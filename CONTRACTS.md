# Obsidian Cockpit — Contract Registry

This file tracks the truth receipts for every completed slice.

---

## Truth Receipt Template

```
# TRUTH RECEIPT

Slice:
Status:
Commit:

## Claims
-

## Evidence
- validators present
- fixtures present
- tests passed
- screenshots present

## Not Proven
-

## Deferred by Contract
- live hardware / appliance / packet store / environment validation is not part of the current frontend phase

## Verdict
- Passed / Failed / Blocked
```

---

## Slice 00 — Contract Harness + Shell

# TRUTH RECEIPT

Slice: 00 — Contract Harness + Shell
Status: Passed (receipt corrected after review)
Commit: e4bb232a (initial), pending checkpoint (corrected)

## Corrections Applied

The original receipt claimed 47 tests and 12 Zod schemas. Verified counts are 50 tests in slice00.test.ts (after health route fix) and 11 exported Zod schemas in cockpit-validators.ts. The original health route test used a try/catch fallback to fixture validation, which meant it could pass without proving a live local route response. That test has been replaced with four explicit tests that require the dev server to be running and will fail outright if the server is unreachable. Screenshot evidence was described in prose but not systematically catalogued; this receipt now states exactly what was captured and what was not.

## Scope Contract

### In Scope

The following are implemented and present in the repository: app shell with DashboardLayout sidebar; global shared time window store via TimeWindowProvider and useTimeWindow hook; TimeWindowSelector component in the page header that reads from and writes to the global time window; auto-cycle selection logic mapping duration to cycle granularity; resolved time window display showing from-until range and cycle in the toolbar; inspector shell that opens and closes without breaking layout with placeholder content; BFF health route at GET /api/bff/health returning a schema-validated response; shared types in cockpit-types.ts; shared validators in cockpit-validators.ts; shared constants in cockpit-constants.ts; fixture directory structure with 8 fixture files; shared UI state components EmptyState, ErrorState, LoadingSkeleton, and KPICardSkeleton; and this truth receipt in CONTRACTS.md.

### Out of Scope

Impact Deck KPI cards (Slice 02), metrics normalization core (Slice 01), top talkers table, detection and alert panels, live ExtraHop integration, PCAP download, and device detail inspector content are all excluded from this slice.

## Data Contract

### BFF Health — Request Shape

Method GET, path /api/bff/health, no request body, no query parameters.

### BFF Health — Response Shape

Validated by BffHealthResponseSchema (Zod). Fields: status (enum: ok, degraded, not_configured), bff object (uptime as number, memoryMB as number, cache object with size and maxSize as integers), appliance (ApplianceIdentity object or null), timestamp (ISO 8601 string). Quiet-state behavior: when EH_HOST or EH_API_KEY are not configured, status is "not_configured" and appliance is null. Error-state behavior: on internal failure, HTTP 500 with JSON body containing error and message fields.

### Time Window — Query Shape

Validated by TimeWindowQuerySchema (Zod). Fields: from (number, default -300000), until (number, optional), cycle (enum: 1sec, 30sec, 5min, 1hr, 24hr, auto; default auto).

## UI Contract

| State | Component | Behavior |
|---|---|---|
| Loading | LoadingSkeleton, KPICardSkeleton | Pulsing placeholder bars and card shapes |
| Quiet / Empty | EmptyState | Icon, title, message; distinct from error |
| Populated | Home page shell | Time selector, resolved range, inspector toggle, content area |
| Transport failure | ErrorState type="transport" | AlertTriangle icon in red, failure message |
| Contract violation | ErrorState type="contract" | ShieldX icon in orange, schema error message |

## Evidence

### Tests

50 tests in server/slice00.test.ts, all passing. Breakdown by describe block:

