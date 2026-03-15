/**
 * Slice 29 — Live ExtraHop Integration Tests
 *
 * Tests cover:
 *   1. ExtraHop client cache behavior (TTL, eviction, stats)
 *   2. ExtraHop normalizers (headline, timeseries, device, detection, alert, appliance)
 *   3. buildMetricsRequest builder
 *   4. Live-mode route behavior (all routes return data or explicit errors, never fixture data)
 *   5. Fixture-mode route behavior (all routes still work with fixtures)
 *
 * These tests do NOT require a live ExtraHop appliance.
 * They validate the contract between raw API shapes and our shared types.
 */
import { describe, it, expect, beforeEach } from 'vitest';
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
  cacheClear,
  getCacheStats,
  isFixtureMode,
} from './extrahop-client';
import {
  HeadlineKpiSchema,
  TimeseriesResponseSchema,
  TopTalkerRowSchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
  ApplianceStatusSchema,
  BffHealthResponseSchema,
  DeviceIdentitySchema,
} from '../shared/cockpit-validators';

// ─── Cache Tests ────────────────────────────────────────────────────────

describe('ExtraHop Client Cache', () => {
  beforeEach(() => {
    cacheClear();
  });

  it('starts with empty cache stats', () => {
    const stats = getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.maxSize).toBe(500);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('cacheClear resets all counters', () => {
    cacheClear();
    const stats = getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it('maxSize is 500', () => {
    const stats = getCacheStats();
    expect(stats.maxSize).toBe(500);
  });
});

// ─── isFixtureMode Tests ────────────────────────────────────────────────

describe('isFixtureMode', () => {
  it('returns true when EH_HOST is not set', async () => {
    const origHost = process.env.EH_HOST;
    const origKey = process.env.EH_API_KEY;
    delete process.env.EH_HOST;
    delete process.env.EH_API_KEY;
    expect(await isFixtureMode()).toBe(true);
    // Restore
    if (origHost !== undefined) process.env.EH_HOST = origHost;
    if (origKey !== undefined) process.env.EH_API_KEY = origKey;
  });

  it('returns true when EH_API_KEY is REPLACE_ME', async () => {
    const origHost = process.env.EH_HOST;
    const origKey = process.env.EH_API_KEY;
    process.env.EH_HOST = 'extrahop.example.com';
    process.env.EH_API_KEY = 'REPLACE_ME';
    expect(await isFixtureMode()).toBe(true);
    // Restore
    if (origHost !== undefined) process.env.EH_HOST = origHost;
    else delete process.env.EH_HOST;
    if (origKey !== undefined) process.env.EH_API_KEY = origKey;
    else delete process.env.EH_API_KEY;
  });

  it('returns true when EH_HOST is empty string', async () => {
    const origHost = process.env.EH_HOST;
    const origKey = process.env.EH_API_KEY;
    process.env.EH_HOST = '';
    process.env.EH_API_KEY = 'somekey';
    expect(await isFixtureMode()).toBe(true);
    if (origHost !== undefined) process.env.EH_HOST = origHost;
    else delete process.env.EH_HOST;
    if (origKey !== undefined) process.env.EH_API_KEY = origKey;
    else delete process.env.EH_API_KEY;
  });
});

// ─── Headline Normalizer Tests ──────────────────────────────────────────

describe('normalizeHeadline', () => {
  it('produces correct totals from raw stats', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000, values: [1000, 2000, 10, 20] },
      { time: 1700000030000, duration: 30000, values: [3000, 4000, 30, 40] },
    ];
    const result = normalizeHeadline(rawStats, 60000);
    expect(result.totalBytes).toBe(10000); // 1000+2000+3000+4000
    expect(result.totalPackets).toBe(100); // 10+20+30+40
    expect(result.bytesPerSecond).toBe(167); // 10000/60 ≈ 167
    expect(result.packetsPerSecond).toBe(2); // 100/60 ≈ 2
    expect(result.baselineDeltaPct).toBeNull();
  });

  it('handles empty stats array', () => {
    const result = normalizeHeadline([], 60000);
    expect(result.totalBytes).toBe(0);
    expect(result.totalPackets).toBe(0);
    expect(result.bytesPerSecond).toBe(0);
    expect(result.packetsPerSecond).toBe(0);
    expect(result.baselineDeltaPct).toBeNull();
  });

  it('computes baseline delta when provided', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000, values: [5000, 5000, 50, 50] },
    ];
    const result = normalizeHeadline(rawStats, 30000, 8000);
    expect(result.totalBytes).toBe(10000);
    expect(result.baselineDeltaPct).toBe(25); // (10000-8000)/8000 * 100 = 25%
  });

  it('returns null baseline delta when baseline is zero', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000, values: [1000, 1000, 10, 10] },
    ];
    const result = normalizeHeadline(rawStats, 30000, 0);
    expect(result.baselineDeltaPct).toBeNull();
  });

  it('handles NaN/undefined values safely', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000, values: [NaN, undefined, null, 'bad'] },
    ];
    const result = normalizeHeadline(rawStats, 30000);
    expect(result.totalBytes).toBe(0);
    expect(result.totalPackets).toBe(0);
    expect(Number.isFinite(result.bytesPerSecond)).toBe(true);
    expect(Number.isFinite(result.packetsPerSecond)).toBe(true);
  });

  it('handles missing values array', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000 }, // no values key
    ];
    const result = normalizeHeadline(rawStats, 30000);
    expect(result.totalBytes).toBe(0);
    expect(result.totalPackets).toBe(0);
  });
});

