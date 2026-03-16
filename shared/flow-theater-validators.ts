/**
 * shared/flow-theater-validators.ts
 * Slice 17 — Flow Theater Foundation
 *
 * Zod validators for all Flow Theater SSE events, intents, and summaries.
 * These are the single source of truth for runtime validation.
 */

import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const TraceEntryModeSchema = z.enum(['hostname', 'device', 'service-row', 'ip', 'cidr']);

export const TraceStepStatusSchema = z.enum(['idle', 'running', 'complete', 'quiet', 'error']);

export const TraceStepIdSchema = z.enum([
  'input-accepted',
  'entry-resolution',
  'device-resolved',
  'activity-timeline',
  'metric-timeline',
  'records-search',
  'detection-alert',
  'trace-assembly',
]);

export const TraceRunStatusSchema = z.enum(['idle', 'running', 'complete', 'quiet', 'error']);

export const TraceSSEEventTypeSchema = z.enum(['step', 'heartbeat', 'complete', 'error']);

// ─── TimeWindow (inline, avoids circular import) ────────────────────────────

const TimeWindowSchema = z.object({
  fromMs: z.number().int().nonnegative(),
  untilMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  cycle: z.enum(['1sec', '30sec', '5min', '1hr', '24hr', 'auto']),
}).refine(d => d.untilMs > d.fromMs, { message: 'untilMs must be greater than fromMs' });

// ─── TraceIntent ─────────────────────────────────────────────────────────────

export const TraceIntentSchema = z.object({
  mode: TraceEntryModeSchema,
  value: z.string().min(1, 'Trace input value must not be empty'),
  timeWindow: TimeWindowSchema,
});

// ─── DeviceIdentity (inline subset) ─────────────────────────────────────────

const TraceDeviceSummarySchema = z.object({
  id: z.number().int().positive(),
  displayName: z.string().min(1),
  ipaddr: z.string().min(1),
  macaddr: z.string(),
  role: z.string(),
  vendor: z.string(),
});

// ─── TraceResolvedDevice ─────────────────────────────────────────────────────

export const TraceResolvedDeviceSchema = z.object({
  resolvedVia: TraceEntryModeSchema,
  originalInput: z.string().min(1),
  device: TraceDeviceSummarySchema,
});

// ─── SSE Events ──────────────────────────────────────────────────────────────

export const TraceStepEventSchema = z.object({
  type: z.literal('step'),
  stepId: TraceStepIdSchema,
  status: TraceStepStatusSchema,
  detail: z.string(),
  durationMs: z.number().nullable(),
  count: z.number().int().nullable(),
  timestamp: z.number().int().positive(),
});

export const TraceHeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  timestamp: z.number().int().positive(),
  activeSteps: z.number().int().nonnegative(),
});

const StepTimingSchema = z.object({
  stepId: TraceStepIdSchema,
  status: TraceStepStatusSchema,
  durationMs: z.number().nullable(),
});

export const TraceSummarySchema = z.object({
  resolvedDevice: TraceResolvedDeviceSchema.nullable(),
  activityCount: z.number().int().nonnegative(),
  metricPointCount: z.number().int().nonnegative(),
  recordCount: z.number().int().nonnegative(),
  detectionCount: z.number().int().nonnegative(),
  alertCount: z.number().int().nonnegative(),
  stepTimings: z.array(StepTimingSchema),
});

export const TraceCompleteEventSchema = z.object({
  type: z.literal('complete'),
  terminalStatus: z.enum(['complete', 'quiet', 'error']),
  summary: TraceSummarySchema,
  totalDurationMs: z.number().nonnegative(),
  timestamp: z.number().int().positive(),
});

export const TraceErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string().min(1),
  failedStepId: TraceStepIdSchema.nullable(),
  timestamp: z.number().int().positive(),
});

export const TraceSSEEventSchema = z.discriminatedUnion('type', [
  TraceStepEventSchema,
  TraceHeartbeatEventSchema,
  TraceCompleteEventSchema,
  TraceErrorEventSchema,
]);

// ─── TraceStepSnapshot (client-side per-step state) ──────────────────────────

export const TraceStepSnapshotSchema = z.object({
  status: TraceStepStatusSchema,
  detail: z.string(),
  durationMs: z.number().nullable(),
  count: z.number().int().nullable(),
});

// ─── TraceRunState (full client-side state) ──────────────────────────────────

export const TraceRunStateSchema = z.object({
  status: TraceRunStatusSchema,
  intent: TraceIntentSchema.nullable(),
  steps: z.record(TraceStepIdSchema, TraceStepSnapshotSchema),
  summary: TraceSummarySchema.nullable(),
  totalDurationMs: z.number().nullable(),
  lastHeartbeat: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
});
