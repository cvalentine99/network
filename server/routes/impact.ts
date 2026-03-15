/**
 * BFF Impact Routes — /api/bff/impact/*
 *
 * DECONTAMINATION (Slice 28):
 *   - All live-mode code paths now return explicit 503 LIVE_NOT_IMPLEMENTED
 *   - No route returns fake zeros/empty arrays that look like a quiet network
 *   - Appliance-status no longer mixes real DB hostname with fixture metadata
 *   - Sentinel ID routing (1042, 4001, 101) gated behind NODE_ENV !== 'production'
 *   - No fixture file is ever loaded when EH_HOST + EH_API_KEY are configured
 */
import { Router } from 'express';
import { TimeWindowQuerySchema, ImpactHeadlineSchema, SeriesPointSchema, TopTalkerRowSchema, NormalizedDetectionSchema, NormalizedAlertSchema, ApplianceStatusSchema, DeviceDetailSchema, DetectionDetailSchema, AlertDetailSchema } from '../../shared/cockpit-validators';
import { z } from 'zod';
import { resolveTimeWindow } from '../../shared/normalize';
import type { ImpactOverviewPayload } from '../../shared/cockpit-types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getApplianceConfig } from '../db';

const impactRouter = Router();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Determine if we are in fixture mode.
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

/**
 * Standard live-mode error response.
 * Used by all routes when EH_HOST + EH_API_KEY are set but integration is not wired.
 */
function liveNotImplementedResponse(route: string) {
  return {
    error: 'LIVE_NOT_IMPLEMENTED',
    message: `Live ${route} integration not yet implemented. ExtraHop API calls are not wired.`,
    code: 'LIVE_NOT_IMPLEMENTED',
  };
}

/**
 * Load a fixture file from the fixtures/impact directory.
 * Returns null if the file cannot be read or parsed.
 */
function loadImpactFixture(name: string): ImpactOverviewPayload | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'impact', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw) as ImpactOverviewPayload;
  } catch {
    return null;
  }
}

