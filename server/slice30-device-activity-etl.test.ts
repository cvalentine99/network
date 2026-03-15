/**
 * Slice 30 — Device Activity ETL Pipeline Tests
 *
 * Tests cover:
 *   1. normalizeDeviceActivity — raw ExtraHop → DeviceActivityRecord[]
 *   2. computeActivitySummary — records → activitySummary shape
 *   3. Data contract schemas (EhDeviceActivityRecordSchema, DeviceActivityRowSchema, etc.)
 *   4. Fixture generation and validation
 *   5. Edge cases: empty, malformed, duplicates, NaN/Infinity guards
 *   6. Route integration: device-detail fixture mode still returns valid activitySummary
 *
 * CONTRACT:
 *   - All tests run against deterministic fixtures, not live systems
 *   - No ExtraHop appliance required
 *   - No database required (normalizer tests are pure functions)
 *   - DB helpers are tested via schema validation only (no live DB in CI)
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeDeviceActivity,
  computeActivitySummary,
  type DeviceActivityRecord,
} from './extrahop-normalizers';
import {
  EhDeviceActivityRecordSchema,
  EhDeviceActivityResponseSchema,
  DeviceActivityRowSchema,
  DeviceActivitySummarySchema,
  DeviceActivityEtlResultSchema,
} from '../shared/device-activity-contract';
import { DeviceDetailSchema } from '../shared/cockpit-validators';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Deterministic Fixtures ──────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

/** Realistic ExtraHop GET /api/v1/devices/{id}/activity response */
const POPULATED_EH_RESPONSE = [
  {
    id: 10001,
    stat_name: 'net',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
  {
    id: 10002,
    stat_name: 'http_client',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
  {
    id: 10003,
    stat_name: 'dns_client',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
  {
    id: 10004,
    stat_name: 'ssl_client',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
  {
    id: 10005,
    stat_name: 'smb_client',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
  {
    id: 10006,
    stat_name: 'net',
    from_time: 1741795500000,
    until_time: 1741795800000,
    mod_time: 1741795800000,
  },
  {
    id: 10007,
    stat_name: 'ldap_client',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
  {
    id: 10008,
    stat_name: 'kerberos_client',
    from_time: 1741795200000,
    until_time: 1741795500000,
    mod_time: 1741795500000,
  },
];

const QUIET_EH_RESPONSE: any[] = [];

const MALFORMED_EH_RESPONSE = [
  { id: 'not-a-number', stat_name: 123, from_time: 'bad' },
  null,
  undefined,
  { id: 10009, stat_name: '', from_time: 1741795200000, until_time: 1741795500000, mod_time: 1741795500000 },
  { stat_name: 'net', from_time: 1741795200000 }, // missing id → id=0 → skipped
  { id: 10010, stat_name: 'http_server', from_time: NaN, until_time: Infinity, mod_time: -Infinity },
];

const DUPLICATE_EH_RESPONSE = [
  { id: 10001, stat_name: 'net', from_time: 1741795200000, until_time: 1741795500000, mod_time: 1741795500000 },
  { id: 10001, stat_name: 'net', from_time: 1741795200000, until_time: 1741795500000, mod_time: 1741795500000 },
  { id: 10002, stat_name: 'http_client', from_time: 1741795200000, until_time: 1741795500000, mod_time: 1741795500000 },
];

const FIXED_POLLED_AT = new Date('2026-03-15T12:00:00.000Z');

// ─── 1. ExtraHop Response Schema Validation ─────────────────────────────

describe('Slice 30 — EhDeviceActivityRecordSchema', () => {
  it('validates a well-formed activity record', () => {
    const result = EhDeviceActivityRecordSchema.safeParse(POPULATED_EH_RESPONSE[0]);
    expect(result.success).toBe(true);
  });

  it('rejects a record with string id', () => {
    const result = EhDeviceActivityRecordSchema.safeParse({ id: 'abc', stat_name: 'net', from_time: 0, until_time: 0, mod_time: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a record with missing stat_name', () => {
    const result = EhDeviceActivityRecordSchema.safeParse({ id: 1, from_time: 0, until_time: 0, mod_time: 0 });
    expect(result.success).toBe(false);
  });

  it('validates the full populated response array', () => {
    const result = EhDeviceActivityResponseSchema.safeParse(POPULATED_EH_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(8);
    }
  });

  it('validates an empty response array', () => {
    const result = EhDeviceActivityResponseSchema.safeParse([]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});

// ─── 2. normalizeDeviceActivity ─────────────────────────────────────────

describe('Slice 30 — normalizeDeviceActivity', () => {
  it('normalizes a populated response into DeviceActivityRecord[]', () => {
    const records = normalizeDeviceActivity(POPULATED_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(8);
    expect(records[0]).toEqual({
      rawId: 10001,
      activityId: 10001,
      deviceId: 1042,
      fromTime: 1741795200000,
      untilTime: 1741795500000,
      modTime: 1741795500000,
      statName: 'net',
      polledAt: FIXED_POLLED_AT,
    });
  });

  it('sets deviceId from the parameter, not from the raw data', () => {
    const records = normalizeDeviceActivity(POPULATED_EH_RESPONSE, 9999, FIXED_POLLED_AT);
    for (const r of records) {
      expect(r.deviceId).toBe(9999);
    }
  });

  it('returns empty array for empty response', () => {
    const records = normalizeDeviceActivity(QUIET_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(0);
  });

  it('returns empty array for non-array input', () => {
    expect(normalizeDeviceActivity(null as any, 1042)).toHaveLength(0);
    expect(normalizeDeviceActivity(undefined as any, 1042)).toHaveLength(0);
    expect(normalizeDeviceActivity('bad' as any, 1042)).toHaveLength(0);
    expect(normalizeDeviceActivity({} as any, 1042)).toHaveLength(0);
  });

  it('skips null and undefined entries', () => {
    const records = normalizeDeviceActivity([null, undefined, POPULATED_EH_RESPONSE[0]], 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(1);
    expect(records[0].rawId).toBe(10001);
  });

  it('skips entries with id=0 (missing/invalid id)', () => {
    const records = normalizeDeviceActivity(
      [{ stat_name: 'net', from_time: 100, until_time: 200, mod_time: 200 }],
      1042,
      FIXED_POLLED_AT
    );
    expect(records).toHaveLength(0);
  });

  it('skips entries with empty stat_name', () => {
    const records = normalizeDeviceActivity(
      [{ id: 10009, stat_name: '', from_time: 100, until_time: 200, mod_time: 200 }],
      1042,
      FIXED_POLLED_AT
    );
    expect(records).toHaveLength(0);
  });

  it('deduplicates entries with the same id in a single batch', () => {
    const records = normalizeDeviceActivity(DUPLICATE_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(2); // 10001 appears once, 10002 appears once
    expect(records.map(r => r.rawId)).toEqual([10001, 10002]);
  });

  it('handles malformed data gracefully — only valid records pass through', () => {
    const records = normalizeDeviceActivity(MALFORMED_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    // "not-a-number" id → safeNum → 0 → skipped
    // null → skipped
    // undefined → skipped
    // empty stat_name → skipped
    // missing id → id=0 → skipped
    // id: 10010, stat_name: 'http_server' → valid (NaN/Infinity → 0 via safeNum)
    expect(records).toHaveLength(1);
    expect(records[0].rawId).toBe(10010);
    expect(records[0].statName).toBe('http_server');
  });

  it('NaN/Infinity in time fields are coerced to 0 via safeNum', () => {
    const records = normalizeDeviceActivity(
      [{ id: 10010, stat_name: 'http_server', from_time: NaN, until_time: Infinity, mod_time: -Infinity }],
      1042,
      FIXED_POLLED_AT
    );
    expect(records).toHaveLength(1);
    expect(records[0].fromTime).toBe(0);
    expect(records[0].untilTime).toBe(0);
    expect(records[0].modTime).toBe(0);
  });

  it('handles snake_case and camelCase field names', () => {
    const camelCaseRecord = {
      id: 20001,
      statName: 'tcp_client',
      fromTime: 1741795200000,
      untilTime: 1741795500000,
      modTime: 1741795500000,
    };
    const records = normalizeDeviceActivity([camelCaseRecord], 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(1);
    expect(records[0].statName).toBe('tcp_client');
    expect(records[0].fromTime).toBe(1741795200000);
  });

  it('all output records pass DeviceActivityRowSchema validation', () => {
    const records = normalizeDeviceActivity(POPULATED_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    for (const r of records) {
      const result = DeviceActivityRowSchema.safeParse(r);
      expect(result.success).toBe(true);
    }
  });
});

// ─── 3. computeActivitySummary ──────────────────────────────────────────

describe('Slice 30 — computeActivitySummary', () => {
  it('computes correct summary from populated records', () => {
    const records = normalizeDeviceActivity(POPULATED_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    const summary = computeActivitySummary(records, '2026-03-03T14:26:40.000Z', '2026-03-12T16:04:30.000Z');

    expect(summary.firstSeen).toBe('2026-03-03T14:26:40.000Z');
    expect(summary.lastSeen).toBe('2026-03-12T16:04:30.000Z');
    // 7 distinct stat_names: net, http_client, dns_client, ssl_client, smb_client, ldap_client, kerberos_client
    expect(summary.totalProtocols).toBe(7);
    expect(summary.totalConnections).toBe(8); // 8 records total
    expect(summary.peakThroughputBps).toBeNull(); // Not derivable from activity endpoint
  });

  it('computes correct summary from empty records', () => {
    const summary = computeActivitySummary([], '2026-03-03T14:26:40.000Z', '2026-03-12T16:04:30.000Z');
    expect(summary.totalProtocols).toBe(0);
    expect(summary.totalConnections).toBe(0);
    expect(summary.peakThroughputBps).toBeNull();
  });

  it('handles null firstSeen/lastSeen', () => {
    const records = normalizeDeviceActivity(POPULATED_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    const summary = computeActivitySummary(records, null, null);
    expect(summary.firstSeen).toBeNull();
    expect(summary.lastSeen).toBeNull();
    expect(summary.totalProtocols).toBe(7);
  });

  it('summary passes DeviceActivitySummarySchema validation', () => {
    const records = normalizeDeviceActivity(POPULATED_EH_RESPONSE, 1042, FIXED_POLLED_AT);
    const summary = computeActivitySummary(records, '2026-03-03T14:26:40.000Z', '2026-03-12T16:04:30.000Z');
    const result = DeviceActivitySummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it('empty summary passes DeviceActivitySummarySchema validation', () => {
    const summary = computeActivitySummary([], null, null);
    const result = DeviceActivitySummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it('counts distinct protocols correctly when duplicates exist', () => {
    const records = normalizeDeviceActivity(
      [
        { id: 1, stat_name: 'net', from_time: 100, until_time: 200, mod_time: 200 },
        { id: 2, stat_name: 'net', from_time: 200, until_time: 300, mod_time: 300 },
        { id: 3, stat_name: 'http_client', from_time: 100, until_time: 200, mod_time: 200 },
      ],
      1042,
      FIXED_POLLED_AT
    );
    const summary = computeActivitySummary(records, null, null);
    expect(summary.totalProtocols).toBe(2); // net, http_client
    expect(summary.totalConnections).toBe(3); // 3 records
  });
});

// ─── 4. DeviceActivityEtlResultSchema ───────────────────────────────────

describe('Slice 30 — DeviceActivityEtlResultSchema', () => {
  it('validates a well-formed ETL result', () => {
    const result = DeviceActivityEtlResultSchema.safeParse({
      deviceId: 1042,
      recordsFetched: 8,
      recordsUpserted: 8,
      distinctProtocols: 7,
      summary: {
        firstSeen: '2026-03-03T14:26:40.000Z',
        lastSeen: '2026-03-12T16:04:30.000Z',
        totalProtocols: 7,
        totalConnections: 8,
        peakThroughputBps: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative recordsFetched', () => {
    const result = DeviceActivityEtlResultSchema.safeParse({
      deviceId: 1042,
      recordsFetched: -1,
      recordsUpserted: 0,
      distinctProtocols: 0,
      summary: { firstSeen: null, lastSeen: null, totalProtocols: 0, totalConnections: 0, peakThroughputBps: null },
    });
    expect(result.success).toBe(false);
  });
});

// ─── 5. Fixture File Validation ─────────────────────────────────────────

describe('Slice 30 — Fixture file validation', () => {
  it('device-detail.populated.fixture.json has valid activitySummary', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-detail', 'device-detail.populated.fixture.json'), 'utf-8'));
    const detail = raw.deviceDetail;
    expect(detail.activitySummary).toBeDefined();
    const result = DeviceActivitySummarySchema.safeParse(detail.activitySummary);
    expect(result.success).toBe(true);
  });

  it('device-detail.quiet.fixture.json has valid activitySummary with zeros', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-detail', 'device-detail.quiet.fixture.json'), 'utf-8'));
    const detail = raw.deviceDetail;
    expect(detail.activitySummary).toBeDefined();
    const result = DeviceActivitySummarySchema.safeParse(detail.activitySummary);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalProtocols).toBe(0);
      expect(result.data.totalConnections).toBe(0);
    }
  });

  it('device-detail.populated.fixture.json passes full DeviceDetailSchema', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-detail', 'device-detail.populated.fixture.json'), 'utf-8'));
    const result = DeviceDetailSchema.safeParse(raw.deviceDetail);
    expect(result.success).toBe(true);
  });
});

// ─── 6. Device Activity Fixture Files ───────────────────────────────────

describe('Slice 30 — Device activity fixture files', () => {
  it('device-activity.populated.fixture.json exists and is valid', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-activity', 'device-activity.populated.fixture.json'), 'utf-8'));
    expect(raw.description).toBeDefined();
    expect(raw.ehResponse).toBeDefined();
    expect(Array.isArray(raw.ehResponse)).toBe(true);
    expect(raw.ehResponse.length).toBeGreaterThan(0);

    // Validate each record against the schema
    const result = EhDeviceActivityResponseSchema.safeParse(raw.ehResponse);
    expect(result.success).toBe(true);
  });

  it('device-activity.quiet.fixture.json exists and is valid', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-activity', 'device-activity.quiet.fixture.json'), 'utf-8'));
    expect(raw.description).toBeDefined();
    expect(raw.ehResponse).toBeDefined();
    expect(Array.isArray(raw.ehResponse)).toBe(true);
    expect(raw.ehResponse.length).toBe(0);
  });

  it('device-activity.malformed.fixture.json exists and contains bad data', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-activity', 'device-activity.malformed.fixture.json'), 'utf-8'));
    expect(raw.description).toBeDefined();
    expect(raw.ehResponse).toBeDefined();
    // Malformed fixture should have entries that fail schema validation
    const result = EhDeviceActivityResponseSchema.safeParse(raw.ehResponse);
    expect(result.success).toBe(false);
  });

  it('populated fixture normalizes correctly', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-activity', 'device-activity.populated.fixture.json'), 'utf-8'));
    const records = normalizeDeviceActivity(raw.ehResponse, 1042, FIXED_POLLED_AT);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) {
      expect(r.deviceId).toBe(1042);
      expect(r.statName).toBeTruthy();
      expect(Number.isFinite(r.fromTime)).toBe(true);
      expect(Number.isFinite(r.untilTime)).toBe(true);
    }
  });

  it('quiet fixture normalizes to empty array', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-activity', 'device-activity.quiet.fixture.json'), 'utf-8'));
    const records = normalizeDeviceActivity(raw.ehResponse, 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(0);
  });

  it('malformed fixture normalizes gracefully — only valid records survive', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, 'device-activity', 'device-activity.malformed.fixture.json'), 'utf-8'));
    const records = normalizeDeviceActivity(raw.ehResponse, 1042, FIXED_POLLED_AT);
    // All records should be valid (no NaN, no empty statName)
    for (const r of records) {
      expect(Number.isFinite(r.rawId)).toBe(true);
      expect(r.rawId).not.toBe(0);
      expect(r.statName.length).toBeGreaterThan(0);
    }
  });
});

// ─── 7. BFF Route Integration (fixture mode) ───────────────────────────

describe('Slice 30 — BFF device-detail route fixture mode', () => {
  it('GET /api/bff/impact/device-detail?id=1042 returns valid activitySummary', async () => {
    const resp = await fetch('http://localhost:3000/api/bff/impact/device-detail?id=1042');
    expect(resp.ok).toBe(true);
    const body = await resp.json();
    expect(body.deviceDetail).toBeDefined();
    expect(body.deviceDetail.activitySummary).toBeDefined();

    const result = DeviceActivitySummarySchema.safeParse(body.deviceDetail.activitySummary);
    expect(result.success).toBe(true);
  });

  it('device-detail activitySummary has non-negative integers', async () => {
    const resp = await fetch('http://localhost:3000/api/bff/impact/device-detail?id=1042');
    const body = await resp.json();
    const summary = body.deviceDetail.activitySummary;

    expect(summary.totalProtocols).toBeGreaterThanOrEqual(0);
    expect(summary.totalConnections).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(summary.totalProtocols)).toBe(true);
    expect(Number.isInteger(summary.totalConnections)).toBe(true);
  });

  it('quiet device returns zero activity summary', async () => {
    const resp = await fetch('http://localhost:3000/api/bff/impact/device-detail?id=0');
    const body = await resp.json();
    if (body.deviceDetail) {
      expect(body.deviceDetail.activitySummary.totalProtocols).toBe(0);
      expect(body.deviceDetail.activitySummary.totalConnections).toBe(0);
    }
  });
});

// ─── 8. NaN/Infinity Guards ─────────────────────────────────────────────

describe('Slice 30 — NaN/Infinity guards', () => {
  const poisonRecords = [
    { id: 1, stat_name: 'net', from_time: NaN, until_time: NaN, mod_time: NaN },
    { id: 2, stat_name: 'http', from_time: Infinity, until_time: -Infinity, mod_time: Infinity },
    { id: 3, stat_name: 'dns', from_time: undefined, until_time: null, mod_time: 'bad' },
  ];

  it('no NaN values in normalized output', () => {
    const records = normalizeDeviceActivity(poisonRecords, 1042, FIXED_POLLED_AT);
    for (const r of records) {
      expect(Number.isNaN(r.rawId)).toBe(false);
      expect(Number.isNaN(r.fromTime)).toBe(false);
      expect(Number.isNaN(r.untilTime)).toBe(false);
      expect(Number.isNaN(r.modTime)).toBe(false);
    }
  });

  it('no Infinity values in normalized output', () => {
    const records = normalizeDeviceActivity(poisonRecords, 1042, FIXED_POLLED_AT);
    for (const r of records) {
      expect(Number.isFinite(r.rawId)).toBe(true);
      expect(Number.isFinite(r.fromTime)).toBe(true);
      expect(Number.isFinite(r.untilTime)).toBe(true);
      expect(Number.isFinite(r.modTime)).toBe(true);
    }
  });

  it('no NaN/Infinity in activity summary', () => {
    const records = normalizeDeviceActivity(poisonRecords, 1042, FIXED_POLLED_AT);
    const summary = computeActivitySummary(records, null, null);
    expect(Number.isFinite(summary.totalProtocols)).toBe(true);
    expect(Number.isFinite(summary.totalConnections)).toBe(true);
    expect(Number.isNaN(summary.totalProtocols)).toBe(false);
    expect(Number.isNaN(summary.totalConnections)).toBe(false);
  });
});

// ─── 9. Edge Cases ──────────────────────────────────────────────────────

describe('Slice 30 — Edge cases', () => {
  it('handles very large activity response (100 records)', () => {
    const largeResponse = Array.from({ length: 100 }, (_, i) => ({
      id: 30000 + i,
      stat_name: `protocol_${i % 10}`,
      from_time: 1741795200000 + i * 300000,
      until_time: 1741795200000 + (i + 1) * 300000,
      mod_time: 1741795200000 + (i + 1) * 300000,
    }));
    const records = normalizeDeviceActivity(largeResponse, 1042, FIXED_POLLED_AT);
    expect(records).toHaveLength(100);

    const summary = computeActivitySummary(records, null, null);
    expect(summary.totalProtocols).toBe(10); // 10 distinct protocol_0..protocol_9
    expect(summary.totalConnections).toBe(100);
  });

  it('handles single record', () => {
    const records = normalizeDeviceActivity(
      [{ id: 1, stat_name: 'net', from_time: 100, until_time: 200, mod_time: 200 }],
      1042,
      FIXED_POLLED_AT
    );
    expect(records).toHaveLength(1);
    const summary = computeActivitySummary(records, null, null);
    expect(summary.totalProtocols).toBe(1);
    expect(summary.totalConnections).toBe(1);
  });

  it('handles records with all the same stat_name', () => {
    const sameProtocol = Array.from({ length: 5 }, (_, i) => ({
      id: 40000 + i,
      stat_name: 'net',
      from_time: 1741795200000 + i * 300000,
      until_time: 1741795200000 + (i + 1) * 300000,
      mod_time: 1741795200000 + (i + 1) * 300000,
    }));
    const records = normalizeDeviceActivity(sameProtocol, 1042, FIXED_POLLED_AT);
    const summary = computeActivitySummary(records, null, null);
    expect(summary.totalProtocols).toBe(1);
    expect(summary.totalConnections).toBe(5);
  });

  it('polledAt defaults to current time when not provided', () => {
    const before = new Date();
    const records = normalizeDeviceActivity(
      [{ id: 1, stat_name: 'net', from_time: 100, until_time: 200, mod_time: 200 }],
      1042
    );
    const after = new Date();
    expect(records).toHaveLength(1);
    expect(records[0].polledAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(records[0].polledAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
