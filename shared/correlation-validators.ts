/**
 * Correlation Overlay — Zod Validators (Slice 19)
 *
 * CONTRACT:
 * - Validates all correlation event shapes at BFF boundary
 * - Rejects NaN, Infinity, negative timestamps, empty strings
 * - Enforces category enum membership
 * - Validates severity when present
 * - Validates riskScore range [0, 100] when present
 * - Validates durationMs >= 0
 */

import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────

export const CorrelationEventCategorySchema = z.enum([
  'detection',
  'alert',
  'config_change',
  'firmware',
  'topology',
  'threshold',
  'external',
]);

export const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// ─── Sub-schemas ──────────────────────────────────────────────────────────

export const CorrelationEventSourceSchema = z.object({
  kind: z.enum(['device', 'appliance', 'external']),
  displayName: z.string().min(1),
  id: z.number().int().nullable(),
});

export const CorrelationEventRefSchema = z.object({
  kind: z.enum(['detection', 'alert', 'device', 'trace']),
  id: z.union([z.string().min(1), z.number()]),
  label: z.string().min(1),
});

// ─── Main Event Schema ────────────────────────────────────────────────────

export const CorrelationEventSchema = z.object({
  id: z.string().min(1),
  category: CorrelationEventCategorySchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  timestampMs: z.number().int().nonnegative().finite(),
  timestampIso: z.string().min(1),
  durationMs: z.number().nonnegative().finite(),
  severity: SeveritySchema.nullable(),
  riskScore: z.number().min(0).max(100).finite().nullable(),
  source: CorrelationEventSourceSchema,
  refs: z.array(CorrelationEventRefSchema),
});

// ─── Payload Schema ───────────────────────────────────────────────────────

export const CorrelationPayloadSchema = z.object({
  events: z.array(CorrelationEventSchema),
  timeWindow: z.object({
    fromMs: z.number().int().nonnegative().finite(),
    untilMs: z.number().int().nonnegative().finite(),
  }),
  categoryCounts: z.object({
    detection: z.number().int().nonnegative(),
    alert: z.number().int().nonnegative(),
    config_change: z.number().int().nonnegative(),
    firmware: z.number().int().nonnegative(),
    topology: z.number().int().nonnegative(),
    threshold: z.number().int().nonnegative(),
    external: z.number().int().nonnegative(),
  }),
  totalCount: z.number().int().nonnegative(),
}).refine(
  (data) => data.timeWindow.fromMs <= data.timeWindow.untilMs,
  { message: 'timeWindow.fromMs must be <= timeWindow.untilMs' },
).refine(
  (data) => data.totalCount === data.events.length,
  { message: 'totalCount must equal events.length' },
).refine(
  (data) => {
    const computed = {
      detection: 0, alert: 0, config_change: 0, firmware: 0,
      topology: 0, threshold: 0, external: 0,
    };
    for (const e of data.events) {
      computed[e.category]++;
    }
    return Object.keys(computed).every(
      (k) => computed[k as keyof typeof computed] === data.categoryCounts[k as keyof typeof data.categoryCounts],
    );
  },
  { message: 'categoryCounts must match actual event category distribution' },
);

// ─── Intent Schema ────────────────────────────────────────────────────────

export const CorrelationIntentSchema = z.object({
  fromMs: z.number().int().nonnegative().finite(),
  untilMs: z.number().int().nonnegative().finite(),
  categories: z.array(CorrelationEventCategorySchema).optional(),
  minSeverity: SeveritySchema.optional(),
}).refine(
  (data) => data.fromMs <= data.untilMs,
  { message: 'fromMs must be <= untilMs' },
);

// ─── Cluster Schema (for testing) ─────────────────────────────────────────

export const CorrelationEventClusterSchema = z.object({
  timestampMs: z.number().int().nonnegative().finite(),
  events: z.array(CorrelationEventSchema),
  count: z.number().int().positive(),
  maxSeverity: SeveritySchema.nullable(),
  dominantCategory: CorrelationEventCategorySchema,
}).refine(
  (data) => data.count === data.events.length,
  { message: 'count must equal events.length' },
);
