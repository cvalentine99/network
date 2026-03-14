/**
 * shared/flow-theater-types.ts
 * Slice 17 — Flow Theater Foundation
 *
 * Shared type contracts for the Flow Theater trace surface.
 * All SSE events, entry modes, step statuses, and summary shapes
 * are defined here. No ad-hoc event shapes in the SSE route.
 */

import type { EpochMs, TimeWindow } from './cockpit-types';

// ─── Entry Modes ─────────────────────────────────────────────────────────────

export type TraceEntryMode = 'hostname' | 'device' | 'service-row';

/**
 * TraceIntent: the client-provided input that initiates a trace.
 * The BFF normalizes this into a resolved device and fans out.
 */
export interface TraceIntent {
  /** Which entry mode the user selected */
  mode: TraceEntryMode;
  /** The raw input value: hostname string, device ID number, or service-row key */
  value: string;
  /** Shared time window from the dashboard context */
  timeWindow: TimeWindow;
}

// ─── Step Contract ───────────────────────────────────────────────────────────

export type TraceStepStatus = 'idle' | 'running' | 'complete' | 'quiet' | 'error';

export type TraceStepId =
  | 'input-accepted'
  | 'entry-resolution'
  | 'device-resolved'
  | 'activity-timeline'
  | 'metric-timeline'
  | 'records-search'
  | 'detection-alert'
  | 'trace-assembly';

/**
 * The 8 steps of the Flow Theater trace rail.
 * Steps 1-3 are serial. Steps 4-8 fan out in parallel after device resolution.
 */
export const TRACE_STEPS: readonly TraceStepDefinition[] = [
  { id: 'input-accepted',    index: 0, label: 'Input Accepted',       serial: true  },
  { id: 'entry-resolution',  index: 1, label: 'Entry Resolution',     serial: true  },
  { id: 'device-resolved',   index: 2, label: 'Device Resolved',      serial: true  },
  { id: 'activity-timeline', index: 3, label: 'Activity Timeline',    serial: false },
  { id: 'metric-timeline',   index: 4, label: 'Metric Timeline',      serial: false },
  { id: 'records-search',    index: 5, label: 'Records / Search',     serial: false },
  { id: 'detection-alert',   index: 6, label: 'Detections & Alerts',  serial: false },
  { id: 'trace-assembly',    index: 7, label: 'Trace Assembly',       serial: false },
] as const;

export interface TraceStepDefinition {
  id: TraceStepId;
  index: number;
  label: string;
  /** true = must complete before next step starts; false = can run in parallel */
  serial: boolean;
}

// ─── SSE Event Types ─────────────────────────────────────────────────────────

export type TraceSSEEventType = 'step' | 'heartbeat' | 'complete' | 'error';

/**
 * TraceStepEvent: emitted when a step transitions to a new status.
 * The BFF emits one of these for each step state change.
 */
export interface TraceStepEvent {
  type: 'step';
  stepId: TraceStepId;
  status: TraceStepStatus;
  /** Human-readable detail text for the step */
  detail: string;
  /** Duration in ms if the step has completed or errored */
  durationMs: number | null;
  /** Optional count (e.g., "3 detections found") */
  count: number | null;
  /** Epoch ms when this event was emitted */
  timestamp: EpochMs;
}

/**
 * TraceHeartbeatEvent: emitted periodically to keep the SSE connection alive.
 * The client uses this to detect stale connections.
 */
export interface TraceHeartbeatEvent {
  type: 'heartbeat';
  /** Epoch ms when heartbeat was emitted */
  timestamp: EpochMs;
  /** Number of steps currently in 'running' status */
  activeSteps: number;
}

/**
 * TraceCompleteEvent: emitted exactly once when the trace reaches a terminal state.
 * Terminal states: complete | quiet | error
 */
export interface TraceCompleteEvent {
  type: 'complete';
  /** Terminal status of the overall trace */
  terminalStatus: 'complete' | 'quiet' | 'error';
  /** Summary of the trace results */
  summary: TraceSummary;
  /** Total wall-clock time from first step to terminal event */
  totalDurationMs: number;
  /** Epoch ms when this event was emitted */
  timestamp: EpochMs;
}

/**
 * TraceErrorEvent: emitted when a fatal error terminates the trace.
 * This is distinct from a step-level error (which is a TraceStepEvent with status='error').
 */
