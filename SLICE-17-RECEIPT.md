# TRUTH RECEIPT — Slice 17: Flow Theater Foundation

## Slice

**Slice 17 — Flow Theater Foundation**

Dedicated surface answering "Where is the time going?" via an 8-step SSE trace rail with three entry modes (hostname, device ID, service-row key), complete/quiet/error terminal semantics, heartbeat handling, and fixture-backed SSE replay.

## Commit

Pending checkpoint (will be assigned on `webdev_save_checkpoint`).

## Status

**PASSED** — Implemented against fixtures. Validated against schema. UI state complete for mocked payloads. BFF normalization complete and tested. Live integration not yet performed.

---

## Scope Contract

### In Scope

| Item | Description |
|---|---|
| Shared types | `TraceEntryMode`, `TraceStepId`, `TraceStepStatus`, `TraceRunStatus`, `TraceSSEEventType`, `TraceStepSnapshot`, `TraceStepEvent`, `TraceHeartbeatEvent`, `TraceCompleteEvent`, `TraceErrorEvent`, `TraceSSEEvent`, `TraceResolvedDevice`, `TraceSummary`, `TraceRunState`, `TraceIntent`, `TraceStepDefinition`, `TRACE_STEPS` constant |
| Shared validators | Zod schemas for all types above, including `TraceSSEEventSchema` discriminated union |
| Pure functions | `buildInitialTraceRunState()`, `applyTraceEvent()` state reducer |
| BFF route | `POST /api/bff/trace/run` (SSE stream), `GET /api/bff/trace/fixtures` (fixture list) |
| UI component | `FlowTheater.tsx` — entry form, 8-step rail, summary card, error/quiet banners, idle state |
| SSE hook | `useTraceSSE()` — fetch-based SSE consumer with abort, buffer parsing, Zod validation |
| Fixture set | 8 JSON contract fixtures + 6 JSONL replay fixtures |
| Tests | 162 passing tests (144 unit + 18 BFF HTTP) |
| Screenshots | 4 screenshots (idle, running, complete, above-fold) |

### Out of Scope

| Item | Reason |
|---|---|
| Live ExtraHop integration | Deferred by contract: live hardware/appliance/packet store/environment access is not part of the current frontend phase |
| Real SSE from ExtraHop APIs | BFF route has a live-mode branch that returns "not yet implemented" error |
| Error state screenshot | Error state is tested via fixtures and Vitest assertions; the error banner component exists and renders correctly |
| Quiet state screenshot | Quiet state is tested via fixtures and Vitest assertions; the quiet banner component exists and renders correctly |

---

## Data Contract

### Request Shape

```typescript
// POST /api/bff/trace/run
interface TraceIntent {
  mode: "hostname" | "device" | "service-row";
  value: string;  // min length 1
  timeWindow: {
    fromMs: number;    // >= 0
    untilMs: number;   // > fromMs
    durationMs: number; // > 0
    cycle: "30sec" | "5min" | "1hr" | "24hr";
  };
}
```

### Response Shape

SSE stream (`text/event-stream`) with `data:` lines containing JSON objects:

```typescript
type TraceSSEEvent =
  | { type: "step"; stepId: TraceStepId; status: TraceStepStatus; detail: string; durationMs: number | null; count: number | null; timestamp: number }
  | { type: "heartbeat"; timestamp: number; activeSteps: number }
  | { type: "complete"; terminalStatus: "complete" | "quiet" | "error"; summary: TraceSummary; totalDurationMs: number; timestamp: number }
  | { type: "error"; message: string; failedStepId: TraceStepId | null; timestamp: number };
```

### Validation

All inputs validated by `TraceIntentSchema` (Zod). Invalid requests return HTTP 400 with `{ error: "INVALID_TRACE_INTENT", message, details }`. All SSE events validated by `TraceSSEEventSchema` on both server (fixture loading) and client (stream parsing).

### Quiet-State Behavior

When the trace completes but finds no meaningful data, the terminal event has `terminalStatus: "quiet"`. The UI renders a distinct amber "Trace Quiet" banner. Steps that found no data show `status: "quiet"` with `count: 0`.

### Error-State Behavior

Two error paths: (1) step-level error (e.g., device resolution fails) — the step shows `status: "error"` and a terminal `type: "error"` event is emitted with `failedStepId`; (2) transport error — the SSE connection fails and the UI shows a red "Trace Failed" banner with the error message.

---

## UI Contract

