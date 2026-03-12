// server/bff/routes/impact.ts
import { Router, Request, Response } from 'express';
import { ehClient, getApplianceIdentity, initApplianceIdentity } from '../lib/ehClient';
import { bffConfig } from '../config';
import { resolveTimeWindow } from '../lib/timeWindow';
import { bindMetricValues, computeRate, normalizeTotalByObject } from '../lib/normalize';
import { normalizeDevice } from '../lib/normalizeDevice';
import { normalizeDetection, normalizeAlert } from '../lib/normalizeDetection';
import { getCached, setCached, cacheKey } from '../lib/cache';
import { TimeWindowQuerySchema } from '../../../shared/impact-validators';
import type { ImpactOverviewPayload, TopTalkerRow, SeriesPoint } from '../../../shared/impact-types';

export const impactRouter = Router();

/**
 * GET /api/bff/impact/status
 * Returns BFF connection status without hitting ExtraHop
 */
impactRouter.get('/status', (_req: Request, res: Response) => {
  const isConfigured = bffConfig.EH_API_KEY !== 'PLACEHOLDER' && bffConfig.EH_API_KEY.length > 0;
  let identity = null;
  try { identity = getApplianceIdentity(); } catch { /* not initialized yet */ }

  res.json({
    configured: isConfigured,
    connected: identity !== null,
    ehHost: isConfigured ? bffConfig.EH_HOST : null,
    appliance: identity ? {
      version: identity.version,
      edition: identity.edition,
      platform: identity.platform,
      hostname: identity.hostname,
    } : null,
  });
});

/**
 * Ensure appliance identity is initialized before making API calls.
 * Lazy-init on first request if startup init failed or was skipped.
 */
async function ensureApplianceIdentity() {
  try {
    return getApplianceIdentity();
  } catch {
    // Not initialized yet — try now
    return await initApplianceIdentity();
  }
}

/**
 * GET /api/bff/impact/overview
 *
 * Fans out 5 parallel calls to build the landing page payload.
 * Answers: "What is broken?" and "Who is affected?"
 */
impactRouter.get('/overview', async (req: Request, res: Response) => {
  // Guard: check if ExtraHop is configured
  if (bffConfig.EH_API_KEY === 'PLACEHOLDER' || !bffConfig.EH_API_KEY) {
    return res.status(503).json({
      error: 'ExtraHop not configured',
      detail: 'Set EH_HOST and EH_API_KEY environment variables to connect to your ExtraHop appliance.',
      configured: false,
    });
  }

  try {
    const params = TimeWindowQuerySchema.parse(req.query);
    const window = resolveTimeWindow(params.from, params.until, params.cycle);

    // Lazy-init appliance identity
    const identity = await ensureApplianceIdentity();

    // Check cache
    const ck = cacheKey(window, 'impact-overview', ['net-bytes', 'net-pkts']);
    const cacheHit = getCached<ImpactOverviewPayload>(ck);
    if (cacheHit) return res.json(cacheHit);

    const networkSpecs = [{ name: 'bytes' }, { name: 'pkts' }];
    const deviceSpecs = [{ name: 'bytes_in' }, { name: 'bytes_out' }, { name: 'pkts_in' }, { name: 'pkts_out' }];

    const [liveMetrics, totals, topTalkersRaw, detections, alerts] = await Promise.all([
      // 1. Network-level timeseries (last 5 min, 30sec cycle)
      ehClient.post('/api/v1/metrics', {
        cycle: '30sec',
        from: -300000,
        metric_category: 'net',
        metric_specs: networkSpecs,
        object_ids: [0],
        object_type: 'network',
      }),

      // 2. Merged totals for headline (1 hour)
      ehClient.post('/api/v1/metrics/total', {
        cycle: '5min',
        from: -3600000,
        metric_category: 'net',
        metric_specs: networkSpecs,
        object_ids: [0],
        object_type: 'network',
      }),

      // 3. Per-device totals for Top Talkers ranking
      ehClient.post('/api/v1/metrics/totalbyobject', {
        from: -3600000,
        cycle: '5min',
        metric_category: 'net',
        metric_specs: deviceSpecs,
        object_type: 'device',
      }),

      // 4. Recent detections (7 days)
      ehClient.post('/api/v1/detections/search', {
        from: -604800000,
        limit: 50,
      }),

      // 5. Alert configs
      ehClient.get('/api/v1/alerts'),
    ]);

    // ── Normalize timeseries ────────────────────────────────────────────────
    const timeseries: SeriesPoint[] = bindMetricValues(
      liveMetrics.data?.stats || [],
      networkSpecs
    );

    // ── Compute headline from totals ────────────────────────────────────────
    const totalStats = totals.data?.stats?.[0];
    const totalBytes = totalStats?.values?.[0] ?? 0;
    const totalPackets = totalStats?.values?.[1] ?? 0;
    const totalDuration = totalStats?.duration || 3600000;

    // ── Build Top Talkers ───────────────────────────────────────────────────
    const talkerTotals = normalizeTotalByObject(topTalkersRaw.data, deviceSpecs);

    const sortedTalkers = talkerTotals
      .map(t => ({
        ...t,
        totalBytes: (t.values.bytes_in || 0) + (t.values.bytes_out || 0),
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes)
      .slice(0, 20);

    // Batch-fetch device details
    const deviceDetails = await Promise.allSettled(
      sortedTalkers.map(t =>
        ehClient.get(`/api/v1/devices/${t.oid}`)
      )
    );

    const topTalkers: TopTalkerRow[] = sortedTalkers.map((talker, idx) => {
      const deviceResult = deviceDetails[idx];
      const device = deviceResult.status === 'fulfilled'
        ? normalizeDevice(deviceResult.value.data)
        : { id: talker.oid, displayName: `Device ${talker.oid}` } as any;

      return {
        device,
        bytesIn: talker.values.bytes_in || 0,
        bytesOut: talker.values.bytes_out || 0,
        totalBytes: talker.totalBytes,
        pktsIn: talker.values.pkts_in || 0,
        pktsOut: talker.values.pkts_out || 0,
        sparkline: [],
      };
    });

    // ── Assemble payload ────────────────────────────────────────────────────
    const payload: ImpactOverviewPayload = {
      headline: {
        totalBytes,
        totalPackets,
        bytesPerSecond: computeRate(totalBytes, totalDuration) || 0,
        packetsPerSecond: computeRate(totalPackets, totalDuration) || 0,
        baselineDeltaPct: null,
      },
      timeseries,
      topTalkers,
      detections: (detections.data || []).map(normalizeDetection),
      alerts: (alerts.data || []).map(normalizeAlert),
      applianceVersion: identity.version,
      applianceEdition: identity.edition,
      appliancePlatform: identity.platform,
      captureName: identity.captureName,
      licensedModules: identity.licensedModules,
    };

    // Cache for 30 seconds
    setCached(ck, payload, 30000);

    res.json(payload);
  } catch (err: any) {
    console.error('[Impact] Overview failed:', err.message);

    // Distinguish between connection errors and API errors
    const isConnectionError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT';
    const status = isConnectionError ? 503 : 502;

    res.status(status).json({
      error: isConnectionError
        ? 'Cannot reach ExtraHop appliance'
        : 'Failed to fetch Impact overview from ExtraHop',
      detail: err.message,
      configured: true,
    });
  }
});
