/**
 * BFF Trace Routes — /api/bff/trace/*
 *
 * Slice 17: POST /api/bff/trace/run
 * SSE endpoint that streams 8-step trace events for the Flow Theater surface.
 *
 * DECONTAMINATION (Slice 28):
 *   - Live mode already returns honest error SSE event (was honest)
 *   - Sentinel routing gated behind NODE_ENV !== 'production'
 *   - Fixture listing endpoint gated behind NODE_ENV !== 'production'
 *   - No fixture file is ever loaded when EH_HOST + EH_API_KEY are configured
 */

import { Router } from 'express';
import { join } from 'path';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { TraceIntentSchema, TraceSSEEventSchema } from '../../shared/flow-theater-validators';
import type { TraceSSEEvent, TraceEntryMode } from '../../shared/flow-theater-types';

const traceRouter = Router();

/** SSE replay interval in ms between events (fixture mode). */
const REPLAY_INTERVAL_MS = 150;

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Determine if we are in fixture mode (no live ExtraHop configured).
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

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
    // Error fixture: specific sentinel values
    if (value === 'unknown.invalid' || value === '0' || value === 'bad-service::0') {
      return 'trace-resolution-error.fixture.jsonl';
    }

    // Quiet fixture: specific sentinel values
    if (value === 'quiet.lab.local' || value === '9999' || value === 'idle-svc::2087') {
      return 'trace-hostname-quiet.fixture.jsonl';
    }

    // Partial-error fixture: specific sentinel values
    if (value === 'partial.lab.local' || value === '8888') {
      return 'trace-partial-error.fixture.jsonl';
    }
  }

  // Entry-mode-specific complete fixtures
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

  // ── LIVE MODE GATE ──
  if (!isFixtureMode()) {
    const errorEvent: TraceSSEEvent = {
      type: 'error',
      message: 'Live trace integration not yet implemented. ExtraHop API calls are not wired.',
      failedStepId: null,
      timestamp: Date.now(),
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
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
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
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
    res.write(`data: ${JSON.stringify(event)}\n\n`);
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