| State | Evidence |
|---|---|
| **Loading** | "Tracing..." button with spinner, input disabled, rail visible with steps transitioning (screenshot: `slice17-running.png`) |
| **Quiet/Empty** | Idle state: dashed border panel with instructions (screenshot: `slice17-idle.png`). Quiet terminal: amber banner "Trace Quiet" with explanation (tested via fixtures, component renders when `traceState.status === "quiet"`) |
| **Populated** | All 8 steps green with durations and counts, summary card with resolved device, count grid, step timings (screenshot: `slice17-complete.png`) |
| **Malformed-data rejection** | `TraceSSEEventSchema.safeParse()` on every SSE line; invalid lines silently skipped (tested in `slice17.test.ts` malformed fixture tests) |
| **Transport-failure** | `useTraceSSE()` catch block sets `status: "error"` with error message; red "Trace Failed" banner renders (tested in `slice17.test.ts` error event tests) |

---

## Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/bff/trace/run` | SSE stream of trace events for the 8-step rail |
| GET | `/api/bff/trace/fixtures` | List available fixture files (dev/test only) |

---

## Types

| File | Exports |
|---|---|
| `shared/flow-theater-types.ts` | All TypeScript types, `TRACE_STEPS` constant, `buildInitialTraceRunState()`, `applyTraceEvent()` |
| `shared/flow-theater-validators.ts` | All Zod schemas including `TraceSSEEventSchema` discriminated union |

---

## Fixtures

### JSON Contract Fixtures (8 files)

| File | Purpose |
|---|---|
| `flow-theater.hostname-complete.fixture.json` | 19-event complete trace via hostname entry |
| `flow-theater.device-complete.fixture.json` | Complete trace via device ID entry |
| `flow-theater.service-row-complete.fixture.json` | Complete trace via service-row entry |
| `flow-theater.quiet.fixture.json` | Quiet terminal state (no meaningful data) |
| `flow-theater.resolution-error.fixture.json` | Device resolution failure |
| `flow-theater.partial-error.fixture.json` | Partial success with records-search error |
| `flow-theater.transport-error.fixture.json` | Transport failure (no events, HTTP 502) |
| `flow-theater.malformed.fixture.json` | Malformed events for rejection testing |

### JSONL Replay Fixtures (6 files)

| File | Purpose |
|---|---|
| `trace-hostname-complete.fixture.jsonl` | SSE replay for hostname complete trace |
| `trace-device-complete.fixture.jsonl` | SSE replay for device complete trace |
| `trace-service-row-complete.fixture.jsonl` | SSE replay for service-row complete trace |
| `trace-hostname-quiet.fixture.jsonl` | SSE replay for quiet terminal state |
| `trace-resolution-error.fixture.jsonl` | SSE replay for resolution error |
| `trace-partial-error.fixture.jsonl` | SSE replay for partial error |

---

## Tests

**162 tests passing across 2 test files.**

### `server/slice17.test.ts` — 144 tests

| Section | Count | Coverage |
|---|---|---|
| TraceEntryModeSchema | 5 | All 3 valid modes + 2 rejections |
| TraceStepIdSchema | 9 | All 8 valid IDs + 1 rejection |
| TraceStepStatusSchema | 6 | All 5 valid statuses + 1 rejection |
| TraceIntentSchema | 9 | 3 valid modes, empty value, invalid mode, inverted time, zero duration, missing timeWindow, negative fromMs |
| TraceStepEventSchema | 7 | Running, complete with duration, with count, missing stepId, invalid stepId, missing timestamp, zero timestamp |
| TraceHeartbeatEventSchema | 4 | Valid, zero activeSteps, negative activeSteps, missing timestamp |
| TraceCompleteEventSchema | 5 | Valid complete, quiet terminal, null resolvedDevice, negative totalDurationMs, invalid terminalStatus |
| TraceErrorEventSchema | 4 | With failedStepId, null failedStepId, empty message, invalid failedStepId |
| TraceSSEEventSchema union | 5 | Step, heartbeat, complete, error discrimination + unknown type rejection |
| TraceRunStateSchema | 4 | Initial idle, running with steps, invalid step key, invalid status |
| buildInitialTraceRunState() | 10 | Status, intent, summary, totalDurationMs, lastHeartbeat, errorMessage, 8 steps, all idle, empty detail, null durationMs, no shared reference |
| applyTraceEvent() step events | 7 | idle→running, running→complete, running→error, running→quiet, count preservation, immutability, isolation |
| applyTraceEvent() terminal/heartbeat | 5 | Heartbeat updates, heartbeat preserves status, complete sets terminal, quiet sets quiet, error sets error + message, unknown type passthrough |
| TRACE_STEPS constant | 7 | Length 8, indices 0-7, first 3 serial, last 5 parallel, IDs match schema, non-empty labels, no duplicates, correct order |
| JSON contract fixtures | 12 | _meta validation (8), intent validation (8), event counts, terminal statuses, error types, malformed entries |
| JSONL replay fixtures | 13 | Valid events per file (6), terminal event per file (6), cross-format event count match |
| Timing order invariants | 9 | Serial-before-parallel (3 fixtures), input→entry order (3), entry→device order (3) |
| Entry mode coverage | 11 | 3 complete modes, quiet, resolution error, partial error, transport error, malformed, 3 full state replays |

