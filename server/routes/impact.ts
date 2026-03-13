/**
 * BFF Impact Routes — /api/bff/impact/*
 *
 * Slice 02: GET /api/bff/impact/headline
 * Returns the KPI headline data for the Impact Deck.
 *
 * In fixture mode (no live appliance), returns fixture data.
 * Shape conforms to ImpactOverviewPayload.headline from shared/cockpit-types.ts.
 *
 * Contract: browser calls /api/bff/impact/headline, never ExtraHop directly.
 * The BFF is responsible for:
 *   1. Accepting a time window query (from, until, cycle)
 *   2. Validating the query via TimeWindowQuerySchema
 *   3. Resolving the time window via resolveTimeWindow
 *   4. Returning headline data validated via ImpactHeadlineSchema
 *   5. Returning proper error shapes for transport failures and malformed data
 */
import { Router } from 'express';
import { TimeWindowQuerySchema, ImpactHeadlineSchema, SeriesPointSchema, TopTalkerRowSchema, NormalizedDetectionSchema, NormalizedAlertSchema, ApplianceStatusSchema } from '../../shared/cockpit-validators';
import { z } from 'zod';
import { resolveTimeWindow } from '../../shared/normalize';
import type { ImpactOverviewPayload } from '../../shared/cockpit-types';
import { readFileSync } from 'fs';
import { join } from 'path';

const impactRouter = Router();

/**
 * Determine if we are in fixture mode.
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
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

/**
 * GET /api/bff/impact/headline
 *
 * Query params: from, until, cycle (all optional, validated by TimeWindowQuerySchema)
 *
 * Response shape on success:
 *   { headline: ImpactHeadline, timeWindow: TimeWindow }
 *
 * Response shape on quiet (no data):
 *   { headline: { totalBytes: 0, totalPackets: 0, bytesPerSecond: 0, packetsPerSecond: 0, baselineDeltaPct: null }, timeWindow: TimeWindow }
 *
 * Response shape on error:
 *   { error: string, message: string }
 */
