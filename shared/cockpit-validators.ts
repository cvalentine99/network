/**
 * Obsidian Cockpit — Shared validators (Zod schemas)
 * Every payload entering or leaving the BFF must pass through these.
 * Components consume validated data only — never raw payloads.
 */
import { z } from 'zod';

// ─── Time Window Query ────────────────────────────────────────────────────
export const TimeWindowQuerySchema = z.object({
  from: z.coerce.number().optional().default(-300000),
  until: z.coerce.number().optional(),
  cycle: z.enum(['1sec', '30sec', '5min', '1hr', '24hr', 'auto']).optional().default('auto'),
});

export type TimeWindowQuery = z.infer<typeof TimeWindowQuerySchema>;

// ─── Time Window (resolved) ──────────────────────────────────────────────
export const TimeWindowSchema = z.object({
  fromMs: z.number(),
  untilMs: z.number(),
  durationMs: z.number().positive(),
  cycle: z.enum(['1sec', '30sec', '5min', '1hr', '24hr', 'auto']),
});

// ─── Series Point ─────────────────────────────────────────────────────────
export const SeriesPointSchema = z.object({
  t: z.number(),
  tIso: z.string(),
  durationMs: z.number().positive(),
  values: z.record(z.string(), z.number().nullable()),
});

// ─── Appliance Identity ───────────────────────────────────────────────────
export const ApplianceIdentitySchema = z.object({
  version: z.string(),
  edition: z.string(),
  platform: z.string(),
  hostname: z.string(),
  mgmtIpaddr: z.string(),
  displayHost: z.string(),
  captureName: z.string(),
  captureMac: z.string(),
  licensedModules: z.array(z.string()),
  licensedOptions: z.array(z.string()),
  processCount: z.number().int().nonnegative(),
  services: z.record(z.string(), z.object({ enabled: z.boolean() })),
});

// ─── BFF Health Response ──────────────────────────────────────────────────
export const EtlJobHealthStatusSchema = z.object({
  running: z.boolean(),
  lastRunAt: z.string().nullable(),
  lastRunDurationMs: z.number().nonnegative(),
  lastRunDevicesPolled: z.number().int().nonnegative(),
  lastRunDevicesSucceeded: z.number().int().nonnegative(),
  lastRunDevicesFailed: z.number().int().nonnegative(),
  lastRunRecordsUpserted: z.number().int().nonnegative(),
  totalRuns: z.number().int().nonnegative(),
  totalErrors: z.number().int().nonnegative(),
  intervalMs: z.number().int().nonnegative(),
  nextRunAt: z.string().nullable(),
});

export const BffHealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'not_configured']),
  bff: z.object({
    uptime: z.number().nonnegative(),
    memoryMB: z.number().nonnegative(),
    cache: z.object({
      size: z.number().int().nonnegative(),
      maxSize: z.number().int().nonnegative(),
    }),
  }),
  appliance: ApplianceIdentitySchema.nullable(),
  etl: EtlJobHealthStatusSchema.nullable(),
  timestamp: z.string(),
});

// ─── Impact Overview Headline ─────────────────────────────────────────────
export const ImpactHeadlineSchema = z.object({
  totalBytes: z.number().nonnegative(),
  totalPackets: z.number().nonnegative(),
  bytesPerSecond: z.number().nonnegative(),
  packetsPerSecond: z.number().nonnegative(),
  baselineDeltaPct: z.number().nullable(),
});

// ─── Normalized Detection ─────────────────────────────────────────────────
export const NormalizedDetectionSchema = z.object({
  id: z.number(),
  title: z.string(),
  type: z.string(),
  displayName: z.string(),
  categories: z.array(z.string()),
  participants: z.array(z.object({
    object_type: z.enum(['device', 'ipaddr']),
    object_id: z.number().optional(),
    ipaddr: z.string().optional(),
    hostname: z.string().optional(),
    role: z.string(),
  })),
  riskScore: z.number().nonnegative(),
  startTime: z.number(),
  startTimeIso: z.string(),
  endTime: z.number(),
  endTimeIso: z.string(),
  createTime: z.number(),
  createTimeIso: z.string(),
  status: z.string(),
  resolution: z.string().nullable(),
  assignee: z.string().nullable(),
  ticketId: z.string().nullable(),
  mitreTactics: z.array(z.string()),
  mitreTechniques: z.array(z.string()),
  isUserCreated: z.boolean(),
  properties: z.record(z.string(), z.unknown()),
  url: z.string().nullable(),
});