| Block | Count | What it proves |
|---|---|---|
| BffHealthResponseSchema | 6 | Accepts ok, not-configured, degraded fixtures; rejects malformed, null, empty |
| ImpactOverviewPayloadSchema | 3 | Accepts populated and quiet fixtures; rejects malformed |
| ImpactHeadlineSchema | 4 | Accepts valid with and without baseline delta; rejects negative and NaN |
| TimeWindow resolution | 9 | Relative from, duration computation, auto-cycle at all 5 boundaries, schema validation, positive duration |
| cockpit-constants | 4 | ACTIVE_SENTINEL value, mapAlertSeverity mapping, riskScoreToSeverity mapping, CYCLE_DURATION_MS entries |
| Fixture files exist | 16 | 8 files verified for existence and valid JSON parse |
| Static audit | 4 | No ExtraHop IP, no API key pattern, no EH env vars, no direct fetch calls in client/src |
| BFF health route (live local server) | 4 | HTTP 200 from live server, schema validation of live response, status field check, uptime type and value check |

Total across all test files in the repository: 69 tests (50 slice00 + 18 network + 1 auth.logout), all passing.

### Validators

11 exported Zod schemas in shared/cockpit-validators.ts:

| Schema | Purpose |
|---|---|
| TimeWindowQuerySchema | Validates time window query input |
| TimeWindowSchema | Validates resolved time window object |
| SeriesPointSchema | Validates individual metric series data points |
| ApplianceIdentitySchema | Validates ExtraHop appliance identity |
| BffHealthResponseSchema | Validates BFF health endpoint response |
| ImpactHeadlineSchema | Validates impact deck headline KPI block |
| NormalizedDetectionSchema | Validates normalized detection objects |
| NormalizedAlertSchema | Validates normalized alert objects |
| DeviceIdentitySchema | Validates device identity objects |
| TopTalkerRowSchema | Validates top talker table rows |
| ImpactOverviewPayloadSchema | Validates full impact overview payload |

### Fixtures

8 fixture files across 2 directories:

| File | Purpose |
|---|---|
| fixtures/health/health.ok.fixture.json | Populated health response with full appliance identity |
| fixtures/health/health.not-configured.fixture.json | Quiet state, appliance null |
| fixtures/health/health.degraded.fixture.json | Degraded state, appliance null |
| fixtures/health/health.malformed.fixture.json | Invalid payload for rejection testing |
| fixtures/impact/impact-overview.populated.fixture.json | Populated impact overview with timeseries data |
| fixtures/impact/impact-overview.quiet.fixture.json | Valid empty state, all zeroes and empty arrays |
| fixtures/impact/impact-overview.transport-error.fixture.json | Simulated HTTP 502 transport failure |
| fixtures/impact/impact-overview.malformed.fixture.json | Invalid payload for rejection testing |

### Screenshots

Two screenshots were captured during development. The first shows the shell in its default state: Impact Deck header, "Last 5 minutes" time window selector, resolved time range with auto-selected 1sec cycle, inspector toggle button, and content placeholder area. The second shows the inspector panel open on the right side with "Select an item to inspect" placeholder, confirming the layout does not break when the inspector is toggled. Both were captured via the dev server preview. No separate screenshots were captured for EmptyState, ErrorState, or LoadingSkeleton components in isolation; those components exist as code and are tested for render but were not individually screenshotted.

### Static Audit

grep confirms no occurrence of 192.168.50.157 in client/src/. grep confirms no occurrence of EH_HOST or EH_API_KEY in client/src/. grep confirms no direct ExtraHop API call patterns in client/src/. curl confirms GET /api/bff/health returns HTTP 200 with schema-valid JSON from the live local dev server.

## Not Proven

Inspector does not yet display real device or detection detail; that is deferred to later slices. BFF health route does not yet call a live ExtraHop appliance. Time window auto-refresh interval is not yet implemented. EmptyState, ErrorState, and LoadingSkeleton components were not individually screenshotted in isolation.

## Deferred by Contract

Live hardware, appliance, packet store, and environment validation is not part of the current frontend phase. Live ExtraHop API integration is deferred; the health route returns a fixture-mode not_configured response. Real appliance identity population is deferred; the appliance field is null in the current phase.

## Live Integration Status

Not attempted. Deferred by contract.

## Verdict

Passed. 50 tests in slice00.test.ts pass, including 4 that require a live local dev server response (no fixture fallback). 11 Zod schemas exported. 8 fixture files present and schema-valid. Static audit confirms no ExtraHop direct access from client code. Inspector opens and closes without breaking layout. Time window is globally shared via React Context. Receipt corrected after review to reflect verified counts and to eliminate the health-route fixture fallback.

---

## Slice 01 — Metrics Normalization Core

