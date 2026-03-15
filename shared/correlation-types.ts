/**
 * Correlation Overlay — Shared Types (Slice 19)
 *
 * CONTRACT:
 * - Defines the shape of correlation events that overlay on the Impact Deck timeline
 * - Events represent "what changed at roughly the same moment" — detections, alerts,
 *   config changes, firmware updates, threshold breaches, topology changes
 * - Each event has a timestamp (epochMs) that maps to the X-axis of GhostedTimeline
 * - Events are grouped by type for color-coded rendering
 * - Browser never contacts ExtraHop directly; all data flows through BFF
 * - Time window must match the shared TimeWindow from cockpit-types
 */

import type { EpochMs, Severity } from './cockpit-types';

// ─── Event Categories ─────────────────────────────────────────────────────
// Each category gets a distinct visual marker on the timeline

export type CorrelationEventCategory =
  | 'detection'       // ExtraHop detection fired
  | 'alert'           // Threshold alert triggered
  | 'config_change'   // Device/appliance configuration changed
  | 'firmware'        // Firmware update applied
  | 'topology'        // Network topology change (link up/down, new device)
  | 'threshold'       // Metric threshold crossed (non-alert)
  | 'external';       // External event injected via API

// ─── Single Correlation Event ─────────────────────────────────────────────

export interface CorrelationEvent {
  /** Unique event identifier */
  id: string;
  /** Event category for color-coding and grouping */
  category: CorrelationEventCategory;
  /** Human-readable title */
  title: string;
  /** Optional longer description */
  description: string | null;
  /** When the event occurred (epoch ms, maps to timeline X-axis) */
  timestampMs: EpochMs;
  /** ISO 8601 string of the timestamp for display */
  timestampIso: string;
  /** Duration in ms (0 for point-in-time events, >0 for ranged events) */
  durationMs: number;
  /** Severity level if applicable */
  severity: Severity | null;
  /** Risk score 0-100 if applicable (detections) */
  riskScore: number | null;
  /** Source entity that generated the event */
  source: CorrelationEventSource;
  /** Optional reference IDs for cross-linking to other surfaces */
  refs: CorrelationEventRef[];
}

export interface CorrelationEventSource {
  /** Source type: device, appliance, external */
  kind: 'device' | 'appliance' | 'external';
  /** Display name of the source */
  displayName: string;
  /** Optional device/appliance ID for drill-down */
  id: number | null;
}

export interface CorrelationEventRef {
  /** Reference type: detection, alert, device, trace */
  kind: 'detection' | 'alert' | 'device' | 'trace';
  /** Reference ID */
  id: string | number;
  /** Display label */
  label: string;
}

// ─── Correlation Payload (BFF Response) ───────────────────────────────────

export interface CorrelationPayload {
  /** Events within the requested time window */
  events: CorrelationEvent[];
  /** Time window these events cover */
  timeWindow: {
    fromMs: EpochMs;
    untilMs: EpochMs;
  };
  /** Category summary counts */
  categoryCounts: Record<CorrelationEventCategory, number>;
  /** Total event count */
  totalCount: number;
}

// ─── Correlation Intent (BFF Request) ─────────────────────────────────────

export interface CorrelationIntent {
  /** Start of time window (epoch ms) */
  fromMs: EpochMs;
  /** End of time window (epoch ms) */
  untilMs: EpochMs;
  /** Optional category filter (empty = all categories) */
  categories?: CorrelationEventCategory[];
  /** Optional minimum severity filter */
  minSeverity?: Severity;
}

// ─── View State (UI Component) ────────────────────────────────────────────

export type CorrelationOverlayState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'quiet'; timeWindow: { fromMs: EpochMs; untilMs: EpochMs } }
  | { kind: 'populated'; payload: CorrelationPayload }
  | { kind: 'error'; message: string }
  | { kind: 'malformed'; message: string };

// ─── Category Visual Config ───────────────────────────────────────────────
// Maps each category to a color and icon hint for the timeline overlay

export interface CategoryVisual {
  category: CorrelationEventCategory;
  color: string;
  label: string;
  /** Short icon hint for the UI (lucide icon name) */
  iconHint: string;
}

