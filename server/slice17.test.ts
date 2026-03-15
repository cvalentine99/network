/**
 * Slice 17 — Flow Theater Foundation
 *
 * Tests cover:
 *   1. TraceEntryMode / TraceStepId / TraceStepStatus enum schemas
 *   2. TraceIntentSchema validation (3 entry modes, edge cases)
 *   3. TraceStepEventSchema validation
 *   4. TraceHeartbeatEventSchema validation
 *   5. TraceCompleteEventSchema validation
 *   6. TraceErrorEventSchema validation
 *   7. TraceSSEEventSchema discriminated union
 *   8. TraceRunStateSchema validation
 *   9. buildInitialTraceRunState() pure function
 *  10. applyTraceEvent() state reducer — step events
 *  11. applyTraceEvent() state reducer — heartbeat, complete, error
 *  12. TRACE_STEPS constant contract
 *  13. Fixture file validation (JSON contract fixtures)
 *  14. JSONL replay fixture validation (BFF route fixtures)
 *  15. Timing order invariants (serial steps before parallel)
 *  16. Entry mode coverage (3 modes × complete/quiet/error)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  TraceEntryModeSchema,
  TraceStepStatusSchema,
  TraceStepIdSchema,
  TraceRunStatusSchema,
  TraceSSEEventTypeSchema,
  TraceIntentSchema,
  TraceStepEventSchema,
  TraceHeartbeatEventSchema,
  TraceCompleteEventSchema,
  TraceErrorEventSchema,
  TraceSSEEventSchema,
  TraceResolvedDeviceSchema,
  TraceSummarySchema,
  TraceRunStateSchema,
  TraceStepSnapshotSchema,
} from '../shared/flow-theater-validators';

import {
  TRACE_STEPS,
  buildInitialTraceRunState,
  applyTraceEvent,
} from '../shared/flow-theater-types';

import type {
  TraceSSEEvent,
  TraceRunState,
  TraceStepId,
} from '../shared/flow-theater-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'flow-theater');

function loadJsonFixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

function loadJsonlEvents(name: string): any[] {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf-8');
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

const VALID_TIME_WINDOW = {
  fromMs: 1710000000000,
  untilMs: 1710001800000,
  durationMs: 1800000,
  cycle: '30sec' as const,
};

// ─── 1. Enum Schemas ────────────────────────────────────────────────────────

describe('Slice 17 > TraceEntryModeSchema', () => {
  it('accepts hostname', () => {
    expect(TraceEntryModeSchema.parse('hostname')).toBe('hostname');
  });
  it('accepts device', () => {
    expect(TraceEntryModeSchema.parse('device')).toBe('device');
  });
  it('accepts service-row', () => {
    expect(TraceEntryModeSchema.parse('service-row')).toBe('service-row');
  });
  it('rejects invalid mode', () => {
    expect(TraceEntryModeSchema.safeParse('ip-address').success).toBe(false);
  });
  it('rejects empty string', () => {
    expect(TraceEntryModeSchema.safeParse('').success).toBe(false);
  });
});

describe('Slice 17 > TraceStepIdSchema', () => {
  const VALID_IDS: string[] = [
    'input-accepted', 'entry-resolution', 'device-resolved',
    'activity-timeline', 'metric-timeline', 'records-search',
    'detection-alert', 'trace-assembly',
  ];
  for (const id of VALID_IDS) {
    it(`accepts ${id}`, () => {
      expect(TraceStepIdSchema.parse(id)).toBe(id);
    });
  }
  it('rejects unknown step ID', () => {
    expect(TraceStepIdSchema.safeParse('packet-capture').success).toBe(false);
  });
});

describe('Slice 17 > TraceStepStatusSchema', () => {
  const VALID_STATUSES = ['idle', 'running', 'complete', 'quiet', 'error'];
  for (const s of VALID_STATUSES) {
    it(`accepts ${s}`, () => {
      expect(TraceStepStatusSchema.parse(s)).toBe(s);
    });
  }
  it('rejects unknown status', () => {
    expect(TraceStepStatusSchema.safeParse('pending').success).toBe(false);
  });
});

// ─── 2. TraceIntentSchema ───────────────────────────────────────────────────

describe('Slice 17 > TraceIntentSchema', () => {
  it('accepts valid hostname intent', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid device intent', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'device',
      value: '2087',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid service-row intent', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'service-row',
      value: 'SMB::1042',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty value', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'hostname',
      value: '',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid mode', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'ip-address',
      value: '10.1.20.42',
      timeWindow: VALID_TIME_WINDOW,
    });
    expect(result.success).toBe(false);
  });

  it('rejects inverted time window (untilMs <= fromMs)', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: { ...VALID_TIME_WINDOW, untilMs: VALID_TIME_WINDOW.fromMs - 1 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero-duration time window', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: { ...VALID_TIME_WINDOW, durationMs: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing timeWindow', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'hostname',
      value: 'dc01.lab.local',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative fromMs', () => {
    const result = TraceIntentSchema.safeParse({
      mode: 'hostname',
      value: 'dc01.lab.local',
      timeWindow: { ...VALID_TIME_WINDOW, fromMs: -1 },
    });
    expect(result.success).toBe(false);
  });
});

// ─── 3. TraceStepEventSchema ────────────────────────────────────────────────

describe('Slice 17 > TraceStepEventSchema', () => {
  const validStepEvent = {
    type: 'step',
    stepId: 'input-accepted',
    status: 'running',
    detail: 'Validating hostname dc01.lab.local',
    durationMs: null,
    count: null,
    timestamp: 1710001800100,
  };

  it('accepts valid running step event', () => {
    expect(TraceStepEventSchema.safeParse(validStepEvent).success).toBe(true);
  });

  it('accepts complete step event with durationMs', () => {
    const event = { ...validStepEvent, status: 'complete', durationMs: 45 };
    expect(TraceStepEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts step event with count', () => {
    const event = { ...validStepEvent, stepId: 'activity-timeline', status: 'complete', durationMs: 340, count: 142 };
    expect(TraceStepEventSchema.safeParse(event).success).toBe(true);
  });

  it('rejects missing stepId', () => {
    const { stepId, ...rest } = validStepEvent;
    expect(TraceStepEventSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid stepId', () => {
    expect(TraceStepEventSchema.safeParse({ ...validStepEvent, stepId: 'bogus' }).success).toBe(false);
  });

  it('rejects missing timestamp', () => {
    const { timestamp, ...rest } = validStepEvent;
    expect(TraceStepEventSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects zero timestamp', () => {
    expect(TraceStepEventSchema.safeParse({ ...validStepEvent, timestamp: 0 }).success).toBe(false);
  });
});

// ─── 4. TraceHeartbeatEventSchema ───────────────────────────────────────────

describe('Slice 17 > TraceHeartbeatEventSchema', () => {
  it('accepts valid heartbeat', () => {
    const result = TraceHeartbeatEventSchema.safeParse({
      type: 'heartbeat',
      timestamp: 1710001800200,
      activeSteps: 3,
    });
    expect(result.success).toBe(true);
  });

  it('accepts zero activeSteps', () => {
    const result = TraceHeartbeatEventSchema.safeParse({
      type: 'heartbeat',
      timestamp: 1710001800200,
      activeSteps: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative activeSteps', () => {
    const result = TraceHeartbeatEventSchema.safeParse({
      type: 'heartbeat',
      timestamp: 1710001800200,
      activeSteps: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing timestamp', () => {
    const result = TraceHeartbeatEventSchema.safeParse({
      type: 'heartbeat',
      activeSteps: 3,
    });
    expect(result.success).toBe(false);
  });
});

// ─── 5. TraceCompleteEventSchema ────────────────────────────────────────────

describe('Slice 17 > TraceCompleteEventSchema', () => {
  const validSummary = {
    resolvedDevice: {
      resolvedVia: 'hostname',
      originalInput: 'dc01.lab.local',
      device: {
        id: 1042,
        displayName: 'dc01.lab.local',
        ipaddr: '10.1.20.42',
        macaddr: '00:50:56:A1:2B:3C',
        role: 'domain_controller',
        vendor: 'VMware',
      },
    },
    activityCount: 142,
    metricPointCount: 1847,
    recordCount: 38,
    detectionCount: 3,
    alertCount: 1,
    stepTimings: [
      { stepId: 'input-accepted', status: 'complete', durationMs: 45 },
      { stepId: 'entry-resolution', status: 'complete', durationMs: 120 },
    ],
  };

  it('accepts valid complete event', () => {
    const result = TraceCompleteEventSchema.safeParse({
      type: 'complete',
      terminalStatus: 'complete',
      summary: validSummary,
      totalDurationMs: 710,
      timestamp: 1710001800820,
    });
    expect(result.success).toBe(true);
  });

  it('accepts quiet terminal status', () => {
    const result = TraceCompleteEventSchema.safeParse({
      type: 'complete',
      terminalStatus: 'quiet',
      summary: { ...validSummary, activityCount: 0, metricPointCount: 0, recordCount: 0, detectionCount: 0, alertCount: 0 },
      totalDurationMs: 480,
      timestamp: 1710001800580,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null resolvedDevice in summary', () => {
    const result = TraceCompleteEventSchema.safeParse({
      type: 'complete',
      terminalStatus: 'error',
      summary: { ...validSummary, resolvedDevice: null },
      totalDurationMs: 200,
      timestamp: 1710001800345,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative totalDurationMs', () => {
    const result = TraceCompleteEventSchema.safeParse({
      type: 'complete',
      terminalStatus: 'complete',
      summary: validSummary,
      totalDurationMs: -1,
      timestamp: 1710001800820,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid terminalStatus', () => {
    const result = TraceCompleteEventSchema.safeParse({
      type: 'complete',
      terminalStatus: 'running',
      summary: validSummary,
      totalDurationMs: 710,
      timestamp: 1710001800820,
    });
    expect(result.success).toBe(false);
  });
});

// ─── 6. TraceErrorEventSchema ───────────────────────────────────────────────

describe('Slice 17 > TraceErrorEventSchema', () => {
  it('accepts valid error event with failedStepId', () => {
    const result = TraceErrorEventSchema.safeParse({
      type: 'error',
      message: 'Device resolution failed',
      failedStepId: 'entry-resolution',
      timestamp: 1710001800345,
    });
    expect(result.success).toBe(true);
  });

  it('accepts error event with null failedStepId', () => {
    const result = TraceErrorEventSchema.safeParse({
      type: 'error',
      message: 'Transport failure',
      failedStepId: null,
      timestamp: 1710001800345,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty message', () => {
    const result = TraceErrorEventSchema.safeParse({
      type: 'error',
      message: '',
      failedStepId: null,
      timestamp: 1710001800345,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid failedStepId', () => {
    const result = TraceErrorEventSchema.safeParse({
      type: 'error',
      message: 'Failure',
      failedStepId: 'bogus-step',
      timestamp: 1710001800345,
    });
    expect(result.success).toBe(false);
  });
});

// ─── 7. TraceSSEEventSchema discriminated union ─────────────────────────────

describe('Slice 17 > TraceSSEEventSchema discriminated union', () => {
  it('discriminates step event', () => {
    const result = TraceSSEEventSchema.safeParse({
      type: 'step',
      stepId: 'input-accepted',
      status: 'running',
      detail: 'Validating',
      durationMs: null,
      count: null,
      timestamp: 1710001800100,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('step');
  });

  it('discriminates heartbeat event', () => {
    const result = TraceSSEEventSchema.safeParse({
      type: 'heartbeat',
      timestamp: 1710001800200,
      activeSteps: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('heartbeat');
  });

  it('discriminates complete event', () => {
    const fixture = loadJsonFixture('flow-theater.hostname-complete.fixture.json');
    const completeEvent = fixture.events.find((e: any) => e.type === 'complete');
    const result = TraceSSEEventSchema.safeParse(completeEvent);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('complete');
  });

  it('discriminates error event', () => {
    const fixture = loadJsonFixture('flow-theater.resolution-error.fixture.json');
    const errorEvent = fixture.events.find((e: any) => e.type === 'error');
    const result = TraceSSEEventSchema.safeParse(errorEvent);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('error');
  });

  it('rejects unknown event type', () => {
    const result = TraceSSEEventSchema.safeParse({
      type: 'unknown',
      timestamp: 1710001800200,
    });
    expect(result.success).toBe(false);
  });
});

// ─── 8. TraceRunStateSchema ─────────────────────────────────────────────────

describe('Slice 17 > TraceRunStateSchema', () => {
  it('accepts initial idle state from buildInitialTraceRunState()', () => {
    const state = buildInitialTraceRunState();
    const result = TraceRunStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it('accepts running state with populated steps', () => {
    const state = buildInitialTraceRunState();
    state.status = 'running';
    state.intent = { mode: 'hostname', value: 'dc01.lab.local', timeWindow: VALID_TIME_WINDOW };
    state.steps['input-accepted'] = { status: 'complete', detail: 'Accepted', durationMs: 45, count: null };
    const result = TraceRunStateSchema.safeParse(state);
    expect(result.success).toBe(true);
  });

  it('rejects state with invalid step key', () => {
    const state: any = buildInitialTraceRunState();
    state.steps['bogus-step'] = { status: 'idle', detail: '', durationMs: null, count: null };
    // The record schema uses TraceStepIdSchema as key, so this should fail
    const result = TraceRunStateSchema.safeParse(state);
    expect(result.success).toBe(false);
  });

  it('rejects state with invalid status', () => {
    const state: any = buildInitialTraceRunState();
    state.status = 'pending';
    const result = TraceRunStateSchema.safeParse(state);
    expect(result.success).toBe(false);
  });
});

// ─── 9. buildInitialTraceRunState() ─────────────────────────────────────────

describe('Slice 17 > buildInitialTraceRunState()', () => {
  it('returns idle status', () => {
    const state = buildInitialTraceRunState();
    expect(state.status).toBe('idle');
  });

  it('returns null intent', () => {
    expect(buildInitialTraceRunState().intent).toBeNull();
  });

  it('returns null summary', () => {
    expect(buildInitialTraceRunState().summary).toBeNull();
  });

  it('returns null totalDurationMs', () => {
    expect(buildInitialTraceRunState().totalDurationMs).toBeNull();
  });

  it('returns null lastHeartbeat', () => {
    expect(buildInitialTraceRunState().lastHeartbeat).toBeNull();
  });

  it('returns null errorMessage', () => {
    expect(buildInitialTraceRunState().errorMessage).toBeNull();
  });

  it('has exactly 8 step entries', () => {
    const state = buildInitialTraceRunState();
    expect(Object.keys(state.steps)).toHaveLength(8);
  });

  it('all steps start as idle', () => {
    const state = buildInitialTraceRunState();
    for (const step of TRACE_STEPS) {
      expect(state.steps[step.id].status).toBe('idle');
    }
  });

  it('all steps start with empty detail', () => {
    const state = buildInitialTraceRunState();
    for (const step of TRACE_STEPS) {
      expect(state.steps[step.id].detail).toBe('');
    }
  });

  it('all steps start with null durationMs', () => {
    const state = buildInitialTraceRunState();
    for (const step of TRACE_STEPS) {
      expect(state.steps[step.id].durationMs).toBeNull();
    }
  });

  it('returns a new object each call (no shared reference)', () => {
    const a = buildInitialTraceRunState();
    const b = buildInitialTraceRunState();
    expect(a).not.toBe(b);
    expect(a.steps).not.toBe(b.steps);
  });
});

// ─── 10. applyTraceEvent() — step events ────────────────────────────────────

describe('Slice 17 > applyTraceEvent() step events', () => {
  it('transitions step from idle to running', () => {
    const state = buildInitialTraceRunState();
    const event: TraceSSEEvent = {
      type: 'step',
      stepId: 'input-accepted',
      status: 'running',
      detail: 'Validating hostname',
      durationMs: null,
      count: null,
      timestamp: 1710001800100,
    };
    const next = applyTraceEvent(state, event);
    expect(next.steps['input-accepted'].status).toBe('running');
    expect(next.steps['input-accepted'].detail).toBe('Validating hostname');
    expect(next.status).toBe('running');
  });

  it('transitions step from running to complete', () => {
    let state = buildInitialTraceRunState();
    state = applyTraceEvent(state, {
      type: 'step', stepId: 'input-accepted', status: 'running',
      detail: 'Validating', durationMs: null, count: null, timestamp: 1710001800100,
    });
    const next = applyTraceEvent(state, {
      type: 'step', stepId: 'input-accepted', status: 'complete',
      detail: 'Hostname accepted', durationMs: 45, count: null, timestamp: 1710001800145,
    });
    expect(next.steps['input-accepted'].status).toBe('complete');
    expect(next.steps['input-accepted'].durationMs).toBe(45);
  });

  it('transitions step to error', () => {
    let state = buildInitialTraceRunState();
    state = applyTraceEvent(state, {
      type: 'step', stepId: 'entry-resolution', status: 'running',
      detail: 'Resolving', durationMs: null, count: null, timestamp: 1710001800150,
    });
    const next = applyTraceEvent(state, {
      type: 'step', stepId: 'entry-resolution', status: 'error',
      detail: 'No device found', durationMs: 200, count: null, timestamp: 1710001800350,
    });
    expect(next.steps['entry-resolution'].status).toBe('error');
  });

  it('transitions step to quiet', () => {
    let state = buildInitialTraceRunState();
    state = applyTraceEvent(state, {
      type: 'step', stepId: 'activity-timeline', status: 'running',
      detail: 'Querying', durationMs: null, count: null, timestamp: 1710001800300,
    });
    const next = applyTraceEvent(state, {
      type: 'step', stepId: 'activity-timeline', status: 'quiet',
      detail: 'No activity records', durationMs: 180, count: 0, timestamp: 1710001800480,
    });
    expect(next.steps['activity-timeline'].status).toBe('quiet');
    expect(next.steps['activity-timeline'].count).toBe(0);
  });

  it('preserves count on step completion', () => {
    let state = buildInitialTraceRunState();
    const next = applyTraceEvent(state, {
      type: 'step', stepId: 'activity-timeline', status: 'complete',
      detail: '142 activity records', durationMs: 340, count: 142, timestamp: 1710001800700,
    });
    expect(next.steps['activity-timeline'].count).toBe(142);
  });

  it('does not mutate the original state', () => {
    const state = buildInitialTraceRunState();
    const next = applyTraceEvent(state, {
      type: 'step', stepId: 'input-accepted', status: 'running',
      detail: 'Validating', durationMs: null, count: null, timestamp: 1710001800100,
    });
    expect(state.steps['input-accepted'].status).toBe('idle');
    expect(next.steps['input-accepted'].status).toBe('running');
  });

  it('does not affect other steps when updating one', () => {
    const state = buildInitialTraceRunState();
    const next = applyTraceEvent(state, {
      type: 'step', stepId: 'input-accepted', status: 'running',
      detail: 'Validating', durationMs: null, count: null, timestamp: 1710001800100,
    });
    expect(next.steps['entry-resolution'].status).toBe('idle');
    expect(next.steps['device-resolved'].status).toBe('idle');
  });
});

// ─── 11. applyTraceEvent() — heartbeat, complete, error ─────────────────────

describe('Slice 17 > applyTraceEvent() terminal and heartbeat events', () => {
  it('heartbeat updates lastHeartbeat', () => {
    const state = buildInitialTraceRunState();
    const next = applyTraceEvent(state, {
      type: 'heartbeat', timestamp: 1710001800500, activeSteps: 3,
    });
    expect(next.lastHeartbeat).toBe(1710001800500);
  });

  it('heartbeat does not change status', () => {
    let state = buildInitialTraceRunState();
    state = { ...state, status: 'running' };
    const next = applyTraceEvent(state, {
      type: 'heartbeat', timestamp: 1710001800500, activeSteps: 3,
    });
    expect(next.status).toBe('running');
  });

  it('complete event sets terminal status', () => {
    const state = { ...buildInitialTraceRunState(), status: 'running' as const };
    const fixture = loadJsonFixture('flow-theater.hostname-complete.fixture.json');
    const completeEvent = fixture.events.find((e: any) => e.type === 'complete');
    const next = applyTraceEvent(state, completeEvent);
    expect(next.status).toBe('complete');
    expect(next.summary).not.toBeNull();
    expect(next.totalDurationMs).toBe(710);
  });

  it('quiet complete event sets quiet status', () => {
    const state = { ...buildInitialTraceRunState(), status: 'running' as const };
    const fixture = loadJsonFixture('flow-theater.quiet.fixture.json');
    const completeEvent = fixture.events.find((e: any) => e.type === 'complete');
    const next = applyTraceEvent(state, completeEvent);
    expect(next.status).toBe('quiet');
  });

  it('error event sets error status and message', () => {
    const state = { ...buildInitialTraceRunState(), status: 'running' as const };
    const next = applyTraceEvent(state, {
      type: 'error',
      message: 'Device resolution failed',
      failedStepId: 'entry-resolution',
      timestamp: 1710001800345,
    });
    expect(next.status).toBe('error');
    expect(next.errorMessage).toBe('Device resolution failed');
  });

  it('unknown event type returns state unchanged', () => {
    const state = buildInitialTraceRunState();
    const next = applyTraceEvent(state, { type: 'bogus' } as any);
    expect(next).toEqual(state);
  });
});

// ─── 12. TRACE_STEPS constant contract ──────────────────────────────────────

describe('Slice 17 > TRACE_STEPS constant', () => {
  it('has exactly 8 steps', () => {
    expect(TRACE_STEPS).toHaveLength(8);
  });

  it('indices are 0 through 7', () => {
    TRACE_STEPS.forEach((step, i) => {
      expect(step.index).toBe(i);
    });
  });

  it('first 3 steps are serial', () => {
    expect(TRACE_STEPS[0].serial).toBe(true);
    expect(TRACE_STEPS[1].serial).toBe(true);
    expect(TRACE_STEPS[2].serial).toBe(true);
  });

  it('last 5 steps are parallel', () => {
    for (let i = 3; i < 8; i++) {
      expect(TRACE_STEPS[i].serial).toBe(false);
    }
  });

  it('step IDs match the TraceStepId enum', () => {
    for (const step of TRACE_STEPS) {
      expect(TraceStepIdSchema.safeParse(step.id).success).toBe(true);
    }
  });

  it('all labels are non-empty strings', () => {
    for (const step of TRACE_STEPS) {
      expect(step.label.length).toBeGreaterThan(0);
    }
  });

  it('no duplicate step IDs', () => {
    const ids = TRACE_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('step order: input-accepted → entry-resolution → device-resolved → parallel fan-out', () => {
    expect(TRACE_STEPS[0].id).toBe('input-accepted');
    expect(TRACE_STEPS[1].id).toBe('entry-resolution');
    expect(TRACE_STEPS[2].id).toBe('device-resolved');
  });
});

// ─── 13. JSON contract fixture validation ───────────────────────────────────

const JSON_FIXTURES = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.fixture.json'));

describe('Slice 17 > JSON contract fixtures', () => {
  for (const file of JSON_FIXTURES) {
    it(`${file} has valid _meta`, () => {
      const data = loadJsonFixture(file);
      expect(data._meta).toBeDefined();
      expect(data._meta.fixture).toBeTruthy();
      expect(data._meta.description).toBeTruthy();
    });
  }

  for (const file of JSON_FIXTURES) {
    it(`${file} has valid intent`, () => {
      const data = loadJsonFixture(file);
      if (data.intent) {
        const result = TraceIntentSchema.safeParse(data.intent);
        expect(result.success).toBe(true);
      }
    });
  }

  it('hostname-complete fixture has 19 events', () => {
    const data = loadJsonFixture('flow-theater.hostname-complete.fixture.json');
    expect(data.events).toHaveLength(19);
  });

  it('quiet fixture terminal status is quiet', () => {
    const data = loadJsonFixture('flow-theater.quiet.fixture.json');
    const complete = data.events.find((e: any) => e.type === 'complete');
    expect(complete.terminalStatus).toBe('quiet');
  });

  it('resolution-error fixture terminal event is error type', () => {
    const data = loadJsonFixture('flow-theater.resolution-error.fixture.json');
    const lastEvent = data.events[data.events.length - 1];
    expect(lastEvent.type).toBe('error');
  });

  it('partial-error fixture has both complete and error step events', () => {
    const data = loadJsonFixture('flow-theater.partial-error.fixture.json');
    const stepEvents = data.events.filter((e: any) => e.type === 'step');
    const hasComplete = stepEvents.some((e: any) => e.status === 'complete');
    const hasError = stepEvents.some((e: any) => e.status === 'error');
    expect(hasComplete).toBe(true);
    expect(hasError).toBe(true);
  });

  it('malformed fixture contains non-object entries', () => {
    const data = loadJsonFixture('flow-theater.malformed.fixture.json');
    const nonObjects = data.events.filter((e: any) => typeof e !== 'object' || e === null);
    expect(nonObjects.length).toBeGreaterThan(0);
  });
});

// ─── 14. JSONL replay fixture validation ────────────────────────────────────

const JSONL_FIXTURES = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.fixture.jsonl'));

describe('Slice 17 > JSONL replay fixtures', () => {
  for (const file of JSONL_FIXTURES) {
    it(`${file} contains only valid TraceSSEEvent lines`, () => {
      const events = loadJsonlEvents(file);
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        const result = TraceSSEEventSchema.safeParse(event);
        expect(result.success).toBe(true);
      }
    });
  }

  for (const file of JSONL_FIXTURES) {
    it(`${file} ends with a terminal event (complete or error)`, () => {
      const events = loadJsonlEvents(file);
      const lastEvent = events[events.length - 1];
      expect(['complete', 'error']).toContain(lastEvent.type);
    });
  }

  it('hostname-complete JSONL has same event count as JSON fixture', () => {
    const json = loadJsonFixture('flow-theater.hostname-complete.fixture.json');
    const jsonl = loadJsonlEvents('trace-hostname-complete.fixture.jsonl');
    // JSON has 19 events, JSONL should have 19 (all are valid TraceSSEEvent objects)
    expect(jsonl).toHaveLength(json.events.filter((e: any) => typeof e === 'object' && e !== null && e.type).length);
  });
});

// ─── 15. Timing order invariants ────────────────────────────────────────────

describe('Slice 17 > Timing order invariants', () => {
  const COMPLETE_FIXTURES = [
    'flow-theater.hostname-complete.fixture.json',
    'flow-theater.device-complete.fixture.json',
    'flow-theater.service-row-complete.fixture.json',
  ];

  for (const file of COMPLETE_FIXTURES) {
    it(`${file}: serial steps complete before parallel steps start`, () => {
      const data = loadJsonFixture(file);
      const stepEvents = data.events.filter((e: any) => e.type === 'step');

      // Find the timestamp when device-resolved completes
      const deviceResolvedComplete = stepEvents.find(
        (e: any) => e.stepId === 'device-resolved' && e.status === 'complete'
      );
      expect(deviceResolvedComplete).toBeDefined();

      // All parallel step running events must have timestamp >= device-resolved complete
      const parallelStepIds = TRACE_STEPS.filter(s => !s.serial).map(s => s.id);
      const parallelRunningEvents = stepEvents.filter(
        (e: any) => parallelStepIds.includes(e.stepId) && e.status === 'running'
      );
      for (const event of parallelRunningEvents) {
        expect(event.timestamp).toBeGreaterThanOrEqual(deviceResolvedComplete.timestamp);
      }
    });
  }

  for (const file of COMPLETE_FIXTURES) {
    it(`${file}: input-accepted completes before entry-resolution starts`, () => {
      const data = loadJsonFixture(file);
      const stepEvents = data.events.filter((e: any) => e.type === 'step');

      const inputComplete = stepEvents.find(
        (e: any) => e.stepId === 'input-accepted' && e.status === 'complete'
      );
      const entryStart = stepEvents.find(
        (e: any) => e.stepId === 'entry-resolution' && e.status === 'running'
      );
      expect(inputComplete).toBeDefined();
      expect(entryStart).toBeDefined();
      expect(inputComplete.timestamp).toBeLessThanOrEqual(entryStart.timestamp);
    });
  }

  for (const file of COMPLETE_FIXTURES) {
    it(`${file}: entry-resolution completes before device-resolved starts`, () => {
      const data = loadJsonFixture(file);
      const stepEvents = data.events.filter((e: any) => e.type === 'step');

      const entryComplete = stepEvents.find(
        (e: any) => e.stepId === 'entry-resolution' && e.status === 'complete'
      );
      const deviceStart = stepEvents.find(
        (e: any) => e.stepId === 'device-resolved' && e.status === 'running'
      );
      expect(entryComplete).toBeDefined();
      expect(deviceStart).toBeDefined();
      expect(entryComplete.timestamp).toBeLessThanOrEqual(deviceStart.timestamp);
    });
  }
});

// ─── 16. Entry mode coverage ────────────────────────────────────────────────

describe('Slice 17 > Entry mode coverage', () => {
  it('hostname entry mode has complete fixture', () => {
    const data = loadJsonFixture('flow-theater.hostname-complete.fixture.json');
    expect(data.intent.mode).toBe('hostname');
    const complete = data.events.find((e: any) => e.type === 'complete');
    expect(complete.terminalStatus).toBe('complete');
  });

  it('device entry mode has complete fixture', () => {
    const data = loadJsonFixture('flow-theater.device-complete.fixture.json');
    expect(data.intent.mode).toBe('device');
    const complete = data.events.find((e: any) => e.type === 'complete');
    expect(complete.terminalStatus).toBe('complete');
  });

  it('service-row entry mode has complete fixture', () => {
    const data = loadJsonFixture('flow-theater.service-row-complete.fixture.json');
    expect(data.intent.mode).toBe('service-row');
    const complete = data.events.find((e: any) => e.type === 'complete');
    expect(complete.terminalStatus).toBe('complete');
  });

  it('quiet terminal state fixture exists', () => {
    const data = loadJsonFixture('flow-theater.quiet.fixture.json');
    const complete = data.events.find((e: any) => e.type === 'complete');
    expect(complete.terminalStatus).toBe('quiet');
  });

  it('resolution error fixture exists', () => {
    const data = loadJsonFixture('flow-theater.resolution-error.fixture.json');
    const error = data.events.find((e: any) => e.type === 'error');
    expect(error.message).toContain('resolution failed');
  });

  it('partial error fixture exists', () => {
    const data = loadJsonFixture('flow-theater.partial-error.fixture.json');
    const error = data.events.find((e: any) => e.type === 'error');
    expect(error.failedStepId).toBe('records-search');
  });

  it('transport error fixture exists', () => {
    const data = loadJsonFixture('flow-theater.transport-error.fixture.json');
    expect(data.events).toHaveLength(0);
    expect(data.expectedError).toBeDefined();
    expect(data.expectedError.status).toBe(502);
  });

  it('malformed fixture exists', () => {
    const data = loadJsonFixture('flow-theater.malformed.fixture.json');
    expect(data._meta.malformedEvents).toBeGreaterThan(0);
  });

  it('full state replay: hostname-complete fixture produces complete state', () => {
    const data = loadJsonFixture('flow-theater.hostname-complete.fixture.json');
    let state = buildInitialTraceRunState();
    for (const event of data.events) {
      if (typeof event === 'object' && event !== null && event.type) {
        const parsed = TraceSSEEventSchema.safeParse(event);
        if (parsed.success) {
          state = applyTraceEvent(state, parsed.data);
        }
      }
    }
    expect(state.status).toBe('complete');
    expect(state.summary).not.toBeNull();
    expect(state.summary!.resolvedDevice).not.toBeNull();
    expect(state.summary!.resolvedDevice!.device.displayName).toBe('dc01.lab.local');
    expect(state.totalDurationMs).toBe(710);
  });

  it('full state replay: quiet fixture produces quiet state', () => {
    const data = loadJsonFixture('flow-theater.quiet.fixture.json');
    let state = buildInitialTraceRunState();
    for (const event of data.events) {
      if (typeof event === 'object' && event !== null && event.type) {
        const parsed = TraceSSEEventSchema.safeParse(event);
        if (parsed.success) {
          state = applyTraceEvent(state, parsed.data);
        }
      }
    }
    expect(state.status).toBe('quiet');
    expect(state.summary!.activityCount).toBe(0);
    expect(state.summary!.metricPointCount).toBe(0);
  });

  it('full state replay: resolution-error fixture produces error state', () => {
    const data = loadJsonFixture('flow-theater.resolution-error.fixture.json');
    let state = buildInitialTraceRunState();
    for (const event of data.events) {
      if (typeof event === 'object' && event !== null && event.type) {
        const parsed = TraceSSEEventSchema.safeParse(event);
        if (parsed.success) {
          state = applyTraceEvent(state, parsed.data);
        }
      }
    }
    expect(state.status).toBe('error');
    expect(state.errorMessage).toContain('resolution failed');
  });
});