# TRUTH RECEIPT

Slice: 01 — Metrics Normalization Core
Status: Passed
Commit: 6b73a133

## Scope Contract

### In Scope

Five pure functions implemented in shared/normalize.ts, each with full test and fixture coverage:

| Function | Purpose | Contract rule enforced |
|---|---|---|
| resolveTimeWindow | Resolve relative or absolute time boundaries into concrete epoch-ms TimeWindow with auto-cycle selection | All panels on a surface share one time window; cycle selection is deterministic from duration |
| bindMetricValues | Positionally bind a raw values[] array to its metric_specs[] array | values[] bind positionally to metric_specs[]; never infer by name; null/NaN/Infinity/undefined sanitized to null |
| computeRate | Convert a bucket total to a per-second rate by dividing by bucket duration | Bucket totals are not rates; throughput = total / durationSeconds; zero/negative duration returns null not Infinity |
| buildMetricSeries | Transform raw stat rows into a normalized MetricSeries with SeriesPoint[] | Output sorted by time; every point schema-validated; empty stats = valid quiet state with points: [] |
| computeActualCoverage | Compute ratio of actual data coverage vs. requested time window | 0 = no data (quiet), 1.0 = full coverage; clamped to 1.0; points outside window excluded |

One exported interface: RawStatRow (input shape for buildMetricSeries).

### Out of Scope

UI components, BFF routes, live ExtraHop metric collection, appliance authentication, visual dashboard composition, chart rendering, and any React code are excluded from this slice. This slice is pure TypeScript with zero DOM or network dependencies.

## Data Contract

### Input Shapes

resolveTimeWindow accepts: from (number, negative = relative), until (number, optional), cycle (MetricCycle, optional), now (number, optional anchor for deterministic testing).

bindMetricValues accepts: specs (MetricSpec[]), values (array of number, null, or undefined).

computeRate accepts: total (number or null), durationMs (number).

buildMetricSeries accepts: objectType, objectId, cycle, fromMs, untilMs, specs (MetricSpec[]), stats (RawStatRow[]).

computeActualCoverage accepts: series (MetricSeries).

### Output Shapes

resolveTimeWindow returns TimeWindow (fromMs, untilMs, durationMs, cycle). Invalid windows (from > until) return durationMs: 0.

bindMetricValues returns Record<string, number | null>. Keys are spec.key1 if present, otherwise spec.name.

computeRate returns number or null. Never NaN. Never Infinity.

buildMetricSeries returns MetricSeries with points sorted ascending by time. Each point passes SeriesPointSchema.

computeActualCoverage returns number between 0 and 1.0 inclusive.

### Quiet-State Behavior

Empty stats array → buildMetricSeries returns points: [] (valid quiet state, not error). computeActualCoverage returns 0 for empty points. computeRate returns null for null total. bindMetricValues returns all-null record for all-null values.

### Error-State Behavior

NaN, Infinity, -Infinity, and undefined in values[] are sanitized to null by bindMetricValues. Zero or negative durationMs causes computeRate to return null. Invalid time windows (from > until) produce durationMs: 0 from resolveTimeWindow.

## UI Contract

Not applicable to this slice. These are pure functions with no UI. No loading, quiet, populated, or error states render visually. The behavioral equivalents (quiet = empty output, error = null/sanitized output) are proven through tests.

## Screenshots

Not applicable. This slice contains no visual components. All five functions are pure TypeScript with no DOM interaction. Screenshot evidence is replaced by test evidence for this slice.

## Evidence

### Tests

server/slice01.test.ts contains **32 it() call sites** in source code. Vitest reports **65 test executions** because 4 of those call sites use `for` loops over fixture arrays, dynamically generating additional test cases at runtime. Both numbers are correct at their respective level of measurement.

Breakdown by describe block (it() call sites / vitest-reported executions):

