# TRUTH RECEIPT — Slice 19: Correlation Overlay

## Metadata

| Field | Value |
|---|---|
| Slice | 19 — Correlation Overlay |
| Status | **Provisionally Passed — partial build-doc recovery, summary wording correction required** |
| Commit | 97497792 |
| Date | 2026-03-14 |

## Claims

The Correlation Overlay surface answers "What changed at roughly the same moment?" by rendering causal strip markers on the Impact Deck timeline, positioned between the KPI strip and the GhostedTimeline chart. The overlay is implemented against deterministic fixtures, validated against Zod schemas, and tested with 98 source-level `it()` call sites expanding to 135 runtime Vitest executions (via dynamic fixture loops). This slice covers the **overlay on the Impact Deck only**; the standalone Correlation page (sidebar entry) remains a placeholder with a "Coming soon" toast. This is a partial build-doc recovery for the Correlation entry, not a full one.

## Scope Contract

### In Scope

- Shared types: `CorrelationEvent`, `CorrelationPayload`, `CorrelationOverlayState`, `CorrelationEventCluster`, `CorrelationEventCategory` (7 categories), `Severity` (4 levels), `CorrelationEventSource`, `CorrelationEventRef`
- Zod validators: `CorrelationEventSchema`, `CorrelationPayloadSchema` (with cross-field refinements for totalCount/categoryCounts/timeWindow), `CorrelationIntentSchema`, `CorrelationEventClusterSchema`, `CorrelationEventSourceSchema`, `CorrelationEventRefSchema`, `SeveritySchema`, `CorrelationEventCategorySchema`
- Pure functions: `clusterEvents()`, `filterEventsByCategory()`, `filterEventsBySeverity()`, `computeCategoryCounts()`, `getCategoryVisual()`, `buildInitialCorrelationState()`
- Category visual map: `CORRELATION_CATEGORY_VISUALS` (7 entries with color, label, iconHint)
- BFF routes: `POST /api/bff/correlation/events` (query with intent), `GET /api/bff/correlation/fixtures` (fixture listing)
- Sentinel routing: quiet (0,0), error (9999999999999), transport-error (8888888888888), malformed (7777777777777), clustered (categories filter present), populated (default)
- UI: `CorrelationStrip` component with category legend pills, timeline-aligned markers, click-to-expand popover with event detail
- UI: `useCorrelationOverlay` hook with state machine (idle/loading/populated/quiet/error/malformed)
- Integration: overlay positioned between KPI strip and GhostedTimeline on Impact Deck (Home.tsx)
- 6 fixture files: populated (8 events, all 7 categories), quiet (0 events), error, transport-error, malformed, clustered (5 events in 2 temporal clusters)
- 6 screenshots: populated, populated-popover, quiet, error, malformed, loading

### Out of Scope

- Standalone Correlation page (sidebar entry is placeholder with "Coming soon" toast) — this means the build-doc Correlation entry is only partially recovered by this slice
- Cross-surface navigation from correlation markers to Flow Theater or Blast Radius
- Real-time SSE streaming of correlation events (current implementation is request/response)
- Time-window synchronization with other panels (hook reads from useTimeWindow context but fixture data uses fixed timestamps)
- Live ExtraHop integration

## Data Contract

### Request Shape (POST /api/bff/correlation/events)

```json
{
  "fromMs": 1710000000000,
  "untilMs": 1710000300000,
  "categories": ["detection", "alert"],
  "minSeverity": "high"
}
```

`categories` and `minSeverity` are optional filters. `fromMs` must be >= 0 and <= `untilMs`.

### Response Shape (populated)

```json
{
  "timeWindow": { "fromMs": 1710000000000, "untilMs": 1710000300000 },
  "totalCount": 8,
  "categoryCounts": {
    "detection": 2, "alert": 1, "config_change": 1,
    "firmware": 1, "topology": 1, "threshold": 1, "external": 1
  },
  "events": [
    {
      "id": "det-4401",
      "category": "detection",
      "title": "Lateral Movement via SMB",
      "description": "...",
      "timestampMs": 1710000060000,
      "timestampIso": "2024-03-09T16:01:00.000Z",
      "durationMs": 45000,
      "severity": "critical",
      "riskScore": 92,
      "source": { "kind": "device", "displayName": "dc01.lab.local", "id": 1042 },
      "refs": [{ "kind": "detection", "id": "det-4401", "label": "Detection #4401" }]
    }
  ]
}
```

### Cross-Field Refinements

- `totalCount` must equal `events.length`
- `categoryCounts` must match actual category distribution in `events`
- `timeWindow.fromMs` must be <= `timeWindow.untilMs`

### Error Response Shape

```json
{
  "error": true,
  "message": "ExtraHop appliance unreachable",
  "code": "UPSTREAM_UNREACHABLE"
}
```

### Quiet-State Behavior

When no events exist in the time window, the BFF returns a valid payload with `totalCount: 0`, `events: []`, and all-zero `categoryCounts`. The UI renders "No correlation events in this time window" in muted text.

### Error-State Behavior

Transport failures return HTTP 502/504 with `{ error: true, message, code }`. The UI renders a red warning banner with the error message. Malformed data (passes HTTP but fails schema validation) renders an amber warning banner with schema violation details.

## UI Contract

| State | Rendering | data-testid |
|---|---|---|
| Loading | Spinner + "Loading correlation events..." | `correlation-loading` |
| Quiet | "No correlation events in this time window" | `correlation-quiet` |
| Populated | Category legend pills + timeline markers + count badge | `correlation-populated` |
| Error | Red warning banner with error message | `correlation-error` |
| Malformed | Amber warning banner with schema violation detail | `correlation-malformed` |

## Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/bff/correlation/events` | Query correlation events for a time window |
| GET | `/api/bff/correlation/fixtures` | List available fixture files |

