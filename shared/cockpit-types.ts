/**
 * Obsidian Cockpit — Shared type contracts
 * Single source of truth for all data shapes across BFF, normalization, and UI layers.
 * No component may define its own payload interpretation. Import from here.
 */

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

// ─── Appliance Status (Slice 07) ─────────────────────────────────────────
/**
 * Normalized appliance status for the footer bar.
 * Answers: "Is my sensor healthy?"
 *
 * Fields:
 *   hostname        — appliance hostname (e.g. "eda01")
 *   displayHost     — FQDN or display name (e.g. "eda01.lab.local")
 *   version         — firmware version string (e.g. "26.1.4.2814")
 *   edition         — product edition (e.g. "Reveal(x) Enterprise")
 *   platform        — platform identifier (e.g. "extrahop")
 *   mgmtIpaddr      — management IP address
 *   captureStatus   — "active" | "inactive" | "unknown"
 *   captureInterface— capture interface name (e.g. "Capture 00:1a:8c:10:00:01")
 *   licenseStatus   — "valid" | "expired" | "unknown"
 *   licensedModules — list of licensed module names
 *   uptimeSeconds   — BFF uptime in seconds (not appliance uptime — that requires live query)
 *   connectionStatus— "connected" | "not_configured" | "error"
 *   lastChecked     — ISO timestamp of last health check
 */