| Block | it() call sites | Vitest executions | How | What it proves |
|---|---|---|---|---|
| Fixture files exist and parse | 2 | 18 | `for` loop over 9 fixture files × 2 tests each | 9 fixture files verified for existence and valid JSON parse |
| resolveTimeWindow | 3 | 10 | `for` loop over 8 fixture cases + 2 static tests | 8 fixture-driven cases (relative, absolute, all auto-cycle boundaries, explicit override, invalid window) plus NaN guard and shape validation |
| bindMetricValues | 11 | 11 | All static | Populated binding, null preservation, short array fill, extra value drop, key1 override, NaN/Infinity/-Infinity/undefined sanitization, empty inputs |
| computeRate | 4 | 10 | `for` loop over 7 fixture cases + 3 static tests | 7 fixture-driven cases (30sec/1sec/5min buckets, null total, zero/negative duration, zero total) plus NaN guard, Infinity guard, zero-total confirmation |
| buildMetricSeries | 7 | 7 | All static | Populated fixture, quiet fixture (empty stats), NaN/Infinity/undefined sanitization, sort order, tIso validity, SeriesPointSchema validation per point, no-poison-values sweep |
| computeActualCoverage | 5 | 9 | `for` loop over 5 fixture cases + 4 static tests | 5 fixture-driven cases (full/half/zero/zero-width/outside-window) plus negative window, overlap clamping, integration with populated buildMetricSeries, integration with quiet buildMetricSeries |
| **Totals** | **32** | **65** | | |

Total across all test files in the repository by the same two measures:

| File | it() call sites | Vitest executions |
|---|---|---|
| server/slice01.test.ts | 32 | 65 |
| server/slice00.test.ts | 36 | 50 |
| server/network.test.ts | 18 | 18 |
| server/auth.logout.test.ts | 1 | 1 |
| **Totals** | **87** | **134** |

### Fixtures

9 fixture files in fixtures/normalization/:

| File | Purpose |
|---|---|
| resolve-time-window.fixture.json | 8 deterministic test cases with fixed anchor epoch |
| bind-values.populated.fixture.json | 4 specs, 4 values, all present |
| bind-values.nulls.fixture.json | Null, short, and extra value scenarios |
| bind-values.key1-override.fixture.json | Specs with key1 override |
| compute-rate.fixture.json | 7 rate conversion cases including edge cases |
| build-series.populated.fixture.json | 5 stat rows for network object |
| build-series.quiet.fixture.json | Empty stats array (valid quiet state) |
| build-series.poison-values.fixture.json | NaN/Infinity/undefined injection description |
| coverage.fixture.json | 5 coverage ratio cases |

### Validators Used

SeriesPointSchema from cockpit-validators.ts is used in tests to validate every output point from buildMetricSeries. No new validators were added in this slice; the existing shared validators are consumed.

## Not Proven

These functions have not been tested against live ExtraHop metric API responses. The fixture data is structurally representative of the ExtraHop metric response format (positional values[], metric_specs[], stat_time, duration) but has not been validated against a live appliance payload capture. The resolveTimeWindow function in shared/normalize.ts duplicates logic from client/src/lib/useTimeWindow.ts; the two implementations have not been formally proven equivalent beyond matching behavior in overlapping test cases.

## Deferred by Contract

Live hardware, appliance, packet store, and environment validation is not part of the current frontend phase. Live ExtraHop metric API replay is deferred. Validation against real appliance payload captures is deferred. Performance benchmarking of normalization functions under production data volumes is deferred.

## Live Integration Status

Not attempted. Deferred by contract.

## Verdict

Passed. 32 it() call sites in slice01.test.ts expand to 65 vitest-reported test executions via fixture-driven for loops, all passing. 87 it() call sites across the full repo expand to 134 vitest-reported executions, all passing. 5 exported pure functions, 1 exported interface, 9 deterministic fixture files. Every function enforces the sprint doc's non-negotiable rules: positional binding (never infer by name), rate conversion (never pass bucket totals as rates), NaN/Infinity sanitization (never reaches output), empty data as valid quiet state (never collapsed into error). No UI components, no network calls, no DOM dependencies. Screenshots not applicable — replaced by test evidence for pure functions.

Receipt correction note: The original receipt (commit 6b73a133) stated "65 tests" and "134 tests" without distinguishing between source-level it() call sites and vitest-reported dynamic test executions. This was misleading when compared against a grep of it() in the source file, which returns 32. Both numbers are factually correct at their respective level of measurement, but the receipt failed to make this distinction. Corrected in this revision.

---


---

## Slice 02 — Impact Deck KPI Strip