// ─── Normalized Alert ─────────────────────────────────────────────────────
export const NormalizedAlertSchema = z.object({
  id: z.number(),
  name: z.string(),
  author: z.string(),
  statName: z.string(),
  fieldName: z.string(),
  fieldOp: z.string().nullable(),
  fieldName2: z.string().nullable(),
  operator: z.string(),
  operand: z.union([z.number(), z.string()]),
  severity: z.number(),
  severityLabel: z.enum(['low', 'medium', 'high', 'critical']),
  type: z.string(),
  disabled: z.boolean(),
  description: z.string(),
  intervalLength: z.number().nullable(),
  refireInterval: z.number().nullable(),
});

// ─── Device Identity ──────────────────────────────────────────────────────
export const DeviceIdentitySchema = z.object({
  id: z.number(),
  displayName: z.string(),
  extrahopId: z.string(),
  discoveryId: z.string(),
  ipaddr4: z.string().nullable(),
  ipaddr6: z.string().nullable(),
  macaddr: z.string(),
  deviceClass: z.string().nullable(),
  role: z.string().nullable(),
  autoRole: z.string().nullable(),
  vendor: z.string().nullable(),
  isL3: z.boolean(),
  vlanid: z.number().nullable(),
  parentId: z.number().nullable(),
  nodeId: z.number().nullable(),
  analysis: z.string().nullable(),
  analysisLevel: z.number().nullable(),
  lastSeenTime: z.number().nullable(),
  lastSeenIso: z.string().nullable(),
  modTime: z.number().nullable(),
  discoverTime: z.number().nullable(),
  discoverTimeIso: z.string().nullable(),
  onWatchlist: z.boolean(),
  critical: z.boolean(),
  customCriticality: z.string().nullable(),
  isCustomDevice: z.boolean(),
  customType: z.string().nullable(),
  userModTime: z.number().nullable(),
  description: z.string().nullable(),
  cdp_name: z.string().nullable(),
  dhcp_name: z.string().nullable(),
  dns_name: z.string().nullable(),
  netbios_name: z.string().nullable(),
  custom_name: z.string().nullable(),
  default_name: z.string().nullable(),
  model: z.string().nullable(),
  modelOverride: z.string().nullable(),
  software: z.string().nullable(),
});

// ─── Top Talker Row ───────────────────────────────────────────────────────
export const TopTalkerRowSchema = z.object({
  device: DeviceIdentitySchema,
  bytesIn: z.number().nonnegative(),
  bytesOut: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
  pktsIn: z.number().nonnegative(),
  pktsOut: z.number().nonnegative(),
  sparkline: z.array(SeriesPointSchema),
});

// ─── Appliance Status (Slice 07) ─────────────────────────────────────────
export const ApplianceStatusSchema = z.object({
  hostname: z.string(),
  displayHost: z.string(),
  version: z.string(),
  edition: z.string(),
  platform: z.string(),
  mgmtIpaddr: z.string(),
  captureStatus: z.enum(['active', 'inactive', 'unknown']),
  captureInterface: z.string(),
  licenseStatus: z.enum(['valid', 'expired', 'unknown']),
  licensedModules: z.array(z.string()),
  uptimeSeconds: z.number().nonnegative(),
  connectionStatus: z.enum(['connected', 'not_configured', 'error']),
  lastChecked: z.string(),
});

// ─── Device Protocol Activity (Slice 09) ────────────────────────────────
export const DeviceProtocolActivitySchema = z.object({
  protocol: z.string().min(1),
  bytesIn: z.number().nonnegative(),
  bytesOut: z.number().nonnegative(),
  totalBytes: z.number().nonnegative(),
  connections: z.number().int().nonnegative(),
  lastSeen: z.string(),
});

