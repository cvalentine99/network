// shared/impact-types.ts — Single source of truth for Impact Deck data contracts

// ─── Primitives ───────────────────────────────────────────────────────────
export type EpochMs = number;
export type IsoString = string;

// ─── Time ─────────────────────────────────────────────────────────────────
export type MetricCycle = '1sec' | '30sec' | '5min' | '1hr' | '24hr' | 'auto';

export interface TimeWindow {
  fromMs: EpochMs;
  untilMs: EpochMs;
  durationMs: number;
  cycle: MetricCycle;
}

// ─── Metrics ──────────────────────────────────────────────────────────────
export interface SeriesPoint {
  t: EpochMs;
  tIso: IsoString;
  durationMs: number;
  values: Record<string, number | null>;
}

export interface MetricSeries {
  objectType: 'network' | 'device' | 'application';
  objectId: number;
  cycle: MetricCycle;
  fromMs: EpochMs;
  untilMs: EpochMs;
  points: SeriesPoint[];
}

export interface MetricSpec {
  name: string;
  key1?: string;
  key2?: string;
  calc_type?: 'count' | 'mean' | 'max' | 'min' | 'sum' | 'percentiles' | 'distinct';
  percentiles?: number[];
}

// ─── Devices ──────────────────────────────────────────────────────────────
export interface DeviceIdentity {
  id: number;
  displayName: string;
  extrahopId: string;
  discoveryId: string;
  ipaddr4: string | null;
  ipaddr6: string | null;
  macaddr: string;
  deviceClass: string | null;
  role: string | null;
  autoRole: string | null;
  vendor: string | null;
  isL3: boolean;
  vlanid: number | null;
  parentId: number | null;
  nodeId: number | null;
  analysis: string | null;
  analysisLevel: number | null;
  lastSeenTime: EpochMs | null;
  lastSeenIso: IsoString | null;
  modTime: EpochMs | null;
  discoverTime: EpochMs | null;
  discoverTimeIso: IsoString | null;
  onWatchlist: boolean;
  critical: boolean;
  customCriticality: string | null;
  isCustomDevice: boolean;
  customType: string | null;
  userModTime: EpochMs | null;
  description: string | null;
  cdp_name: string | null;
  dhcp_name: string | null;
  dns_name: string | null;
  netbios_name: string | null;
  custom_name: string | null;
  default_name: string | null;
  model: string | null;
  modelOverride: string | null;
  software: string | null;
}

// ─── Detections ───────────────────────────────────────────────────────────
export interface DetectionParticipant {
  object_type: 'device' | 'ipaddr';
  object_id?: number;
  ipaddr?: string;
  hostname?: string;
  role: string;
}

export interface NormalizedDetection {
  id: number;
  title: string;
  type: string;
  displayName: string;
  categories: string[];
  participants: DetectionParticipant[];
  riskScore: number;
  startTime: EpochMs;
  startTimeIso: IsoString;
  endTime: EpochMs;
  endTimeIso: IsoString;
  createTime: EpochMs;
  createTimeIso: IsoString;
  status: string;
  resolution: string | null;
  assignee: string | null;
  ticketId: string | null;
  mitreTactics: string[];
  mitreTechniques: string[];
  isUserCreated: boolean;
  properties: Record<string, unknown>;
  url: string | null;
}

// ─── Alerts ───────────────────────────────────────────────────────────────
export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface NormalizedAlert {
  id: number;
  name: string;
  author: string;
  statName: string;
  fieldName: string;
  fieldOp: string | null;
  fieldName2: string | null;
  operator: string;
  operand: number | string;
  severity: number;
  severityLabel: Severity;
  type: string;
  disabled: boolean;
  description: string;
  intervalLength: number | null;
  refireInterval: number | null;
}

// ─── Impact Deck Payload ─────────────────────────────────────────────────
export interface ImpactOverviewPayload {
  headline: {
    totalBytes: number;
    totalPackets: number;
    bytesPerSecond: number;
    packetsPerSecond: number;
    baselineDeltaPct: number | null;
  };
  timeseries: SeriesPoint[];
  topTalkers: TopTalkerRow[];
  detections: NormalizedDetection[];
  alerts: NormalizedAlert[];
  applianceVersion: string;
  applianceEdition: string;
  appliancePlatform: string;
  captureName: string;
  licensedModules: string[];
}

export interface TopTalkerRow {
  device: DeviceIdentity;
  bytesIn: number;
  bytesOut: number;
  totalBytes: number;
  pktsIn: number;
  pktsOut: number;
  sparkline: SeriesPoint[];
}

// ─── Appliance Identity ───────────────────────────────────────────────────
export interface ApplianceIdentity {
  version: string;
  edition: string;
  platform: string;
  hostname: string;
  mgmtIpaddr: string;
  displayHost: string;
  captureName: string;
  captureMac: string;
  licensedModules: string[];
  licensedOptions: string[];
  processCount: number;
  services: Record<string, { enabled: boolean }>;
}
