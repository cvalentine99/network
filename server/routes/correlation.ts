/**
 * Slice 22 — Correlation Timeline: BFF Route
 *
 * POST /api/bff/correlation/events  — returns correlated events for a time window
 * GET  /api/bff/correlation/fixtures — lists available fixture files (dev/test only)
 *
 * LIVE MODE:
 *   - GET /api/v1/detections → detections with participants, risk scores
 *   - GET /api/v1/alerts → configured alerts
 *   - Normalizes both into a unified CorrelationEvent stream
 *   - Computes categoryCounts from the event stream
 *
 * FIXTURE MODE:
 *   - Loads deterministic fixture files from fixtures/correlation/
 *   - Sentinel routing available in dev/test only
 */

import { Router, type Request, type Response } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CorrelationIntentSchema, CorrelationPayloadSchema } from '../../shared/correlation-validators';
import { ehRequest, isFixtureMode, ExtraHopClientError } from '../extrahop-client';

const router = Router();
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'correlation');

// ─── Sentinel Map (dev/test only) ─────────────────────────────────
// These are only used in fixture mode + dev environment
const SENTINEL_MAP: Record<number, { file: string; status: number }> = {
  9999999999999: { file: 'correlation.error.fixture.json', status: 502 },
  8888888888888: { file: 'correlation.transport-error.fixture.json', status: 504 },
  7777777777777: { file: 'correlation.malformed.fixture.json', status: 200 },
};

// ─── Severity Mapping ──────────────────────────────────────────────
function mapSeverity(riskScore: number | null | undefined): string {
  if (riskScore == null) return 'info';
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  if (riskScore >= 20) return 'low';
  return 'info';
}

