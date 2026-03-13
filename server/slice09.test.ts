/**
 * Slice 09 — Device Detail Inspector Pane
 * Contract tests: types, validators, BFF route, fixtures, hook helpers, state discrimination
 *
 * Tests cover:
 * 1. Fixture files exist and parse as valid JSON (5 files × 2 = 10 vitest executions)
 * 2. DeviceDetailSchema validation against populated fixture
 * 3. DeviceDetailSchema rejection of malformed fixture
 * 4. DeviceProtocolActivitySchema validation (individual protocol rows)
 * 5. Quiet fixture validation (zero traffic, empty arrays)
 * 6. Not-found fixture shape validation
 * 7. Transport-error fixture shape validation
 * 8. isQuietDevice helper function
 * 9. BFF route /api/bff/impact/device-detail live local response (populated + quiet + missing id)
 * 10. DeviceDetail type structural checks (all required fields present)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import {
  DeviceDetailSchema,
  DeviceProtocolActivitySchema,
  DeviceIdentitySchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
} from '../shared/cockpit-validators';
import { isQuietDevice } from '../client/src/hooks/useDeviceDetail';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'device-detail');

// ─── Fixture file names ──────────────────────────────────────────────────
const FIXTURE_FILES = [
  'device-detail.populated.fixture.json',
  'device-detail.quiet.fixture.json',
  'device-detail.transport-error.fixture.json',
  'device-detail.malformed.fixture.json',
  'device-detail.not-found.fixture.json',
];

// ─── Helper: load fixture ────────────────────────────────────────────────
function loadFixture(name: string): any {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

// ─── 1. Fixture files exist and parse ────────────────────────────────────
// 2 it() call sites → 10 vitest executions (5 files × 2 tests each via for-loop)
describe('Fixture files exist and parse', () => {
  for (const file of FIXTURE_FILES) {
    it(`${file} exists on disk`, () => {
      expect(existsSync(join(FIXTURE_DIR, file))).toBe(true);
    });
    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 2. DeviceDetailSchema validates populated fixture ───────────────────
describe('DeviceDetailSchema — populated fixture', () => {
  const fixture = loadFixture('device-detail.populated.fixture.json');

  it('validates the full deviceDetail object', () => {
    const result = DeviceDetailSchema.safeParse(fixture.deviceDetail);
    expect(result.success).toBe(true);
  });

  it('device field passes DeviceIdentitySchema', () => {
    const result = DeviceIdentitySchema.safeParse(fixture.deviceDetail.device);
    expect(result.success).toBe(true);
  });

  it('traffic has all required numeric fields', () => {
    const t = fixture.deviceDetail.traffic;
    expect(typeof t.bytesIn).toBe('number');
    expect(typeof t.bytesOut).toBe('number');
    expect(typeof t.totalBytes).toBe('number');
    expect(typeof t.pktsIn).toBe('number');
    expect(typeof t.pktsOut).toBe('number');
    expect(t.bytesIn).toBeGreaterThanOrEqual(0);
    expect(t.bytesOut).toBeGreaterThanOrEqual(0);
    expect(t.totalBytes).toBeGreaterThanOrEqual(0);
  });

  it('protocols array is non-empty and each entry validates', () => {
    const protocols = fixture.deviceDetail.protocols;
    expect(Array.isArray(protocols)).toBe(true);
    expect(protocols.length).toBeGreaterThan(0);
    for (const proto of protocols) {
      const result = DeviceProtocolActivitySchema.safeParse(proto);
      expect(result.success).toBe(true);
    }
  });

  it('associatedDetections array validates against NormalizedDetectionSchema', () => {
    const detections = fixture.deviceDetail.associatedDetections;
    expect(Array.isArray(detections)).toBe(true);
    for (const d of detections) {
      const result = NormalizedDetectionSchema.safeParse(d);
      expect(result.success).toBe(true);
    }
  });

  it('associatedAlerts array validates against NormalizedAlertSchema', () => {
    const alerts = fixture.deviceDetail.associatedAlerts;
    expect(Array.isArray(alerts)).toBe(true);
    for (const a of alerts) {
      const result = NormalizedAlertSchema.safeParse(a);
      expect(result.success).toBe(true);
    }
  });

  it('activitySummary has correct field types', () => {
    const s = fixture.deviceDetail.activitySummary;
    expect(typeof s.totalProtocols).toBe('number');
    expect(typeof s.totalConnections).toBe('number');
    expect(s.firstSeen === null || typeof s.firstSeen === 'string').toBe(true);
    expect(s.lastSeen === null || typeof s.lastSeen === 'string').toBe(true);
    expect(s.peakThroughputBps === null || typeof s.peakThroughputBps === 'number').toBe(true);
  });

  it('populated device has non-zero traffic', () => {
    expect(fixture.deviceDetail.traffic.totalBytes).toBeGreaterThan(0);
  });

  it('populated device has at least one protocol', () => {
    expect(fixture.deviceDetail.protocols.length).toBeGreaterThan(0);
  });
});

// ─── 3. DeviceDetailSchema rejects malformed fixture ─────────────────────
describe('DeviceDetailSchema — malformed fixture', () => {
  const fixture = loadFixture('device-detail.malformed.fixture.json');

  it('rejects the malformed deviceDetail object', () => {
    const result = DeviceDetailSchema.safeParse(fixture.deviceDetail);
    expect(result.success).toBe(false);
  });

  it('reports specific validation issues', () => {
    const result = DeviceDetailSchema.safeParse(fixture.deviceDetail);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('device.id as string is rejected', () => {
    const result = DeviceIdentitySchema.safeParse(fixture.deviceDetail.device);
    expect(result.success).toBe(false);
  });

  it('negative bytesIn is rejected', () => {
    const trafficSchema = z.object({
      bytesIn: z.number().nonnegative(),
      bytesOut: z.number().nonnegative(),
      totalBytes: z.number().nonnegative(),
      pktsIn: z.number().nonnegative(),
      pktsOut: z.number().nonnegative(),
    });
    const result = trafficSchema.safeParse(fixture.deviceDetail.traffic);
    expect(result.success).toBe(false);
  });

  it('empty protocol name is rejected', () => {
    const proto = fixture.deviceDetail.protocols[0];
    const result = DeviceProtocolActivitySchema.safeParse(proto);
    expect(result.success).toBe(false);
  });

  it('activitySummary.totalProtocols as string is rejected', () => {
    const summarySchema = z.object({
      firstSeen: z.string().nullable(),
      lastSeen: z.string().nullable(),
      totalProtocols: z.number().int().nonnegative(),
      totalConnections: z.number().int().nonnegative(),
      peakThroughputBps: z.number().nullable(),
    });
    const result = summarySchema.safeParse(fixture.deviceDetail.activitySummary);
    expect(result.success).toBe(false);
  });
});

// ─── 4. DeviceProtocolActivitySchema — individual validation ─────────────
describe('DeviceProtocolActivitySchema', () => {
  it('accepts a valid protocol activity row', () => {
    const valid = {
      protocol: 'DNS',
      bytesIn: 100000,
      bytesOut: 50000,
      totalBytes: 150000,
      connections: 500,
      lastSeen: '2026-03-12T16:04:30.000Z',
    };
    const result = DeviceProtocolActivitySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects protocol with empty string name', () => {
    const invalid = {
      protocol: '',
      bytesIn: 100,
      bytesOut: 50,
      totalBytes: 150,
      connections: 1,
      lastSeen: '2026-03-12T16:00:00.000Z',
    };
    const result = DeviceProtocolActivitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects negative connections', () => {
    const invalid = {
      protocol: 'HTTP',
      bytesIn: 100,
      bytesOut: 50,
      totalBytes: 150,
      connections: -1,
      lastSeen: '2026-03-12T16:00:00.000Z',
    };
    const result = DeviceProtocolActivitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects non-integer connections', () => {
    const invalid = {
      protocol: 'TLS',
      bytesIn: 100,
      bytesOut: 50,
      totalBytes: 150,
      connections: 5.5,
      lastSeen: '2026-03-12T16:00:00.000Z',
    };
    const result = DeviceProtocolActivitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ─── 5. Quiet fixture validation ─────────────────────────────────────────
describe('Quiet fixture', () => {
  const fixture = loadFixture('device-detail.quiet.fixture.json');

  it('validates against DeviceDetailSchema', () => {
    const result = DeviceDetailSchema.safeParse(fixture.deviceDetail);
    expect(result.success).toBe(true);
  });

  it('has zero totalBytes', () => {
    expect(fixture.deviceDetail.traffic.totalBytes).toBe(0);
  });

  it('has empty protocols array', () => {
    expect(fixture.deviceDetail.protocols).toEqual([]);
  });

  it('has empty associatedDetections array', () => {
    expect(fixture.deviceDetail.associatedDetections).toEqual([]);
  });

  it('has empty associatedAlerts array', () => {
    expect(fixture.deviceDetail.associatedAlerts).toEqual([]);
  });

  it('activitySummary.lastSeen is null', () => {
    expect(fixture.deviceDetail.activitySummary.lastSeen).toBeNull();
  });
});

// ─── 6. Not-found fixture shape ──────────────────────────────────────────
describe('Not-found fixture', () => {
  const fixture = loadFixture('device-detail.not-found.fixture.json');

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
    expect(fixture.error.length).toBeGreaterThan(0);
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message.length).toBeGreaterThan(0);
  });

  it('does not have deviceDetail field', () => {
    expect(fixture.deviceDetail).toBeUndefined();
  });
});

// ─── 7. Transport-error fixture shape ────────────────────────────────────
describe('Transport-error fixture', () => {
  const fixture = loadFixture('device-detail.transport-error.fixture.json');

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
    expect(fixture.error.length).toBeGreaterThan(0);
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message.length).toBeGreaterThan(0);
  });

  it('does not have deviceDetail field', () => {
    expect(fixture.deviceDetail).toBeUndefined();
  });
});

// ─── 8. isQuietDevice helper ─────────────────────────────────────────────
describe('isQuietDevice helper', () => {
  it('returns true for quiet fixture data', () => {
    const fixture = loadFixture('device-detail.quiet.fixture.json');
    expect(isQuietDevice(fixture.deviceDetail)).toBe(true);
  });

  it('returns false for populated fixture data', () => {
    const fixture = loadFixture('device-detail.populated.fixture.json');
    expect(isQuietDevice(fixture.deviceDetail)).toBe(false);
  });

  it('returns false when only protocols are present', () => {
    const data = {
      device: {} as any,
      traffic: { bytesIn: 0, bytesOut: 0, totalBytes: 0, pktsIn: 0, pktsOut: 0 },
      protocols: [{ protocol: 'DNS', bytesIn: 0, bytesOut: 0, totalBytes: 0, connections: 1, lastSeen: '' }],
      associatedDetections: [],
      associatedAlerts: [],
      activitySummary: { firstSeen: null, lastSeen: null, totalProtocols: 1, totalConnections: 1, peakThroughputBps: null },
    };
    expect(isQuietDevice(data)).toBe(false);
  });

  it('returns false when only traffic is non-zero', () => {
    const data = {
      device: {} as any,
      traffic: { bytesIn: 100, bytesOut: 0, totalBytes: 100, pktsIn: 1, pktsOut: 0 },
      protocols: [],
      associatedDetections: [],
      associatedAlerts: [],
      activitySummary: { firstSeen: null, lastSeen: null, totalProtocols: 0, totalConnections: 0, peakThroughputBps: null },
    };
    expect(isQuietDevice(data)).toBe(false);
  });

  it('returns false when only detections are present', () => {
    const data = {
      device: {} as any,
      traffic: { bytesIn: 0, bytesOut: 0, totalBytes: 0, pktsIn: 0, pktsOut: 0 },
      protocols: [],
      associatedDetections: [{ id: 1 } as any],
      associatedAlerts: [],
      activitySummary: { firstSeen: null, lastSeen: null, totalProtocols: 0, totalConnections: 0, peakThroughputBps: null },
    };
    expect(isQuietDevice(data)).toBe(false);
  });

  it('returns false when only alerts are present', () => {
    const data = {
      device: {} as any,
      traffic: { bytesIn: 0, bytesOut: 0, totalBytes: 0, pktsIn: 0, pktsOut: 0 },
      protocols: [],
      associatedDetections: [],
      associatedAlerts: [{ id: 1 } as any],
      activitySummary: { firstSeen: null, lastSeen: null, totalProtocols: 0, totalConnections: 0, peakThroughputBps: null },
    };
    expect(isQuietDevice(data)).toBe(false);
  });
});

// ─── 9. BFF route /api/bff/impact/device-detail ──────────────────────────
describe('BFF route /api/bff/impact/device-detail', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/device-detail';

  it('returns 400 when id param is missing', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid device ID');
  });

  it('returns 400 when id param is non-numeric', async () => {
    const res = await fetch(`${BASE}?id=abc`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid device ID');
  });

  it('returns 200 with valid deviceDetail for device 1042 (populated fixture)', async () => {
    const res = await fetch(`${BASE}?id=1042`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviceDetail).toBeDefined();
    const validation = DeviceDetailSchema.safeParse(body.deviceDetail);
    expect(validation.success).toBe(true);
  });

  it('populated response has non-empty protocols', async () => {
    const res = await fetch(`${BASE}?id=1042`);
    const body = await res.json();
    expect(body.deviceDetail.protocols.length).toBeGreaterThan(0);
  });

  it('returns 200 with quiet deviceDetail for unknown device id (quiet fixture)', async () => {
    const res = await fetch(`${BASE}?id=5555`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deviceDetail).toBeDefined();
    const validation = DeviceDetailSchema.safeParse(body.deviceDetail);
    expect(validation.success).toBe(true);
    expect(body.deviceDetail.traffic.totalBytes).toBe(0);
  });

  it('quiet response has empty protocols array', async () => {
    const res = await fetch(`${BASE}?id=5555`);
    const body = await res.json();
    expect(body.deviceDetail.protocols).toEqual([]);
  });

  it('quiet response has empty associatedDetections array', async () => {
    const res = await fetch(`${BASE}?id=5555`);
    const body = await res.json();
    expect(body.deviceDetail.associatedDetections).toEqual([]);
  });
});

// ─── 10. DeviceDetail structural checks ──────────────────────────────────
describe('DeviceDetail structural completeness', () => {
  const fixture = loadFixture('device-detail.populated.fixture.json');
  const detail = fixture.deviceDetail;

  it('has device field with id', () => {
    expect(typeof detail.device.id).toBe('number');
  });

  it('has device field with displayName', () => {
    expect(typeof detail.device.displayName).toBe('string');
    expect(detail.device.displayName.length).toBeGreaterThan(0);
  });

  it('has traffic field with all 5 numeric properties', () => {
    const keys = ['bytesIn', 'bytesOut', 'totalBytes', 'pktsIn', 'pktsOut'];
    for (const k of keys) {
      expect(typeof detail.traffic[k]).toBe('number');
    }
  });

  it('has protocols as array', () => {
    expect(Array.isArray(detail.protocols)).toBe(true);
  });

  it('has associatedDetections as array', () => {
    expect(Array.isArray(detail.associatedDetections)).toBe(true);
  });

  it('has associatedAlerts as array', () => {
    expect(Array.isArray(detail.associatedAlerts)).toBe(true);
  });

  it('has activitySummary with all required fields', () => {
    const keys = ['firstSeen', 'lastSeen', 'totalProtocols', 'totalConnections', 'peakThroughputBps'];
    for (const k of keys) {
      expect(k in detail.activitySummary).toBe(true);
    }
  });

  it('protocol rows each have protocol name, bytesIn, bytesOut, totalBytes, connections, lastSeen', () => {
    for (const proto of detail.protocols) {
      expect(typeof proto.protocol).toBe('string');
      expect(typeof proto.bytesIn).toBe('number');
      expect(typeof proto.bytesOut).toBe('number');
      expect(typeof proto.totalBytes).toBe('number');
      expect(typeof proto.connections).toBe('number');
      expect(typeof proto.lastSeen).toBe('string');
    }
  });
});
