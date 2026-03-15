/**
 * Slice 15 — Time-window synchronization audit
 *
 * Pure functions and types for proving that all dashboard panels
 * share the same time window with no drift.
 *
 * These are audit utilities, not runtime code. They exist to:
 * 1. Verify that two resolveTimeWindow implementations produce identical output
 * 2. Validate that BFF query params match the context window
 * 3. Detect drift between panels on the same surface
 * 4. Prove that cycle selection is deterministic from duration
 */

import type { TimeWindow, MetricCycle } from './cockpit-types';

// ─── Types ───────────────────────────────────────────────────────────────

/** A snapshot of the time-window params sent by a single panel to the BFF */
export interface PanelTimeWindowSnapshot {
  panelId: string;
  fromMs: number;
  untilMs: number;
  cycle: MetricCycle;
  capturedAt: number; // epoch ms when the snapshot was taken
}

/** Result of comparing two panels' time-window snapshots */
export interface DriftReport {
  panelA: string;
  panelB: string;
  fromMsDelta: number;
  untilMsDelta: number;
  cycleMismatch: boolean;
  drifted: boolean;
}

/** Result of comparing two resolveTimeWindow implementations */
export interface EquivalenceResult {
  input: { from: number; until?: number; cycle?: MetricCycle; now: number };
  outputA: TimeWindow;
  outputB: TimeWindow;
  equivalent: boolean;
  differences: string[];
}

// ─── Drift Detection ─────────────────────────────────────────────────────

/**
 * Compare two panel snapshots and report any drift.
 * Drift is defined as any difference in fromMs, untilMs, or cycle.
 * A tolerance of 0 is used — panels on the same surface must be identical.
 */
export function detectDrift(a: PanelTimeWindowSnapshot, b: PanelTimeWindowSnapshot): DriftReport {
  const fromMsDelta = Math.abs(a.fromMs - b.fromMs);
  const untilMsDelta = Math.abs(a.untilMs - b.untilMs);
  const cycleMismatch = a.cycle !== b.cycle;
  return {
    panelA: a.panelId,
    panelB: b.panelId,
    fromMsDelta,
    untilMsDelta,
    cycleMismatch,
    drifted: fromMsDelta > 0 || untilMsDelta > 0 || cycleMismatch,
  };
}

/**
 * Given N panel snapshots, compare all pairs and return any drifted pairs.
 * Returns empty array if all panels are synchronized.
 */
export function auditSurfaceDrift(snapshots: PanelTimeWindowSnapshot[]): DriftReport[] {
  const drifted: DriftReport[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const report = detectDrift(snapshots[i], snapshots[j]);
      if (report.drifted) {
        drifted.push(report);
      }
    }
  }
  return drifted;
}

// ─── Implementation Equivalence ──────────────────────────────────────────

/**
 * Compare two resolveTimeWindow implementations for equivalence.
 * Both must produce identical TimeWindow output for the same input.
 */
export function checkEquivalence(
  resolveA: (from: number, until?: number, cycle?: MetricCycle, now?: number) => TimeWindow,
  resolveB: (from: number, until?: number, cycle?: MetricCycle, now?: number) => TimeWindow,
  input: { from: number; until?: number; cycle?: MetricCycle; now: number }
): EquivalenceResult {
  const outputA = resolveA(input.from, input.until, input.cycle, input.now);
  const outputB = resolveB(input.from, input.until, input.cycle, input.now);
  const differences: string[] = [];

  if (outputA.fromMs !== outputB.fromMs) {
    differences.push(`fromMs: ${outputA.fromMs} vs ${outputB.fromMs}`);
  }
  if (outputA.untilMs !== outputB.untilMs) {
    differences.push(`untilMs: ${outputA.untilMs} vs ${outputB.untilMs}`);
  }
  if (outputA.durationMs !== outputB.durationMs) {
    differences.push(`durationMs: ${outputA.durationMs} vs ${outputB.durationMs}`);
  }
  if (outputA.cycle !== outputB.cycle) {
    differences.push(`cycle: ${outputA.cycle} vs ${outputB.cycle}`);
  }

  return {
    input,
    outputA,
    outputB,
    equivalent: differences.length === 0,
    differences,
  };
}

// ─── Cycle Determinism ───────────────────────────────────────────────────

/** The canonical cycle boundaries (same in both implementations) */
export const CYCLE_BOUNDARIES: Array<{ maxDurationMs: number; expectedCycle: MetricCycle }> = [
  { maxDurationMs: 360_000, expectedCycle: '1sec' },      // ≤ 6 min
  { maxDurationMs: 1_800_000, expectedCycle: '30sec' },    // ≤ 30 min
  { maxDurationMs: 21_600_000, expectedCycle: '5min' },    // ≤ 6 hr
  { maxDurationMs: 172_800_000, expectedCycle: '1hr' },    // ≤ 2 days
  { maxDurationMs: Infinity, expectedCycle: '24hr' },      // > 2 days
];

/**
 * Verify that a given autoSelectCycle function produces the expected cycle
 * for a given duration. Returns null if correct, or the actual cycle if wrong.
 */
export function verifyCycleDeterminism(
  autoSelectCycle: (durationMs: number) => MetricCycle,
  durationMs: number,
  expectedCycle: MetricCycle
): { correct: boolean; actual: MetricCycle; expected: MetricCycle } {
  const actual = autoSelectCycle(durationMs);
  return { correct: actual === expectedCycle, actual, expected: expectedCycle };
}

// ─── Preset Validation ───────────────────────────────────────────────────

/**
 * Verify that all TIME_WINDOW_PRESETS produce valid TimeWindows
 * when resolved with a given anchor time.
 */
export function validatePresets(
  presets: ReadonlyArray<{ label: string; value: number }>,
  resolve: (from: number, until?: number, cycle?: MetricCycle, now?: number) => TimeWindow,
  now: number
): Array<{ label: string; value: number; window: TimeWindow; valid: boolean; reason?: string }> {
  return presets.map((preset) => {
    const window = resolve(preset.value, undefined, undefined, now);
    const reasons: string[] = [];
    if (window.fromMs >= window.untilMs) reasons.push('fromMs >= untilMs');
    if (window.durationMs <= 0) reasons.push('durationMs <= 0');
    if (Number.isNaN(window.fromMs)) reasons.push('fromMs is NaN');
    if (Number.isNaN(window.untilMs)) reasons.push('untilMs is NaN');
    if (!['1sec', '30sec', '5min', '1hr', '24hr'].includes(window.cycle)) {
      reasons.push(`cycle "${window.cycle}" is not a concrete value`);
    }
    return {
      label: preset.label,
      value: preset.value,
      window,
      valid: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  });
}
