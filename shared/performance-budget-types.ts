/**
 * Slice 22 — Performance Budget Validation
 *
 * Shared types, constants, and validators for formal timing proof
 * across all major dashboard surfaces.
 *
 * These budgets define the maximum acceptable time from navigation
 * to the populated (or equivalent terminal) data-testid appearing
 * in the DOM, measured via Puppeteer against fixture-backed BFF routes.
 *
 * Budget targets are measured in a sandbox Chromium environment.
 * They are NOT production SLAs — they are contract-phase proof that
 * the rendering pipeline completes within a reasonable envelope
 * when driven by deterministic fixture data.
 */

import { z } from "zod";

// ─── Surface identifiers ───────────────────────────────────────

export const SURFACE_IDS = [
  "impact-deck",
  "flow-theater",
  "blast-radius",
  "correlation",
  "topology",
  "inspector-tab-switch",
] as const;

export type SurfaceId = (typeof SURFACE_IDS)[number];

// ─── Budget constants ──────────────────────────────────────────

/**
 * Maximum allowed render time (ms) from navigation/action start
 * to terminal data-testid visible in DOM.
 *
 * These are contract-phase budgets measured in sandbox Chromium,
 * not production SLAs.
 */
export const PERFORMANCE_BUDGETS: Record<SurfaceId, number> = {
  "impact-deck": 2000,
  "flow-theater": 5000,
  "blast-radius": 3000,
  "correlation": 2000,
  "topology": 4000,
  "inspector-tab-switch": 200,
} as const;

// ─── Terminal testid map ───────────────────────────────────────

/**
 * The data-testid that signals a surface has reached its
 * populated/terminal state. The measurement harness waits
 * for this selector to appear.
 */
export const SURFACE_TERMINAL_TESTIDS: Record<SurfaceId, string> = {
  "impact-deck":
    "[data-testid='kpi-strip-populated'], [data-testid='kpi-strip-quiet'], [data-testid='kpi-strip-error'], [data-testid='kpi-strip-malformed'], [data-testid='kpi-strip-loading']",
  "flow-theater": "[data-testid='flow-theater-page']",
  "blast-radius": "[data-testid='blast-radius-surface']",
  "correlation":
    "[data-testid='correlation-page-populated'], [data-testid='correlation-page-quiet'], [data-testid='correlation-page-error'], [data-testid='correlation-page-malformed'], [data-testid='correlation-page-loading'], [data-testid='correlation-page-idle']",
  "topology":
    "[data-testid='topology-populated'], [data-testid='topology-quiet'], [data-testid='topology-loading'], [data-testid='topology-error'], [data-testid='topology-malformed']",
  "inspector-tab-switch": "[data-testid='inspector-shell']",
} as const;

// ─── Surface route map ─────────────────────────────────────────

/**
 * The client-side route path for each surface.
 * Inspector tab switch is measured on the Impact Deck (/).
 */
export const SURFACE_ROUTES: Record<SurfaceId, string> = {
  "impact-deck": "/",
  "flow-theater": "/flow-theater",
  "blast-radius": "/blast-radius",
  "correlation": "/correlation",
  "topology": "/topology",
  "inspector-tab-switch": "/",
} as const;

// ─── Measurement result types ──────────────────────────────────

export interface TimingMeasurement {
  /** Which surface was measured */
  surfaceId: SurfaceId;
  /** Budget target in ms */
  budgetMs: number;
  /** Actual measured time in ms */
  actualMs: number;
  /** Whether the measurement passed the budget */
  passed: boolean;
  /** The data-testid selector waited for */
  terminalSelector: string;
  /** ISO timestamp when the measurement was taken */
  measuredAt: string;
  /** Number of measurement runs averaged */
  runs: number;
  /** Individual run times in ms */
  runTimes: number[];
  /** Standard deviation across runs (ms) */
  stdDevMs: number;
}

export interface PerformanceBudgetReport {
  /** All individual surface measurements */
  measurements: TimingMeasurement[];
  /** Overall pass/fail */
  allPassed: boolean;
  /** Total surfaces measured */
  totalSurfaces: number;
  /** Surfaces that passed */
  passedCount: number;
  /** Surfaces that failed */
  failedCount: number;
  /** ISO timestamp of the report */
  generatedAt: string;
  /** Environment description */
  environment: string;
}

// ─── Zod schemas ───────────────────────────────────────────────

export const SurfaceIdSchema = z.enum(SURFACE_IDS);

export const TimingMeasurementSchema = z.object({
  surfaceId: SurfaceIdSchema,
  budgetMs: z.number().int().positive(),
  actualMs: z.number().nonnegative(),
  passed: z.boolean(),
  terminalSelector: z.string().min(1),
  measuredAt: z.string().min(1),
  runs: z.number().int().positive(),
  runTimes: z.array(z.number().nonnegative()).min(1),
  stdDevMs: z.number().nonnegative(),
});

export const PerformanceBudgetReportSchema = z.object({
  measurements: z.array(TimingMeasurementSchema).min(1),
  allPassed: z.boolean(),
  totalSurfaces: z.number().int().positive(),
  passedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  generatedAt: z.string().min(1),
  environment: z.string().min(1),
});

// ─── Validators ────────────────────────────────────────────────

/**
 * Validate that a measurement's passed field is consistent
 * with actualMs vs budgetMs.
 */
export function validatePassedConsistency(m: TimingMeasurement): boolean {
  return m.passed === (m.actualMs <= m.budgetMs);
}

/**
 * Validate that report summary counts are consistent
 * with individual measurements.
 */
export function validateReportConsistency(r: PerformanceBudgetReport): boolean {
  const passed = r.measurements.filter((m) => m.passed).length;
  const failed = r.measurements.filter((m) => !m.passed).length;
  return (
    r.passedCount === passed &&
    r.failedCount === failed &&
    r.totalSurfaces === r.measurements.length &&
    r.allPassed === (failed === 0)
  );
}

/**
 * Validate that runTimes array length matches runs count
 * and that actualMs is the mean of runTimes.
 */
export function validateRunTimesConsistency(m: TimingMeasurement): boolean {
  if (m.runTimes.length !== m.runs) return false;
  const mean = m.runTimes.reduce((a, b) => a + b, 0) / m.runs;
  // Allow 1ms rounding tolerance
  return Math.abs(mean - m.actualMs) <= 1;
}

/**
 * Validate that stdDev is correctly computed from runTimes.
 */
export function validateStdDev(m: TimingMeasurement): boolean {
  if (m.runs === 1) return m.stdDevMs === 0;
  const mean = m.runTimes.reduce((a, b) => a + b, 0) / m.runs;
  const variance =
    m.runTimes.reduce((sum, t) => sum + (t - mean) ** 2, 0) / m.runs;
  const stdDev = Math.sqrt(variance);
  // Allow 1ms rounding tolerance
  return Math.abs(stdDev - m.stdDevMs) <= 1;
}

/**
 * Validate that every SURFACE_ID has a corresponding budget,
 * terminal testid, and route defined.
 */
export function validateBudgetCoverage(): {
  covered: SurfaceId[];
  missing: SurfaceId[];
} {
  const covered: SurfaceId[] = [];
  const missing: SurfaceId[] = [];
  for (const id of SURFACE_IDS) {
    if (
      PERFORMANCE_BUDGETS[id] !== undefined &&
      SURFACE_TERMINAL_TESTIDS[id] !== undefined &&
      SURFACE_ROUTES[id] !== undefined
    ) {
      covered.push(id);
    } else {
      missing.push(id);
    }
  }
  return { covered, missing };
}