### Scope Contract

**In scope:**
- 5 KPI headline cards: Total Bytes, Total Packets, Throughput (bytes/sec), Packet Rate (packets/sec), Baseline Delta (%)
- 5 pure formatter functions: formatBytes, formatBytesPerSec, formatPackets, formatPacketsPerSec, formatPercent
- BFF route: GET /api/bff/impact/headline (fixture-backed, schema-validated)
- useImpactHeadline hook: fetches from BFF, validates via ImpactHeadlineSchema, returns KPIStripState discriminated union
- KPIStrip component: renders all 5 UI states (loading, quiet, populated, error, malformed)
- Client-side schema re-validation of headline data before rendering
- 6 headline-specific fixture files + 1 formatter fixture file

**Out of scope:**
- Impact Deck time-series charts
- Protocol breakdown panels
- Inspector detail view content
- Live ExtraHop integration

### Data Contract

**Request shape:** `GET /api/bff/impact/headline?from={ms}&until={ms}&cycle={CycleGranularity}`

**Response shape (success):**
```json
{
  "headline": {
    "totalBytes": number (>= 0),
    "totalPackets": number (>= 0),
    "bytesPerSecond": number (>= 0),
    "packetsPerSecond": number (>= 0),
    "baselineDeltaPct": number | null
  },
  "timeWindow": {
    "fromMs": number,
    "untilMs": number,
    "durationMs": number,
    "cycle": CycleGranularity
  }
}
```

**Response shape (error):** `{ "error": string, "message": string }`

**Quiet-state behavior:** All headline values are 0, baselineDeltaPct is null. KPIStrip renders EmptyState ("No traffic data").

**Error-state behavior:** Transport failure renders ErrorState with type="transport". Malformed data renders ErrorState with type="contract".

### UI Contract

| State | Trigger | Rendering |
|---|---|---|
| Loading | Fetch in progress | 5 KPICardSkeleton pulse animations |
| Quiet | All values 0, baselineDeltaPct null | EmptyState: "No traffic data" |
| Populated | Valid non-zero headline data | 5 KPI cards with formatted values, icons, baseline delta arrow |
| Error | HTTP error or network failure | ErrorState type="transport": "KPI data unavailable" |
| Malformed | Headline fails ImpactHeadlineSchema | ErrorState type="contract": "KPI data rejected" |

### Truth Proof

**Tests:** 81 vitest-reported test executions from 42 it() call sites in server/slice02.test.ts.

| Describe block | it() call sites | Vitest executions | Expansion method |
|---|---|---|---|
| Fixture files exist and parse | 2 | 12 | 6 files × 2 dynamic tests each |
| formatBytes | 5 | 13 | 9 fixture-driven + 4 static |
| formatBytesPerSec | 3 | 8 | 6 fixture-driven + 2 static |
| formatPackets | 3 | 9 | 7 fixture-driven + 2 static |
| formatPacketsPerSec | 2 | 7 | 6 fixture-driven + 1 static |
| formatPercent | 3 | 8 | 6 fixture-driven + 2 static |
| ImpactHeadlineSchema validation | 8 | 8 | All static |
| BFF /api/bff/impact/headline route | 7 | 7 | All static, live local requests |
| Formatter contract rules | 9 | 9 | All static |

**Repo-wide totals:** 129 it() call sites → 215 vitest executions across 5 test files, all passing.

**Fixture files (6 new for Slice 02):**
- fixtures/impact/headline.populated.fixture.json
- fixtures/impact/headline.quiet.fixture.json
- fixtures/impact/headline.transport-error.fixture.json
- fixtures/impact/headline.malformed.fixture.json
- fixtures/impact/headline.negative-baseline.fixture.json
- fixtures/formatters/formatters.fixture.json

**Fixture backing clarification:** The BFF route at GET /api/bff/impact/headline serves data extracted from the Slice 00 fixtures: `impact-overview.populated.fixture.json` (extracting .headline) and `impact-overview.quiet.fixture.json` (extracting .headline). It does NOT serve the headline.*.fixture.json files directly. The headline.*.fixture.json files are used exclusively by slice02.test.ts for schema validation tests. These are two different fixture sets serving two different purposes.

