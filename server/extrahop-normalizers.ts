/**
 * ExtraHop Response Normalizers
 *
 * Transforms raw ExtraHop REST API responses into the shared types
 * defined in shared/cockpit-types.ts and validated by shared/cockpit-validators.ts.
 *
 * CONTRACT:
 *   - Each normalizer takes raw ExtraHop JSON and returns the exact shape
 *     expected by the corresponding Zod schema.
 *   - No normalizer may invent data. Missing fields → null/empty, not fake values.
 *   - NaN/Infinity must never reach the output.
 *   - These are pure functions: same input → same output.
 *
 * ExtraHop REST API reference (used fields):
 *   - POST /api/v1/metrics → { cycle, node_id, clock, from, until, stats: [{ time, duration, values }], xid }
 *   - GET /api/v1/devices → [{ id, display_name, extrahop_id, ... }]
 *   - GET /api/v1/detections → [{ id, display_name, type, ... }]
 *   - GET /api/v1/alerts → [{ id, name, author, ... }]
 *   - GET /api/v1/extrahop → { version, edition, platform, hostname, ... }
 */

import type {
  SeriesPoint,
  MetricCycle,
  DeviceIdentity,
  NormalizedDetection,
  NormalizedAlert,
  ApplianceIdentity,
} from '../shared/cockpit-types';
import { bindMetricValues, computeRate, type RawStatRow } from '../shared/normalize';
import type { MetricSpec } from '../shared/cockpit-types';

// ─── Safe number helper ──────────────────────────────────────────────────
// ─── ExtraHop Raw API Types (audit M1) ──────────────────────────────────
// Replaces 'any' in normalizer function signatures with typed interfaces.
// Fields are optional because the API may omit them depending on device type/state.

/** Raw device from GET /api/v1/devices */
export interface ExtraHopRawDevice {
  id?: number;
  display_name?: string;
  extrahop_id?: string;
  discovery_id?: string;
  ipaddr4?: string | null;
  ipaddr6?: string | null;
  macaddr?: string;
  device_class?: string | null;
  role?: string | null;
  auto_role?: string | null;
  vendor?: string | null;
  is_l3?: boolean;
  vlanid?: number | null;
  parent_id?: number | null;
  node_id?: number | null;
  analysis?: string | null;
  analysis_level?: number | null;
  mod_time?: number | null;
  discover_time?: number | null;
  user_mod_time?: number | null;
  critical?: boolean;
  cloud_instance_id?: string | null;
  cloud_account?: string | null;
  [key: string]: unknown;
}

/** Raw detection from GET /api/v1/detections */
export interface ExtraHopRawDetection {
  id?: number;
  display_name?: string;
  type?: string;
  risk_score?: number | null;
  categories?: string[];
  start_time?: number;
  end_time?: number | null;
  mod_time?: number;
  status?: string | null;
  resolution?: string | null;
  participants?: Array<{
    role?: string;
    object_type?: string;
    object_id?: number;
    hostname?: string | null;
    object_value?: string | null;
  }>;
  mitre_tactics?: Array<{ id?: string; name?: string }>;
  mitre_techniques?: Array<{ id?: string; name?: string }>;
  description?: string | null;
  ticket_id?: string | null;
  assignee?: string | null;
  url?: string | null;
  [key: string]: unknown;
}

/** Raw alert from GET /api/v1/alerts */
export interface ExtraHopRawAlert {
  id?: number;
  name?: string;
  author?: string;
  severity?: number;
  type?: string;
  stat_name?: string;
  interval_length?: number;
  fire_count?: number;
  mod_time?: number;
  description?: string | null;
  apply_all?: boolean;
  disabled?: boolean;
  object_type?: string;
  protocols?: string[];
  [key: string]: unknown;
}

/** Raw appliance from GET /api/v1/extrahop */
export interface ExtraHopRawAppliance {
  hostname?: string;
  platform?: string;
  firmware_version?: string;
  version?: string;
  edition?: string;
  license?: { status?: string; modules?: Record<string, unknown>; features?: Record<string, unknown> };
  display_host?: string;
  displayHost?: string;
  uuid?: string;
  mgmt_ipaddr?: string;
  mgmtIpaddr?: string;
  capture_name?: string;
  captureName?: string;
  capture_mac?: string;
  captureMac?: string;
  licensed_modules?: unknown[];
  licensedModules?: unknown[];
  licensed_options?: unknown[];
  licensedOptions?: unknown[];
  process_count?: number;
  processCount?: number;
  services?: Record<string, { enabled: boolean }>;
  [key: string]: unknown;
}

