/**
 * Slice 21 — Living Topology: BFF Route
 *
 * POST /api/bff/topology/query   — returns topology payload for a time window
 * GET  /api/bff/topology/fixtures — lists available fixture files
 *
 * Sentinel routing (fixture phase):
 *   fromMs === 1         → quiet fixture
 *   fromMs === 2         → error fixture
 *   fromMs === 3         → transport-error fixture
 *   fromMs === 4         → malformed fixture
 *   fromMs === 5         → large-scale fixture (200 nodes)
 *   anything else        → populated fixture (15 nodes)
 *
 * Live integration: deferred by contract.
 */

import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TopologyQueryRequestSchema } from '../../shared/topology-validators';

const router = Router();
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'topology');

// ─── Sentinel Map ──────────────────────────────────────────────────
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

  const { fromMs } = parsed.data;
  const fixtureName = SENTINEL_MAP[fromMs] || 'topology.populated.fixture.json';

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

// ─── GET /fixtures ─────────────────────────────────────────────────
router.get('/fixtures', (_req: Request, res: Response) => {
  try {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list fixtures', details: String(err) });
  }
});

export default router;