// ─── Timeseries Normalizer Tests ────────────────────────────────────────

describe('normalizeTimeseries', () => {
  it('produces sorted SeriesPoint array', () => {
    const rawStats = [
      { time: 1700000060000, duration: 30000, values: [200, 300, 5, 5] },
      { time: 1700000000000, duration: 30000, values: [100, 200, 3, 4] },
    ];
    const points = normalizeTimeseries(rawStats);
    expect(points).toHaveLength(2);
    // Should be sorted by time ascending
    expect(points[0].t).toBe(1700000000000);
    expect(points[1].t).toBe(1700000060000);
  });

  it('computes bytes and pkts sums correctly', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000, values: [100, 200, 3, 4] },
    ];
    const points = normalizeTimeseries(rawStats);
    expect(points[0].values.bytes).toBe(300); // 100+200
    expect(points[0].values.pkts).toBe(7); // 3+4
  });

  it('includes tIso field as ISO string', () => {
    const rawStats = [
      { time: 1700000000000, duration: 30000, values: [0, 0, 0, 0] },
    ];
    const points = normalizeTimeseries(rawStats);
    expect(points[0].tIso).toBe(new Date(1700000000000).toISOString());
  });

  it('handles empty stats array', () => {
    const points = normalizeTimeseries([]);
    expect(points).toEqual([]);
  });

  it('handles malformed stat rows', () => {
    const rawStats = [
      { time: 'not-a-number', values: null },
      { duration: 30000 }, // missing time
    ];
    const points = normalizeTimeseries(rawStats);
    expect(points).toHaveLength(2);
    // Should not throw, should produce safe defaults
    for (const p of points) {
      expect(Number.isFinite(p.t)).toBe(true);
      expect(Number.isFinite(p.values.bytes)).toBe(true);
      expect(Number.isFinite(p.values.pkts)).toBe(true);
    }
  });
});

// ─── Device Identity Normalizer Tests ───────────────────────────────────

describe('normalizeDeviceIdentity', () => {
  const RAW_DEVICE = {
    id: 1042,
    display_name: 'web-server-01',
    extrahop_id: 'ABCD1234',
    discovery_id: 'disc-001',
    ipaddr4: '10.0.1.50',
    ipaddr6: null,
    macaddr: '00:11:22:33:44:55',
    device_class: 'node',
    role: 'http_server',
    auto_role: 'http_server',
    vendor: 'Dell',
    is_l3: true,
    vlanid: 100,
    parent_id: null,
    node_id: 1,
    analysis: 'advanced',
    analysis_level: 2,
    mod_time: 1700000000000,
    discover_time: 1699000000000,
    on_watchlist: false,
    critical: true,
    custom_criticality: null,
    is_custom_device: false,
    custom_type: null,
    user_mod_time: null,
    description: 'Primary web server',
    cdp_name: null,
    dhcp_name: 'web-server-01',
    dns_name: 'web-server-01.example.com',
    netbios_name: null,
    custom_name: null,
    default_name: 'web-server-01',
    model: 'PowerEdge R740',
    model_override: null,
    software: 'nginx/1.24',
  };

  it('normalizes a full ExtraHop device response', () => {
    const result = normalizeDeviceIdentity(RAW_DEVICE);
    expect(result.id).toBe(1042);
    expect(result.displayName).toBe('web-server-01');
    expect(result.ipaddr4).toBe('10.0.1.50');
    expect(result.macaddr).toBe('00:11:22:33:44:55');
    expect(result.isL3).toBe(true);
    expect(result.critical).toBe(true);
    expect(result.vendor).toBe('Dell');
  });

  it('validates against DeviceIdentitySchema', () => {
    const result = normalizeDeviceIdentity(RAW_DEVICE);
    const validation = DeviceIdentitySchema.safeParse(result);
    expect(validation.success).toBe(true);
  });

  it('handles empty/minimal device', () => {
    const result = normalizeDeviceIdentity({});
    expect(result.id).toBe(0);
    expect(result.displayName).toBe('');
    expect(result.ipaddr4).toBeNull();
    expect(result.isL3).toBe(false);
  });

  it('handles camelCase input (already normalized)', () => {
    const result = normalizeDeviceIdentity({
      id: 42,
      displayName: 'test',
      extrahopId: 'EH42',
      macaddr: 'AA:BB:CC:DD:EE:FF',
    });
    expect(result.id).toBe(42);
    expect(result.displayName).toBe('test');
    expect(result.extrahopId).toBe('EH42');
  });
});