// ─── Device Detail (Slice 09) ───────────────────────────────────────────
export const DeviceDetailSchema = z.object({
  device: DeviceIdentitySchema,
  traffic: z.object({
    bytesIn: z.number().nonnegative(),
    bytesOut: z.number().nonnegative(),
    totalBytes: z.number().nonnegative(),
    pktsIn: z.number().nonnegative(),
    pktsOut: z.number().nonnegative(),
  }),
  protocols: z.array(DeviceProtocolActivitySchema),
  associatedDetections: z.array(NormalizedDetectionSchema),
  associatedAlerts: z.array(NormalizedAlertSchema),
  activitySummary: z.object({
    firstSeen: z.string().nullable(),
    lastSeen: z.string().nullable(),
    totalProtocols: z.number().int().nonnegative(),
    totalConnections: z.number().int().nonnegative(),
    peakThroughputBps: z.number().nullable(),
  }),
});

// ─── PCAP Download (Slice 10) ───────────────────────────────────────────
export const PcapRequestSchema = z.object({
  ip: z.string().min(1, 'IP address is required'),
  fromMs: z.number().int(),
  untilMs: z.number().int(),
  bpfFilter: z.string().optional(),
  limitBytes: z.number().int().positive().optional().default(10_485_760), // 10 MB
  limitPackets: z.number().int().positive().optional(),
});

export const PcapMetadataSchema = z.object({
  filename: z.string().min(1),
  contentType: z.literal('application/vnd.tcpdump.pcap'),
  estimatedBytes: z.number().nonnegative().nullable(),
  sourceIp: z.string().min(1),
  fromMs: z.number().int(),
  untilMs: z.number().int(),
  bpfFilter: z.string().nullable(),
  packetStoreId: z.number().int().nullable(),
});

// ─── Detection Detail (Slice 11) ────────────────────────────────────────
export const DetectionNoteSchema = z.object({
  timestamp: z.string(),
  author: z.string(),
  text: z.string(),
});

export const DetectionTimelineEventSchema = z.object({
  timestamp: z.string(),
  event: z.enum(['created', 'updated', 'assigned', 'status_changed', 'resolved', 'reopened']),
  detail: z.string(),
});

export const DetectionDetailSchema = z.object({
  detection: NormalizedDetectionSchema,
  relatedDevices: z.array(DeviceIdentitySchema),
  relatedAlerts: z.array(NormalizedAlertSchema),
  notes: z.array(DetectionNoteSchema),
  timeline: z.array(DetectionTimelineEventSchema),
});

// ─── Alert Detail (Slice 11) ────────────────────────────────────────────
export const AlertTriggerEventSchema = z.object({
  timestamp: z.string(),
  deviceId: z.number(),
  deviceName: z.string(),
  value: z.number(),
  threshold: z.union([z.number(), z.string()]),
  exceeded: z.boolean(),
});

export const AlertDetailSchema = z.object({
  alert: NormalizedAlertSchema,
  triggerHistory: z.array(AlertTriggerEventSchema),
  associatedDevices: z.array(DeviceIdentitySchema),
  associatedDetections: z.array(NormalizedDetectionSchema),
});

// ─── Inspector History Entry (Slice 13) ─────────────────────────────────
export const InspectorSelectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('device'),
    device: DeviceIdentitySchema,
    topTalkerRow: TopTalkerRowSchema,
  }),
  z.object({
    kind: z.literal('detection'),
    detection: NormalizedDetectionSchema,
  }),
  z.object({
    kind: z.literal('alert'),
    alert: NormalizedAlertSchema,
  }),
]);

export const InspectorHistoryEntrySchema = z.object({
  selection: InspectorSelectionSchema,
  label: z.string().min(1),
  timestamp: z.number().int().positive(),
});

// ─── Impact Overview Payload (full) ───────────────────────────────────────
export const ImpactOverviewPayloadSchema = z.object({
  headline: ImpactHeadlineSchema,
  timeseries: z.array(SeriesPointSchema),
  topTalkers: z.array(TopTalkerRowSchema),
  detections: z.array(NormalizedDetectionSchema),
  alerts: z.array(NormalizedAlertSchema),
  applianceVersion: z.string(),
  applianceEdition: z.string(),
  appliancePlatform: z.string(),
  captureName: z.string(),
  licensedModules: z.array(z.string()),
});