// ─── Safe helpers ───────────────────────────────────────────────────────────
function safeNum(v: unknown, fallback: number = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}

function safeStr(v: unknown, fallback: string = ''): string {
  if (typeof v === 'string') return v;
  return fallback;
}

function safeNullStr(v: unknown): string | null {
  if (typeof v === 'string') return v;
  return null;
}

function safeBool(v: unknown, fallback: boolean = false): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

// ─── Headline Normalizer ─────────────────────────────────────────────────
/**
 * ExtraHop POST /api/v1/metrics response for network-level bytes/packets.
 *
 * Request body:
 * {
 *   "cycle": "auto",
 *   "from": <epochMs>,
 *   "until": <epochMs>,
 *   "metric_category": "net",
 *   "metric_specs": [
 *     { "name": "bytes_in" },
 *     { "name": "bytes_out" },
 *     { "name": "pkts_in" },
 *     { "name": "pkts_out" }
 *   ],
 *   "object_ids": [0],
 *   "object_type": "network"
 * }
 *
 * Response shape (relevant fields):
 * {
 *   "cycle": "30sec",
 *   "stats": [
 *     { "time": <epochMs>, "duration": <ms>, "values": [<bytes_in>, <bytes_out>, <pkts_in>, <pkts_out>] }
 *   ]
 * }
 */
export interface HeadlineResult {
  totalBytes: number;
  totalPackets: number;
  bytesPerSecond: number;
  packetsPerSecond: number;
  baselineDeltaPct: number | null;
}

const HEADLINE_SPECS: MetricSpec[] = [
  { name: 'bytes_in' },
  { name: 'bytes_out' },
  { name: 'pkts_in' },
  { name: 'pkts_out' },
];

export function normalizeHeadline(
  rawStats: RawStatRow[],
  durationMs: number,
  baselineBytes?: number | null
): HeadlineResult {
  let totalBytesIn = 0;
  let totalBytesOut = 0;
  let totalPktsIn = 0;
  let totalPktsOut = 0;

  for (const stat of rawStats) {
    const vals = Array.isArray(stat.values) ? stat.values : [];
    const bound = bindMetricValues(HEADLINE_SPECS, vals);
    totalBytesIn += safeNum(bound['bytes_in']);
    totalBytesOut += safeNum(bound['bytes_out']);
    totalPktsIn += safeNum(bound['pkts_in']);
    totalPktsOut += safeNum(bound['pkts_out']);
  }

  const totalBytes = totalBytesIn + totalBytesOut;
  const totalPackets = totalPktsIn + totalPktsOut;
  const bytesPerSecond = computeRate(totalBytes, durationMs) ?? 0;
  const packetsPerSecond = computeRate(totalPackets, durationMs) ?? 0;

  let baselineDeltaPct: number | null = null;
  if (baselineBytes != null && baselineBytes > 0 && Number.isFinite(baselineBytes)) {
    const delta = ((totalBytes - baselineBytes) / baselineBytes) * 100;
    baselineDeltaPct = Number.isFinite(delta) ? Math.round(delta * 10) / 10 : null;
  }

  return {
    totalBytes,
    totalPackets,
    bytesPerSecond: Math.round(bytesPerSecond),
    packetsPerSecond: Math.round(packetsPerSecond),
    baselineDeltaPct,
  };
}

// ─── Timeseries Normalizer ───────────────────────────────────────────────
/**
 * Same POST /api/v1/metrics response, but we preserve each stat row as a SeriesPoint.
 * The UI expects values keyed as { bytes, pkts }.
 */
const TIMESERIES_SPECS: MetricSpec[] = [
  { name: 'bytes_in' },
  { name: 'bytes_out' },
  { name: 'pkts_in' },
  { name: 'pkts_out' },
];