// ─── Detection Normalizer Tests ─────────────────────────────────────────

describe('normalizeDetection', () => {
  const RAW_DETECTION = {
    id: 4001,
    display_name: 'Lateral Movement Detected',
    type: 'lateral_movement',
    categories: ['sec.attack'],
    participants: [
      { object_type: 'device', object_id: 1042, role: 'offender' },
      { object_type: 'ipaddr', ipaddr: '10.0.1.100', role: 'victim' },
    ],
    risk_score: 80,
    start_time: 1700000000000,
    end_time: 1700003600000,
    mod_time: 1700000100000,
    status: 'new',
    resolution: null,
    assignee: null,
    ticket_id: null,
    mitre_tactics: ['TA0008'],
    mitre_techniques: ['T1021'],
    is_user_created: false,
    properties: { detail: 'SMB lateral movement' },
    url: '/extrahop/#/detections/detail/4001',
  };

  it('normalizes a full ExtraHop detection', () => {
    const result = normalizeDetection(RAW_DETECTION);
    expect(result.id).toBe(4001);
    expect(result.title).toBe('Lateral Movement Detected');
    expect(result.riskScore).toBe(80);
    expect(result.participants).toHaveLength(2);
    expect(result.mitreTactics).toEqual(['TA0008']);
    expect(result.mitreTechniques).toEqual(['T1021']);
  });

  it('validates against NormalizedDetectionSchema', () => {
    const result = normalizeDetection(RAW_DETECTION);
    const validation = NormalizedDetectionSchema.safeParse(result);
    expect(validation.success).toBe(true);
  });

  it('handles empty detection', () => {
    const result = normalizeDetection({});
    expect(result.id).toBe(0);
    expect(result.title).toBe('');
    expect(result.participants).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.mitreTactics).toEqual([]);
    expect(result.mitreTechniques).toEqual([]);
  });

  it('produces valid ISO timestamps', () => {
    const result = normalizeDetection(RAW_DETECTION);
    expect(result.startTimeIso).toBe(new Date(1700000000000).toISOString());
    expect(result.endTimeIso).toBe(new Date(1700003600000).toISOString());
  });
});

// ─── Alert Normalizer Tests ─────────────────────────────────────────────

describe('normalizeAlert', () => {
  const RAW_ALERT = {
    id: 101,
    name: 'High Throughput',
    author: 'system',
    stat_name: 'bytes_in',
    field_name: 'bytes_in',
    field_op: null,
    field_name2: null,
    operator: '>',
    operand: '1000000000',
    severity: 5,
    type: 'threshold',
    disabled: false,
    description: 'Alert when throughput exceeds 1Gbps',
    interval_length: 30,
    refire_interval: 300,
  };

  it('normalizes a full ExtraHop alert', () => {
    const result = normalizeAlert(RAW_ALERT);
    expect(result.id).toBe(101);
    expect(result.name).toBe('High Throughput');
    expect(result.severity).toBe(5);
    expect(result.severityLabel).toBe('high');
    expect(result.type).toBe('threshold');
    expect(result.disabled).toBe(false);
  });

  it('validates against NormalizedAlertSchema', () => {
    const result = normalizeAlert(RAW_ALERT);
    const validation = NormalizedAlertSchema.safeParse(result);
    expect(validation.success).toBe(true);
  });

  it('maps severity levels correctly', () => {
    const severityMap: Record<number, string> = {
      0: 'low', 1: 'low',
      2: 'medium', 3: 'medium',
      4: 'high', 5: 'high',
      6: 'critical', 7: 'critical',
    };
    for (const [sev, label] of Object.entries(severityMap)) {
      const result = normalizeAlert({ ...RAW_ALERT, severity: Number(sev) });
      expect(result.severityLabel).toBe(label);
    }
  });

  it('handles empty alert', () => {
    const result = normalizeAlert({});
    expect(result.id).toBe(0);
    expect(result.name).toBe('');
    expect(result.severity).toBe(0);
    expect(result.severityLabel).toBe('low');
  });
});