// ─── POST /events ──────────────────────────────────────────────────
router.post('/events', async (req: Request, res: Response) => {
  const parsed = CorrelationIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: true,
      message: `Invalid correlation intent: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      code: 'INVALID_INTENT',
    });
    return;
  }

  // ── FIXTURE MODE ──
  if (await isFixtureMode()) {
    const intent = parsed.data;
    const fromMs = intent.fromMs;

    // Sentinel routing: only in dev/test, never in production
    if ((await isFixtureMode()) && SENTINEL_MAP[fromMs]) {
      const sentinel = SENTINEL_MAP[fromMs];
      const fixture = loadFixture(sentinel.file);
      res.status(sentinel.status).json(fixture);
      return;
    }

    // Quiet state
    const untilMs = intent.untilMs;
    if (fromMs === 0 && untilMs === 0) {
      const fixture = loadFixture('correlation.quiet.fixture.json');
      res.status(200).json(fixture);
      return;
    }

    // Clustered fixture (dev/test only)
    if (
      (await isFixtureMode()) &&
      intent.categories &&
      intent.categories.length > 0 &&
      fromMs === 1710000000000 &&
      intent.untilMs === 1710000300000
    ) {
      const fixture = loadFixture('correlation.clustered.fixture.json');
      res.status(200).json(fixture);
      return;
    }

    // Default: populated fixture
    const fixture = loadFixture('correlation.populated.fixture.json');
    res.status(200).json(fixture);
    return;
  }

  // ── LIVE MODE ──
  const intent = parsed.data;
  const fromMs = intent.fromMs;
  const untilMs = intent.untilMs;

  if (!fromMs || !untilMs) {
    res.status(400).json({
      error: 'Missing time window',
      message: 'fromMs and untilMs are required',
    });
    return;
  }

  try {
    const events: any[] = [];
    const categoryCounts: Record<string, number> = {};
    const categories = intent.categories;

    // 1. Fetch detections if category filter includes 'detection' or no filter
    const wantDetections = !categories || categories.length === 0 || categories.includes('detection');
    if (wantDetections) {
      const detectionsResp = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/detections?from=${fromMs}&until=${untilMs}`,
        cacheTtlMs: 30_000,
      });

      const rawDetections = Array.isArray(detectionsResp.data) ? detectionsResp.data : [];
      let detCount = 0;

      for (const det of rawDetections) {
        const timestampMs = det.start_time ?? det.mod_time ?? fromMs;
        const endTime = det.end_time ?? det.update_time ?? timestampMs;
        const durationMs = endTime > timestampMs ? endTime - timestampMs : 0;
        const riskScore = typeof det.risk_score === 'number' ? det.risk_score : null;

        // Build source from first participant
        let source: any = { kind: 'appliance', displayName: 'ExtraHop', id: 1 };
        if (Array.isArray(det.participants) && det.participants.length > 0) {
          const p = det.participants[0];
          if (p.object_type === 'device') {
            source = {
              kind: 'device',
              displayName: p.hostname || p.object_value || `Device ${p.object_id}`,
              id: p.object_id,
            };
          }
        }

        // Build refs
        const refs: any[] = [
          { kind: 'detection', id: `det-${det.id}`, label: `Detection #${det.id}` },
        ];
        if (source.kind === 'device') {
          refs.push({ kind: 'device', id: source.id, label: source.displayName });
        }

        events.push({
          id: `det-${det.id}`,
          category: 'detection',
          title: det.title || det.type || 'Unknown Detection',
          description: det.description || '',
          timestampMs,
          timestampIso: new Date(timestampMs).toISOString(),
          durationMs,
          severity: mapSeverity(riskScore),
          riskScore,
          source,
          refs,
        });
        detCount++;
      }
      categoryCounts['detection'] = detCount;
    }

    // 2. Fetch alerts if category filter includes 'alert' or no filter
    const wantAlerts = !categories || categories.length === 0 || categories.includes('alert');
    if (wantAlerts) {
      const alertsResp = await ehRequest<any[]>({
        method: 'GET',
        path: '/api/v1/alerts',
        cacheTtlMs: 60_000,
      });

      const rawAlerts = Array.isArray(alertsResp.data) ? alertsResp.data : [];
      let alertCount = 0;

      for (const alert of rawAlerts) {
        if (alert.disabled) continue;

        const timestampMs = alert.mod_time ?? alert.create_time ?? fromMs;

        events.push({
          id: `alert-${alert.id}`,
          category: 'alert',
          title: alert.name || 'Unknown Alert',
          description: alert.description || '',
          timestampMs,
          timestampIso: new Date(timestampMs).toISOString(),
          durationMs: 0,
          severity: mapSeverity(alert.severity ?? 50),
          riskScore: null,
          source: {
            kind: 'appliance',
            displayName: 'ExtraHop',
            id: 1,
          },
          refs: [
            { kind: 'alert', id: `alert-${alert.id}`, label: `Alert #${alert.id}` },
          ],
        });
        alertCount++;
      }
      categoryCounts['alert'] = alertCount;
    }

    // 3. Sort events by timestamp descending
    events.sort((a, b) => b.timestampMs - a.timestampMs);

    // 4. Validate output with Zod before sending (audit H1)
    const rawPayload = {
      events,
      timeWindow: { fromMs, untilMs },
      categoryCounts,
      totalCount: events.length,
    };

    const payloadValidation = CorrelationPayloadSchema.safeParse(rawPayload);
    if (!payloadValidation.success) {
      console.error('[correlation] Output validation failed:', payloadValidation.error.issues);
      res.status(500).json({
        error: 'Correlation output validation failed',
        message: payloadValidation.error.issues.map(i => i.message).join('; '),
      });
      return;
    }

    res.json(payloadValidation.data);
  } catch (err: unknown) {
    if (err instanceof ExtraHopClientError) {
      res.status(502).json({
        error: 'ExtraHop API error',
        message: err.message,
        code: err.code,
      });
      return;
    }
    res.status(500).json({
      error: 'Correlation fetch failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// ─── GET /fixtures (dev/test only) ────────────────────────────────
router.get('/fixtures', async (_req: Request, res: Response) => {
  if (!(await isFixtureMode())) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  try {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files, mode: (await isFixtureMode()) ? 'fixture' : 'live' });
  } catch {
    res.json({ fixtures: [] });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────
function loadFixture(filename: string): unknown {
  // BE-H4: Wrap in try/catch to avoid leaking raw filesystem errors
  try {
    const raw = readFileSync(join(FIXTURE_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to load fixture "${filename}": ${msg}`);
  }
}

export default router;