## Types

| File | Exports |
|---|---|
| `shared/correlation-types.ts` | `CorrelationEvent`, `CorrelationEventCategory`, `Severity`, `CorrelationPayload`, `CorrelationIntent`, `CorrelationOverlayState`, `CorrelationEventCluster`, `CorrelationEventSource`, `CorrelationEventRef`, `CategoryVisual`, `CORRELATION_CATEGORY_VISUALS`, `getCategoryVisual`, `filterEventsByCategory`, `filterEventsBySeverity`, `clusterEvents`, `computeCategoryCounts`, `buildInitialCorrelationState` |
| `shared/correlation-validators.ts` | `CorrelationEventCategorySchema`, `SeveritySchema`, `CorrelationEventSourceSchema`, `CorrelationEventRefSchema`, `CorrelationEventSchema`, `CorrelationPayloadSchema`, `CorrelationIntentSchema`, `CorrelationEventClusterSchema` |

## Fixtures

| File | Purpose |
|---|---|
| `fixtures/correlation/correlation.populated.fixture.json` | 8 events across all 7 categories, 5-minute window |
| `fixtures/correlation/correlation.quiet.fixture.json` | 0 events, valid empty payload |
| `fixtures/correlation/correlation.error.fixture.json` | BFF error: UPSTREAM_UNREACHABLE |
| `fixtures/correlation/correlation.transport-error.fixture.json` | BFF error: GATEWAY_TIMEOUT |
| `fixtures/correlation/correlation.malformed.fixture.json` | Invalid data that fails schema validation |
| `fixtures/correlation/correlation.clustered.fixture.json` | 5 events in 2 temporal clusters |

## Tests

**98 source-level `it()` call sites → 135 runtime Vitest executions** in `server/slice19.test.ts`:

| Section | Count | Coverage |
|---|---|---|
| Enum schemas | 18 | CorrelationEventCategorySchema (7 valid + 8 invalid), SeveritySchema (4 valid + 6 invalid) |
| Sub-schemas | 10 | CorrelationEventSourceSchema, CorrelationEventRefSchema |
| CorrelationEventSchema | 16 | Valid event, nullable fields, zero duration, empty refs, invalid id/title/timestamp/duration/riskScore/category/severity, NaN/Infinity rejection |
| CorrelationIntentSchema | 9 | Valid intents, filters, equal timestamps, inverted window, negative fromMs, invalid category/severity, missing fields |
| CorrelationPayloadSchema | 7 | Populated/quiet/clustered fixtures pass, malformed fails, mismatched totalCount/categoryCounts/timeWindow rejected |
| Fixture file validation | 9 | All 6+ fixtures validated, error fixtures checked for structure, malformed proven to fail |
| Pure functions | 30 | getCategoryVisual (8), CORRELATION_CATEGORY_VISUALS (3), filterEventsByCategory (4), filterEventsBySeverity (5), computeCategoryCounts (3), buildInitialCorrelationState (1), clusterEvents (8) |
| Clustered fixture analysis | 4 | Event count, temporal proximity, cluster grouping |
| Populated fixture invariants | 8 | Time window bounds, ISO timestamp consistency, category coverage, nullable fields, point/ranged events, NaN/Infinity rejection |
| BFF route tests | 10 | POST populated/quiet/error/transport-error/malformed/clustered, 4 invalid intent cases |
| BFF fixtures endpoint | 1 | GET returns fixture list |
| State machine invariants | 6 | All 6 state kinds validated |

## Screenshots

| File | State |
|---|---|
| `screenshots/slice19-populated.png` | 8 markers with category-colored icons, legend pills, count badge |
| `screenshots/slice19-populated-popover.png` | Popover showing event detail on marker click |
| `screenshots/slice19-quiet.png` | "No correlation events" muted text |
| `screenshots/slice19-error.png` | Red warning banner with ECONNREFUSED detail |
| `screenshots/slice19-malformed.png` | Amber warning banner with schema violation detail |
| `screenshots/slice19-loading.png` | Spinner with "Loading correlation events..." |

## Evidence

- [x] Tests passed: 98 source-level it() call sites → 135 runtime Vitest executions (all passing)
- [x] Fixtures present: 6 files validated
- [x] Screenshots present: 6 files (populated, populated-popover, quiet, error, malformed, loading)
- [x] Validators present: 8 Zod schemas with cross-field refinements
- [x] Pure functions tested: 7 functions with deterministic inputs/outputs
- [x] BFF route tested: 11 HTTP-level tests via supertest

## Not Proven

- Cross-surface navigation from correlation markers to Flow Theater or Blast Radius
- Real-time streaming of correlation events
- Time-window synchronization with live data (fixture timestamps are static)
- Behavior under >100 events (performance budget not tested)

## Deferred by Contract

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. The correlation overlay is implemented against deterministic fixtures and validated against Zod schemas. Live ExtraHop integration has not been attempted.

## Live Integration Status

Not attempted. Deferred by contract.

## Verdict

**PROVISIONALLY PASSED — partial build-doc recovery, summary wording correction applied.** Slice 19 — Correlation Overlay is implemented against fixtures, validated against schemas, and tested with 98 source-level `it()` call sites expanding to 135 runtime Vitest executions. The overlay renders causal strip markers on the Impact Deck timeline with category-colored icons, legend pills, and click-to-expand popovers. All 6 UI states (loading, quiet, populated, error, malformed, popover) are screenshot-proven. BFF route handles sentinel routing for all fixture types. Cross-field schema refinements enforce totalCount/categoryCounts/timeWindow consistency. The standalone Correlation page remains placeholder-only; this slice is a partial build-doc recovery for the Correlation entry, not a full one. Live integration not yet performed.