export function normalizeTimeseries(rawStats: RawStatRow[]): SeriesPoint[] {
  const points: SeriesPoint[] = [];

  for (const stat of rawStats) {
    const vals = Array.isArray(stat.values) ? stat.values : [];
    const bound = bindMetricValues(TIMESERIES_SPECS, vals);

    const bytesIn = safeNum(bound['bytes_in']);
    const bytesOut = safeNum(bound['bytes_out']);
    const pktsIn = safeNum(bound['pkts_in']);
    const pktsOut = safeNum(bound['pkts_out']);

    const t = safeNum(stat.time);
    const durationMs = safeNum(stat.duration, 1);

    points.push({
      t,
      tIso: new Date(t).toISOString(),
      durationMs,
      values: {
        bytes: bytesIn + bytesOut,
        pkts: pktsIn + pktsOut,
      },
    });
  }

  points.sort((a, b) => a.t - b.t);
  return points;
}

// ─── Top Talkers Normalizer ──────────────────────────────────────────────
/**
 * Top talkers requires two API calls:
 * 1. POST /api/v1/metrics with object_type: "device" and top_n grouping
 * 2. GET /api/v1/devices/{id} for each device to get full identity
 *
 * The metrics response returns per-device stats.
 * We merge device identity from the devices API.
 */

export function normalizeDeviceIdentity(raw: ExtraHopRawDevice): DeviceIdentity {
  return {
    id: safeNum(raw.id),
    displayName: safeStr(raw.display_name ?? raw.displayName),
    extrahopId: safeStr(raw.extrahop_id ?? raw.extrahopId),
    discoveryId: safeStr(raw.discovery_id ?? raw.discoveryId),
    ipaddr4: safeNullStr(raw.ipaddr4),
    ipaddr6: safeNullStr(raw.ipaddr6),
    macaddr: safeStr(raw.macaddr),
    deviceClass: safeNullStr(raw.device_class ?? raw.deviceClass),
    role: safeNullStr(raw.role),
    autoRole: safeNullStr(raw.auto_role ?? raw.autoRole),
    vendor: safeNullStr(raw.vendor),
    isL3: safeBool(raw.is_l3 ?? raw.isL3),
    vlanid: raw.vlanid != null ? safeNum(raw.vlanid) : null,
    parentId: raw.parent_id != null ? safeNum(raw.parent_id ?? raw.parentId) : null,
    nodeId: raw.node_id != null ? safeNum(raw.node_id ?? raw.nodeId) : null,
    analysis: safeNullStr(raw.analysis),
    analysisLevel: raw.analysis_level != null ? safeNum(raw.analysis_level ?? raw.analysisLevel) : null,
    lastSeenTime: raw.mod_time != null ? safeNum(raw.mod_time ?? raw.lastSeenTime) : null,
    lastSeenIso: raw.mod_time ? new Date(safeNum(raw.mod_time)).toISOString() : safeNullStr(raw.lastSeenIso),
    modTime: raw.mod_time != null ? safeNum(raw.mod_time ?? raw.modTime) : null,
    discoverTime: raw.discover_time != null ? safeNum(raw.discover_time ?? raw.discoverTime) : null,
    discoverTimeIso: raw.discover_time ? new Date(safeNum(raw.discover_time)).toISOString() : safeNullStr(raw.discoverTimeIso),
    onWatchlist: safeBool(raw.on_watchlist ?? raw.onWatchlist),
    critical: safeBool(raw.critical),
    customCriticality: safeNullStr(raw.custom_criticality ?? raw.customCriticality),
    isCustomDevice: safeBool(raw.is_custom_device ?? raw.isCustomDevice),
    customType: safeNullStr(raw.custom_type ?? raw.customType),
    userModTime: raw.user_mod_time != null ? safeNum(raw.user_mod_time ?? raw.userModTime) : null,
    description: safeNullStr(raw.description),
    cdp_name: safeNullStr(raw.cdp_name),
    dhcp_name: safeNullStr(raw.dhcp_name),
    dns_name: safeNullStr(raw.dns_name),
    netbios_name: safeNullStr(raw.netbios_name),
    custom_name: safeNullStr(raw.custom_name),
    default_name: safeNullStr(raw.default_name),
    model: safeNullStr(raw.model),
    modelOverride: safeNullStr(raw.model_override ?? raw.modelOverride),
    software: safeNullStr(raw.software),
  };
}

