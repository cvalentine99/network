/**
 * BFF Impact Routes — /api/bff/impact/*
 *
 * LIVE INTEGRATION (Slice 29):
 *   - All routes now call ExtraHop REST API when EH_HOST + EH_API_KEY are configured
 *   - Responses are normalized through shared types and validated by Zod schemas
 *   - Fixture mode still works for development/testing
 *   - Sentinel ID routing gated behind NODE_ENV !== 'production'
 *   - TTL cache applied to expensive metric queries (30s default)
 */
import { Router } from 'express';
import {
  TimeWindowQuerySchema,
  ImpactHeadlineSchema,
  SeriesPointSchema,
  TopTalkerRowSchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
  ApplianceStatusSchema,
  DeviceDetailSchema,
  DetectionDetailSchema,
  AlertDetailSchema,
} from '../../shared/cockpit-validators';
import { z } from 'zod';
import { resolveTimeWindow } from '../../shared/normalize';
import type { ImpactOverviewPayload } from '../../shared/cockpit-types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getApplianceConfig } from '../db';
import { ehRequest, ExtraHopClientError } from '../extrahop-client';
import {
  normalizeHeadline,
  normalizeTimeseries,
  normalizeDeviceIdentity,
  normalizeDetection,
  normalizeAlert,
  normalizeApplianceStatus,
  buildMetricsRequest,
} from '../extrahop-normalizers';

const impactRouter = Router();

const isDev = process.env.NODE_ENV !== 'production';

// ─── Cache TTLs ───────────────────────────────────────────────────────
const METRICS_CACHE_TTL = 30_000;   // 30s for metric queries
const DEVICE_CACHE_TTL = 60_000;    // 60s for device lists
const DETECTION_CACHE_TTL = 30_000; // 30s for detections
const ALERT_CACHE_TTL = 60_000;     // 60s for alert configs
const APPLIANCE_CACHE_TTL = 120_000; // 2min for appliance identity

/**
 * Determine if we are in fixture mode.
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

/**
 * Format ExtraHop client errors into HTTP responses.
 */
function handleEhError(res: any, err: any, route: string) {
  if (err instanceof ExtraHopClientError) {
    const status = err.code === 'NO_CONFIG' ? 503
      : err.code === 'TIMEOUT' ? 504
      : err.code === 'NETWORK_ERROR' ? 502
      : err.httpStatus >= 400 ? err.httpStatus
      : 502;
    return res.status(status).json({
      error: `ExtraHop ${route} API error`,
      message: err.message,
      code: err.code,
    });
  }
  return res.status(500).json({
    error: `Impact ${route} fetch failed`,
    message: err.message || 'Unknown error',
  });
}

// ─── Fixture loaders ──────────────────────────────────────────────────
function loadImpactFixture(name: string): ImpactOverviewPayload | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'impact', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw) as ImpactOverviewPayload;
  } catch {
    return null;
  }
}

function loadTopTalkersFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'top-talkers', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadDetectionsFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'detections', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadAlertsFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'alerts', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadApplianceStatusFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'appliance-status', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadDeviceDetailFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'device-detail', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadDetectionDetailFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'detection-detail', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadAlertDetailFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'alert-detail', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /headline ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/headline', async (req, res) => {
  try {
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      const metricsBody = buildMetricsRequest({
        from: timeWindow.fromMs,
        until: timeWindow.untilMs,
        cycle: timeWindow.cycle,
        metricCategory: 'net',
        metricSpecs: [
          { name: 'bytes_in' },
          { name: 'bytes_out' },
          { name: 'pkts_in' },
          { name: 'pkts_out' },
        ],
        objectType: 'network',
        objectIds: [0],
      });

      const response = await ehRequest<any>({
        method: 'POST',
        path: '/api/v1/metrics',
        body: metricsBody,
        cacheTtlMs: METRICS_CACHE_TTL,
      });

      const rawStats = Array.isArray(response.data?.stats) ? response.data.stats : [];
      const headline = normalizeHeadline(rawStats, timeWindow.durationMs);

      const validation = ImpactHeadlineSchema.safeParse(headline);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed headline data',
          message: 'Headline data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ headline: validation.data, timeWindow });
    }

    // ── FIXTURE MODE ──
    const fixtureName = timeWindow.durationMs > 0
      ? 'impact-overview.populated.fixture.json'
      : 'impact-overview.quiet.fixture.json';

    const fixture = loadImpactFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const headlineResult = ImpactHeadlineSchema.safeParse(fixture.headline);
    if (!headlineResult.success) {
      return res.status(502).json({
        error: 'Malformed headline data',
        message: 'Headline data from source failed schema validation',
        details: headlineResult.error.issues,
      });
    }

    return res.json({ headline: headlineResult.data, timeWindow });
  } catch (err: any) {
    return handleEhError(res, err, 'headline');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /timeseries ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/timeseries', async (req, res) => {
  try {
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      const metricsBody = buildMetricsRequest({
        from: timeWindow.fromMs,
        until: timeWindow.untilMs,
        cycle: timeWindow.cycle,
        metricCategory: 'net',
        metricSpecs: [
          { name: 'bytes_in' },
          { name: 'bytes_out' },
          { name: 'pkts_in' },
          { name: 'pkts_out' },
        ],
        objectType: 'network',
        objectIds: [0],
      });

      const response = await ehRequest<any>({
        method: 'POST',
        path: '/api/v1/metrics',
        body: metricsBody,
        cacheTtlMs: METRICS_CACHE_TTL,
      });

      const rawStats = Array.isArray(response.data?.stats) ? response.data.stats : [];
      const timeseries = normalizeTimeseries(rawStats);

      const timeseriesArray = z.array(SeriesPointSchema);
      const validation = timeseriesArray.safeParse(timeseries);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed timeseries data',
          message: 'Timeseries data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ timeseries: validation.data, timeWindow });
    }

    // ── FIXTURE MODE ──
    const fixtureName = timeWindow.durationMs > 0
      ? 'impact-overview.populated.fixture.json'
      : 'impact-overview.quiet.fixture.json';

    const fixture = loadImpactFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const timeseriesArray = z.array(SeriesPointSchema);
    const validation = timeseriesArray.safeParse(fixture.timeseries);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed timeseries data',
        message: 'Timeseries data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ timeseries: validation.data, timeWindow });
  } catch (err: any) {
    return handleEhError(res, err, 'timeseries');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /top-talkers ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/top-talkers', async (req, res) => {
  try {
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      // Step 1: Get per-device metrics with top_n
      const metricsBody = buildMetricsRequest({
        from: timeWindow.fromMs,
        until: timeWindow.untilMs,
        cycle: timeWindow.cycle,
        metricCategory: 'net_detail',
        metricSpecs: [
          { name: 'bytes_in' },
          { name: 'bytes_out' },
          { name: 'pkts_in' },
          { name: 'pkts_out' },
        ],
        objectType: 'device',
        objectIds: [0], // 0 = all devices
        topN: 10,
      });

      const metricsResponse = await ehRequest<any>({
        method: 'POST',
        path: '/api/v1/metrics',
        body: metricsBody,
        cacheTtlMs: METRICS_CACHE_TTL,
      });

      // The response contains per-device stats grouped by xid (device ID)
      const rawStats = Array.isArray(metricsResponse.data?.stats) ? metricsResponse.data.stats : [];

      // Group stats by device ID (xid field)
      const deviceStatsMap = new Map<number, { bytesIn: number; bytesOut: number; pktsIn: number; pktsOut: number; sparkline: any[] }>();

      for (const stat of rawStats) {
        const deviceId = stat.oid ?? stat.xid ?? 0;
        if (!deviceStatsMap.has(deviceId)) {
          deviceStatsMap.set(deviceId, { bytesIn: 0, bytesOut: 0, pktsIn: 0, pktsOut: 0, sparkline: [] });
        }
        const entry = deviceStatsMap.get(deviceId)!;
        const vals = Array.isArray(stat.values) ? stat.values : [];
        entry.bytesIn += typeof vals[0] === 'number' && Number.isFinite(vals[0]) ? vals[0] : 0;
        entry.bytesOut += typeof vals[1] === 'number' && Number.isFinite(vals[1]) ? vals[1] : 0;
        entry.pktsIn += typeof vals[2] === 'number' && Number.isFinite(vals[2]) ? vals[2] : 0;
        entry.pktsOut += typeof vals[3] === 'number' && Number.isFinite(vals[3]) ? vals[3] : 0;

        const t = typeof stat.time === 'number' ? stat.time : 0;
        const dur = typeof stat.duration === 'number' ? stat.duration : 1;
        entry.sparkline.push({
          t,
          tIso: new Date(t).toISOString(),
          durationMs: dur,
          values: {
            bytes: (typeof vals[0] === 'number' ? vals[0] : 0) + (typeof vals[1] === 'number' ? vals[1] : 0),
          },
        });
      }

      // Step 2: Fetch device identity for each device
      const deviceIds = Array.from(deviceStatsMap.keys());
      const topTalkers = [];

      for (const deviceId of deviceIds) {
        try {
          const deviceResponse = await ehRequest<any>({
            method: 'GET',
            path: `/api/v1/devices/${deviceId}`,
            cacheTtlMs: DEVICE_CACHE_TTL,
          });

          const device = normalizeDeviceIdentity(deviceResponse.data);
          const stats = deviceStatsMap.get(deviceId)!;

          topTalkers.push({
            device,
            bytesIn: stats.bytesIn,
            bytesOut: stats.bytesOut,
            totalBytes: stats.bytesIn + stats.bytesOut,
            pktsIn: stats.pktsIn,
            pktsOut: stats.pktsOut,
            sparkline: stats.sparkline.sort((a: any, b: any) => a.t - b.t),
          });
        } catch {
          // Skip devices we can't resolve — don't block the whole response
          continue;
        }
      }

      // Sort by totalBytes descending
      topTalkers.sort((a, b) => b.totalBytes - a.totalBytes);

      const topTalkersArray = z.array(TopTalkerRowSchema);
      const validation = topTalkersArray.safeParse(topTalkers);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed top talkers data',
          message: 'Top talkers data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ topTalkers: validation.data, timeWindow });
    }

    // ── FIXTURE MODE ──
    const fixtureName = timeWindow.durationMs > 0
      ? 'top-talkers.populated.fixture.json'
      : 'top-talkers.quiet.fixture.json';

    const fixture = loadTopTalkersFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const topTalkersArray = z.array(TopTalkerRowSchema);
    const validation = topTalkersArray.safeParse(fixture.topTalkers);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed top talkers data',
        message: 'Top talkers data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ topTalkers: validation.data, timeWindow });
  } catch (err: any) {
    return handleEhError(res, err, 'top-talkers');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /detections ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/detections', async (req, res) => {
  try {
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      // GET /api/v1/detections with time filter
      const response = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/detections?from=${timeWindow.fromMs}&until=${timeWindow.untilMs}&limit=100`,
        cacheTtlMs: DETECTION_CACHE_TTL,
      });

      const rawDetections = Array.isArray(response.data) ? response.data : [];
      const detections = rawDetections.map(normalizeDetection);

      const detectionsArray = z.array(NormalizedDetectionSchema);
      const validation = detectionsArray.safeParse(detections);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed detections data',
          message: 'Detections data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ detections: validation.data, timeWindow });
    }

    // ── FIXTURE MODE ──
    const fixtureName = timeWindow.durationMs > 0
      ? 'detections.populated.fixture.json'
      : 'detections.quiet.fixture.json';

    const fixture = loadDetectionsFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const detectionsArray = z.array(NormalizedDetectionSchema);
    const validation = detectionsArray.safeParse(fixture.detections);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed detections data',
        message: 'Detections data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ detections: validation.data, timeWindow });
  } catch (err: any) {
    return handleEhError(res, err, 'detections');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /alerts ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/alerts', async (req, res) => {
  try {
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      // GET /api/v1/alerts — returns all configured alerts (not time-filtered)
      const response = await ehRequest<any[]>({
        method: 'GET',
        path: '/api/v1/alerts',
        cacheTtlMs: ALERT_CACHE_TTL,
      });

      const rawAlerts = Array.isArray(response.data) ? response.data : [];
      const alerts = rawAlerts.map(normalizeAlert);

      const alertsArray = z.array(NormalizedAlertSchema);
      const validation = alertsArray.safeParse(alerts);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed alerts data',
          message: 'Alerts data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ alerts: validation.data, timeWindow });
    }

    // ── FIXTURE MODE ──
    const fixtureName = timeWindow.durationMs > 0
      ? 'alerts.populated.fixture.json'
      : 'alerts.quiet.fixture.json';

    const fixture = loadAlertsFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const alertsArray = z.array(NormalizedAlertSchema);
    const validation = alertsArray.safeParse(fixture.alerts);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed alerts data',
        message: 'Alerts data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ alerts: validation.data, timeWindow });
  } catch (err: any) {
    return handleEhError(res, err, 'alerts');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /appliance-status ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/appliance-status', async (_req, res) => {
  try {
    const dbConfig = await getApplianceConfig().catch(() => null);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      try {
        // Probe the appliance for real metadata
        const ehResponse = await ehRequest<any>({
          method: 'GET',
          path: '/api/v1/extrahop',
          cacheTtlMs: APPLIANCE_CACHE_TTL,
        });

        const status = normalizeApplianceStatus(ehResponse.data, 'connected');

        // Override hostname from DB config if available (user may have set a nickname)
        if (dbConfig && dbConfig.hostname) {
          status.hostname = dbConfig.hostname.split('.')[0];
          status.displayHost = dbConfig.nickname
            ? `${dbConfig.hostname} (${dbConfig.nickname})`
            : dbConfig.hostname;
        }

        const validation = ApplianceStatusSchema.safeParse(status);
        if (!validation.success) {
          return res.status(502).json({
            error: 'Malformed appliance status data',
            message: 'Appliance status from ExtraHop failed schema validation',
            details: validation.error.issues,
          });
        }
        return res.json({ applianceStatus: validation.data });
      } catch (ehErr: any) {
        // Appliance unreachable — return error status with DB-known fields
        if (dbConfig && dbConfig.hostname) {
          const errorStatus = {
            hostname: dbConfig.hostname.split('.')[0],
            displayHost: dbConfig.nickname
              ? `${dbConfig.hostname} (${dbConfig.nickname})`
              : dbConfig.hostname,
            version: 'unknown',
            edition: 'unknown',
            platform: 'unknown',
            mgmtIpaddr: 'unknown',
            captureStatus: 'unknown' as const,
            captureInterface: 'unknown',
            licenseStatus: 'unknown' as const,
            licensedModules: [] as string[],
            uptimeSeconds: 0,
            connectionStatus: 'error' as const,
            lastChecked: new Date().toISOString(),
          };

          const validation = ApplianceStatusSchema.safeParse(errorStatus);
          if (validation.success) {
            return res.json({ applianceStatus: validation.data });
          }
        }
        return handleEhError(res, ehErr, 'appliance-status');
      }
    }

    // ── FIXTURE MODE ──
    if (dbConfig && dbConfig.hostname) {
      const fixtureFile = dbConfig.lastTestResult === 'success'
        ? 'appliance-status.populated.fixture.json'
        : 'appliance-status.quiet.fixture.json';
      const fixture = loadApplianceStatusFixture(fixtureFile);

      if (fixture) {
        const status = {
          ...fixture.applianceStatus,
          hostname: dbConfig.hostname.split('.')[0],
          displayHost: dbConfig.nickname
            ? `${dbConfig.hostname} (${dbConfig.nickname})`
            : dbConfig.hostname,
          uptimeSeconds: Math.round(process.uptime()),
          lastChecked: new Date().toISOString(),
          connectionStatus: dbConfig.lastTestResult === 'success' ? 'connected' as const
            : dbConfig.lastTestResult === 'failure' ? 'error' as const
            : 'not_configured' as const,
        };

        const validation = ApplianceStatusSchema.safeParse(status);
        if (!validation.success) {
          return res.status(502).json({
            error: 'Malformed appliance status data',
            message: 'Appliance status data from DB config failed schema validation',
            details: validation.error.issues,
          });
        }
        return res.json({ applianceStatus: validation.data });
      }
    }

    // Fixture mode, no DB config — quiet
    const fixture = loadApplianceStatusFixture('appliance-status.quiet.fixture.json');
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: 'Could not load fixture: appliance-status.quiet.fixture.json',
      });
    }

    const status = {
      ...fixture.applianceStatus,
      uptimeSeconds: Math.round(process.uptime()),
      lastChecked: new Date().toISOString(),
    };

    const validation = ApplianceStatusSchema.safeParse(status);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed appliance status data',
        message: 'Appliance status data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ applianceStatus: validation.data });
  } catch (err: any) {
    return handleEhError(res, err, 'appliance-status');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /device-detail ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/device-detail', async (req, res) => {
  try {
    const idParam = req.query.id;
    if (!idParam || isNaN(Number(idParam))) {
      return res.status(400).json({
        error: 'Invalid device ID',
        message: 'Query param "id" must be a numeric device ID',
      });
    }

    const deviceId = Number(idParam);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      // Step 1: Get device identity
      const deviceResponse = await ehRequest<any>({
        method: 'GET',
        path: `/api/v1/devices/${deviceId}`,
        cacheTtlMs: DEVICE_CACHE_TTL,
      });

      const device = normalizeDeviceIdentity(deviceResponse.data);

      // Step 2: Get device traffic metrics
      const now = Date.now();
      const metricsBody = buildMetricsRequest({
        from: now - 300_000, // last 5 minutes
        until: now,
        metricCategory: 'net',
        metricSpecs: [
          { name: 'bytes_in' },
          { name: 'bytes_out' },
          { name: 'pkts_in' },
          { name: 'pkts_out' },
        ],
        objectType: 'device',
        objectIds: [deviceId],
      });

      const metricsResponse = await ehRequest<any>({
        method: 'POST',
        path: '/api/v1/metrics',
        body: metricsBody,
        cacheTtlMs: METRICS_CACHE_TTL,
      });

      const rawStats = Array.isArray(metricsResponse.data?.stats) ? metricsResponse.data.stats : [];
      let bytesIn = 0, bytesOut = 0, pktsIn = 0, pktsOut = 0;
      for (const stat of rawStats) {
        const vals = Array.isArray(stat.values) ? stat.values : [];
        bytesIn += typeof vals[0] === 'number' && Number.isFinite(vals[0]) ? vals[0] : 0;
        bytesOut += typeof vals[1] === 'number' && Number.isFinite(vals[1]) ? vals[1] : 0;
        pktsIn += typeof vals[2] === 'number' && Number.isFinite(vals[2]) ? vals[2] : 0;
        pktsOut += typeof vals[3] === 'number' && Number.isFinite(vals[3]) ? vals[3] : 0;
      }

      // Step 3: Get associated detections for this device
      let associatedDetections: any[] = [];
      try {
        const detectionsResponse = await ehRequest<any[]>({
          method: 'GET',
          path: `/api/v1/detections?from=${now - 86400000}&until=${now}&limit=20`,
          cacheTtlMs: DETECTION_CACHE_TTL,
        });
        const allDetections = Array.isArray(detectionsResponse.data) ? detectionsResponse.data : [];
        // Filter to detections involving this device
        associatedDetections = allDetections
          .filter((d: any) => {
            const participants = Array.isArray(d.participants) ? d.participants : [];
            return participants.some((p: any) => p.object_id === deviceId);
          })
          .map(normalizeDetection);
      } catch {
        // Non-fatal — return empty detections
      }

      // Step 4: Get associated alerts (all alerts, filter is optional)
      let associatedAlerts: any[] = [];
      try {
        const alertsResponse = await ehRequest<any[]>({
          method: 'GET',
          path: '/api/v1/alerts',
          cacheTtlMs: ALERT_CACHE_TTL,
        });
        associatedAlerts = Array.isArray(alertsResponse.data)
          ? alertsResponse.data.map(normalizeAlert)
          : [];
      } catch {
        // Non-fatal — return empty alerts
      }

      const deviceDetail = {
        device,
        traffic: {
          bytesIn,
          bytesOut,
          totalBytes: bytesIn + bytesOut,
          pktsIn,
          pktsOut,
        },
        protocols: [], // ExtraHop doesn't have a direct protocol breakdown endpoint
        associatedDetections,
        associatedAlerts,
        activitySummary: {
          firstSeen: device.discoverTimeIso,
          lastSeen: device.lastSeenIso,
          totalProtocols: 0,
          totalConnections: 0,
          peakThroughputBps: null,
        },
      };

      const validation = DeviceDetailSchema.safeParse(deviceDetail);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed device detail data',
          message: 'Device detail data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ deviceDetail: validation.data });
    }

    // ── FIXTURE MODE ──
    let fixtureName: string;
    if (isDev && deviceId === 1042) {
      fixtureName = 'device-detail.populated.fixture.json';
    } else if (isDev && deviceId === 9999) {
      fixtureName = 'device-detail.not-found.fixture.json';
    } else {
      fixtureName = 'device-detail.quiet.fixture.json';
    }

    const fixture = loadDeviceDetailFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const validation = DeviceDetailSchema.safeParse(fixture.deviceDetail);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed device detail data',
        message: 'Device detail data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ deviceDetail: validation.data });
  } catch (err: any) {
    return handleEhError(res, err, 'device-detail');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /detection-detail ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/detection-detail', async (req, res) => {
  try {
    const idParam = req.query.id;
    if (!idParam || isNaN(Number(idParam))) {
      return res.status(400).json({
        error: 'Invalid detection ID',
        message: 'Query param "id" must be a numeric detection ID',
      });
    }

    const detectionId = Number(idParam);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      // Get the detection
      const detectionResponse = await ehRequest<any>({
        method: 'GET',
        path: `/api/v1/detections/${detectionId}`,
        cacheTtlMs: DETECTION_CACHE_TTL,
      });

      const detection = normalizeDetection(detectionResponse.data);

      // Get related devices from participants
      const relatedDevices: any[] = [];
      const participants = Array.isArray(detectionResponse.data?.participants)
        ? detectionResponse.data.participants
        : [];

      for (const p of participants) {
        if (p.object_type === 'device' && p.object_id) {
          try {
            const deviceResponse = await ehRequest<any>({
              method: 'GET',
              path: `/api/v1/devices/${p.object_id}`,
              cacheTtlMs: DEVICE_CACHE_TTL,
            });
            relatedDevices.push(normalizeDeviceIdentity(deviceResponse.data));
          } catch {
            // Skip unresolvable devices
          }
        }
      }

      const detectionDetail = {
        detection,
        relatedDevices,
        relatedAlerts: [], // No direct alert-detection link in EH API
        notes: [],         // Notes require separate API or are not available
        timeline: [
          {
            timestamp: detection.createTimeIso,
            event: 'created' as const,
            detail: `Detection "${detection.title}" created`,
          },
        ],
      };

      const validation = DetectionDetailSchema.safeParse(detectionDetail);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed detection detail data',
          message: 'Detection detail data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ detectionDetail: validation.data });
    }

    // ── FIXTURE MODE ──
    let fixtureName: string;
    if (isDev && detectionId === 4001) {
      fixtureName = 'detection-detail.populated.fixture.json';
    } else {
      fixtureName = 'detection-detail.quiet.fixture.json';
    }

    const fixture = loadDetectionDetailFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const validation = DetectionDetailSchema.safeParse(fixture.detectionDetail);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed detection detail data',
        message: 'Detection detail data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ detectionDetail: validation.data });
  } catch (err: any) {
    return handleEhError(res, err, 'detection-detail');
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── GET /alert-detail ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
impactRouter.get('/alert-detail', async (req, res) => {
  try {
    const idParam = req.query.id;
    if (!idParam || isNaN(Number(idParam))) {
      return res.status(400).json({
        error: 'Invalid alert ID',
        message: 'Query param "id" must be a numeric alert ID',
      });
    }

    const alertId = Number(idParam);

    // ── LIVE MODE ──
    if (!isFixtureMode()) {
      // Get the alert
      const alertResponse = await ehRequest<any>({
        method: 'GET',
        path: `/api/v1/alerts/${alertId}`,
        cacheTtlMs: ALERT_CACHE_TTL,
      });

      const alert = normalizeAlert(alertResponse.data);

      // Get associated devices — alerts don't directly reference devices in EH API,
      // but we can look at recent detections for device overlap
      let associatedDevices: any[] = [];
      let associatedDetections: any[] = [];
      try {
        const now = Date.now();
        const detectionsResponse = await ehRequest<any[]>({
          method: 'GET',
          path: `/api/v1/detections?from=${now - 86400000}&until=${now}&limit=50`,
          cacheTtlMs: DETECTION_CACHE_TTL,
        });
        const allDetections = Array.isArray(detectionsResponse.data) ? detectionsResponse.data : [];
        associatedDetections = allDetections.slice(0, 5).map(normalizeDetection);

        // Extract unique device IDs from detection participants
        const deviceIds = new Set<number>();
        for (const d of allDetections) {
          const participants = Array.isArray(d.participants) ? d.participants : [];
          for (const p of participants) {
            if (p.object_type === 'device' && p.object_id) {
              deviceIds.add(p.object_id);
            }
          }
        }

        for (const did of Array.from(deviceIds).slice(0, 10)) {
          try {
            const deviceResponse = await ehRequest<any>({
              method: 'GET',
              path: `/api/v1/devices/${did}`,
              cacheTtlMs: DEVICE_CACHE_TTL,
            });
            associatedDevices.push(normalizeDeviceIdentity(deviceResponse.data));
          } catch {
            // Skip unresolvable
          }
        }
      } catch {
        // Non-fatal
      }

      const alertDetail = {
        alert,
        triggerHistory: [], // EH API doesn't expose alert trigger history directly
        associatedDevices,
        associatedDetections,
      };

      const validation = AlertDetailSchema.safeParse(alertDetail);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed alert detail data',
          message: 'Alert detail data from ExtraHop failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ alertDetail: validation.data });
    }

    // ── FIXTURE MODE ──
    let fixtureName: string;
    if (isDev && alertId === 101) {
      fixtureName = 'alert-detail.populated.fixture.json';
    } else {
      fixtureName = 'alert-detail.quiet.fixture.json';
    }

    const fixture = loadAlertDetailFixture(fixtureName);
    if (!fixture) {
      return res.status(500).json({
        error: 'Fixture load failed',
        message: `Could not load fixture: ${fixtureName}`,
      });
    }

    const validation = AlertDetailSchema.safeParse(fixture.alertDetail);
    if (!validation.success) {
      return res.status(502).json({
        error: 'Malformed alert detail data',
        message: 'Alert detail data from source failed schema validation',
        details: validation.error.issues,
      });
    }

    return res.json({ alertDetail: validation.data });
  } catch (err: any) {
    return handleEhError(res, err, 'alert-detail');
  }
});

export { impactRouter };
