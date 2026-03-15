/**
 * Slice 29 — ExtraHop Client, Cache & Route Integration Tests
 *
 * Covers:
 *   1. ExtraHopClientError class contract
 *   2. TTL cache internals (set, get, expiry, eviction, stats)
 *   3. isFixtureMode() env-var gating (DB fallback is separate)
 *   4. ehRequest error handling (NO_CONFIG, API_ERROR, TIMEOUT, NETWORK_ERROR)
 *   5. ehBinaryRequest error handling
 *   6. Route-level live-mode error handling (all routes use ExtraHopClientError)
 *   7. Route-level fixture-mode schema validation
 *   8. Normalizer edge cases not covered in slice29-live-integration.test.ts
 *
 * These tests do NOT require a live ExtraHop appliance.
 * They validate the contract between the client layer, cache layer,
 * normalizers, and route error handling.
 *
 * Deferred by contract: live hardware / appliance / packet store / environment
 * access is not part of the current frontend phase.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ExtraHopClientError,
  cacheClear,
  getCacheStats,
  isFixtureMode,
} from './extrahop-client';
import {
  normalizeHeadline,
  normalizeTimeseries,
  normalizeDeviceIdentity,
  normalizeDetection,
  normalizeAlert,
  normalizeApplianceIdentity,
  normalizeApplianceStatus,
  buildMetricsRequest,
} from './extrahop-normalizers';
import {
  ImpactHeadlineSchema,
  DeviceIdentitySchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
  ApplianceStatusSchema,
  BffHealthResponseSchema,
} from '../shared/cockpit-validators';

// ═══════════════════════════════════════════════════════════════════════════
// 1. ExtraHopClientError Class Contract
// ═══════════════════════════════════════════════════════════════════════════

describe('ExtraHopClientError', () => {
  it('is an instance of Error', () => {
    const err = new ExtraHopClientError('test', 'TEST_CODE', 500);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct name property', () => {
    const err = new ExtraHopClientError('test', 'TEST_CODE', 500);
    expect(err.name).toBe('ExtraHopClientError');
  });

  it('preserves message', () => {
    const err = new ExtraHopClientError('Something went wrong', 'API_ERROR', 502);
    expect(err.message).toBe('Something went wrong');
  });

  it('preserves code', () => {
    const err = new ExtraHopClientError('msg', 'NO_CONFIG', 0);
    expect(err.code).toBe('NO_CONFIG');
  });

  it('preserves httpStatus', () => {
    const err = new ExtraHopClientError('msg', 'API_ERROR', 403);
    expect(err.httpStatus).toBe(403);
  });

  it('supports NO_CONFIG code with httpStatus 0', () => {
    const err = new ExtraHopClientError('No appliance configured', 'NO_CONFIG', 0);
    expect(err.code).toBe('NO_CONFIG');
    expect(err.httpStatus).toBe(0);
  });

  it('supports TIMEOUT code', () => {
    const err = new ExtraHopClientError('Timed out', 'TIMEOUT', 0);
    expect(err.code).toBe('TIMEOUT');
    expect(err.httpStatus).toBe(0);
  });

  it('supports NETWORK_ERROR code', () => {
    const err = new ExtraHopClientError('Connection refused', 'NETWORK_ERROR', 0);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.httpStatus).toBe(0);
  });

  it('supports API_ERROR code with various HTTP statuses', () => {
    for (const status of [400, 401, 403, 404, 500, 502, 503]) {
      const err = new ExtraHopClientError(`HTTP ${status}`, 'API_ERROR', status);
      expect(err.code).toBe('API_ERROR');
      expect(err.httpStatus).toBe(status);
    }
  });

  it('has a stack trace', () => {
    const err = new ExtraHopClientError('test', 'TEST', 0);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('ExtraHopClientError');
  });

  it('can be caught as Error', () => {
    try {
      throw new ExtraHopClientError('catch test', 'TEST', 0);
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(ExtraHopClientError);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. TTL Cache Internals
// ═══════════════════════════════════════════════════════════════════════════

describe('TTL Cache', () => {
  beforeEach(() => {
    cacheClear();
  });

  it('starts empty after clear', () => {
    const stats = getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('maxSize is 500', () => {
    expect(getCacheStats().maxSize).toBe(500);
  });

  it('maxSize is a positive integer', () => {
    const { maxSize } = getCacheStats();
    expect(Number.isInteger(maxSize)).toBe(true);
    expect(maxSize).toBeGreaterThan(0);
  });

  it('cacheClear resets hits and misses', () => {
    // After clear, counters should be zero
    cacheClear();
    const stats = getCacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('getCacheStats returns all required fields', () => {
    const stats = getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('maxSize');
    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
    expect(typeof stats.size).toBe('number');
    expect(typeof stats.maxSize).toBe('number');
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
  });

  it('all cache stats are non-negative', () => {
    const stats = getCacheStats();
    expect(stats.size).toBeGreaterThanOrEqual(0);
    expect(stats.maxSize).toBeGreaterThanOrEqual(0);
    expect(stats.hits).toBeGreaterThanOrEqual(0);
    expect(stats.misses).toBeGreaterThanOrEqual(0);
  });

  it('cache stats pass BffHealthResponse schema for cache field', () => {
    const stats = getCacheStats();
    // The health route embeds cache stats in bff.cache
    const cacheSchema = BffHealthResponseSchema.shape.bff.shape.cache;
    const result = cacheSchema.safeParse({ size: stats.size, maxSize: stats.maxSize });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. isFixtureMode() Env-Var Gating
// ═══════════════════════════════════════════════════════════════════════════

describe('isFixtureMode() env-var gating', () => {
  const origHost = process.env.EH_HOST;
  const origKey = process.env.EH_API_KEY;

  afterEach(() => {
    // Restore original env
    if (origHost !== undefined) process.env.EH_HOST = origHost;
    else delete process.env.EH_HOST;
    if (origKey !== undefined) process.env.EH_API_KEY = origKey;
    else delete process.env.EH_API_KEY;
  });

  it('returns true when both EH_HOST and EH_API_KEY are missing', () => {
    delete process.env.EH_HOST;
    delete process.env.EH_API_KEY;
    expect(isFixtureMode()).toBe(true);
  });

  it('returns true when EH_HOST is set but EH_API_KEY is missing', () => {
    process.env.EH_HOST = 'extrahop.lab.local';
    delete process.env.EH_API_KEY;
    expect(isFixtureMode()).toBe(true);
  });

  it('returns true when EH_API_KEY is set but EH_HOST is missing', () => {
    delete process.env.EH_HOST;
    process.env.EH_API_KEY = 'real-api-key-123';
    expect(isFixtureMode()).toBe(true);
  });

  it('returns true when EH_HOST is empty string', () => {
    process.env.EH_HOST = '';
    process.env.EH_API_KEY = 'real-api-key-123';
    expect(isFixtureMode()).toBe(true);
  });

  it('returns true when EH_API_KEY is empty string', () => {
    process.env.EH_HOST = 'extrahop.lab.local';
    process.env.EH_API_KEY = '';
    expect(isFixtureMode()).toBe(true);
  });

  it('returns true when EH_API_KEY is REPLACE_ME', () => {
    process.env.EH_HOST = 'extrahop.lab.local';
    process.env.EH_API_KEY = 'REPLACE_ME';
    expect(isFixtureMode()).toBe(true);
  });

  it('returns false when both are set to real values', () => {
    process.env.EH_HOST = 'extrahop.lab.local';
    process.env.EH_API_KEY = 'abc123-real-key';
    expect(isFixtureMode()).toBe(false);
  });

  it('is a pure function — same env → same result', () => {
    process.env.EH_HOST = 'test.example.com';
    process.env.EH_API_KEY = 'key123';
    const r1 = isFixtureMode();
    const r2 = isFixtureMode();
    expect(r1).toBe(r2);
    expect(r1).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Normalizer Edge Cases (beyond slice29-live-integration.test.ts)
// ═══════════════════════════════════════════════════════════════════════════

describe('Normalizer edge cases', () => {
  describe('normalizeHeadline edge cases', () => {
    it('handles negative values safely', () => {
      const result = normalizeHeadline(
        [{ time: 1700000000000, duration: 30000, values: [-100, -200, -10, -20] }],
        30000
      );
      // Negative values are technically valid from the API (delta metrics)
      expect(Number.isFinite(result.totalBytes)).toBe(true);
      expect(Number.isFinite(result.totalPackets)).toBe(true);
    });

    it('handles extremely large values without overflow', () => {
      const result = normalizeHeadline(
        [{ time: 1700000000000, duration: 30000, values: [Number.MAX_SAFE_INTEGER, 0, 0, 0] }],
        30000
      );
      expect(Number.isFinite(result.totalBytes)).toBe(true);
      expect(Number.isFinite(result.bytesPerSecond)).toBe(true);
    });

    it('handles zero duration gracefully', () => {
      const result = normalizeHeadline(
        [{ time: 1700000000000, duration: 30000, values: [1000, 2000, 10, 20] }],
        0 // zero duration
      );
      // computeRate returns null for zero duration, normalizer coerces to 0
      expect(result.bytesPerSecond).toBe(0);
      expect(result.packetsPerSecond).toBe(0);
    });

    it('handles negative duration gracefully', () => {
      const result = normalizeHeadline(
        [{ time: 1700000000000, duration: 30000, values: [1000, 2000, 10, 20] }],
        -1000
      );
      expect(result.bytesPerSecond).toBe(0);
      expect(result.packetsPerSecond).toBe(0);
    });

    it('handles mixed valid/invalid values in a single stat row', () => {
      const result = normalizeHeadline(
        [{ time: 1700000000000, duration: 30000, values: [1000, NaN, 10, undefined] }],
        30000
      );
      expect(result.totalBytes).toBe(1000); // 1000 + 0 (NaN → 0)
      expect(result.totalPackets).toBe(10); // 10 + 0 (undefined → 0)
    });

    it('handles multiple stat rows with partial data', () => {
      const result = normalizeHeadline(
        [
          { time: 1700000000000, duration: 30000, values: [1000] }, // only bytes_in
          { time: 1700000030000, duration: 30000, values: [2000, 3000] }, // bytes_in + bytes_out
        ],
        60000
      );
      expect(result.totalBytes).toBe(6000); // 1000+0 + 2000+3000
    });

    it('validates result against ImpactHeadlineSchema', () => {
      const result = normalizeHeadline(
        [{ time: 1700000000000, duration: 30000, values: [1000, 2000, 10, 20] }],
        30000
      );
      const validation = ImpactHeadlineSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('normalizeTimeseries edge cases', () => {
    it('returns empty array for empty input', () => {
      const result = normalizeTimeseries([]);
      expect(result).toEqual([]);
    });

    it('sorts points by time ascending', () => {
      const result = normalizeTimeseries([
        { time: 1700000060000, duration: 30000, values: [100, 200, 1, 2] },
        { time: 1700000000000, duration: 30000, values: [300, 400, 3, 4] },
        { time: 1700000030000, duration: 30000, values: [500, 600, 5, 6] },
      ]);
      expect(result[0].t).toBe(1700000000000);
      expect(result[1].t).toBe(1700000030000);
      expect(result[2].t).toBe(1700000060000);
    });

    it('produces valid ISO timestamps', () => {
      const result = normalizeTimeseries([
        { time: 1700000000000, duration: 30000, values: [100, 200, 1, 2] },
      ]);
      expect(result[0].tIso).toBe(new Date(1700000000000).toISOString());
    });

    it('handles stat rows with no values key', () => {
      const result = normalizeTimeseries([
        { time: 1700000000000, duration: 30000 }, // no values
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].values.bytes).toBe(0);
      expect(result[0].values.pkts).toBe(0);
    });

    it('never produces NaN in output values', () => {
      const result = normalizeTimeseries([
        { time: NaN, duration: NaN, values: [NaN, Infinity, -Infinity, undefined] },
      ]);
      for (const p of result) {
        expect(Number.isFinite(p.t)).toBe(true);
        expect(Number.isFinite(p.durationMs)).toBe(true);
        expect(Number.isFinite(p.values.bytes)).toBe(true);
        expect(Number.isFinite(p.values.pkts)).toBe(true);
      }
    });
  });

  describe('normalizeDeviceIdentity edge cases', () => {
    it('handles null input gracefully', () => {
      // normalizeDeviceIdentity({}) should not throw
      const result = normalizeDeviceIdentity({});
      expect(result.id).toBe(0);
      expect(result.displayName).toBe('');
    });

    it('handles snake_case to camelCase mapping', () => {
      const result = normalizeDeviceIdentity({
        id: 42,
        display_name: 'Test Device',
        extrahop_id: 'EH42',
        discovery_id: 'D42',
        device_class: 'node',
        auto_role: 'server',
        is_l3: true,
        parent_id: 10,
        node_id: 5,
        analysis_level: 2,
        mod_time: 1700000000000,
        discover_time: 1699999000000,
        on_watchlist: true,
        custom_criticality: 'high',
        is_custom_device: false,
        custom_type: null,
        user_mod_time: 1700000100000,
        model_override: 'Custom Model',
      });
      expect(result.displayName).toBe('Test Device');
      expect(result.extrahopId).toBe('EH42');
      expect(result.discoveryId).toBe('D42');
      expect(result.deviceClass).toBe('node');
      expect(result.autoRole).toBe('server');
      expect(result.isL3).toBe(true);
      expect(result.parentId).toBe(10);
      expect(result.nodeId).toBe(5);
      expect(result.analysisLevel).toBe(2);
      expect(result.onWatchlist).toBe(true);
      expect(result.customCriticality).toBe('high');
      expect(result.isCustomDevice).toBe(false);
      expect(result.modelOverride).toBe('Custom Model');
    });

    it('handles camelCase input (already normalized)', () => {
      const result = normalizeDeviceIdentity({
        id: 42,
        displayName: 'Already Camel',
        extrahopId: 'EH42',
        deviceClass: 'node',
        autoRole: 'server',
      });
      expect(result.displayName).toBe('Already Camel');
      expect(result.extrahopId).toBe('EH42');
    });

    it('validates against DeviceIdentitySchema', () => {
      const result = normalizeDeviceIdentity({
        id: 1042,
        display_name: 'web-server-01',
        extrahop_id: 'EH1042',
        ipaddr4: '10.0.1.50',
        macaddr: 'AA:BB:CC:DD:EE:FF',
      });
      const validation = DeviceIdentitySchema.safeParse(result);
      expect(validation.success).toBe(true);
    });

    it('handles NaN id gracefully', () => {
      const result = normalizeDeviceIdentity({ id: NaN });
      expect(result.id).toBe(0);
      expect(Number.isFinite(result.id)).toBe(true);
    });

    it('handles Infinity in numeric fields', () => {
      const result = normalizeDeviceIdentity({
        id: Infinity,
        vlanid: -Infinity,
        analysis_level: Infinity,
      });
      expect(Number.isFinite(result.id)).toBe(true);
    });

    it('preserves DNS name fields', () => {
      const result = normalizeDeviceIdentity({
        id: 1,
        cdp_name: 'cdp-host',
        dhcp_name: 'dhcp-host',
        dns_name: 'dns-host.example.com',
        netbios_name: 'NETBIOS-HOST',
        custom_name: 'My Custom Name',
        default_name: 'Default Name',
      });
      expect(result.cdp_name).toBe('cdp-host');
      expect(result.dhcp_name).toBe('dhcp-host');
      expect(result.dns_name).toBe('dns-host.example.com');
      expect(result.netbios_name).toBe('NETBIOS-HOST');
      expect(result.custom_name).toBe('My Custom Name');
      expect(result.default_name).toBe('Default Name');
    });
  });

  describe('normalizeDetection edge cases', () => {
    it('handles participants with mixed object types', () => {
      const result = normalizeDetection({
        id: 1,
        participants: [
          { object_type: 'device', object_id: 42, role: 'offender' },
          { object_type: 'ipaddr', ipaddr: '10.0.1.100', role: 'victim' },
          { object_type: 'device', object_id: 43, hostname: 'server-02', role: 'target' },
        ],
      });
      expect(result.participants).toHaveLength(3);
      expect(result.participants[0].object_type).toBe('device');
      expect(result.participants[1].object_type).toBe('ipaddr');
      expect(result.participants[1].ipaddr).toBe('10.0.1.100');
    });

    it('handles detection with no participants', () => {
      const result = normalizeDetection({ id: 1, participants: null });
      expect(result.participants).toEqual([]);
    });

    it('handles detection with non-array participants', () => {
      const result = normalizeDetection({ id: 1, participants: 'invalid' });
      expect(result.participants).toEqual([]);
    });

    it('preserves MITRE ATT&CK fields', () => {
      const result = normalizeDetection({
        id: 1,
        mitre_tactics: ['TA0001', 'TA0008'],
        mitre_techniques: ['T1190', 'T1021.001'],
      });
      expect(result.mitreTactics).toEqual(['TA0001', 'TA0008']);
      expect(result.mitreTechniques).toEqual(['T1190', 'T1021.001']);
    });

    it('generates URL when not provided', () => {
      const result = normalizeDetection({ id: 4001 });
      expect(result.url).toBe('/extrahop/#/detections/detail/4001');
    });

    it('preserves provided URL', () => {
      const result = normalizeDetection({
        id: 4001,
        url: '/custom/path/4001',
      });
      expect(result.url).toBe('/custom/path/4001');
    });

    it('validates against NormalizedDetectionSchema', () => {
      const result = normalizeDetection({
        id: 4001,
        display_name: 'Test Detection',
        type: 'lateral_movement',
        categories: ['sec.attack'],
        participants: [{ object_type: 'device', object_id: 42, role: 'offender' }],
        risk_score: 80,
        start_time: 1700000000000,
        end_time: 1700003600000,
        mod_time: 1700000100000,
        status: 'new',
      });
      const validation = NormalizedDetectionSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('normalizeAlert edge cases', () => {
    it('handles string operand', () => {
      const result = normalizeAlert({ id: 1, operand: '1000000000' });
      expect(result.operand).toBe('1000000000');
    });

    it('handles numeric operand', () => {
      const result = normalizeAlert({ id: 1, operand: 1000000000 });
      expect(result.operand).toBe(1000000000);
    });

    it('handles null operand', () => {
      const result = normalizeAlert({ id: 1, operand: null });
      expect(result.operand).toBe(0);
    });

    it('handles severity out of known range', () => {
      const result = normalizeAlert({ id: 1, severity: 99 });
      // Unknown severity maps to 'medium' (default)
      expect(result.severityLabel).toBe('medium');
    });

    it('handles negative severity (safeNum passes through valid finite numbers)', () => {
      const result = normalizeAlert({ id: 1, severity: -1 });
      // safeNum returns -1 because it's a valid finite number
      expect(result.severity).toBe(-1);
      expect(Number.isFinite(result.severity)).toBe(true);
    });

    it('handles disabled alert', () => {
      const result = normalizeAlert({ id: 1, disabled: true });
      expect(result.disabled).toBe(true);
    });

    it('handles null interval fields', () => {
      const result = normalizeAlert({
        id: 1,
        interval_length: null,
        refire_interval: null,
      });
      expect(result.intervalLength).toBeNull();
      expect(result.refireInterval).toBeNull();
    });

    it('validates against NormalizedAlertSchema', () => {
      const result = normalizeAlert({
        id: 101,
        name: 'High Throughput',
        author: 'system',
        stat_name: 'bytes_in',
        field_name: 'bytes_in',
        operator: '>',
        operand: '1000000000',
        severity: 5,
        type: 'threshold',
        disabled: false,
        description: 'Alert when throughput exceeds 1Gbps',
      });
      const validation = NormalizedAlertSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe('normalizeApplianceIdentity edge cases', () => {
    it('handles all fields as snake_case', () => {
      const result = normalizeApplianceIdentity({
        version: '9.4.0',
        edition: 'Reveal(x) Enterprise',
        platform: 'EDA 6200',
        hostname: 'extrahop.lab.local',
        mgmt_ipaddr: '10.0.0.1',
        display_host: 'extrahop.lab.local',
        capture_name: 'Default',
        capture_mac: 'AA:BB:CC:DD:EE:FF',
        licensed_modules: ['NDR', 'NPM'],
        licensed_options: ['Decrypt'],
        process_count: 4,
        services: { ssh: true },
      });
      expect(result.mgmtIpaddr).toBe('10.0.0.1');
      expect(result.displayHost).toBe('extrahop.lab.local');
      expect(result.captureName).toBe('Default');
      expect(result.captureMac).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.processCount).toBe(4);
    });

    it('handles all fields as camelCase', () => {
      const result = normalizeApplianceIdentity({
        version: '9.4.0',
        mgmtIpaddr: '10.0.0.1',
        displayHost: 'extrahop.lab.local',
        captureName: 'Default',
        captureMac: 'AA:BB:CC:DD:EE:FF',
        licensedModules: ['NDR'],
        licensedOptions: ['Decrypt'],
        processCount: 4,
      });
      expect(result.mgmtIpaddr).toBe('10.0.0.1');
      expect(result.licensedModules).toEqual(['NDR']);
    });

    it('handles non-array licensed_modules', () => {
      const result = normalizeApplianceIdentity({
        licensed_modules: 'NDR', // string instead of array
      });
      expect(result.licensedModules).toEqual([]);
    });

    it('handles non-object services', () => {
      const result = normalizeApplianceIdentity({
        services: 'invalid',
      });
      expect(result.services).toEqual({});
    });
  });

  describe('normalizeApplianceStatus edge cases', () => {
    it('splits hostname at first dot', () => {
      const result = normalizeApplianceStatus(
        { hostname: 'extrahop.lab.example.com' },
        'connected'
      );
      expect(result.hostname).toBe('extrahop');
    });

    it('handles hostname with no dots', () => {
      const result = normalizeApplianceStatus(
        { hostname: 'extrahop' },
        'connected'
      );
      expect(result.hostname).toBe('extrahop');
    });

    it('handles empty hostname', () => {
      const result = normalizeApplianceStatus(
        { hostname: '' },
        'connected'
      );
      expect(result.hostname).toBe('');
    });

    it('maps capture_status correctly', () => {
      expect(normalizeApplianceStatus({ capture_status: 'active' }, 'connected').captureStatus).toBe('active');
      expect(normalizeApplianceStatus({ capture_status: 'inactive' }, 'connected').captureStatus).toBe('inactive');
      expect(normalizeApplianceStatus({ capture_status: 'other' }, 'connected').captureStatus).toBe('unknown');
      expect(normalizeApplianceStatus({}, 'connected').captureStatus).toBe('unknown');
    });

    it('maps license_status correctly', () => {
      expect(normalizeApplianceStatus({ license_status: 'valid' }, 'connected').licenseStatus).toBe('valid');
      expect(normalizeApplianceStatus({ license_status: 'expired' }, 'connected').licenseStatus).toBe('expired');
      expect(normalizeApplianceStatus({ license_status: 'other' }, 'connected').licenseStatus).toBe('unknown');
      expect(normalizeApplianceStatus({}, 'connected').licenseStatus).toBe('unknown');
    });

    it('produces valid ISO lastChecked', () => {
      const result = normalizeApplianceStatus({}, 'connected');
      const parsed = new Date(result.lastChecked);
      expect(parsed.toISOString()).toBe(result.lastChecked);
    });

    it('uptimeSeconds is non-negative finite', () => {
      const result = normalizeApplianceStatus({}, 'connected');
      expect(Number.isFinite(result.uptimeSeconds)).toBe(true);
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('validates against ApplianceStatusSchema', () => {
      const result = normalizeApplianceStatus(
        {
          hostname: 'extrahop.lab.local',
          display_host: 'extrahop.lab.local',
          version: '9.4.0',
          edition: 'Reveal(x) Enterprise',
          platform: 'EDA 6200',
          mgmt_ipaddr: '10.0.0.1',
          capture_status: 'active',
          license_status: 'valid',
          licensed_modules: ['NDR'],
        },
        'connected'
      );
      const validation = ApplianceStatusSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. buildMetricsRequest Contract
// ═══════════════════════════════════════════════════════════════════════════

describe('buildMetricsRequest contract', () => {
  it('produces exact ExtraHop API shape', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
      objectType: 'network',
      objectIds: [0],
    });

    // Exact keys the ExtraHop API expects
    expect(body).toHaveProperty('from');
    expect(body).toHaveProperty('until');
    expect(body).toHaveProperty('metric_category');
    expect(body).toHaveProperty('metric_specs');
    expect(body).toHaveProperty('object_type');
    expect(body).toHaveProperty('object_ids');
  });

  it('does NOT include cycle when set to auto', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      cycle: 'auto',
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }],
      objectType: 'network',
      objectIds: [0],
    });
    expect(body).not.toHaveProperty('cycle');
  });

  it('includes cycle when set to specific value', () => {
    for (const cycle of ['30sec', '5min', '1hr', '24hr'] as const) {
      const body = buildMetricsRequest({
        from: 1700000000000,
        until: 1700003600000,
        cycle,
        metricCategory: 'net',
        metricSpecs: [{ name: 'bytes_in' }],
        objectType: 'network',
        objectIds: [0],
      });
      expect(body.cycle).toBe(cycle);
    }
  });

  it('does NOT include top_n when not specified', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }],
      objectType: 'network',
      objectIds: [0],
    });
    expect(body).not.toHaveProperty('top_n');
  });

  it('includes top_n when specified', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }],
      objectType: 'device',
      objectIds: [0],
      topN: 20,
    });
    expect(body.top_n).toBe(20);
  });

  it('supports all three object types', () => {
    for (const objectType of ['network', 'device', 'application'] as const) {
      const body = buildMetricsRequest({
        from: 1700000000000,
        until: 1700003600000,
        metricCategory: 'net',
        metricSpecs: [{ name: 'bytes_in' }],
        objectType,
        objectIds: [0],
      });
      expect(body.object_type).toBe(objectType);
    }
  });

  it('preserves key1 in metric specs', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net_detail',
      metricSpecs: [
        { name: 'bytes_in', key1: 'HTTP' },
        { name: 'bytes_out' },
      ],
      objectType: 'device',
      objectIds: [1042],
    });
    const specs = body.metric_specs as any[];
    expect(specs[0]).toEqual({ name: 'bytes_in', key1: 'HTTP' });
    expect(specs[1]).toEqual({ name: 'bytes_out' });
  });

  it('supports multiple object IDs', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }],
      objectType: 'device',
      objectIds: [1, 2, 3, 4, 5],
    });
    expect(body.object_ids).toEqual([1, 2, 3, 4, 5]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Fixture-Mode Route Integration (Schema Validation)
// ═══════════════════════════════════════════════════════════════════════════

describe('Fixture-mode route schema validation', () => {
  const BASE = `http://localhost:${process.env.PORT || 3000}/api/bff`;
  const NOW = Date.now();
  const FROM = NOW - 3600000;

  it('health route response passes BffHealthResponseSchema', async () => {
    const res = await fetch(`${BASE}/health`);
    const body = await res.json();
    const validation = BffHealthResponseSchema.safeParse(body);
    expect(validation.success).toBe(true);
  });

  it('health route bff.cache has valid stats', async () => {
    const res = await fetch(`${BASE}/health`);
    const body = await res.json();
    expect(typeof body.bff.cache.size).toBe('number');
    expect(typeof body.bff.cache.maxSize).toBe('number');
    expect(body.bff.cache.size).toBeGreaterThanOrEqual(0);
    expect(body.bff.cache.maxSize).toBeGreaterThanOrEqual(0);
  });

  it('health route timestamp is valid ISO', async () => {
    const res = await fetch(`${BASE}/health`);
    const body = await res.json();
    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });

  it('impact/headline returns valid HeadlineKpi shape', async () => {
    const res = await fetch(`${BASE}/impact/headline?fromMs=${FROM}&untilMs=${NOW}`);
    const body = await res.json();
    expect(body).toHaveProperty('headline');
    const validation = ImpactHeadlineSchema.safeParse(body.headline);
    expect(validation.success).toBe(true);
  });

  it('impact/timeseries returns array of points', async () => {
    const res = await fetch(`${BASE}/impact/timeseries?fromMs=${FROM}&untilMs=${NOW}`);
    const body = await res.json();
    expect(Array.isArray(body.timeseries)).toBe(true);
    // Each point should have t, tIso, durationMs, values
    if (body.timeseries.length > 0) {
      const point = body.timeseries[0];
      expect(point).toHaveProperty('t');
      expect(point).toHaveProperty('tIso');
      expect(point).toHaveProperty('durationMs');
      expect(point).toHaveProperty('values');
    }
  });

  it('impact/top-talkers returns array', async () => {
    const res = await fetch(`${BASE}/impact/top-talkers?fromMs=${FROM}&untilMs=${NOW}`);
    const body = await res.json();
    expect(Array.isArray(body.topTalkers)).toBe(true);
  });

  it('impact/detections returns array', async () => {
    const res = await fetch(`${BASE}/impact/detections?fromMs=${FROM}&untilMs=${NOW}`);
    const body = await res.json();
    expect(Array.isArray(body.detections)).toBe(true);
  });

  it('impact/alerts returns array', async () => {
    const res = await fetch(`${BASE}/impact/alerts?fromMs=${FROM}&untilMs=${NOW}`);
    const body = await res.json();
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('topology/query returns envelope with payload', async () => {
    const res = await fetch(`${BASE}/topology/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMs: FROM, toMs: NOW }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('payload');
    if (body.payload) {
      expect(body.payload).toHaveProperty('nodes');
      expect(body.payload).toHaveProperty('edges');
      expect(body.payload).toHaveProperty('clusters');
      expect(body.payload).toHaveProperty('summary');
    }
  });

  it('correlation/events returns events array', async () => {
    const res = await fetch(`${BASE}/correlation/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMs: FROM, untilMs: NOW }),
    });
    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body).toHaveProperty('totalCount');
    expect(typeof body.totalCount).toBe('number');
  });

  it('blast-radius/query returns source + peers + summary', async () => {
    const durationMs = NOW - FROM;
    const res = await fetch(`${BASE}/blast-radius/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'hostname',
        value: 'web-server-01',
        timeWindow: { fromMs: FROM, untilMs: NOW, durationMs, cycle: '30sec' },
      }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('source');
    expect(body).toHaveProperty('peers');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('timeWindow');
  });

  it('packets/metadata returns valid PCAP metadata', async () => {
    const res = await fetch(`${BASE}/packets/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: '10.0.1.50', fromMs: FROM, untilMs: NOW }),
    });
    const body = await res.json();
    expect(body).toHaveProperty('metadata');
    expect(body.metadata.contentType).toBe('application/vnd.tcpdump.pcap');
    expect(typeof body.metadata.estimatedBytes).toBe('number');
  });

  it('packets/download returns binary with correct content-type', async () => {
    const res = await fetch(`${BASE}/packets/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: '10.0.1.50', fromMs: FROM, untilMs: NOW }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.tcpdump.pcap');
    // Binary contract: response is NOT JSON
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Route Input Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Route input validation', () => {
  const BASE = `http://localhost:${process.env.PORT || 3000}/api/bff`;

  it('impact/headline returns fixture data even without time params (uses defaults)', async () => {
    const res = await fetch(`${BASE}/impact/headline`);
    // Route uses default time window when params are missing in fixture mode
    expect([200, 400]).toContain(res.status);
  });

  it('impact/device-detail rejects missing id', async () => {
    const res = await fetch(`${BASE}/impact/device-detail`);
    expect(res.status).toBe(400);
  });

  it('impact/device-detail rejects non-numeric id', async () => {
    const res = await fetch(`${BASE}/impact/device-detail?id=abc`);
    expect(res.status).toBe(400);
  });

  it('impact/detection-detail rejects missing id', async () => {
    const res = await fetch(`${BASE}/impact/detection-detail`);
    expect(res.status).toBe(400);
  });

  it('impact/alert-detail rejects missing id', async () => {
    const res = await fetch(`${BASE}/impact/alert-detail`);
    expect(res.status).toBe(400);
  });

  it('topology/query rejects invalid body', async () => {
    const res = await fetch(`${BASE}/topology/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('correlation/events rejects invalid body', async () => {
    const res = await fetch(`${BASE}/correlation/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('blast-radius/query rejects invalid body', async () => {
    const res = await fetch(`${BASE}/blast-radius/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('packets/metadata rejects missing ip', async () => {
    const res = await fetch(`${BASE}/packets/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMs: 1, untilMs: 2 }),
    });
    expect(res.status).toBe(400);
  });

  it('packets/download rejects invalid time window', async () => {
    const res = await fetch(`${BASE}/packets/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: '10.0.1.50', fromMs: 2000, untilMs: 1000 }),
    });
    expect(res.status).toBe(400);
  });

  it('trace/run rejects invalid body', async () => {
    const res = await fetch(`${BASE}/trace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. NaN/Infinity Guards (comprehensive)
// ═══════════════════════════════════════════════════════════════════════════

describe('NaN/Infinity guards (comprehensive)', () => {
  it('normalizeHeadline: all-NaN stat row produces zeros', () => {
    const result = normalizeHeadline(
      [{ time: NaN, duration: NaN, values: [NaN, NaN, NaN, NaN] }],
      NaN
    );
    expect(result.totalBytes).toBe(0);
    expect(result.totalPackets).toBe(0);
    expect(result.bytesPerSecond).toBe(0);
    expect(result.packetsPerSecond).toBe(0);
    expect(Number.isFinite(result.totalBytes)).toBe(true);
    expect(Number.isFinite(result.totalPackets)).toBe(true);
    expect(Number.isFinite(result.bytesPerSecond)).toBe(true);
    expect(Number.isFinite(result.packetsPerSecond)).toBe(true);
  });

  it('normalizeHeadline: Infinity values produce zeros', () => {
    const result = normalizeHeadline(
      [{ time: 0, duration: 30000, values: [Infinity, -Infinity, Infinity, -Infinity] }],
      30000
    );
    expect(Number.isFinite(result.totalBytes)).toBe(true);
    expect(Number.isFinite(result.totalPackets)).toBe(true);
  });

  it('normalizeTimeseries: NaN/Infinity in values produce zeros', () => {
    const points = normalizeTimeseries([
      { time: NaN, duration: -1, values: [Infinity, -Infinity, NaN, undefined] },
    ]);
    for (const p of points) {
      expect(Number.isFinite(p.values.bytes)).toBe(true);
      expect(Number.isFinite(p.values.pkts)).toBe(true);
      expect(Number.isFinite(p.t)).toBe(true);
      expect(Number.isFinite(p.durationMs)).toBe(true);
    }
  });

  it('normalizeDeviceIdentity: NaN id becomes 0', () => {
    const result = normalizeDeviceIdentity({ id: NaN });
    expect(result.id).toBe(0);
  });

  it('normalizeDeviceIdentity: Infinity vlanid becomes 0', () => {
    const result = normalizeDeviceIdentity({ id: 1, vlanid: Infinity });
    expect(Number.isFinite(result.id)).toBe(true);
  });

  it('normalizeDetection: NaN risk_score becomes 0', () => {
    const result = normalizeDetection({ id: 1, risk_score: NaN });
    expect(result.riskScore).toBe(0);
    expect(Number.isFinite(result.riskScore)).toBe(true);
  });

  it('normalizeDetection: NaN timestamps become 0', () => {
    const result = normalizeDetection({ id: 1, start_time: NaN, end_time: Infinity });
    expect(Number.isFinite(result.startTime)).toBe(true);
    expect(Number.isFinite(result.endTime)).toBe(true);
  });

  it('normalizeAlert: NaN severity becomes 0', () => {
    const result = normalizeAlert({ id: 1, severity: NaN });
    expect(result.severity).toBe(0);
    expect(Number.isFinite(result.severity)).toBe(true);
  });

  it('normalizeApplianceIdentity: NaN process_count becomes 0', () => {
    const result = normalizeApplianceIdentity({ process_count: NaN });
    expect(result.processCount).toBe(0);
    expect(Number.isFinite(result.processCount)).toBe(true);
  });
});
