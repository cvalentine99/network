/**
 * Correlation Overlay — BFF Route (Slice 19)
 *
 * CONTRACT:
 * - POST /api/bff/correlation/events — query correlation events for a time window
 * - GET  /api/bff/correlation/fixtures — list available fixture files (dev/test only)
 * - Validates intent via CorrelationIntentSchema
 * - Browser never contacts ExtraHop directly
 * - Returns proper HTTP status codes: 200 for data, 400 for invalid intent, 502 for upstream errors
 *
 * DECONTAMINATION (Slice 28):
 *   - isFixtureMode() gate added: live mode returns explicit 503 LIVE_NOT_IMPLEMENTED
 *   - Sentinel routing removed from production: only available when NODE_ENV !== 'production'
 *   - Fixture listing endpoint gated behind NODE_ENV !== 'production'
 *   - No fixture file is ever loaded when EH_HOST + EH_API_KEY are configured
 */

import { Router, type Request, type Response } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CorrelationIntentSchema } from '../../shared/correlation-validators';

const router = Router();
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'correlation');

/**
 * Determine if we are in fixture mode (no live ExtraHop configured).
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

const isDev = process.env.NODE_ENV !== 'production';

// ─── POST /api/bff/correlation/events ─────────────────────────────────────
router.post('/events', (req: Request, res: Response) => {
  // Validate intent
  const parsed = CorrelationIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: true,
      message: `Invalid correlation intent: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      code: 'INVALID_INTENT',
    });
    return;
  }

  // ── LIVE MODE GATE ──
  // When EH_HOST + EH_API_KEY are configured, do NOT load fixtures.
  // Return explicit error until real ExtraHop integration is wired.
  if (!isFixtureMode()) {
    res.status(503).json({
      error: 'LIVE_NOT_IMPLEMENTED',
      message: 'Live correlation integration not yet implemented. ExtraHop API calls for correlation events are not wired.',
      code: 'LIVE_NOT_IMPLEMENTED',
    });
    return;
  }

  // ── FIXTURE MODE ──
  const intent = parsed.data;

  // Sentinel routing: only in dev/test, never in production
  if (isDev) {
    if (intent.fromMs === 9999999999999) {
      const fixture = loadFixture('correlation.error.fixture.json');
      res.status(502).json(fixture);
      return;
    }

    if (intent.fromMs === 8888888888888) {
      const fixture = loadFixture('correlation.transport-error.fixture.json');
      res.status(504).json(fixture);
      return;
    }

    if (intent.fromMs === 7777777777777) {
      const fixture = loadFixture('correlation.malformed.fixture.json');
      res.status(200).json(fixture);
      return;
    }
  }

  if (intent.fromMs === 0 && intent.untilMs === 0) {
    const fixture = loadFixture('correlation.quiet.fixture.json');
    res.status(200).json(fixture);
    return;
  }

  // Clustered fixture: when categories filter is provided (dev/test only for sentinel matching)
  if (
    isDev &&
    intent.categories &&
    intent.categories.length > 0 &&
    intent.fromMs === 1710000000000 &&
    intent.untilMs === 1710000300000
  ) {
    const fixture = loadFixture('correlation.clustered.fixture.json');
    res.status(200).json(fixture);
    return;
  }

  // Default: populated fixture
  const fixture = loadFixture('correlation.populated.fixture.json');
  res.status(200).json(fixture);
});

// ─── GET /api/bff/correlation/fixtures (dev/test only) ───────────────────
// This endpoint is NOT available in production.
router.get('/fixtures', (_req: Request, res: Response) => {
  if (!isDev) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  try {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files, mode: isFixtureMode() ? 'fixture' : 'live' });
  } catch {
    res.json({ fixtures: [] });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────
function loadFixture(filename: string): unknown {
  const raw = readFileSync(join(FIXTURE_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

export default router;
