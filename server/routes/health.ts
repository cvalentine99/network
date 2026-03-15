/**
 * BFF Health Route — GET /api/bff/health
 *
 * Returns normalized appliance identity and BFF status.
 * Shape conforms to BffHealthResponse from shared/cockpit-types.ts.
 *
 * LIVE INTEGRATION (Slice 29):
 *   - Fixture mode: status = 'not_configured', appliance = null
 *   - Live mode: pings GET /api/v1/extrahop on the configured appliance.
 *     If reachable: status = 'ok', appliance = normalized identity.
 *     If unreachable: status = 'degraded', appliance = null.
 *   - Cache stats from the shared ExtraHop client cache.
 *
 * ExtraHop API call:
 *   GET /api/v1/extrahop
 *   Response shape (from ExtraHop REST API):
 *   {
 *     "version": "9.4.0.1234",
 *     "edition": "Reveal(x) Enterprise",
 *     "platform": "extrahop",
 *     "hostname": "extrahop.lab.local",
 *     "mgmt_ipaddr": "10.1.20.1",
 *     "display_host": "extrahop.lab.local",
 *     "capture_name": "Default",
 *     "capture_mac": "00:1A:2B:3C:4D:5E",
 *     "licensed_modules": ["wire_data", "eda"],
 *     "licensed_options": ["ssl_decryption"],
 *     "process_count": 4,
 *     "services": { "extrahop": { "enabled": true }, "bridge": { "enabled": true } }
 *   }
 *
 * Contract: browser calls /api/bff/health, never ExtraHop directly.
 */
import { Router } from 'express';
import type { BffHealthResponse, ApplianceIdentity } from '../../shared/cockpit-types';
import { BffHealthResponseSchema } from '../../shared/cockpit-validators';
import { ehRequest, isFixtureMode, getCacheStats, ExtraHopClientError } from '../extrahop-client';
import { getEtlStatus } from '../etl-scheduler';

const healthRouter = Router();

/**
 * Normalize the raw ExtraHop /api/v1/extrahop response into ApplianceIdentity.
 * The ExtraHop API uses snake_case; our shared types use camelCase.
 */
function normalizeApplianceIdentity(raw: any): ApplianceIdentity {
  return {
    version: raw.version ?? '',
    edition: raw.edition ?? '',
    platform: raw.platform ?? '',
    hostname: raw.hostname ?? '',
    mgmtIpaddr: raw.mgmt_ipaddr ?? raw.mgmtIpaddr ?? '',
    displayHost: raw.display_host ?? raw.displayHost ?? '',
    captureName: raw.capture_name ?? raw.captureName ?? '',
    captureMac: raw.capture_mac ?? raw.captureMac ?? '',
    licensedModules: Array.isArray(raw.licensed_modules)
      ? raw.licensed_modules
      : Array.isArray(raw.licensedModules)
        ? raw.licensedModules
        : [],
    licensedOptions: Array.isArray(raw.licensed_options)
      ? raw.licensed_options
      : Array.isArray(raw.licensedOptions)
        ? raw.licensedOptions
        : [],
    processCount: typeof raw.process_count === 'number'
      ? raw.process_count
      : typeof raw.processCount === 'number'
        ? raw.processCount
        : 0,
    services: raw.services && typeof raw.services === 'object'
      ? raw.services
      : {},
  };
}

healthRouter.get('/', async (_req, res) => {
  try {
    const cacheStats = getCacheStats();

    const etlStatus = getEtlStatus();

    // ── FIXTURE MODE ──
    if (isFixtureMode()) {
      const response: BffHealthResponse = {
        status: 'not_configured',
        bff: {
          uptime: process.uptime(),
          memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          cache: { size: cacheStats.size, maxSize: cacheStats.maxSize },
        },
        appliance: null,
        etl: etlStatus.running ? etlStatus : null,
        timestamp: new Date().toISOString(),
      };

      const validated = BffHealthResponseSchema.safeParse(response);
      if (!validated.success) {
        return res.status(500).json({
          error: 'Health response failed schema validation',
          details: validated.error.issues,
        });
      }
      return res.json(validated.data);
    }

    // ── LIVE MODE ──
    // Attempt a lightweight probe to GET /api/v1/extrahop
    let appliance: ApplianceIdentity | null = null;
    let status: 'ok' | 'degraded' = 'degraded';

    try {
      const probeResult = await ehRequest<any>({
        method: 'GET',
        path: '/api/v1/extrahop',
        cacheTtlMs: 30_000, // Cache appliance identity for 30s
        timeoutMs: 10_000,
      });

      if (probeResult.ok && probeResult.data) {
        appliance = normalizeApplianceIdentity(probeResult.data);
        status = 'ok';
      }
    } catch (err) {
      // Appliance unreachable — status stays 'degraded', appliance stays null
      // This is honest: we tried and failed.
      if (err instanceof ExtraHopClientError) {
        console.warn(`[health] Appliance probe failed: ${err.code} — ${err.message}`);
      }
    }

    const response: BffHealthResponse = {
      status,
      bff: {
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cache: { size: cacheStats.size, maxSize: cacheStats.maxSize },
      },
      appliance,
      etl: etlStatus.running ? etlStatus : null,
      timestamp: new Date().toISOString(),
    };

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
