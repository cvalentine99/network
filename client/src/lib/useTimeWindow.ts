/**
 * Global Time Window Store
 *
 * NON-NEGOTIABLE: All panels on a surface share one time window.
 * No panel-local time windows. If fromMs/untilMs drift between panels,
 * the surface is fiction.
 *
 * Uses React Context so every component on the dashboard reads the same
 * resolved TimeWindow. The selector in the header writes to it.
 */
import { createContext, useContext } from 'react';
import type { TimeWindow, MetricCycle } from '@shared/cockpit-types';

// ─── Auto-cycle selection ─────────────────────────────────────────────────
export function autoSelectCycle(durationMs: number): MetricCycle {
  if (durationMs <= 360_000) return '1sec';
  if (durationMs <= 1_800_000) return '30sec';
  if (durationMs <= 21_600_000) return '5min';
  if (durationMs <= 172_800_000) return '1hr';
  return '24hr';
}

// ─── Resolve a relative or absolute time window ───────────────────────────
export function resolveTimeWindow(
  from: number,
  until?: number,
  cycle?: MetricCycle
): TimeWindow {
  const now = Date.now();
  const fromMs = from < 0 ? now + from : from;
  const untilMs = until != null
    ? (until < 0 ? now + until : until)
    : now;
  const durationMs = untilMs - fromMs;
  const resolvedCycle: MetricCycle = cycle && cycle !== 'auto'
    ? cycle
    : autoSelectCycle(durationMs);
  return { fromMs, untilMs, durationMs, cycle: resolvedCycle };
}

// ─── Context shape ────────────────────────────────────────────────────────
export interface TimeWindowContextValue {
  /** Current resolved time window — shared across all panels */
  window: TimeWindow;
  /** The raw "from" offset used to create the window (e.g. -300000) */
  fromOffset: number;
  /** Update the time window. Negative = relative to now. */
  setFromOffset: (offset: number) => void;
  /** Force-refresh the window (re-resolve against current Date.now()) */
  refresh: () => void;
}

export const TimeWindowContext = createContext<TimeWindowContextValue | null>(null);

export function useTimeWindow(): TimeWindowContextValue {
  const ctx = useContext(TimeWindowContext);
  if (!ctx) {
    throw new Error('useTimeWindow must be used within a TimeWindowProvider');
  }
  return ctx;
}