export interface TraceErrorEvent {
  type: 'error';
  /** Human-readable error message */
  message: string;
  /** Which step caused the fatal error, if applicable */
  failedStepId: TraceStepId | null;
  /** Epoch ms when this event was emitted */
  timestamp: EpochMs;
}

export type TraceSSEEvent =
  | TraceStepEvent
  | TraceHeartbeatEvent
  | TraceCompleteEvent
  | TraceErrorEvent;

// ─── Resolved Device ─────────────────────────────────────────────────────────

/**
 * TraceDeviceSummary: lightweight device identity for trace results.
 * Uses a minimal subset of DeviceIdentity to avoid coupling the trace
 * contract to the full 30+ field ExtraHop device shape.
 */
export interface TraceDeviceSummary {
  id: number;
  displayName: string;
  ipaddr: string;
  macaddr: string;
  role: string;
  vendor: string;
}

/**
 * TraceResolvedDevice: the canonical device identity established in step 3.
 * This is a lightweight subset plus the resolution path.
 */
export interface TraceResolvedDevice {
  /** How the device was resolved */
  resolvedVia: TraceEntryMode;
  /** The original input value */
  originalInput: string;
  /** The resolved device summary */
  device: TraceDeviceSummary;
}

// ─── Trace Summary ───────────────────────────────────────────────────────────

/**
 * TraceSummary: the final summary card data emitted with the complete event.
 */
export interface TraceSummary {
  /** The resolved device, or null if resolution failed */
  resolvedDevice: TraceResolvedDevice | null;
  /** Number of activity records found */
  activityCount: number;
  /** Number of metric data points collected */
  metricPointCount: number;
  /** Number of records/search results found */
  recordCount: number;
  /** Number of detections found */
  detectionCount: number;
  /** Number of alerts found */
  alertCount: number;
  /** Per-step timing breakdown */
  stepTimings: Array<{
    stepId: TraceStepId;
    status: TraceStepStatus;
    durationMs: number | null;
  }>;
}

// ─── Trace Run State (client-side) ──────────────────────────────────────────

export type TraceRunStatus = 'idle' | 'running' | 'complete' | 'quiet' | 'error';

/**
 * TraceRunState: the full client-side state of a trace run.
 * Managed by the Flow Theater page component.
 */
export interface TraceRunState {
  /** Overall trace status */
  status: TraceRunStatus;
  /** The intent that started this trace */
  intent: TraceIntent | null;
  /** Per-step status map */
  steps: Record<TraceStepId, TraceStepSnapshot>;
  /** The final summary, populated when trace completes */
  summary: TraceSummary | null;
  /** Total duration from start to terminal event */
  totalDurationMs: number | null;
  /** Last heartbeat timestamp */
  lastHeartbeat: EpochMs | null;
  /** Error message if trace failed fatally */
  errorMessage: string | null;
}

export interface TraceStepSnapshot {
  status: TraceStepStatus;
  detail: string;
  durationMs: number | null;
  count: number | null;
}

/**
 * Build the initial idle state for a trace run.
 */
export function buildInitialTraceRunState(): TraceRunState {
  const steps: Record<string, TraceStepSnapshot> = {};
  for (const step of TRACE_STEPS) {
    steps[step.id] = { status: 'idle', detail: '', durationMs: null, count: null };
  }
  return {
    status: 'idle',
    intent: null,
    steps: steps as Record<TraceStepId, TraceStepSnapshot>,
    summary: null,
    totalDurationMs: null,
    lastHeartbeat: null,
    errorMessage: null,
  };
}

/**
 * Apply a single SSE event to the current trace run state.
 * Pure function — returns a new state object.
 */
export function applyTraceEvent(state: TraceRunState, event: TraceSSEEvent): TraceRunState {
  switch (event.type) {
    case 'step': {
      const newSteps = { ...state.steps };
      newSteps[event.stepId] = {
        status: event.status,
        detail: event.detail,
        durationMs: event.durationMs,
        count: event.count,
      };
      return {
        ...state,
        status: 'running',
        steps: newSteps,
      };
    }
    case 'heartbeat':
      return {
        ...state,
        lastHeartbeat: event.timestamp,
      };
    case 'complete':
      return {
        ...state,
        status: event.terminalStatus,
        summary: event.summary,
        totalDurationMs: event.totalDurationMs,
      };
    case 'error':
      return {
        ...state,
        status: 'error',
        errorMessage: event.message,
      };
    default:
      return state;
  }
}