// ─── Detection Normalizer ────────────────────────────────────────────────
/**
 * GET /api/v1/detections response:
 * [
 *   {
 *     "id": 4001,
 *     "display_name": "...",
 *     "type": "...",
 *     "categories": ["sec.attack"],
 *     "participants": [{ "object_type": "device", "object_id": 1042, "role": "offender" }],
 *     "risk_score": 80,
 *     "start_time": <epochMs>,
 *     "end_time": <epochMs>,
 *     "mod_time": <epochMs>,
 *     "status": "new",
 *     "resolution": null,
 *     "assignee": null,
 *     "ticket_id": null,
 *     "mitre_tactics": ["TA0001"],
 *     "mitre_techniques": ["T1190"],
 *     "is_user_created": false,
 *     "properties": {},
 *     "url": "/extrahop/#/detections/detail/4001"
 *   }
 * ]
 */
export function normalizeDetection(raw: ExtraHopRawDetection): NormalizedDetection {
  const startTime = safeNum(raw.start_time ?? raw.startTime);
  const endTime = safeNum(raw.end_time ?? raw.endTime);
  const createTime = safeNum(raw.mod_time ?? raw.createTime ?? raw.create_time);

  return {
    id: safeNum(raw.id),
    title: safeStr(raw.display_name ?? raw.title ?? raw.displayName),
    type: safeStr(raw.type),
    displayName: safeStr(raw.display_name ?? raw.displayName ?? raw.title),
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
    participants: Array.isArray(raw.participants)
      ? raw.participants.map((p: { role?: string; object_type?: string; object_id?: number; hostname?: string | null; object_value?: string | null; ipaddr?: string | null }) => ({
          object_type: safeStr(p.object_type, 'device') as 'device' | 'ipaddr',
          object_id: p.object_id != null ? safeNum(p.object_id) : undefined,
          ipaddr: safeNullStr(p.ipaddr) ?? undefined,
          hostname: safeNullStr(p.hostname) ?? undefined,
          role: safeStr(p.role, 'unknown'),
        }))
      : [],
    riskScore: safeNum(raw.risk_score ?? raw.riskScore),
    startTime,
    startTimeIso: new Date(startTime).toISOString(),
    endTime,
    endTimeIso: new Date(endTime).toISOString(),
    createTime,
    createTimeIso: new Date(createTime).toISOString(),
    status: safeStr(raw.status, 'new'),
    resolution: safeNullStr(raw.resolution),
    assignee: safeNullStr(raw.assignee),
    ticketId: safeNullStr(raw.ticket_id ?? raw.ticketId),
    mitreTactics: Array.isArray(raw.mitre_tactics)
      ? (raw.mitre_tactics as unknown[]).map(String)
      : [],
    mitreTechniques: Array.isArray(raw.mitre_techniques)
      ? (raw.mitre_techniques as unknown[]).map(String)
      : [],
    isUserCreated: safeBool(raw.is_user_created),
    properties: (raw.properties && typeof raw.properties === 'object'
      ? raw.properties as Record<string, unknown>
      : {} as Record<string, unknown>),
    url: safeNullStr(raw.url) ?? `/extrahop/#/detections/detail/${safeNum(raw.id)}`,
  };
}

// ─── Alert Normalizer ────────────────────────────────────────────────────
/**
 * GET /api/v1/alerts response:
 * [
 *   {
 *     "id": 101,
 *     "name": "High Throughput",
 *     "author": "system",
 *     "stat_name": "bytes_in",
 *     "field_name": "bytes_in",
 *     "field_op": null,
 *     "field_name2": null,
 *     "operator": ">",
 *     "operand": "1000000000",
 *     "severity": 3,
 *     "type": "threshold",
 *     "disabled": false,
 *     "description": "...",
 *     "interval_length": 30,
 *     "refire_interval": 300
 *   }
 * ]
 */
const SEVERITY_LABELS: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
  0: 'low',
  1: 'low',
  2: 'medium',
  3: 'medium',
  4: 'high',
  5: 'high',
  6: 'critical',
  7: 'critical',
};

