/**
 * Correlation Overlay — BFF Route (Slice 19)
 *
 * CONTRACT:
 * - POST /api/bff/correlation/events — query correlation events for a time window
 * - GET  /api/bff/correlation/fixtures — list available fixture files
 * - Validates intent via CorrelationIntentSchema
 * - Routes to fixtures via sentinel values in the time window:
 *   - fromMs=1710000000000, untilMs=1710000300000 → populated
 *   - fromMs=0, untilMs=0 → quiet
 *   - fromMs=9999999999999 → error
 *   - fromMs=8888888888888 → transport-error
 *   - fromMs=7777777777777 → malformed
 *   - fromMs=1710000000000, untilMs=1710000300000 + categories=['detection','alert','config_change'] → clustered
 * - Browser never contacts ExtraHop directly
 * - Returns proper HTTP status codes: 200 for data, 400 for invalid intent, 502 for upstream errors
 */

import { Router, type Request, type Response } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { CorrelationIntentSchema } from '../../shared/correlation-validators';

const router = Router();
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'correlation');

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

  const intent = parsed.data;

  // Sentinel routing
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

  if (intent.fromMs === 0 && intent.untilMs === 0) {
    const fixture = loadFixture('correlation.quiet.fixture.json');
    res.status(200).json(fixture);
    return;
  }

  // Clustered fixture: when categories filter is provided
  if (
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

// ─── GET /api/bff/correlation/fixtures ────────────────────────────────────
router.get('/fixtures', (_req: Request, res: Response) => {
  try {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files });
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
