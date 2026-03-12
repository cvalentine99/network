// server/bff/lib/timeWindow.ts
import type { TimeWindow, MetricCycle } from '../../../shared/impact-types';
import { ACTIVE_SENTINEL } from '../../../shared/impact-constants';

/**
 * Resolve a relative or absolute time window into a stable TimeWindow.
 * Negative `from` values are relative to now (e.g., -300000 = 5 min ago).
 * `until` defaults to now if omitted.
 */
export function resolveTimeWindow(
  from: number,
  until?: number,
  cycle?: string
): TimeWindow {
  const now = Date.now();
  const fromMs = from < 0 ? now + from : from;
  const untilMs = until != null
    ? (until < 0 ? now + until : until)
    : now;
  const durationMs = untilMs - fromMs;
  const resolvedCycle: MetricCycle = (cycle && cycle !== 'auto')
    ? (cycle as MetricCycle)
    : autoSelectCycle(durationMs);
  return { fromMs, untilMs, durationMs, cycle: resolvedCycle };
}

/**
 * Auto-select the best metric cycle for a given duration.
 *   ≤ 6 min      → 1sec
 *   ≤ 30 min     → 30sec
 *   ≤ 6 hours    → 5min
 *   ≤ 2 days     → 1hr
 *   > 2 days     → 24hr
 */
export function autoSelectCycle(durationMs: number): MetricCycle {
  if (durationMs <= 360_000) return '1sec';
  if (durationMs <= 1_800_000) return '30sec';
  if (durationMs <= 21_600_000) return '5min';
  if (durationMs <= 172_800_000) return '1hr';
  return '24hr';
}

export function epochToIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function epochToIsoSafe(ms: number | null | undefined): string | null {
  if (ms == null || ms === 0) return null;
  if (ms === ACTIVE_SENTINEL) return null;
  return epochToIso(ms);
}

export function isActiveSentinel(untilTime: number | null | undefined): boolean {
  return untilTime === ACTIVE_SENTINEL;
}
