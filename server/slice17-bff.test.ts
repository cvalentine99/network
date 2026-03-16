/**
 * Slice 17 — BFF Trace Route Tests
 *
 * HTTP-level tests for the /api/bff/trace/* endpoints.
 * Uses supertest with a minimal Express app mounting the traceRouter.
 *
 * Tests cover:
 *   1. POST /api/bff/trace/run — invalid intent returns 400
 *   2. POST /api/bff/trace/run — valid hostname intent returns SSE stream
 *   3. POST /api/bff/trace/run — SSE stream contains valid TraceSSEEvent lines
 *   4. POST /api/bff/trace/run — SSE stream ends with terminal event
 *   5. POST /api/bff/trace/run — error sentinel returns error fixture stream
 *   6. POST /api/bff/trace/run — quiet sentinel returns quiet fixture stream
 *   7. POST /api/bff/trace/run — device mode returns device fixture stream
 *   8. POST /api/bff/trace/run — service-row mode returns service-row fixture stream
 *  8b. POST /api/bff/trace/run — ip mode returns ip fixture stream (+ error/quiet sentinels)
 *  8c. POST /api/bff/trace/run — cidr mode returns cidr fixture stream (+ error/quiet sentinels)
 *   9. GET /api/bff/trace/fixtures — returns fixture list in fixture mode
 *  10. SSE response headers are correct
 *  11. selectFixture mapping: sentinel values route to correct fixtures
 *  12. loadFixtureEvents: JSONL parsing and Zod validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { traceRouter } from './routes/trace';
import { TraceSSEEventSchema } from '../shared/flow-theater-validators';

// ─── Test App Setup ────────────────────────────────────────────────────────

let app: express.Express;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use('/api/bff/trace', traceRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

const VALID_TIME_WINDOW = {
  fromMs: 1710000000000,
  untilMs: 1710001800000,
  durationMs: 1800000,
  cycle: '30sec',
};

// ─── Helper: consume SSE stream ────────────────────────────────────────────

function consumeSSE(
  path: string,
  body: object,
  timeoutMs = 10000
): Promise<{ status: number; headers: Record<string, string>; events: any[] }> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const url = new URL(path, baseUrl);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Connection: 'keep-alive',
          'Content-Length': Buffer.byteLength(bodyStr).toString(),
        },
      },
      (res) => {
        const events: any[] = [];
        let buffer = '';
        res.setEncoding('utf8');

        res.on('data', (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              events.push(JSON.parse(jsonStr));
            } catch {
              // skip
            }
          }
        });

        res.on('end', () => {
          // Process any remaining buffer
          if (buffer.trim().startsWith('data:')) {
            const jsonStr = buffer.trim().slice(5).trim();
            if (jsonStr) {
              try {
                events.push(JSON.parse(jsonStr));
              } catch {
                // skip
              }
            }
          }

          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string>,
            events,
          });
        });

        res.on('error', reject);
      }
    );

    req.on('error', reject);
    req.end(bodyStr);

    setTimeout(() => {
      req.destroy();
      reject(new Error('SSE consume timeout'));
    }, timeoutMs);
  });
}

function fetchJSON(
  path: string,
  method = 'GET'
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: { Accept: 'application/json' },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end();
    setTimeout(() => {
      req.destroy();
      reject(new Error('Fetch timeout'));
    }, 5000);
  });
}

// ─── 1. Invalid intent returns 400 ─────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run validation', () => {
  it('returns 400 for invalid mode', async () => {
    const url = new URL('/api/bff/trace/run', baseUrl);
    const bodyStr = JSON.stringify({ mode: 'invalid', value: 'test', timeWindow: VALID_TIME_WINDOW });

    const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr).toString() },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          });
        }
      );
      req.on('error', reject);
      req.end(bodyStr);
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('INVALID_TRACE_INTENT');
  });

  it('returns 400 for empty value', async () => {
    const url = new URL('/api/bff/trace/run', baseUrl);
    const bodyStr = JSON.stringify({ mode: 'hostname', value: '', timeWindow: VALID_TIME_WINDOW });

    const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr).toString() },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          });
        }
      );
      req.on('error', reject);
      req.end(bodyStr);
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBe('INVALID_TRACE_INTENT');
  });

  it('returns 400 for missing body', async () => {
    const url = new URL('/api/bff/trace/run', baseUrl);

    const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': '0' },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => (data += chunk));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 0, body: data });
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(result.status).toBe(400);
  });
});

// ─── 2-4. Valid hostname intent returns SSE stream ─────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run SSE stream (hostname)', () => {
  it('returns 200 with SSE content type', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toBe('text/event-stream');
  });

  it('returns correct SSE headers', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.headers['cache-control']).toBe('no-cache');
    expect(result.headers['connection']).toBe('keep-alive');
    expect(result.headers['x-accel-buffering']).toBe('no');
  });

  it('streams 19 events for hostname-complete fixture', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.events).toHaveLength(19);
  });

  it('all SSE events pass TraceSSEEventSchema validation', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    for (const event of result.events) {
      const validated = TraceSSEEventSchema.safeParse(event);
      expect(validated.success).toBe(true);
    }
  });

  it('last event is a terminal event (complete)', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('complete');
    expect(lastEvent.terminalStatus).toBe('complete');
  });

  it('first event is a step event for input-accepted', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.events[0].type).toBe('step');
    expect(result.events[0].stepId).toBe('input-accepted');
  });
});

// ─── 5. Error sentinel ─────────────────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run error fixture', () => {
  it('error sentinel returns error terminal event', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'unknown.invalid',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('error');
    expect(lastEvent.failedStepId).toBe('entry-resolution');
  });
});

// ─── 6. Quiet sentinel ─────────────────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run quiet fixture', () => {
  it('quiet sentinel returns quiet terminal event', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'quiet.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('complete');
    expect(lastEvent.terminalStatus).toBe('quiet');
  });
});

// ─── 7. Device mode ────────────────────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run device mode', () => {
  it('device mode returns complete stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'device',
      value: '1042',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('complete');
    expect(lastEvent.terminalStatus).toBe('complete');
  });
});

// ─── 8. Service-row mode ───────────────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run service-row mode', () => {
  it('service-row mode returns complete stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'service-row',
      value: 'SMB::1042',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('complete');
    expect(lastEvent.terminalStatus).toBe('complete');
  });
});

// ─── 8b. IP mode ─────────────────────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run ip mode', () => {
  it('ip mode returns complete stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'ip',
      value: '10.1.20.42',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('complete');
    expect(lastEvent.terminalStatus).toBe('complete');
  });

  it('ip error sentinel returns error stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'ip',
      value: '0.0.0.0',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('error');
  });

  it('ip quiet sentinel returns quiet stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'ip',
      value: '192.168.0.0',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(['complete']).toContain(lastEvent.type);
    if (lastEvent.type === 'complete') {
      expect(lastEvent.terminalStatus).toBe('quiet');
    }
  });
});

// ─── 8c. POST /api/bff/trace/run — cidr mode ─────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run cidr mode', () => {
  it('cidr mode returns complete stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'cidr',
      value: '10.1.20.0/24',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('complete');
    expect(lastEvent.terminalStatus).toBe('complete');
  });

  it('cidr error sentinel returns error stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'cidr',
      value: '0.0.0.0/32',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('error');
  });

  it('cidr quiet sentinel returns quiet stream', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'cidr',
      value: '192.168.255.0/24',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(['complete']).toContain(lastEvent.type);
    if (lastEvent.type === 'complete') {
      expect(lastEvent.terminalStatus).toBe('quiet');
    }
  });
});

// ─── 9. GET /api/bff/trace/fixtures ────────────────────────────────────────

describe('Slice 17 BFF > GET /api/bff/trace/fixtures', () => {
  it('returns fixture list in fixture mode', async () => {
    const result = await fetchJSON('/api/bff/trace/fixtures');
    expect(result.status).toBe(200);
    expect(result.body.mode).toBe('fixture');
    expect(Array.isArray(result.body.fixtures)).toBe(true);
    expect(result.body.fixtures.length).toBeGreaterThan(0);
  });

  it('all fixture names end with .fixture.jsonl', async () => {
    const result = await fetchJSON('/api/bff/trace/fixtures');
    for (const name of result.body.fixtures) {
      expect(name).toMatch(/\.fixture\.jsonl$/);
    }
  });

  it('includes hostname-complete fixture', async () => {
    const result = await fetchJSON('/api/bff/trace/fixtures');
    expect(result.body.fixtures).toContain('trace-hostname-complete.fixture.jsonl');
  });

  it('includes ip-complete fixture', async () => {
    const result = await fetchJSON('/api/bff/trace/fixtures');
    expect(result.body.fixtures).toContain('trace-ip-complete.fixture.jsonl');
  });

  it('includes cidr-complete fixture', async () => {
    const result = await fetchJSON('/api/bff/trace/fixtures');
    expect(result.body.fixtures).toContain('trace-cidr-complete.fixture.jsonl');
  });
});

// ─── 10. Partial error fixture ─────────────────────────────────────────────

describe('Slice 17 BFF > POST /api/bff/trace/run partial-error fixture', () => {
  it('partial-error sentinel returns error terminal event', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'partial.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.status).toBe(200);
    const lastEvent = result.events[result.events.length - 1];
    expect(lastEvent.type).toBe('error');
  });

  it('partial-error has both complete and error step events', async () => {
    const result = await consumeSSE('/api/bff/trace/run', {
      mode: 'hostname',
      value: 'partial.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    const stepEvents = result.events.filter((e) => e.type === 'step');
    const hasComplete = stepEvents.some((e) => e.status === 'complete');
    const hasError = stepEvents.some((e) => e.status === 'error');
    expect(hasComplete).toBe(true);
    expect(hasError).toBe(true);
  });
});
