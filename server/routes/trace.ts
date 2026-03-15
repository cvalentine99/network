/**
 * BFF Trace Routes — /api/bff/trace/*
 *
 * Slice 17: POST /api/bff/trace/run
 * SSE endpoint that streams 8-step trace events for the Flow Theater surface.
 *
 * LIVE INTEGRATION (Slice 29):
 *   - Live mode executes real ExtraHop API calls for each of the 8 trace steps
 *   - Steps: input-accepted → entry-resolution → device-resolved → activity-timeline
 *            → metric-timeline → records-search → detection-alert → trace-assembly
 *   - Each step emits running/complete/error SSE events as it progresses
 *   - Fixture mode replays JSONL fixture files for testing
 *   - Sentinel routing gated behind NODE_ENV !== 'production'
 *   - Fixture listing endpoint gated behind NODE_ENV !== 'production'
 */

import { Router, type Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { TraceIntentSchema, TraceSSEEventSchema } from '../../shared/flow-theater-validators';
import type {
  TraceSSEEvent,
  TraceEntryMode,
  TraceStepId,
  TraceStepStatus,
  TraceSummary,
  TraceDeviceSummary,
  TraceResolvedDevice,
} from '../../shared/flow-theater-types';
import {
  isFixtureMode,
  ehRequest,
  ExtraHopClientError,
} from '../extrahop-client';
import { buildMetricsRequest, normalizeDeviceIdentity } from '../extrahop-normalizers';

const traceRouter = Router();

/** SSE replay interval in ms between events (fixture mode). */
const REPLAY_INTERVAL_MS = 150;

const isDev = process.env.NODE_ENV !== 'production';

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

function sendSSE(res: Response, event: TraceSSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function stepRunning(stepId: TraceStepId, detail: string): TraceSSEEvent {
  return {
    type: 'step',
    stepId,
    status: 'running' as TraceStepStatus,
    detail,
    durationMs: null,
    count: null,
    timestamp: Date.now(),
  };
}

function stepComplete(stepId: TraceStepId, detail: string, durationMs: number, count: number | null = null): TraceSSEEvent {
  return {
    type: 'step',
    stepId,
    status: 'complete' as TraceStepStatus,
    detail,
    durationMs,
    count,
    timestamp: Date.now(),
  };
}

function stepError(stepId: TraceStepId, detail: string, durationMs: number): TraceSSEEvent {
  return {
    type: 'step',
    stepId,
    status: 'error' as TraceStepStatus,
    detail,
    durationMs,
    count: null,
    timestamp: Date.now(),
  };
}

function stepQuiet(stepId: TraceStepId, detail: string, durationMs: number): TraceSSEEvent {
  return {
    type: 'step',
    stepId,
    status: 'quiet' as TraceStepStatus,
    detail,
    durationMs,
    count: 0,
    timestamp: Date.now(),
  };
}

function heartbeat(activeSteps: number): TraceSSEEvent {
  return {
    type: 'heartbeat',
    timestamp: Date.now(),
    activeSteps,
  };
}

// ─── Live Trace Execution ────────────────────────────────────────────────────

interface StepTiming {
  stepId: TraceStepId;
  status: TraceStepStatus;
  durationMs: number | null;
}

async function executeLiveTrace(
  res: Response,
  mode: TraceEntryMode,
  value: string,
  fromMs: number,
  untilMs: number,
): Promise<void> {
  const traceStart = Date.now();
  const stepTimings: StepTiming[] = [];
  let resolvedDevice: TraceResolvedDevice | null = null;
  let activityCount = 0;
  let metricPointCount = 0;
  let recordCount = 0;
  let detectionCount = 0;
  let alertCount = 0;
  let aborted = false;

  res.on('close', () => { aborted = true; });

  // Helper: run a step and track timing
  async function runStep<T>(
    stepId: TraceStepId,
    runningDetail: string,
    fn: () => Promise<{ detail: string; count: number | null; result: T }>,
  ): Promise<T | null> {
    if (aborted) return null;
    const start = Date.now();
    sendSSE(res, stepRunning(stepId, runningDetail));

    try {
      const { detail, count, result } = await fn();
      const dur = Date.now() - start;
      sendSSE(res, stepComplete(stepId, detail, dur, count));
      stepTimings.push({ stepId, status: 'complete', durationMs: dur });
      return result;
    } catch (err: any) {
      const dur = Date.now() - start;
      const msg = err instanceof ExtraHopClientError
        ? err.message
        : (err.message || 'Unknown error');
      sendSSE(res, stepError(stepId, msg, dur));
      stepTimings.push({ stepId, status: 'error', durationMs: dur });
      return null;
    }
  }

  // ── Step 1: input-accepted ──
  const inputOk = await runStep('input-accepted', `Validating ${mode} "${value}"`, async () => {
    // Input was already validated by Zod. Just confirm.
    return { detail: `${mode} input accepted`, count: null, result: true };
  });
  if (!inputOk || aborted) {
    sendSSE(res, { type: 'error', message: 'Input validation failed', failedStepId: 'input-accepted', timestamp: Date.now() });
    res.end();
    return;
  }

  // ── Step 2: entry-resolution ──
  const deviceId = await runStep('entry-resolution', `Resolving ${mode} to device`, async () => {
    let searchResult: any;

    if (mode === 'hostname') {
      // Search devices by name
      searchResult = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/devices?search_type=name&value=${encodeURIComponent(value)}&limit=1`,
        cacheTtlMs: 30_000,
      });
    } else if (mode === 'device') {
      // Direct device ID lookup
      const id = parseInt(value, 10);
      if (isNaN(id)) throw new Error(`Invalid device ID: ${value}`);
      const dev = await ehRequest<any>({
        method: 'GET',
        path: `/api/v1/devices/${id}`,
        cacheTtlMs: 30_000,
      });
      searchResult = { data: [dev.data] };
    } else if (mode === 'service-row') {
      // service-row format: "serviceName::deviceId"
      const parts = value.split('::');
      const devId = parseInt(parts[1], 10);
      if (isNaN(devId)) throw new Error(`Invalid service-row format: ${value}`);
      const dev = await ehRequest<any>({
        method: 'GET',
        path: `/api/v1/devices/${devId}`,
        cacheTtlMs: 30_000,
      });
      searchResult = { data: [dev.data] };
    }

    const devices = Array.isArray(searchResult?.data) ? searchResult.data : [searchResult?.data];
    if (!devices || devices.length === 0 || !devices[0]) {
      throw new Error(`No device found for ${mode}="${value}"`);
    }

    const rawDev = devices[0];
    return {
      detail: `Resolved to device ${rawDev.id}`,
      count: null,
      result: rawDev,
    };
  });

  if (!deviceId || aborted) {
    // Fill remaining steps as error
    for (const sid of ['device-resolved', 'activity-timeline', 'metric-timeline', 'records-search', 'detection-alert', 'trace-assembly'] as TraceStepId[]) {
      if (!stepTimings.find(s => s.stepId === sid)) {
        stepTimings.push({ stepId: sid, status: 'error', durationMs: null });
      }
    }
    const summary: TraceSummary = {
      resolvedDevice: null,
      activityCount: 0,
      metricPointCount: 0,
      recordCount: 0,
      detectionCount: 0,
      alertCount: 0,
      stepTimings,
    };
    sendSSE(res, {
      type: 'complete',
      terminalStatus: 'error',
      summary,
      totalDurationMs: Date.now() - traceStart,
      timestamp: Date.now(),
    });
    res.end();
    return;
  }

  // ── Step 3: device-resolved ──
  const devSummary = await runStep('device-resolved', 'Building device profile', async () => {
    const normalized = normalizeDeviceIdentity(deviceId);
    const summary: TraceDeviceSummary = {
      id: normalized.id,
      displayName: normalized.displayName,
      ipaddr: normalized.ipaddr4 || '',
      macaddr: normalized.macaddr || '',
      role: normalized.role || 'other',
      vendor: normalized.vendor || 'Unknown',
    };
    resolvedDevice = {
      resolvedVia: mode,
      originalInput: value,
      device: summary,
    };
    return {
      detail: `Device: ${summary.displayName} (${summary.ipaddr})`,
      count: null,
      result: summary,
    };
  });

  if (!devSummary || aborted) {
    sendSSE(res, { type: 'error', message: 'Device resolution failed', failedStepId: 'device-resolved', timestamp: Date.now() });
    res.end();
    return;
  }

  sendSSE(res, heartbeat(3)); // 3 parallel steps about to start

  // ── Steps 4-6 run in parallel ──

  // Step 4: activity-timeline
  const activityPromise = runStep('activity-timeline', 'Fetching device activity', async () => {
    const resp = await ehRequest<any>({
      method: 'POST',
      path: '/api/v1/metrics',
      body: buildMetricsRequest({
        cycle: 'auto',
        from: fromMs,
        until: untilMs,
        objectType: 'device',
        objectIds: [devSummary.id],
        metricCategory: 'net',
        metricSpecs: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
      }),
      cacheTtlMs: 60_000,
    });
    const stats = resp.data?.stats || [];
    const count = stats.length;
    activityCount = count;
    return {
      detail: `${count} activity records`,
      count,
      result: stats,
    };
  });

  // Step 5: metric-timeline
  const metricPromise = runStep('metric-timeline', 'Collecting metric timeseries', async () => {
    const resp = await ehRequest<any>({
      method: 'POST',
      path: '/api/v1/metrics',
      body: buildMetricsRequest({
        cycle: '30sec',
        from: fromMs,
        until: untilMs,
        objectType: 'device',
        objectIds: [devSummary.id],
        metricCategory: 'net',
        metricSpecs: [
          { name: 'bytes_in' },
          { name: 'bytes_out' },
          { name: 'pkts_in' },
          { name: 'pkts_out' },
        ],
      }),
      cacheTtlMs: 60_000,
    });
    const stats = resp.data?.stats || [];
    let pointCount = 0;
    for (const s of stats) {
      if (s.values && Array.isArray(s.values)) {
        for (const valArr of s.values) {
          if (Array.isArray(valArr)) pointCount += valArr.length;
        }
      }
    }
    metricPointCount = pointCount;
    return {
      detail: `${pointCount} metric data points`,
      count: pointCount,
      result: stats,
    };
  });

  // Step 6: records-search
  const recordsPromise = runStep('records-search', 'Searching transaction records', async () => {
    try {
      const resp = await ehRequest<any>({
        method: 'POST',
        path: '/api/v1/records/search',
        body: {
          from: fromMs,
          until: untilMs,
          filter: {
            field: 'ipaddr',
            operator: '=',
            operand: devSummary.ipaddr,
          },
          limit: 100,
        },
        cacheTtlMs: 60_000,
      });
      const records = resp.data?.records || [];
      recordCount = records.length;
      return {
        detail: `${records.length} records found`,
        count: records.length,
        result: records,
      };
    } catch (err: any) {
      // Records API may not be available on all appliances
      if (err instanceof ExtraHopClientError && (err.httpStatus === 404 || err.httpStatus === 501)) {
        recordCount = 0;
        return {
          detail: 'Records search not available on this appliance',
          count: 0,
          result: [],
        };
      }
      throw err;
    }
  });

  await Promise.all([activityPromise, metricPromise, recordsPromise]);

  if (aborted) { res.end(); return; }

  sendSSE(res, heartbeat(1));

  // ── Step 7: detection-alert ──
  await runStep('detection-alert', 'Scanning detections and alerts', async () => {
    // Fetch detections for this device's time window
    const detectResp = await ehRequest<any[]>({
      method: 'GET',
      path: `/api/v1/detections?from=${fromMs}&until=${untilMs}&limit=100`,
      cacheTtlMs: 60_000,
    });
    const allDetections = Array.isArray(detectResp.data) ? detectResp.data : [];
    // Filter to detections involving this device
    const deviceDetections = allDetections.filter((d: any) => {
      const participants = d.participants || [];
      return participants.some((p: any) =>
        p.object_id === devSummary.id ||
        p.ipaddr === devSummary.ipaddr
      );
    });

    // Fetch alerts
    const alertResp = await ehRequest<any[]>({
      method: 'GET',
      path: '/api/v1/alerts',
      cacheTtlMs: 60_000,
    });
    const allAlerts = Array.isArray(alertResp.data) ? alertResp.data : [];

    detectionCount = deviceDetections.length;
    alertCount = allAlerts.length;

    const parts: string[] = [];
    if (deviceDetections.length > 0) parts.push(`${deviceDetections.length} detections`);
    if (allAlerts.length > 0) parts.push(`${allAlerts.length} alert${allAlerts.length > 1 ? 's' : ''}`);
    const detail = parts.length > 0 ? parts.join(', ') : 'No detections or alerts';

    return {
      detail,
      count: deviceDetections.length + allAlerts.length,
      result: { detections: deviceDetections, alerts: allAlerts },
    };
  });

  if (aborted) { res.end(); return; }

  // ── Step 8: trace-assembly ──
  await runStep('trace-assembly', 'Assembling trace results', async () => {
    // Assembly is just building the summary — no additional API calls
    return {
      detail: 'Trace assembled',
      count: null,
      result: true,
    };
  });

  // ── Emit complete event ──
  const summary: TraceSummary = {
    resolvedDevice,
    activityCount,
    metricPointCount,
    recordCount,
    detectionCount,
    alertCount,
    stepTimings,
  };

  const hasData = activityCount > 0 || metricPointCount > 0 || recordCount > 0 || detectionCount > 0;
  const hasErrors = stepTimings.some(s => s.status === 'error');
  const terminalStatus = hasErrors ? 'error' : (hasData ? 'complete' : 'quiet');

  sendSSE(res, {
    type: 'complete',
    terminalStatus,
    summary,
    totalDurationMs: Date.now() - traceStart,
    timestamp: Date.now(),
  });

  res.end();
}

// ─── Fixture Helpers ─────────────────────────────────────────────────────────

/**
 * Load a JSONL fixture file and parse it into an array of SSE events.
 */
function loadFixtureEvents(fixtureName: string): TraceSSEEvent[] {
  const fixturePath = join(process.cwd(), 'fixtures', 'flow-theater', fixtureName);
  if (!existsSync(fixturePath)) {
    return [];
  }
  const raw = readFileSync(fixturePath, 'utf-8');
  const lines = raw.split('\n').filter(line => line.trim().length > 0);
  const events: TraceSSEEvent[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const validated = TraceSSEEventSchema.safeParse(parsed);
      if (validated.success) {
        events.push(validated.data);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return events;
}

/**
 * Select the appropriate fixture file based on entry mode and input value.
 * Sentinel values are ONLY used in dev/test, never in production.
 */
function selectFixture(mode: TraceEntryMode, value: string): string {
  // Sentinel routing: only in dev/test
  if (isDev) {
    if (value === 'unknown.invalid' || value === '0' || value === 'bad-service::0') {
      return 'trace-resolution-error.fixture.jsonl';
    }
    if (value === 'quiet.lab.local' || value === '9999' || value === 'idle-svc::2087') {
      return 'trace-hostname-quiet.fixture.jsonl';
    }
    if (value === 'partial.lab.local' || value === '8888') {
      return 'trace-partial-error.fixture.jsonl';
    }
  }

  switch (mode) {
    case 'hostname':
      return 'trace-hostname-complete.fixture.jsonl';
    case 'device':
      return 'trace-device-complete.fixture.jsonl';
    case 'service-row':
      return 'trace-service-row-complete.fixture.jsonl';
    default:
      return 'trace-hostname-complete.fixture.jsonl';
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/bff/trace/run
 */
traceRouter.post('/run', (req, res) => {
  // Validate the request body
  const parseResult = TraceIntentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'INVALID_TRACE_INTENT',
      message: 'Invalid trace intent',
      details: parseResult.error.issues,
    });
    return;
  }

  const intent = parseResult.data;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // ── LIVE MODE ──
  if (!isFixtureMode()) {
    executeLiveTrace(
      res,
      intent.mode,
      intent.value,
      intent.timeWindow.fromMs,
      intent.timeWindow.untilMs,
    ).catch((err: any) => {
      const errorEvent: TraceSSEEvent = {
        type: 'error',
        message: err.message || 'Unexpected trace error',
        failedStepId: null,
        timestamp: Date.now(),
      };
      try { sendSSE(res, errorEvent); } catch { /* connection closed */ }
      try { res.end(); } catch { /* already closed */ }
    });
    return;
  }

  // ── FIXTURE MODE ──
  const fixtureName = selectFixture(intent.mode, intent.value);
  const events = loadFixtureEvents(fixtureName);

  if (events.length === 0) {
    const errorEvent: TraceSSEEvent = {
      type: 'error',
      message: `No fixture found for mode=${intent.mode} value=${intent.value}`,
      failedStepId: null,
      timestamp: Date.now(),
    };
    sendSSE(res, errorEvent);
    res.end();
    return;
  }

  // Replay events with staggered timing
  let eventIndex = 0;
  const replayInterval = setInterval(() => {
    if (eventIndex >= events.length) {
      clearInterval(replayInterval);
      res.end();
      return;
    }

    const event = events[eventIndex];
    sendSSE(res, event);
    eventIndex++;

    if (event.type === 'complete' || event.type === 'error') {
      clearInterval(replayInterval);
      res.end();
    }
  }, REPLAY_INTERVAL_MS);

  res.on('close', () => {
    clearInterval(replayInterval);
  });
});

/**
 * GET /api/bff/trace/fixtures
 *
 * Returns the list of available fixture files for testing/development.
 * NOT available in production.
 */
traceRouter.get('/fixtures', (_req, res) => {
  if (!isDev) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  if (!isFixtureMode()) {
    res.json({ fixtures: [], mode: 'live' });
    return;
  }

  const fixtureDir = join(process.cwd(), 'fixtures', 'flow-theater');
  if (!existsSync(fixtureDir)) {
    res.json({ fixtures: [], mode: 'fixture' });
    return;
  }

  try {
    const files = readdirSync(fixtureDir).filter((f: string) => f.endsWith('.fixture.jsonl'));
    res.json({ fixtures: files, mode: 'fixture' });
  } catch {
    res.json({ fixtures: [], mode: 'fixture' });
  }
});

export { traceRouter };
