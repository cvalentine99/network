/**
 * Slice 18 — Blast Radius Validators
 *
 * Zod schemas for all Blast Radius types.
 * Used by BFF route (server-side validation) and test suite.
 */

import { z } from 'zod';

// ─── Entry Mode ────────────────────────────────────────────────────────────

export const BlastRadiusEntryModeSchema = z.enum(['device-id', 'hostname', 'ip-address']);

export const BlastRadiusTimeWindowSchema = z.object({
  fromMs: z.number().int().nonnegative(),
  untilMs: z.number().int().positive(),
  durationMs: z.number().int().positive(),
  cycle: z.enum(['30sec', '5min', '1hr', '24hr']),
}).refine(tw => tw.untilMs > tw.fromMs, {
  message: 'untilMs must be greater than fromMs',
});

export const BlastRadiusIntentSchema = z.object({
  mode: BlastRadiusEntryModeSchema,
  value: z.string().min(1),
  timeWindow: BlastRadiusTimeWindowSchema,
});

// ─── Severity ──────────────────────────────────────────────────────────────

export const BlastRadiusSeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

// ─── Protocol ──────────────────────────────────────────────────────────────

export const BlastRadiusProtocolSchema = z.object({
  name: z.string().min(1),
  port: z.number().int().nonnegative().nullable(),
  bytesSent: z.number().nonnegative(),
  bytesReceived: z.number().nonnegative(),
  hasDetections: z.boolean(),
});

// ─── Detection ─────────────────────────────────────────────────────────────

export const BlastRadiusDetectionSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  type: z.string().min(1),
  riskScore: z.number().nonnegative().max(100),
  severity: BlastRadiusSeveritySchema,
  startTime: z.number().int().nonnegative(),
  participants: z.array(z.string()),
});

// ─── Peer ──────────────────────────────────────────────────────────────────

export const BlastRadiusPeerSchema = z.object({
  deviceId: z.number().int().positive(),
  displayName: z.string().min(1),
  ipaddr: z.string().nullable(),
  role: z.string().nullable(),
  critical: z.boolean(),
  protocols: z.array(BlastRadiusProtocolSchema).min(1),
  detections: z.array(BlastRadiusDetectionSchema),
  totalBytes: z.number().nonnegative(),
  impactScore: z.number().nonnegative(),
  firstSeen: z.number().int().nonnegative(),
  lastSeen: z.number().int().nonnegative(),
}).refine(p => p.lastSeen >= p.firstSeen, {
  message: 'lastSeen must be >= firstSeen',
});

// ─── Source ────────────────────────────────────────────────────────────────

export const BlastRadiusSourceSchema = z.object({
  deviceId: z.number().int().positive(),
  displayName: z.string().min(1),
  ipaddr: z.string().nullable(),
  macaddr: z.string().nullable(),
  role: z.string().nullable(),
  deviceClass: z.string().nullable(),
  critical: z.boolean(),
});

// ─── Summary ───────────────────────────────────────────────────────────────

export const BlastRadiusSummarySchema = z.object({
  peerCount: z.number().int().nonnegative(),
  affectedPeerCount: z.number().int().nonnegative(),
  totalDetections: z.number().int().nonnegative(),
  uniqueProtocols: z.number().int().nonnegative(),
  totalBytes: z.number().nonnegative(),
  maxImpactScore: z.number().nonnegative(),
  severityDistribution: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
  }),
});

// ─── Payload ───────────────────────────────────────────────────────────────

export const BlastRadiusPayloadSchema = z.object({
  source: BlastRadiusSourceSchema,
  peers: z.array(BlastRadiusPeerSchema),
  summary: BlastRadiusSummarySchema,
  timeWindow: z.object({
    fromMs: z.number().int().nonnegative(),
    untilMs: z.number().int().positive(),
    durationMs: z.number().int().positive(),
    cycle: z.string().min(1),
  }),
});

// ─── View State ────────────────────────────────────────────────────────────

export const BlastRadiusStatusSchema = z.enum(['idle', 'loading', 'populated', 'quiet', 'error']);
export const BlastRadiusSortFieldSchema = z.enum(['impactScore', 'totalBytes', 'displayName', 'detections']);

export const BlastRadiusViewStateSchema = z.object({
  status: BlastRadiusStatusSchema,
  intent: BlastRadiusIntentSchema.nullable(),
  payload: BlastRadiusPayloadSchema.nullable(),
  errorMessage: z.string().nullable(),
  sortField: BlastRadiusSortFieldSchema,
  sortDirection: z.enum(['asc', 'desc']),
  filterAffectedOnly: z.boolean(),
  selectedPeerId: z.number().int().positive().nullable(),
});