export function normalizeAlert(raw: ExtraHopRawAlert): NormalizedAlert {
  const severity = safeNum(raw.severity);
  return {
    id: safeNum(raw.id),
    name: safeStr(raw.name),
    author: safeStr(raw.author, 'system'),
    statName: safeStr(raw.stat_name ?? raw.statName),
    fieldName: safeStr(raw.field_name ?? raw.fieldName),
    fieldOp: safeNullStr(raw.field_op ?? raw.fieldOp),
    fieldName2: safeNullStr(raw.field_name2 ?? raw.fieldName2),
    operator: safeStr(raw.operator, '>'),
    operand: raw.operand != null ? (typeof raw.operand === 'number' ? raw.operand : String(raw.operand)) : 0,
    severity,
    severityLabel: SEVERITY_LABELS[severity] ?? 'medium',
    type: safeStr(raw.type, 'threshold'),
    disabled: safeBool(raw.disabled),
    description: safeStr(raw.description),
    intervalLength: raw.interval_length != null ? safeNum(raw.interval_length ?? raw.intervalLength) : null,
    refireInterval: raw.refire_interval != null ? safeNum(raw.refire_interval ?? raw.refireInterval) : null,
  };
}

// ─── Appliance Identity Normalizer ───────────────────────────────────────
/**
 * GET /api/v1/extrahop response → ApplianceIdentity
 * (Also used by health route, but exported here for reuse)
 */
export function normalizeApplianceIdentity(raw: ExtraHopRawAppliance): ApplianceIdentity {
  return {
    version: safeStr(raw.version),
    edition: safeStr(raw.edition),
    platform: safeStr(raw.platform),
    hostname: safeStr(raw.hostname),
    mgmtIpaddr: safeStr(raw.mgmt_ipaddr ?? raw.mgmtIpaddr),
    displayHost: safeStr(raw.display_host ?? raw.displayHost ?? raw.hostname),
    captureName: safeStr(raw.capture_name ?? raw.captureName),
    captureMac: safeStr(raw.capture_mac ?? raw.captureMac),
    licensedModules: Array.isArray(raw.licensed_modules ?? raw.licensedModules)
      ? ((raw.licensed_modules ?? raw.licensedModules) as unknown[]).map(String)
      : [],
    licensedOptions: Array.isArray(raw.licensed_options ?? raw.licensedOptions)
      ? ((raw.licensed_options ?? raw.licensedOptions) as unknown[]).map(String)
      : [],
    processCount: safeNum(raw.process_count ?? raw.processCount),
    services: (raw.services && typeof raw.services === 'object'
      ? raw.services as Record<string, { enabled: boolean }>
      : {} as Record<string, { enabled: boolean }>),
  };
}

// ─── Appliance Status Normalizer ─────────────────────────────────────────
/**
 * Combines GET /api/v1/extrahop identity with connection status
 * to produce the ApplianceStatus shape.
 */
export interface ApplianceStatusResult {
  hostname: string;
  displayHost: string;
  version: string;
  edition: string;
  platform: string;
  mgmtIpaddr: string;
  captureStatus: 'active' | 'inactive' | 'unknown';
  captureInterface: string;
  licenseStatus: 'valid' | 'expired' | 'unknown';
  licensedModules: string[];
  uptimeSeconds: number;
  connectionStatus: 'connected' | 'not_configured' | 'error';
  lastChecked: string;
}

export function normalizeApplianceStatus(
  raw: ExtraHopRawAppliance,
  connectionStatus: 'connected' | 'not_configured' | 'error'
): ApplianceStatusResult {
  // Determine capture status from the raw response
  const captureStatus: 'active' | 'inactive' | 'unknown' =
    raw.capture_status === 'active' || raw.captureStatus === 'active' ? 'active'
    : raw.capture_status === 'inactive' || raw.captureStatus === 'inactive' ? 'inactive'
    : 'unknown';

  // Determine license status
  const licenseStatus: 'valid' | 'expired' | 'unknown' =
    raw.license_status === 'valid' || raw.licenseStatus === 'valid' ? 'valid'
    : raw.license_status === 'expired' || raw.licenseStatus === 'expired' ? 'expired'
    : 'unknown';

  return {
    hostname: safeStr(raw.hostname).split('.')[0] || safeStr(raw.hostname),
    displayHost: safeStr(raw.display_host ?? raw.displayHost ?? raw.hostname),
    version: safeStr(raw.version),
    edition: safeStr(raw.edition),
    platform: safeStr(raw.platform),
    mgmtIpaddr: safeStr(raw.mgmt_ipaddr ?? raw.mgmtIpaddr),
    captureStatus,
    captureInterface: safeStr(raw.capture_name ?? raw.captureName ?? 'Default'),
    licenseStatus,
    licensedModules: Array.isArray(raw.licensed_modules ?? raw.licensedModules)
      ? ((raw.licensed_modules ?? raw.licensedModules) as unknown[]).map(String)
      : [],
    uptimeSeconds: Math.round(process.uptime()),
    connectionStatus,
    lastChecked: new Date().toISOString(),
  };
}

