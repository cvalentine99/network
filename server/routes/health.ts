/**
 * BFF Health Route — GET /api/bff/health
 *
 * Returns normalized appliance identity and BFF status.
 * Shape conforms to BffHealthResponse from shared/cockpit-types.ts.
 *
 * DECONTAMINATION (Slice 28):
 *   - Fixture mode: status = 'not_configured', appliance = null
 *   - Live mode: status = 'ok' (we can reach the BFF; actual ExtraHop
 *     reachability is NOT tested here because no live API calls are wired yet).
 *     When live ExtraHop integration is wired, this route should attempt a
 *     lightweight ping to the appliance and return 'degraded' if it fails.
 *   - Removed hardcoded 'degraded' — that was dishonest because we never
 *     actually tested appliance reachability.
 *   - cache.size and cache.maxSize report 0 because no BFF cache is
 *     implemented yet. Previously hardcoded maxSize: 500 was fake.
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
    // In fixture mode: not_configured.
    // In live mode: 'ok' because the BFF itself is running.
    // NOTE: When ExtraHop API integration is wired, this should attempt
    // a lightweight appliance ping and return 'degraded' if unreachable.
    // Until then, 'ok' means "BFF is running and credentials are configured"
    // — it does NOT mean "ExtraHop appliance is reachable and responding."
    const status = isFixtureMode() ? 'not_configured' : 'ok';

    const response: BffHealthResponse = {
      status,
      bff: {
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        // No BFF cache is implemented. Report zeros honestly.
        cache: { size: 0, maxSize: 0 },
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