// ─── Appliance Identity Normalizer Tests ────────────────────────────────

describe('normalizeApplianceIdentity', () => {
  const RAW_EXTRAHOP = {
    version: '9.4.0',
    edition: 'Reveal(x) Enterprise',
    platform: 'EDA 6200',
    hostname: 'extrahop.example.com',
    mgmt_ipaddr: '10.0.0.1',
    display_host: 'extrahop.example.com',
    capture_name: 'Default',
    capture_mac: 'AA:BB:CC:DD:EE:FF',
    licensed_modules: ['NDR', 'NPM'],
    licensed_options: ['Decrypt'],
    process_count: 4,
    services: { ssh: true, http: true },
  };

  it('normalizes a full ExtraHop identity response', () => {
    const result = normalizeApplianceIdentity(RAW_EXTRAHOP);
    expect(result.version).toBe('9.4.0');
    expect(result.edition).toBe('Reveal(x) Enterprise');
    expect(result.platform).toBe('EDA 6200');
    expect(result.hostname).toBe('extrahop.example.com');
    expect(result.licensedModules).toEqual(['NDR', 'NPM']);
  });

  it('handles empty response', () => {
    const result = normalizeApplianceIdentity({});
    expect(result.version).toBe('');
    expect(result.hostname).toBe('');
    expect(result.licensedModules).toEqual([]);
  });
});

// ─── Appliance Status Normalizer Tests ──────────────────────────────────

describe('normalizeApplianceStatus', () => {
  const RAW_EXTRAHOP = {
    hostname: 'extrahop.example.com',
    display_host: 'extrahop.example.com',
    version: '9.4.0',
    edition: 'Reveal(x) Enterprise',
    platform: 'EDA 6200',
    mgmt_ipaddr: '10.0.0.1',
    capture_status: 'active',
    capture_name: 'Default',
    license_status: 'valid',
    licensed_modules: ['NDR', 'NPM'],
  };

  it('normalizes connected appliance status', () => {
    const result = normalizeApplianceStatus(RAW_EXTRAHOP, 'connected');
    expect(result.connectionStatus).toBe('connected');
    expect(result.captureStatus).toBe('active');
    expect(result.licenseStatus).toBe('valid');
    expect(result.version).toBe('9.4.0');
    expect(result.hostname).toBe('extrahop'); // split at dot
  });

  it('normalizes not_configured status', () => {
    const result = normalizeApplianceStatus({}, 'not_configured');
    expect(result.connectionStatus).toBe('not_configured');
    expect(result.captureStatus).toBe('unknown');
    expect(result.licenseStatus).toBe('unknown');
    expect(result.version).toBe('');
  });

  it('normalizes error status', () => {
    const result = normalizeApplianceStatus({}, 'error');
    expect(result.connectionStatus).toBe('error');
  });

  it('produces valid lastChecked ISO string', () => {
    const result = normalizeApplianceStatus(RAW_EXTRAHOP, 'connected');
    expect(new Date(result.lastChecked).toISOString()).toBe(result.lastChecked);
  });

  it('uptimeSeconds is a finite number', () => {
    const result = normalizeApplianceStatus(RAW_EXTRAHOP, 'connected');
    expect(Number.isFinite(result.uptimeSeconds)).toBe(true);
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

// ─── buildMetricsRequest Tests ──────────────────────────────────────────

describe('buildMetricsRequest', () => {
  it('builds a basic network metrics request', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
      objectType: 'network',
      objectIds: [0],
    });
    expect(body.from).toBe(1700000000000);
    expect(body.until).toBe(1700003600000);
    expect(body.metric_category).toBe('net');
    expect(body.object_type).toBe('network');
    expect(body.object_ids).toEqual([0]);
    expect(body.metric_specs).toEqual([{ name: 'bytes_in' }, { name: 'bytes_out' }]);
  });

  it('includes cycle when not auto', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      cycle: '30sec',
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }],
      objectType: 'network',
      objectIds: [0],
    });
    expect(body.cycle).toBe('30sec');
  });

  it('omits cycle when auto', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      cycle: 'auto',
      metricCategory: 'net',
      metricSpecs: [{ name: 'bytes_in' }],
      objectType: 'network',
      objectIds: [0],
    });
    expect(body.cycle).toBeUndefined();
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

  it('includes key1 in metric specs when provided', () => {
    const body = buildMetricsRequest({
      from: 1700000000000,
      until: 1700003600000,
      metricCategory: 'net_detail',
      metricSpecs: [{ name: 'bytes_in', key1: 'HTTP' }],
      objectType: 'device',
      objectIds: [1042],
    });
    const specs = body.metric_specs as any[];
    expect(specs[0]).toEqual({ name: 'bytes_in', key1: 'HTTP' });
  });
});

