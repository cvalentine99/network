/**
 * Obsidian Cockpit — Metrics Normalization Core (Slice 01)
 *
 * Five pure functions. No side effects. No network calls. No DOM access.
 * Every function is deterministic: same input → same output, always.
 *
 * CONTRACT RULES (from sprint doc, non-negotiable):
 * 1. values[] arrays bind positionally to metric_specs[]. Never infer by name.
 * 2. Bucket totals are not rates. Throughput = total / durationSeconds.
 * 3. Empty data is valid → quiet state, not error.
 * 4. NaN and Infinity must never reach the output.
 * 5. Null in values[] means "no data for this bucket" — preserve as null, do not coerce to 0.
 */

import type {
  TimeWindow,
  MetricCycle,
  MetricSpec,
  SeriesPoint,
  MetricSeries,
  EpochMs,
} from './cockpit-types';

// ─── 1. resolveTimeWindow ────────────────────────────────────────────────
/**
 * Resolve a relative or absolute time window into concrete epoch boundaries.
 *
 * - Negative `from` is relative to `now` (e.g. -300000 = 5 minutes ago).
 * - Negative `until` is relative to `now`.
 * - Omitted `until` defaults to `now`.
 * - `cycle = 'auto'` selects granularity based on duration.
 * - Returns a frozen TimeWindow with positive durationMs.
 *
 * This function is duplicated from useTimeWindow.ts intentionally:
 * useTimeWindow.ts is a React module (imports createContext/useContext).
 * This module is pure — usable in server, tests, and workers without React.
 */
export function resolveTimeWindow(
  from: number,
  until?: number,
  cycle?: MetricCycle,
  now?: number
): TimeWindow {
  const anchor = now ?? Date.now();
  const fromMs = from < 0 ? anchor + from : from;
  const untilMs = until != null ? (until < 0 ? anchor + until : until) : anchor;
  const durationMs = untilMs - fromMs;

  if (durationMs <= 0) {
    // Invalid window — return a zero-width window at fromMs.
    // Caller should treat durationMs <= 0 as a quiet state.
    return { fromMs, untilMs: fromMs, durationMs: 0, cycle: '1sec' };
  }

  const resolvedCycle: MetricCycle =
    cycle && cycle !== 'auto' ? cycle : autoSelectCycle(durationMs);

  return { fromMs, untilMs, durationMs, cycle: resolvedCycle };
}

function autoSelectCycle(durationMs: number): MetricCycle {
  if (durationMs <= 360_000) return '1sec'; // ≤ 6 min
  if (durationMs <= 1_800_000) return '30sec'; // ≤ 30 min
  if (durationMs <= 21_600_000) return '5min'; // ≤ 6 hr
  if (durationMs <= 172_800_000) return '1hr'; // ≤ 2 days
  return '24hr';
}

// ─── 2. bindMetricValues ─────────────────────────────────────────────────
/**
 * Positionally bind a raw values[] array to its metric_specs[].
 *
 * CONTRACT: values[i] corresponds to metric_specs[i].
 * Never infer by name. Never assume order. Read the spec, bind by index.
 *
 * If values[i] is null, undefined, NaN, or Infinity → output null for that key.
 * If values.length < specs.length → missing positions are null.
 * If values.length > specs.length → extra positions are silently dropped.
 *
 * Returns Record<string, number | null> keyed by spec name (or spec.key1 if present).
 */
export function bindMetricValues(
  specs: MetricSpec[],
  values: (number | null | undefined)[]
): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const key = spec.key1 ?? spec.name;
    const raw = i < values.length ? values[i] : undefined;

    if (raw == null || !Number.isFinite(raw)) {
      result[key] = null;
    } else {
      result[key] = raw;
    }
  }

  return result;
}

// ─── 3. computeRate ──────────────────────────────────────────────────────
/**
 * Convert a bucket total to a per-second rate.
 *
 * CONTRACT: Bucket totals are NOT rates. You must divide by duration.
 * durationMs must be > 0. If it is 0 or negative, return null (not NaN, not Infinity).
 * If total is null, return null.
 * If the computed rate is NaN or Infinity (defensive), return null.
 */
export function computeRate(
  total: number | null,
  durationMs: number
): number | null {
  if (total == null) return null;
  if (durationMs <= 0) return null;

  const durationSec = durationMs / 1000;
  const rate = total / durationSec;

  if (!Number.isFinite(rate)) return null;
  return rate;
}

// ─── 4. buildMetricSeries ────────────────────────────────────────────────
/**
 * Transform raw ExtraHop metric stats into a normalized MetricSeries.
 *
 * Input: an array of raw stat rows, each with:
 *   - time (epoch ms)
 *   - duration (ms)
 *   - values (number[] — positional, bound to specs)
 *
 * Plus: the metric_specs array from the parent metric response,
 * and the object identity (type + id) and cycle.
 *
 * Output: a MetricSeries with normalized SeriesPoint[] where each point's
 * values are keyed by spec name, nulls are preserved, and no NaN/Infinity leaks.
 *
 * If stats is empty, returns a MetricSeries with points: [] — this is valid quiet state.
 */
export interface RawStatRow {
  time: EpochMs;
  duration: number; // ms
  values: (number | null | undefined)[];
}

export function buildMetricSeries(
  objectType: 'network' | 'device' | 'application',
  objectId: number,
  cycle: MetricCycle,
  fromMs: EpochMs,
  untilMs: EpochMs,
  specs: MetricSpec[],
  stats: RawStatRow[]
): MetricSeries {
  const points: SeriesPoint[] = [];

  for (const stat of stats) {
    const bound = bindMetricValues(specs, stat.values);
    const durationMs = stat.duration > 0 ? stat.duration : 1; // defensive

    points.push({
      t: stat.time,
      tIso: new Date(stat.time).toISOString(),
      durationMs,
      values: bound,
    });
  }

  // Sort by time ascending — never trust input order
  points.sort((a, b) => a.t - b.t);

  return {
    objectType,
    objectId,
    cycle,
    fromMs,
    untilMs,
    points,
  };
}

// ─── 5. computeActualCoverage ────────────────────────────────────────────
/**
 * Compute the actual time coverage of a MetricSeries relative to its window.
 *
 * Returns a ratio between 0 and 1:
 *   - 1.0 = every bucket in the window has data
 *   - 0.0 = no data at all (quiet state)
 *   - 0.5 = half the expected buckets are present
 *
 * This is used to detect partial data (e.g., appliance was offline for part
 * of the window) and to distinguish "no data" from "data is all zeroes."
 *
 * If the window duration is 0 or negative, returns 0.
 * If there are no points, returns 0.
 * Coverage > 1.0 is clamped to 1.0 (defensive against overlapping buckets).
 */
export function computeActualCoverage(series: MetricSeries): number {
  const windowMs = series.untilMs - series.fromMs;
  if (windowMs <= 0) return 0;
  if (series.points.length === 0) return 0;

  // Sum the duration of all points that fall within the window
  let coveredMs = 0;
  for (const point of series.points) {
    // Only count points whose start time falls within the window
    if (point.t >= series.fromMs && point.t < series.untilMs) {
      coveredMs += point.durationMs;
    }
  }

  const ratio = coveredMs / windowMs;
  return Math.min(ratio, 1.0);
}
