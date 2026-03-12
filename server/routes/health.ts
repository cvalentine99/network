/**
 * BFF Health Route — GET /api/bff/health
 *
 * Returns normalized appliance identity and BFF status.
 * In fixture mode (no live appliance configured), returns fixture data.
 * Shape conforms to BffHealthResponse from shared/cockpit-types.ts.
 *
 * Contract: browser calls /api/bff/health, never ExtraHop directly.
 */
import { Router } from 'express';
import type { BffHealthResponse } from '../../shared/cockpit-types';
import { BffHealthResponseSchema } from '../../shared/cockpit-validators';

const healthRouter = Router();

/**
 * Determine if we are in fixture mode.
 * Fixture mode is active when EH_HOST or EH_API_KEY are not configured.
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

healthRouter.get('/', (_req, res) => {
  try {
    const status = isFixtureMode() ? 'not_configured' : 'degraded';

    const response: BffHealthResponse = {
      status,
      bff: {
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cache: { size: 0, maxSize: 500 },
      },
      appliance: null,
      timestamp: new Date().toISOString(),
    };

    // Validate our own output before sending
    const validated = BffHealthResponseSchema.safeParse(response);
    if (!validated.success) {
      return res.status(500).json({
        error: 'Health response failed schema validation',
        details: validated.error.issues,
      });
    }

    return res.json(validated.data);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Health check failed',
      message: err.message || 'Unknown error',
    });
  }
});

export { healthRouter };