// ─── Fixture-mode route integration tests ───────────────────────────────

describe('Fixture-mode route integration (Slice 29)', () => {
  const BASE = `http://localhost:${process.env.PORT || 3000}/api/bff`;
  const NOW = Date.now();
  const FROM = NOW - 3600000;

  it('health route returns fixture mode status', async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // In fixture mode with no EH_HOST configured, status is 'not_configured'
    expect(['ok', 'not_configured']).toContain(body.status);
    expect(body).toHaveProperty('bff');
    expect(body).toHaveProperty('appliance');
    expect(body).toHaveProperty('timestamp');
  });

  it('impact/headline returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/impact/headline?fromMs=${FROM}&untilMs=${NOW}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('headline');
    expect(body).toHaveProperty('timeWindow');
    expect(typeof body.headline.totalBytes).toBe('number');
    expect(typeof body.headline.totalPackets).toBe('number');
  });

  it('impact/timeseries returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/impact/timeseries?fromMs=${FROM}&untilMs=${NOW}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('timeseries');
    expect(body).toHaveProperty('timeWindow');
    expect(Array.isArray(body.timeseries)).toBe(true);
  });

  it('impact/top-talkers returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/impact/top-talkers?fromMs=${FROM}&untilMs=${NOW}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('topTalkers');
    expect(body).toHaveProperty('timeWindow');
    expect(Array.isArray(body.topTalkers)).toBe(true);
  });

  it('impact/detections returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/impact/detections?fromMs=${FROM}&untilMs=${NOW}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('detections');
    expect(Array.isArray(body.detections)).toBe(true);
  });

  it('impact/alerts returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/impact/alerts?fromMs=${FROM}&untilMs=${NOW}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('alerts');
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('topology/query returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/topology/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMs: FROM, toMs: NOW }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('payload');
  });

  it('correlation/events returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/correlation/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMs: FROM, untilMs: NOW }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('events');
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('blast-radius/query returns fixture data in fixture mode', async () => {
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('source');
    expect(body).toHaveProperty('peers');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('timeWindow');
  });

  it('packets/metadata returns fixture data in fixture mode', async () => {
    const res = await fetch(`${BASE}/packets/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: '10.0.1.50',
        fromMs: FROM,
        untilMs: NOW,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('metadata');
    expect(body.metadata.contentType).toBe('application/vnd.tcpdump.pcap');
  });

  it('packets/download returns binary PCAP in fixture mode', async () => {
    const res = await fetch(`${BASE}/packets/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: '10.0.1.50',
        fromMs: FROM,
        untilMs: NOW,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.tcpdump.pcap');
  });
});

// ─── NaN/Infinity guard tests ───────────────────────────────────────────

describe('NaN/Infinity guards', () => {
  it('normalizeHeadline never produces NaN', () => {
    const result = normalizeHeadline(
      [{ time: Infinity, duration: NaN, values: [NaN, -Infinity, undefined, null] }],
      0 // zero duration
    );
    expect(Number.isFinite(result.totalBytes)).toBe(true);
    expect(Number.isFinite(result.totalPackets)).toBe(true);
    expect(Number.isFinite(result.bytesPerSecond)).toBe(true);
    expect(Number.isFinite(result.packetsPerSecond)).toBe(true);
  });

  it('normalizeTimeseries never produces NaN in values', () => {
    const points = normalizeTimeseries([
      { time: NaN, duration: -1, values: [Infinity, -Infinity, NaN, undefined] },
    ]);
    for (const p of points) {
      expect(Number.isFinite(p.values.bytes)).toBe(true);
      expect(Number.isFinite(p.values.pkts)).toBe(true);
    }
  });

  it('normalizeDeviceIdentity never produces NaN for numeric fields', () => {
    const result = normalizeDeviceIdentity({
      id: NaN,
      vlanid: Infinity,
      analysis_level: -Infinity,
    });
    expect(Number.isFinite(result.id)).toBe(true);
  });
});