impactRouter.get('/headline', (req, res) => {
  try {
    // 1. Validate query params
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;

    // 2. Resolve time window
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // 3. In fixture mode, return fixture data
    if (isFixtureMode()) {
      // Determine which fixture to use based on whether the window is valid
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

      // Validate headline before sending
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
    }

    // 4. Live mode — placeholder for future ExtraHop integration
    // For now, return quiet state since we have no live connection
    return res.json({
      headline: {
        totalBytes: 0,
        totalPackets: 0,
        bytesPerSecond: 0,
        packetsPerSecond: 0,
        baselineDeltaPct: null,
      },
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact headline fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/bff/impact/timeseries
 *
 * Query params: from, until, cycle (all optional, validated by TimeWindowQuerySchema)
 *
 * Response shape on success:
 *   { timeseries: SeriesPoint[], timeWindow: TimeWindow }
 *
 * Response shape on quiet (no data):
 *   { timeseries: [], timeWindow: TimeWindow }
 *
 * Response shape on error:
 *   { error: string, message: string }
 *
 * Fixture backing: extracts .timeseries from impact-overview.populated.fixture.json
 * (or impact-overview.quiet.fixture.json for invalid windows).
 * Timeseries-specific fixtures (timeseries.*.fixture.json) are for test use only.
 */
impactRouter.get('/timeseries', (req, res) => {
  try {
    // 1. Validate query params
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;

    // 2. Resolve time window
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // 3. In fixture mode, return fixture data
    if (isFixtureMode()) {
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

      // Validate each series point before sending
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
    }

    // 4. Live mode — placeholder for future ExtraHop integration
    return res.json({
      timeseries: [],
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact timeseries fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

/**
 * Load a fixture file from the fixtures/top-talkers directory.
 * Returns null if the file cannot be read or parsed.
 */
function loadTopTalkersFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'top-talkers', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * GET /api/bff/impact/top-talkers
 *
 * Query params: from, until, cycle (all optional, validated by TimeWindowQuerySchema)
 *
 * Response shape on success:
 *   { topTalkers: TopTalkerRow[], timeWindow: TimeWindow }
 *
 * Response shape on quiet (no data):
 *   { topTalkers: [], timeWindow: TimeWindow }
 *
 * Response shape on error:
 *   { error: string, message: string }
 *
 * Fixture backing: loads from fixtures/top-talkers/top-talkers.populated.fixture.json
 * (or top-talkers.quiet.fixture.json for invalid windows).
 */
impactRouter.get('/top-talkers', (req, res) => {
  try {
    // 1. Validate query params
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;

    // 2. Resolve time window
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // 3. In fixture mode, return fixture data
    if (isFixtureMode()) {
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

      // Validate each top talker row before sending
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
    }

    // 4. Live mode — placeholder for future ExtraHop integration
    return res.json({
      topTalkers: [],
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact top talkers fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

/**
 * Load a fixture file from the fixtures/detections directory.
 * Returns null if the file cannot be read or parsed.
 */
function loadDetectionsFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'detections', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * GET /api/bff/impact/detections
 *
 * Query params: from, until, cycle (all optional, validated by TimeWindowQuerySchema)
 *
 * Response shape on success:
 *   { detections: NormalizedDetection[], timeWindow: TimeWindow }
 *
 * Response shape on quiet (no data):
 *   { detections: [], timeWindow: TimeWindow }
 *
 * Response shape on error:
 *   { error: string, message: string }
 *
 * Fixture backing: loads from fixtures/detections/detections.populated.fixture.json
 * (or detections.quiet.fixture.json for invalid windows).
 */
impactRouter.get('/detections', (req, res) => {
  try {
    // 1. Validate query params
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;

    // 2. Resolve time window
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // 3. In fixture mode, return fixture data
    if (isFixtureMode()) {
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

      // Validate each detection before sending
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
    }

    // 4. Live mode — placeholder for future ExtraHop integration
    return res.json({
      detections: [],
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact detections fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

/**
 * Load a fixture file from the fixtures/alerts directory.
 * Returns null if the file cannot be read or parsed.
 */
function loadAlertsFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'alerts', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * GET /api/bff/impact/alerts
 *
 * Query params: from, until, cycle (all optional, validated by TimeWindowQuerySchema)
 *
 * Response shape on success:
 *   { alerts: NormalizedAlert[], timeWindow: TimeWindow }
 *
 * Response shape on quiet (no data):
 *   { alerts: [], timeWindow: TimeWindow }
 *
 * Response shape on error:
 *   { error: string, message: string }
 *
 * Fixture backing: loads from fixtures/alerts/alerts.populated.fixture.json
 * (or alerts.quiet.fixture.json for invalid windows).
 *
 * Alert severity mapping (ExtraHop convention — LOWER = MORE severe):
 *   0-1 → critical, 2-3 → high, 4-5 → medium, 6+ → low
 */
impactRouter.get('/alerts', (req, res) => {
  try {
    // 1. Validate query params
    const queryResult = TimeWindowQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        error: 'Invalid time window query',
        message: queryResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { from, until, cycle } = queryResult.data;

    // 2. Resolve time window
    const timeWindow = resolveTimeWindow(from, until, cycle);

    // 3. In fixture mode, return fixture data
    if (isFixtureMode()) {
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

      // Validate each alert before sending
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
    }

    // 4. Live mode — placeholder for future ExtraHop integration
    return res.json({
      alerts: [],
      timeWindow,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Impact alerts fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

/**
 * Load a fixture file from the fixtures/appliance-status directory.
 * Returns null if the file cannot be read or parsed.
 */
function loadApplianceStatusFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'appliance-status', name);
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * GET /api/bff/impact/appliance-status
 *
 * No query params required (appliance status is not time-window-dependent).
 *
 * Response shape on success:
 *   { applianceStatus: ApplianceStatus }
 *
 * Response shape on quiet (not configured):
 *   { applianceStatus: ApplianceStatus } where connectionStatus = 'not_configured'
 *
 * Response shape on error:
 *   { error: string, message: string }
 *
 * Fixture backing: loads from fixtures/appliance-status/appliance-status.populated.fixture.json
 * (or appliance-status.quiet.fixture.json when not configured).
 *
 * Contract:
 *   - This route does NOT depend on time window (appliance health is instantaneous)
 *   - In fixture mode, connectionStatus = 'not_configured'
 *   - In live mode (future), connectionStatus = 'connected' or 'error'
 */
impactRouter.get('/appliance-status', (_req, res) => {
  try {
    // In fixture mode, return the appropriate fixture
    if (isFixtureMode()) {
      // When not configured, return quiet fixture
      const fixture = loadApplianceStatusFixture('appliance-status.quiet.fixture.json');
      if (!fixture) {
        return res.status(500).json({
          error: 'Fixture load failed',
          message: 'Could not load fixture: appliance-status.quiet.fixture.json',
        });
      }

      // Override lastChecked with current timestamp and uptimeSeconds with BFF uptime
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
    }

    // Live mode — construct from health check (future integration)
    // For now, return not_configured since we have no live connection
    const status = {
      hostname: '',
      displayHost: '',
      version: '',
      edition: '',
      platform: '',
      mgmtIpaddr: '',
      captureStatus: 'unknown' as const,
      captureInterface: '',
      licenseStatus: 'unknown' as const,
      licensedModules: [] as string[],
      uptimeSeconds: Math.round(process.uptime()),
      connectionStatus: 'not_configured' as const,
      lastChecked: new Date().toISOString(),
    };

    return res.json({ applianceStatus: status });
  } catch (err: any) {
    return res.status(500).json({
      error: 'Appliance status fetch failed',
      message: err.message || 'Unknown error',
    });
  }
});

export { impactRouter };