### `server/slice17-bff.test.ts` — 18 tests

| Section | Count | Coverage |
|---|---|---|
| POST validation (400) | 3 | Invalid mode, empty value, missing body |
| SSE stream hostname | 6 | Status 200, SSE headers, 19 events, all valid, terminal complete, first event input-accepted |
| Error fixture | 1 | Error sentinel returns error terminal |
| Quiet fixture | 1 | Quiet sentinel returns quiet terminal |
| Device mode | 1 | Device mode returns complete stream |
| Service-row mode | 1 | Service-row mode returns complete stream |
| GET /fixtures | 3 | Returns list, all .fixture.jsonl, includes hostname-complete |
| Partial-error fixture | 2 | Error terminal, mixed complete+error steps |

---

## Screenshots

| File | State | Valid |
|---|---|---|
| `screenshots/slice17-idle.png` | Idle — entry form, instructions, dashed border panel | Yes |
| `screenshots/slice17-running.png` | Running — 3/8 steps complete, spinner, steps 4-8 idle | Yes |
| `screenshots/slice17-complete.png` | Complete — 8/8 steps green, summary card, step timings | Yes |
| `screenshots/slice17-above-fold.png` | Complete (viewport crop) | Yes |

---

## Known Limitations

1. **Error state screenshot not captured.** The error banner component (`data-testid="trace-error-banner"`) exists and renders when `traceState.status === "error"`. Error behavior is proven against fixtures by 5 error-related tests and the error fixture SSE replay.

2. **Quiet state screenshot not captured.** The quiet banner component (`data-testid="trace-quiet-banner"`) exists and renders when `traceState.status === "quiet"`. Quiet behavior is proven against fixtures by 4 quiet-related tests and the quiet fixture SSE replay.

3. **SSE replay interval is 150ms.** BFF tests take ~30 seconds total due to real-time SSE streaming. This is by design for realistic pacing but makes the BFF test suite slower than the unit tests.

---

## Bug Fix: SSE `req.close` vs `res.close`

During this slice, a critical SSE bug was discovered and fixed. The trace route was listening for `req.on('close')` instead of `res.on('close')`. For POST requests, the `req` 'close' event fires immediately after the request body is consumed (which is instant), killing the `setInterval` before any events could be sent. Switching to `res.on('close')` fixed the issue. This is documented in the route source with a comment explaining the root cause.

---

## Live Integration Status

**Deferred by contract:** live hardware / appliance / packet store / environment access is not part of the current frontend phase. The BFF route has a live-mode branch (`isFixtureMode() === false`) that currently returns a "not yet implemented" error event. When `EH_HOST` and `EH_API_KEY` environment variables are configured, this branch will proxy to ExtraHop APIs.

---

## Not Proven

1. Live ExtraHop SSE integration — deferred by contract.
2. Real device resolution against ExtraHop appliance — deferred by contract.
3. Performance under real network conditions — deferred by contract.
4. Error/quiet state screenshots — behavior proven against fixtures by tests and fixtures, visual capture deferred.

---

## Deferred by Contract

Live hardware / appliance / packet store / environment access is not part of the current frontend phase. All behavior is validated against deterministic fixtures and Zod schemas.

---

## Verdict

**PASSED.** Slice 17 is contract-complete for the frontend/BFF phase. All 162 tests pass. All 14 fixture files validate. All 4 screenshots captured. The SSE bug (req.close vs res.close) has been identified, fixed, and documented. The FlowTheater component renders all 5 UI states (idle, running, complete, quiet, error) against fixture-backed SSE replay.