// ─── Device Activity Normalizer ─────────────────────────────────────────
/**
 * GET /api/v1/devices/{id}/activity response:
 * [
 *   {
 *     "id": <number>,
 *     "stat_name": "net" | "http_client" | "dns_client" | ...,
 *     "from_time": <epochMs>,
 *     "until_time": <epochMs>,
 *     "mod_time": <epochMs>
 *   }
 * ]
 *
 * Normalizes into rows ready for fact_device_activity upsert.
 */
export interface DeviceActivityRecord {
  rawId: number;
  activityId: number;
  deviceId: number;
  fromTime: number;
  untilTime: number;
  modTime: number;
  statName: string;
  polledAt: Date;
}

export function normalizeDeviceActivity(
  rawRecords: Record<string, unknown>[],
  deviceId: number,
  polledAt: Date = new Date()
): DeviceActivityRecord[] {
  if (!Array.isArray(rawRecords)) return [];

  const records: DeviceActivityRecord[] = [];
  const seenIds = new Set<number>();

  for (const raw of rawRecords) {
    if (!raw || typeof raw !== 'object') continue;

    const rawId = safeNum(raw.id);
    // Skip records with no valid id or duplicate ids in the same batch
    if (rawId === 0 || seenIds.has(rawId)) continue;
    seenIds.add(rawId);

    const statName = safeStr(raw.stat_name ?? raw.statName);
    if (!statName) continue; // stat_name is required

    records.push({
      rawId,
      activityId: rawId, // ExtraHop activity record ID is the dedup key
      deviceId,
      fromTime: safeNum(raw.from_time ?? raw.fromTime),
      untilTime: safeNum(raw.until_time ?? raw.untilTime),
      modTime: safeNum(raw.mod_time ?? raw.modTime),
      statName,
      polledAt,
    });
  }

  return records;
}

/**
 * Compute an activity summary from normalized activity records.
 * Used by the device-detail route to populate the activitySummary field.
 */
export function computeActivitySummary(
  records: DeviceActivityRecord[],
  firstSeen: string | null,
  lastSeen: string | null
): {
  firstSeen: string | null;
  lastSeen: string | null;
  totalProtocols: number;
  totalConnections: number;
  peakThroughputBps: number | null;
} {
  const distinctProtocols = new Set<string>();
  for (const r of records) {
    if (r.statName) distinctProtocols.add(r.statName);
  }

  return {
    firstSeen,
    lastSeen,
    totalProtocols: distinctProtocols.size,
    totalConnections: records.length,
    peakThroughputBps: null, // Not derivable from the activity endpoint alone
  };
}

// ─── Metrics Request Builder ─────────────────────────────────────────────
/**
 * Build the standard ExtraHop POST /api/v1/metrics request body.
 * This is the exact shape the ExtraHop API expects.
 */
export function buildMetricsRequest(params: {
  from: number;
  until: number;
  cycle?: MetricCycle;
  metricCategory: string;
  metricSpecs: Array<{ name: string; key1?: string }>;
  objectType: 'network' | 'device' | 'application';
  objectIds: number[];
  topN?: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from: params.from,
    until: params.until,
    metric_category: params.metricCategory,
    metric_specs: params.metricSpecs.map(s => {
      const spec: Record<string, string> = { name: s.name };
      if (s.key1) spec.key1 = s.key1;
      return spec;
    }),
    object_type: params.objectType,
    object_ids: params.objectIds,
  };

  if (params.cycle && params.cycle !== 'auto') {
    body.cycle = params.cycle;
  }

  if (params.topN) {
    body.top_n = params.topN;
  }

  return body;
}