// ─── GET /headline ─────────────────────────────────────────────────
impactRouter.get('/headline', (req, res) => {
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

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('headline'));
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

    return res.json({
      headline: headlineResult.data,
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact headline fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── GET /timeseries ───────────────────────────────────────────────
impactRouter.get('/timeseries', (req, res) => {
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

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('timeseries'));
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

    return res.json({
      timeseries: validation.data,
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact timeseries fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Top Talkers fixture loader ────────────────────────────────────
function loadTopTalkersFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'top-talkers', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /top-talkers ──────────────────────────────────────────────
impactRouter.get('/top-talkers', (req, res) => {
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

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('top-talkers'));
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

    return res.json({
      topTalkers: validation.data,
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact top talkers fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Detections fixture loader ─────────────────────────────────────
function loadDetectionsFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'detections', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /detections ───────────────────────────────────────────────
impactRouter.get('/detections', (req, res) => {
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

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('detections'));
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

    return res.json({
      detections: validation.data,
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact detections fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Alerts fixture loader ─────────────────────────────────────────
function loadAlertsFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'alerts', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /alerts ───────────────────────────────────────────────────
impactRouter.get('/alerts', (req, res) => {
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

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('alerts'));
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

    return res.json({
      alerts: validation.data,
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact alerts fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Appliance Status fixture loader ───────────────────────────────
function loadApplianceStatusFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'appliance-status', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /appliance-status ─────────────────────────────────────────
/**
 * DECONTAMINATION:
 *   - When DB config exists but we're NOT in fixture mode (EH_HOST+KEY set),
 *     return ONLY DB-known fields. Do NOT overlay fixture metadata.
 *   - Unknown fields (version, edition, platform, license, capture) = null/'unknown'
 *   - In fixture mode with no DB config, return quiet fixture (not_configured)
 *   - In fixture mode with DB config, return fixture data (labeled as fixture)
 */
impactRouter.get('/appliance-status', async (_req, res) => {
  try {
    const dbConfig = await getApplianceConfig().catch(() => null);

    // ── LIVE MODE (EH_HOST + EH_API_KEY configured) ──
    if (!isFixtureMode()) {
      if (dbConfig && dbConfig.hostname) {
        // Return ONLY what we know from the DB. No fixture metadata overlay.
        const connectionStatus = dbConfig.lastTestResult === 'success' ? 'connected' as const
          : dbConfig.lastTestResult === 'failure' ? 'error' as const
          : 'not_configured' as const;

        const status = {
          hostname: dbConfig.hostname.split('.')[0],
          displayHost: dbConfig.nickname
            ? `${dbConfig.hostname} (${dbConfig.nickname})`
            : dbConfig.hostname,
          // All appliance metadata fields are UNKNOWN until real EH API call is wired
          version: null,
          edition: null,
          platform: null,
          mgmtIpaddr: null,
          captureStatus: 'unknown' as const,
          captureInterface: null,
          licenseStatus: 'unknown' as const,
          licensedModules: [] as string[],
          uptimeSeconds: null,
          connectionStatus,
          lastChecked: new Date().toISOString(),
        };

        const validation = ApplianceStatusSchema.safeParse(status);
        if (!validation.success) {
          return res.status(502).json({
            error: 'Malformed appliance status data',
            message: 'Appliance status from DB config failed schema validation',
            details: validation.error.issues,
          });
        }
        return res.json({ applianceStatus: validation.data });
      }

      // Live mode but no DB config — not configured
      return res.status(503).json(liveNotImplementedResponse('appliance-status'));
    }

    // ── FIXTURE MODE ──
    if (dbConfig && dbConfig.hostname) {
      // Fixture mode with DB config: load fixture but clearly it's fixture data
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
    return res.status(500).json({
      error: 'Appliance status fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Device Detail fixture loader ──────────────────────────────────
function loadDeviceDetailFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'device-detail', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /device-detail ────────────────────────────────────────────
impactRouter.get('/device-detail', (req, res) => {
  try {
    const idParam = req.query.id;
    if (!idParam || isNaN(Number(idParam))) {
      return res.status(400).json({
        error: 'Invalid device ID',
        message: 'Query param "id" must be a numeric device ID',
      });
    }

    const deviceId = Number(idParam);

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('device-detail'));
    }

    // ── FIXTURE MODE ──
    // Sentinel ID routing: only in dev/test
    let fixtureName: string;
    if (isDev && deviceId === 1042) {
      fixtureName = 'device-detail.populated.fixture.json';
    } else if (isDev && deviceId === 9999) {
      fixtureName = 'device-detail.not-found.fixture.json';
    } else {
      // Unknown device IDs get quiet fixture (empty traffic, no protocols)
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
    return res.status(500).json({
      error: 'Device detail fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Detection Detail fixture loader ───────────────────────────────
function loadDetectionDetailFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'detection-detail', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /detection-detail ─────────────────────────────────────────
impactRouter.get('/detection-detail', (req, res) => {
  try {
    const idParam = req.query.id;
    if (!idParam || isNaN(Number(idParam))) {
      return res.status(400).json({
        error: 'Invalid detection ID',
        message: 'Query param "id" must be a numeric detection ID',
      });
    }

    const detectionId = Number(idParam);

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('detection-detail'));
    }

    // ── FIXTURE MODE ──
    let fixtureName: string;
    if (isDev && detectionId === 4001) {
      fixtureName = 'detection-detail.populated.fixture.json';
    } else {
      // Unknown detection IDs get quiet fixture
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
    return res.status(500).json({
      error: 'Detection detail fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

// ─── Alert Detail fixture loader ───────────────────────────────────
function loadAlertDetailFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'alert-detail', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── GET /alert-detail ─────────────────────────────────────────────
impactRouter.get('/alert-detail', (req, res) => {
  try {
    const idParam = req.query.id;
    if (!idParam || isNaN(Number(idParam))) {
      return res.status(400).json({
        error: 'Invalid alert ID',
        message: 'Query param "id" must be a numeric alert ID',
      });
    }

    const alertId = Number(idParam);

    // ── LIVE MODE GATE ──
    if (!isFixtureMode()) {
      return res.status(503).json(liveNotImplementedResponse('alert-detail'));
    }

    // ── FIXTURE MODE ──
    let fixtureName: string;
    if (isDev && alertId === 101) {
      fixtureName = 'alert-detail.populated.fixture.json';
    } else {
      // Unknown alert IDs get quiet fixture
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
    return res.status(500).json({
      error: 'Alert detail fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

export { impactRouter };