export interface ApplianceStatus {
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
  lastChecked: IsoString;
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

// ─── Device Protocol Activity (Slice 09) ────────────────────────────────
/**
 * A single protocol activity row for a device.
 * Represents traffic breakdown by protocol (e.g., DNS, HTTP, TLS, SMB).
 *
 * Fields:
 *   protocol     — protocol name (e.g. "DNS", "HTTP", "TLS", "SMB")
 *   bytesIn      — inbound bytes for this protocol
 *   bytesOut     — outbound bytes for this protocol
 *   totalBytes   — total bytes (bytesIn + bytesOut)
 *   connections  — number of connections/flows observed
 *   lastSeen     — ISO timestamp of last activity for this protocol
 */
export interface DeviceProtocolActivity {
  protocol: string;
  bytesIn: number;
  bytesOut: number;
  totalBytes: number;
  connections: number;
  lastSeen: IsoString;
}

// ─── Device Detail (Slice 09) ───────────────────────────────────────────
/**
 * Full device detail for the inspector pane.
 * Extends the compact DevicePreview (Slice 08) with:
 *   - Protocol activity breakdown
 *   - Associated detections (NormalizedDetection[])
 *   - Associated alerts (NormalizedAlert[])
 *   - Activity summary metrics
 *
 * This is the BFF response shape for GET /api/bff/impact/device-detail?id=<deviceId>
 */
export interface DeviceDetail {
  device: DeviceIdentity;
  traffic: {
    bytesIn: number;
    bytesOut: number;
    totalBytes: number;
    pktsIn: number;
    pktsOut: number;
  };
  protocols: DeviceProtocolActivity[];
  associatedDetections: NormalizedDetection[];
  associatedAlerts: NormalizedAlert[];
  activitySummary: {
    firstSeen: IsoString | null;
    lastSeen: IsoString | null;
    totalProtocols: number;
    totalConnections: number;
    peakThroughputBps: number | null;
  };
}

// ─── Inspector Selection (Slice 08) ─────────────────────────────────────
/**
 * Discriminated union representing what entity is currently selected in the inspector.
 * Each variant carries the full normalized entity data — no re-fetching required.
 * The inspector shell routes content based on the `kind` discriminant.
 *
 * Invariants:
 *   - Only one entity can be selected at a time
 *   - Selecting a new entity replaces the previous selection
 *   - Clearing selection returns to the empty "Select an item" state
 *   - The inspector auto-opens on selection and can be manually closed
 */
export type InspectorSelection =
  | { kind: 'device'; device: DeviceIdentity; topTalkerRow: TopTalkerRow }
  | { kind: 'detection'; detection: NormalizedDetection }
  | { kind: 'alert'; alert: NormalizedAlert };

// ─── PCAP Download (Slice 10) ───────────────────────────────────────────
/**
 * Request shape for PCAP download.
 * Sent from frontend to BFF as JSON POST body.
 *
 * The BFF proxies this to ExtraHop POST /api/v1/packets/search
 * and streams the raw binary PCAP response back to the browser.
 *
 * Fields:
 *   ip           — target IP address to filter packets (required)
 *   fromMs       — start of time window (epoch ms)
 *   untilMs      — end of time window (epoch ms)
 *   bpfFilter    — optional Berkeley Packet Filter expression (e.g. "tcp port 443")
 *   limitBytes   — optional max bytes to capture (default: 10MB)
 *   limitPackets — optional max packets to capture
 *
 * Binary contract invariant:
 *   The BFF MUST NOT convert PCAP bytes to JSON.
 *   The response is raw binary with Content-Type: application/vnd.tcpdump.pcap.
 */
export interface PcapRequest {
  ip: string;
  fromMs: EpochMs;
  untilMs: EpochMs;
  bpfFilter?: string;
  limitBytes?: number;
  limitPackets?: number;
}

/**
 * Metadata returned as JSON headers or in a pre-flight metadata endpoint.
 * This is NOT the PCAP payload itself — it describes the download.
 *
 * Fields:
 *   filename       — suggested filename (e.g. "192.168.1.10_1710000000_1710003600.pcap")
 *   contentType    — MIME type (always "application/vnd.tcpdump.pcap")
 *   estimatedBytes — estimated size in bytes (null if unknown)
 *   sourceIp       — the IP that was queried
 *   fromMs         — start of the captured window
 *   untilMs        — end of the captured window
 *   bpfFilter      — the BPF filter applied (null if none)
 *   packetStoreId  — ExtraHop packet store node ID (null in fixture mode)
 */
export interface PcapMetadata {
  filename: string;
  contentType: 'application/vnd.tcpdump.pcap';
  estimatedBytes: number | null;
  sourceIp: string;
  fromMs: EpochMs;
  untilMs: EpochMs;
  bpfFilter: string | null;
  packetStoreId: number | null;
}

// ─── Detection Detail (Slice 11) ────────────────────────────────────────
/**
 * A timestamped investigation note attached to a detection.
 */
export interface DetectionNote {
  timestamp: IsoString;
  author: string;
  text: string;
}

/**
 * A lifecycle event in the detection timeline.
 */
export interface DetectionTimelineEvent {
  timestamp: IsoString;
  event: 'created' | 'updated' | 'assigned' | 'status_changed' | 'resolved' | 'reopened';
  detail: string;
}

/**
 * Full detection detail for the inspector pane.
 * Extends the compact DetectionPreview (Slice 08) with:
 *   - Related devices (participants resolved to DeviceIdentity)
 *   - Related alerts (alerts on same devices during detection window)
 *   - Investigation notes
 *   - Detection lifecycle timeline
 *
 * This is the BFF response shape for GET /api/bff/impact/detection-detail?id=<detectionId>
 */
export interface DetectionDetail {
  detection: NormalizedDetection;
  relatedDevices: DeviceIdentity[];
  relatedAlerts: NormalizedAlert[];
  notes: DetectionNote[];
  timeline: DetectionTimelineEvent[];
}

// ─── Alert Detail (Slice 11) ────────────────────────────────────────────
/**
 * A single trigger event in the alert's recent history.
 */
export interface AlertTriggerEvent {
  timestamp: IsoString;
  deviceId: number;
  deviceName: string;
  value: number;
  threshold: number | string;
  exceeded: boolean;
}

/**
 * Full alert detail for the inspector pane.
 * Extends the compact AlertPreview (Slice 08) with:
 *   - Trigger history (recent trigger events)
 *   - Associated devices (devices that triggered this alert)
 *   - Associated detections (detections on the same devices)
 *
 * This is the BFF response shape for GET /api/bff/impact/alert-detail?id=<alertId>
 */
export interface AlertDetail {
  alert: NormalizedAlert;
  triggerHistory: AlertTriggerEvent[];
  associatedDevices: DeviceIdentity[];
  associatedDetections: NormalizedDetection[];
}

// ─── Inspector History (Slice 13) ───────────────────────────────────────
/**
 * A single entry in the inspector navigation history stack.
 * Each entry captures the selection that was active at that point,
 * plus a human-readable label for breadcrumb display.
 *
 * Invariants:
 *   - label is derived from the entity at push time and never changes
 *   - timestamp is epoch-ms at push time (for ordering verification)
 *   - The stack is append-only during forward navigation;
 *     goBack pops entries off the top
 *   - Maximum depth is enforced by INSPECTOR_HISTORY_MAX_DEPTH
 */
export interface InspectorHistoryEntry {
  selection: InspectorSelection;
  label: string;
  timestamp: EpochMs;
}

// ─── BFF Health Response ──────────────────────────────────────────────────
export interface BffHealthResponse {
  status: 'ok' | 'degraded' | 'not_configured';
  bff: {
    uptime: number;
    memoryMB: number;
    cache: { size: number; maxSize: number };
  };
  appliance: ApplianceIdentity | null;
  timestamp: IsoString;
}