export const CORRELATION_CATEGORY_VISUALS: CategoryVisual[] = [
  { category: 'detection',     color: 'oklch(0.628 0.258 29.234)',  label: 'Detection',     iconHint: 'shield-alert' },
  { category: 'alert',         color: 'oklch(0.705 0.213 47.604)',  label: 'Alert',         iconHint: 'bell-ring' },
  { category: 'config_change', color: 'oklch(0.723 0.191 261.348)', label: 'Config Change', iconHint: 'settings' },
  { category: 'firmware',      color: 'oklch(0.762 0.195 151.711)', label: 'Firmware',      iconHint: 'cpu' },
  { category: 'topology',      color: 'oklch(0.714 0.203 305.504)', label: 'Topology',      iconHint: 'network' },
  { category: 'threshold',     color: 'oklch(0.795 0.184 86.047)',  label: 'Threshold',     iconHint: 'gauge' },
  { category: 'external',      color: 'oklch(0.600 0.000 0)',       label: 'External',      iconHint: 'globe' },
];

// ─── Pure Functions ───────────────────────────────────────────────────────

/**
 * Get the visual config for a given category
 */
export function getCategoryVisual(category: CorrelationEventCategory): CategoryVisual {
  return (
    CORRELATION_CATEGORY_VISUALS.find((v) => v.category === category) ??
    CORRELATION_CATEGORY_VISUALS[CORRELATION_CATEGORY_VISUALS.length - 1] // fallback to 'external'
  );
}

/**
 * Filter events by categories
 */
export function filterEventsByCategory(
  events: CorrelationEvent[],
  categories: CorrelationEventCategory[],
): CorrelationEvent[] {
  if (categories.length === 0) return events;
  const set = new Set(categories);
  return events.filter((e) => set.has(e.category));
}

/**
 * Filter events by minimum severity (null severity events are excluded when filtering)
 */
export function filterEventsBySeverity(
  events: CorrelationEvent[],
  minSeverity: Severity,
): CorrelationEvent[] {
  const severityOrder: Record<Severity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  const minLevel = severityOrder[minSeverity];
  return events.filter(
    (e) => e.severity !== null && severityOrder[e.severity] >= minLevel,
  );
}

/**
 * Group events into time buckets for clustered rendering.
 * Events within `bucketMs` of each other are grouped together.
 */
export function clusterEvents(
  events: CorrelationEvent[],
  bucketMs: number,
): CorrelationEventCluster[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.timestampMs - b.timestampMs);
  const clusters: CorrelationEventCluster[] = [];
  let current: CorrelationEvent[] = [sorted[0]];
  let clusterStart = sorted[0].timestampMs;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].timestampMs - clusterStart <= bucketMs) {
      current.push(sorted[i]);
    } else {
      clusters.push(buildCluster(current));
      current = [sorted[i]];
      clusterStart = sorted[i].timestampMs;
    }
  }
  clusters.push(buildCluster(current));
  return clusters;
}

export interface CorrelationEventCluster {
  /** Midpoint timestamp for positioning */
  timestampMs: EpochMs;
  /** All events in this cluster */
  events: CorrelationEvent[];
  /** Count of events */
  count: number;
  /** Highest severity in the cluster */
  maxSeverity: Severity | null;
  /** Dominant category (most frequent) */
  dominantCategory: CorrelationEventCategory;
}

function buildCluster(events: CorrelationEvent[]): CorrelationEventCluster {
  const midpoint = Math.round(
    events.reduce((sum, e) => sum + e.timestampMs, 0) / events.length,
  );
  const severityOrder: Record<Severity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  let maxSeverity: Severity | null = null;
  const categoryCounts = new Map<CorrelationEventCategory, number>();

  for (const e of events) {
    if (e.severity !== null) {
      if (maxSeverity === null || severityOrder[e.severity] > severityOrder[maxSeverity]) {
        maxSeverity = e.severity;
      }
    }
    categoryCounts.set(e.category, (categoryCounts.get(e.category) ?? 0) + 1);
  }

  let dominantCategory: CorrelationEventCategory = events[0].category;
  let maxCount = 0;
  Array.from(categoryCounts.entries()).forEach(([cat, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = cat;
    }
  });

  return {
    timestampMs: midpoint,
    events,
    count: events.length,
    maxSeverity,
    dominantCategory,
  };
}

/**
 * Build initial overlay state
 */
export function buildInitialCorrelationState(): CorrelationOverlayState {
  return { kind: 'idle' };
}

/**
 * Compute category counts from an event array
 */
export function computeCategoryCounts(
  events: CorrelationEvent[],
): Record<CorrelationEventCategory, number> {
  const counts: Record<CorrelationEventCategory, number> = {
    detection: 0,
    alert: 0,
    config_change: 0,
    firmware: 0,
    topology: 0,
    threshold: 0,
    external: 0,
  };
  for (const e of events) {
    counts[e.category]++;
  }
  return counts;
}
