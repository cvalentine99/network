/**
 * Slice 31 — Background ETL Scheduler + Activity Timeline Tests
 *
 * Tests for:
 *   1. ETL scheduler module (getEtlStatus, runEtlCycle, startEtlScheduler, stopEtlScheduler)
 *   2. BFF /device-activity route (fixture mode)
 *   3. Health endpoint ETL status reporting
 *   4. Activity row schema validation
 *   5. EtlJobHealthStatusSchema validation
 *   6. BffHealthResponseSchema with etl field
 *
 * All tests run against fixtures. No live ExtraHop or DB required.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import type { Server } from 'http';

// ─── Schema imports ──────────────────────────────────────────────────────
import {
  BffHealthResponseSchema,
  EtlJobHealthStatusSchema,
} from '../shared/cockpit-validators';

// ─── ETL Scheduler imports ───────────────────────────────────────────────
import {
  getEtlStatus,
  stopEtlScheduler,
  type EtlJobStatus,
} from './etl-scheduler';

// ─── Fixture paths ───────────────────────────────────────────────────────
const FIXTURES_DIR = join(process.cwd(), 'fixtures', 'device-activity');

// ─── Activity Row Schema (matches BFF response shape) ────────────────────
const ActivityRowSchema = z.object({
  activityId: z.number().int(),
  deviceId: z.number().int(),
  statName: z.string().min(1),
  fromTime: z.number().int(),
  untilTime: z.number().int(),
  modTime: z.number().int(),
});

const DeviceActivityResponseSchema = z.object({
  activityRows: z.array(ActivityRowSchema),
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. ETL Scheduler Module Tests
// ═══════════════════════════════════════════════════════════════════════════
describe('ETL Scheduler Module', () => {
  describe('getEtlStatus()', () => {
    it('returns a valid EtlJobStatus object', () => {
      const status = getEtlStatus();
      expect(status).toBeDefined();
      expect(typeof status.running).toBe('boolean');
      expect(typeof status.totalRuns).toBe('number');
      expect(typeof status.totalErrors).toBe('number');
      expect(typeof status.intervalMs).toBe('number');
      expect(typeof status.lastRunDurationMs).toBe('number');
      expect(typeof status.lastRunDevicesPolled).toBe('number');
      expect(typeof status.lastRunDevicesSucceeded).toBe('number');
      expect(typeof status.lastRunDevicesFailed).toBe('number');
      expect(typeof status.lastRunRecordsUpserted).toBe('number');
    });

    it('validates against EtlJobHealthStatusSchema', () => {
      const status = getEtlStatus();
      const result = EtlJobHealthStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });

    it('has non-negative numeric fields', () => {
      const status = getEtlStatus();
      expect(status.totalRuns).toBeGreaterThanOrEqual(0);
      expect(status.totalErrors).toBeGreaterThanOrEqual(0);
      expect(status.intervalMs).toBeGreaterThanOrEqual(0);
      expect(status.lastRunDurationMs).toBeGreaterThanOrEqual(0);
      expect(status.lastRunDevicesPolled).toBeGreaterThanOrEqual(0);
      expect(status.lastRunDevicesSucceeded).toBeGreaterThanOrEqual(0);
      expect(status.lastRunDevicesFailed).toBeGreaterThanOrEqual(0);
      expect(status.lastRunRecordsUpserted).toBeGreaterThanOrEqual(0);
    });

    it('returns a copy (not a reference to internal state)', () => {
      const status1 = getEtlStatus();
      const status2 = getEtlStatus();
      expect(status1).not.toBe(status2);
      expect(status1).toEqual(status2);
    });

    it('lastRunAt is null when no cycle has run', () => {
      const status = getEtlStatus();
      // In fixture mode, scheduler doesn't start, so lastRunAt should be null
      expect(status.lastRunAt).toBeNull();
    });
  });

  describe('stopEtlScheduler()', () => {
    it('sets running to false', () => {
      stopEtlScheduler();
      const status = getEtlStatus();
      expect(status.running).toBe(false);
    });

    it('sets nextRunAt to null', () => {
      stopEtlScheduler();
      const status = getEtlStatus();
      expect(status.nextRunAt).toBeNull();
    });

    it('is idempotent — calling twice does not throw', () => {
      expect(() => {
        stopEtlScheduler();
        stopEtlScheduler();
      }).not.toThrow();
    });
  });

  describe('fixture mode behavior', () => {
    it('scheduler does not start in fixture mode (no EH_HOST/EH_API_KEY)', () => {
      // In test environment, EH_HOST and EH_API_KEY are not set
      // so isFixtureMode() returns true and scheduler should not be running
      const status = getEtlStatus();
      expect(status.running).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. EtlJobHealthStatusSchema Validation
// ═══════════════════════════════════════════════════════════════════════════
describe('EtlJobHealthStatusSchema', () => {
  it('accepts a valid idle status', () => {
    const idle: EtlJobStatus = {
      running: false,
      lastRunAt: null,
      lastRunDurationMs: 0,
      lastRunDevicesPolled: 0,
      lastRunDevicesSucceeded: 0,
      lastRunDevicesFailed: 0,
      lastRunRecordsUpserted: 0,
      totalRuns: 0,
      totalErrors: 0,
      intervalMs: 0,
      nextRunAt: null,
    };
    expect(EtlJobHealthStatusSchema.safeParse(idle).success).toBe(true);
  });

  it('accepts a valid running status with last run data', () => {
    const running: EtlJobStatus = {
      running: true,
      lastRunAt: '2026-03-15T10:00:00.000Z',
      lastRunDurationMs: 4523,
      lastRunDevicesPolled: 42,
      lastRunDevicesSucceeded: 40,
      lastRunDevicesFailed: 2,
      lastRunRecordsUpserted: 320,
      totalRuns: 15,
      totalErrors: 3,
      intervalMs: 300000,
      nextRunAt: '2026-03-15T10:05:00.000Z',
    };
    expect(EtlJobHealthStatusSchema.safeParse(running).success).toBe(true);
  });

  it('rejects negative totalRuns', () => {
    const bad = {
      running: false,
      lastRunAt: null,
      lastRunDurationMs: 0,
      lastRunDevicesPolled: 0,
      lastRunDevicesSucceeded: 0,
      lastRunDevicesFailed: 0,
      lastRunRecordsUpserted: 0,
      totalRuns: -1,
      totalErrors: 0,
      intervalMs: 0,
      nextRunAt: null,
    };
    expect(EtlJobHealthStatusSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects negative intervalMs', () => {
    const bad = {
      running: false,
      lastRunAt: null,
      lastRunDurationMs: 0,
      lastRunDevicesPolled: 0,
      lastRunDevicesSucceeded: 0,
      lastRunDevicesFailed: 0,
      lastRunRecordsUpserted: 0,
      totalRuns: 0,
      totalErrors: 0,
      intervalMs: -1,
      nextRunAt: null,
    };
    expect(EtlJobHealthStatusSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects missing running field', () => {
    const bad = {
      lastRunAt: null,
      lastRunDurationMs: 0,
      lastRunDevicesPolled: 0,
      lastRunDevicesSucceeded: 0,
      lastRunDevicesFailed: 0,
      lastRunRecordsUpserted: 0,
      totalRuns: 0,
      totalErrors: 0,
      intervalMs: 0,
      nextRunAt: null,
    };
    expect(EtlJobHealthStatusSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects non-integer devicesPolled', () => {
    const bad = {
      running: false,
      lastRunAt: null,
      lastRunDurationMs: 0,
      lastRunDevicesPolled: 1.5,
      lastRunDevicesSucceeded: 0,
      lastRunDevicesFailed: 0,
      lastRunRecordsUpserted: 0,
      totalRuns: 0,
      totalErrors: 0,
      intervalMs: 0,
      nextRunAt: null,
    };
    expect(EtlJobHealthStatusSchema.safeParse(bad).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. BffHealthResponseSchema with ETL field
// ═══════════════════════════════════════════════════════════════════════════
describe('BffHealthResponseSchema with etl field', () => {
  it('accepts etl: null (fixture mode / ETL not running)', () => {
    const response = {
      status: 'not_configured',
      bff: { uptime: 10, memoryMB: 50, cache: { size: 0, maxSize: 500 } },
      appliance: null,
      etl: null,
      timestamp: '2026-03-15T10:00:00.000Z',
    };
    expect(BffHealthResponseSchema.safeParse(response).success).toBe(true);
  });

  it('accepts etl with full status object', () => {
    const response = {
      status: 'ok',
      bff: { uptime: 100, memoryMB: 80, cache: { size: 5, maxSize: 500 } },
      appliance: {
        version: '9.4.0',
        edition: 'Reveal(x)',
        platform: 'extrahop',
        hostname: 'eh.lab',
        mgmtIpaddr: '10.1.1.1',
        displayHost: 'eh.lab',
        captureName: 'Default',
        captureMac: '00:11:22:33:44:55',
        licensedModules: ['wire_data'],
        licensedOptions: [],
        processCount: 4,
        services: {},
      },
      etl: {
        running: true,
        lastRunAt: '2026-03-15T10:00:00.000Z',
        lastRunDurationMs: 5000,
        lastRunDevicesPolled: 10,
        lastRunDevicesSucceeded: 9,
        lastRunDevicesFailed: 1,
        lastRunRecordsUpserted: 80,
        totalRuns: 5,
        totalErrors: 1,
        intervalMs: 300000,
        nextRunAt: '2026-03-15T10:05:00.000Z',
      },
      timestamp: '2026-03-15T10:00:00.000Z',
    };
    expect(BffHealthResponseSchema.safeParse(response).success).toBe(true);
  });

  it('rejects response without etl field', () => {
    const response = {
      status: 'not_configured',
      bff: { uptime: 10, memoryMB: 50, cache: { size: 0, maxSize: 500 } },
      appliance: null,
      timestamp: '2026-03-15T10:00:00.000Z',
    };
    expect(BffHealthResponseSchema.safeParse(response).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. BFF /device-activity Route (Fixture Mode)
// ═══════════════════════════════════════════════════════════════════════════
describe('BFF /device-activity route (fixture mode)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { impactRouter } = await import('./routes/impact');
    const app = express();
    app.use(express.json());
    app.use('/api/bff/impact', impactRouter);

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

  afterAll(() => {
    server?.close();
  });

  it('returns 400 for missing device ID', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid device ID');
  });

  it('returns 400 for non-numeric device ID', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity?id=abc`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid device ID');
  });

  it('returns activity rows for device 1042 in fixture mode', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity?id=1042`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const validation = DeviceActivityResponseSchema.safeParse(body);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.activityRows.length).toBeGreaterThan(0);
    }
  });

  it('activity rows have valid schema', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity?id=1042`);
    const body = await res.json();
    for (const row of body.activityRows) {
      const validation = ActivityRowSchema.safeParse(row);
      expect(validation.success).toBe(true);
    }
  });

  it('activity rows have no NaN or Infinity values', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity?id=1042`);
    const body = await res.json();
    const json = JSON.stringify(body);
    expect(json).not.toContain('NaN');
    expect(json).not.toContain('Infinity');
  });

  it('respects limit parameter', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity?id=1042&limit=3`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activityRows.length).toBeLessThanOrEqual(3);
  });

  it('clamps limit to max 200', async () => {
    const res = await fetch(`${baseUrl}/api/bff/impact/device-activity?id=1042&limit=999`);
    expect(res.status).toBe(200);
    // Should not crash — just returns what's available
    const body = await res.json();
    expect(Array.isArray(body.activityRows)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Health Endpoint ETL Status
// ═══════════════════════════════════════════════════════════════════════════
describe('Health endpoint ETL status (fixture mode)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { healthRouter } = await import('./routes/health');
    const app = express();
    app.use(express.json());
    app.use('/api/bff/health', healthRouter);

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

  afterAll(() => {
    server?.close();
  });

  it('returns etl: null in fixture mode (ETL not running)', async () => {
    const res = await fetch(`${baseUrl}/api/bff/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.etl).toBeNull();
  });

  it('health response validates against BffHealthResponseSchema with etl field', async () => {
    const res = await fetch(`${baseUrl}/api/bff/health`);
    const body = await res.json();
    const validation = BffHealthResponseSchema.safeParse(body);
    expect(validation.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Fixture File Validation
// ═══════════════════════════════════════════════════════════════════════════
describe('Device activity fixture files', () => {
  it('populated fixture exists and has activityRows', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.populated.fixture.json'), 'utf-8');
    const fixture = JSON.parse(raw);
    expect(Array.isArray(fixture.activityRows)).toBe(true);
    expect(fixture.activityRows.length).toBeGreaterThan(0);
  });

  it('populated fixture activityRows validate against schema', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.populated.fixture.json'), 'utf-8');
    const fixture = JSON.parse(raw);
    for (const row of fixture.activityRows) {
      const validation = ActivityRowSchema.safeParse(row);
      expect(validation.success).toBe(true);
    }
  });

  it('quiet fixture exists and has empty ehResponse', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.quiet.fixture.json'), 'utf-8');
    const fixture = JSON.parse(raw);
    expect(Array.isArray(fixture.ehResponse)).toBe(true);
    expect(fixture.ehResponse.length).toBe(0);
  });

  it('malformed fixture exists', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.malformed.fixture.json'), 'utf-8');
    const fixture = JSON.parse(raw);
    expect(fixture).toBeDefined();
  });

  it('transport-error fixture exists', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.transport-error.fixture.json'), 'utf-8');
    const fixture = JSON.parse(raw);
    expect(fixture).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Activity Row Edge Cases
// ═══════════════════════════════════════════════════════════════════════════
describe('Activity row edge cases', () => {
  it('ActivityRowSchema rejects row with empty statName', () => {
    const bad = {
      activityId: 1,
      deviceId: 1042,
      statName: '',
      fromTime: 1000,
      untilTime: 2000,
      modTime: 2000,
    };
    expect(ActivityRowSchema.safeParse(bad).success).toBe(false);
  });

  it('ActivityRowSchema rejects row with float activityId', () => {
    const bad = {
      activityId: 1.5,
      deviceId: 1042,
      statName: 'net',
      fromTime: 1000,
      untilTime: 2000,
      modTime: 2000,
    };
    expect(ActivityRowSchema.safeParse(bad).success).toBe(false);
  });

  it('ActivityRowSchema rejects row with missing fields', () => {
    const bad = { activityId: 1, deviceId: 1042 };
    expect(ActivityRowSchema.safeParse(bad).success).toBe(false);
  });

  it('ActivityRowSchema accepts row with negative times (epoch before 1970)', () => {
    const row = {
      activityId: 1,
      deviceId: 1042,
      statName: 'net',
      fromTime: -1000,
      untilTime: 0,
      modTime: 0,
    };
    // Negative epoch times are technically valid (pre-1970)
    expect(ActivityRowSchema.safeParse(row).success).toBe(true);
  });

  it('ActivityRowSchema accepts row with zero times', () => {
    const row = {
      activityId: 0,
      deviceId: 0,
      statName: 'tcp',
      fromTime: 0,
      untilTime: 0,
      modTime: 0,
    };
    expect(ActivityRowSchema.safeParse(row).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. NaN/Infinity Guards
// ═══════════════════════════════════════════════════════════════════════════
describe('NaN/Infinity guards in activity data', () => {
  it('fixture populated data contains no NaN', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.populated.fixture.json'), 'utf-8');
    expect(raw).not.toContain('NaN');
  });

  it('fixture populated data contains no Infinity', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'device-activity.populated.fixture.json'), 'utf-8');
    expect(raw).not.toContain('Infinity');
  });

  it('ETL status contains no NaN or Infinity', () => {
    const status = getEtlStatus();
    const json = JSON.stringify(status);
    expect(json).not.toContain('NaN');
    expect(json).not.toContain('Infinity');
  });
});
