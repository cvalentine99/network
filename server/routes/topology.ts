/**
 * Slice 21 — Living Topology: BFF Route
 *
 * POST /api/bff/topology/query   — returns topology payload for a time window
 * GET  /api/bff/topology/fixtures — lists available fixture files (dev/test only)
 *
 * DECONTAMINATION (Slice 28):
 *   - isFixtureMode() gate added: live mode returns explicit 503 LIVE_NOT_IMPLEMENTED
 *   - Sentinel routing removed from production: only available when NODE_ENV !== 'production'
 *   - Fixture listing endpoint gated behind NODE_ENV !== 'production'
 *   - No fixture file is ever loaded when EH_HOST + EH_API_KEY are configured
 */

import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TopologyQueryRequestSchema } from '../../shared/topology-validators';

const router = Router();
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'topology');

/**
 * Determine if we are in fixture mode (no live ExtraHop configured).
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

const isDev = process.env.NODE_ENV !== 'production';

// ─── Sentinel Map (dev/test only) ─────────────────────────────────
// Only used in fixture mode AND non-production environments.
const SENTINEL_MAP: Record<number, string> = {
  1: 'topology.quiet.fixture.json',
  2: 'topology.error.fixture.json',
  3: 'topology.transport-error.fixture.json',
  4: 'topology.malformed.fixture.json',
  5: 'topology.large-scale.fixture.json',
};

// ─── POST /query ───────────────────────────────────────────────────
router.post('/query', (req: Request, res: Response) => {
  const parsed = TopologyQueryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.issues,
    });
    return;
  }

  // ── LIVE MODE GATE ──
  // When EH_HOST + EH_API_KEY are configured, do NOT load fixtures.
  // Return explicit error until real ExtraHop integration is wired.
  if (!isFixtureMode()) {
    res.status(503).json({
      error: 'LIVE_NOT_IMPLEMENTED',
      message: 'Live topology integration not yet implemented. ExtraHop API calls for /api/v1/networks and /api/v1/devices are not wired.',
      code: 'LIVE_NOT_IMPLEMENTED',
    });
    return;
  }

  // ── FIXTURE MODE ──
  const { fromMs } = parsed.data;

  // Sentinel routing: only in dev/test, never in production
  const fixtureName = (isDev && SENTINEL_MAP[fromMs])
    ? SENTINEL_MAP[fromMs]
    : 'topology.populated.fixture.json';

  try {
    const raw = readFileSync(join(FIXTURE_DIR, fixtureName), 'utf-8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: `Failed to load fixture: ${fixtureName}`,
      details: String(err),
    });
  }
});

// ─── GET /fixtures (dev/test only) ────────────────────────────────
// This endpoint is NOT available in production.
router.get('/fixtures', (_req: Request, res: Response) => {
  if (!isDev) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  try {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files, mode: isFixtureMode() ? 'fixture' : 'live' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list fixtures', details: String(err) });
  }
});

export default router;