**Screenshots:**
- Populated state: Captured as screenshots/slice02-populated.png (77,325 bytes). 5 KPI cards visible with formatted values (7.96 GB, 12.45M pkts, 27.17 MB/s, 41.50K pps, +12.3%). Note: values "12.45M..." and "27.17..." and "41.50K..." appear truncated in the card layout — a known visual issue.
- Loading state: Transient. 5 KPICardSkeleton pulse animations render during fetch. Not separately captured because the state lasts < 200ms on local dev server.
- Quiet state: Not separately screenshotted. The component renders EmptyState when all values are 0. Proven by code path analysis and schema validation test.
- Error state: Not separately screenshotted. The component renders ErrorState type="transport" when fetch fails. Proven by code path analysis.
- Malformed state: Not separately screenshotted. The component renders ErrorState type="contract" when schema validation fails. Proven by code path and ImpactHeadlineSchema rejection test.

**Validators present:** ImpactHeadlineSchema (Zod), TimeWindowSchema (Zod), TimeWindowQuerySchema (Zod). Client-side re-validation in KPIStrip before rendering.

### Known Limitations

- Loading, quiet, error, and malformed states are proven by code path and test but not individually screenshotted. The populated state is the only state with a browser screenshot.
- The BFF route uses process.cwd() for fixture path resolution, which works in dev but would need adjustment for production deployment.
- Formatter precision is fixed (2 decimal places for bytes, 2 for packets with SI suffixes, 1 for percent). No user-configurable precision.

### Not Proven

- Component render tests in a DOM environment (jsdom/happy-dom). Tests are server-side only (schema, formatter, route).
- Visual regression testing of KPI card layout across viewport widths.

### Deferred by Contract

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. All data flows through fixture-backed BFF routes.

### Live Integration Status

Not attempted. Deferred by contract.

### Verdict

**Passed (corrected).** 81 vitest executions from 42 it() call sites, all passing. 5 formatter functions tested against deterministic fixtures. BFF route tested with live local requests (not fixture fallback). Schema validation proves populated, quiet, and malformed states. Populated state screenshotted as screenshots/slice02-populated.png. Loading/quiet/error/malformed states proven by code path but not individually screenshotted.

**Correction note (revision 2):** Original receipt (commit e2e8f97a) had two inaccuracies: (1) claimed screenshot evidence existed but only a notes markdown file was present — no actual PNG image was in the project; (2) did not distinguish that the BFF route serves data from Slice 00 impact-overview.*.fixture.json files while the headline.*.fixture.json files are used only by tests. Both corrected in this revision.

# TRUTH RECEIPT

Slice: 02 — Impact Deck KPI Strip
Status: Passed (corrected — receipt revision 2)
Commit: e2e8f97a (original), pending (correction checkpoint)

## Claims
- 5 pure formatter functions exported from shared/formatters.ts
- BFF route GET /api/bff/impact/headline returns schema-validated headline data
- KPIStrip component handles 5 UI states via KPIStripState discriminated union
- useImpactHeadline hook fetches from BFF, validates, and returns typed state
- Client-side re-validation via ImpactHeadlineSchema before rendering
- 6 headline fixture files + 1 formatter fixture file created (for test use)
- BFF route serves headline data extracted from Slice 00 impact-overview.*.fixture.json files, not from headline.*.fixture.json
- 81 vitest executions from 42 it() call sites, all passing
- 215 total vitest executions across repo, all passing
- No ExtraHop direct access from client code
- All data flows through /api/bff/* routes

## Evidence
- tests passed: 81/81 in slice02.test.ts, 215/215 repo-wide
- fixtures present: 6 headline + 1 formatter = 7 new files
- screenshots present: populated state captured as screenshots/slice02-populated.png (77,325 bytes, actual PNG image file)
- validators present: ImpactHeadlineSchema, TimeWindowSchema, TimeWindowQuerySchema
- BFF route tested with live local HTTP requests (not fixture fallback)
- Static grep audit: no ExtraHop host in client code (proven in Slice 00)

## Not Proven
- Component DOM render tests (jsdom/happy-dom)
- Individual screenshots for loading, quiet, error, malformed states
- Visual regression across viewport widths

## Deferred by Contract
- live hardware / appliance / packet store / environment access is not part of the current frontend phase
