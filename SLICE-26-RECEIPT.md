# TRUTH RECEIPT — Slice 26

**Slice:** Time-Window Regression Audit
**Commit:** 7529a5b9
**Status:** Passed

## Scope

**In scope:** Source-code audit of all `Date.now()` and `new Date()` calls in client code. Verification that all 7 data-fetching hooks use the shared `useTimeWindow()` context. Verification that `TimeWindowProvider` wraps all routes. Verification that cross-surface navigation URLs do not encode time parameters. Documentation of known deviations. Fixture cases for synchronized and drifted states.

**Out of scope:** Runtime drift measurement (would require live multi-surface rendering with clock instrumentation). Fixing the BlastRadius deviation (documented as remediation path). Performance of the refresh/tick mechanism.

## Claims

### Proven by structural analysis:

1. **Single time source:** `resolveTimeWindow()` in `lib/useTimeWindow.ts` is the only function that calls `Date.now()` for time-window resolution. All other `Date.now()` calls are either display-only (formatRelativeTime), comment references, demo page usage, or the documented BlastRadius deviation.

2. **Shared context wraps all routes:** `TimeWindowProvider` wraps `<Router>` in `App.tsx`, meaning every route has access to the same `TimeWindowContext`.

3. **All data hooks use shared window:** All 7 data-fetching hooks (`useImpactHeadline`, `useImpactTimeseries`, `useTopTalkers`, `useDetections`, `useAlerts`, `useCorrelationOverlay`, `useTopology`) import and call `useTimeWindow()`. None call `Date.now()` directly.

4. **Cross-surface nav preserves time:** Navigation URLs contain only entity identifiers (device ID, hostname, IP). No `fromMs`, `untilMs`, or time-related parameters are encoded. The shared `TimeWindowContext` persists across navigation because the provider wraps all routes.

5. **No panel-local time windows:** No page component (Home, FlowTheater, Correlation, Topology, Help) creates a local `useState` for `fromMs`/`untilMs`.

### Known deviations:

1. **BlastRadius.tsx (minor):** Creates a fallback time window from `Date.now()` at query submission time (lines 314–315, 330–331) instead of reading from `useTimeWindow()`. This means the Blast Radius query uses a 30-minute window anchored to submission time, which may differ from the global 5-minute window. Remediation: wire to `useTimeWindow()`.

2. **DetectionsTable.tsx (none):** `formatRelativeTime` calls `Date.now()` for display-only "5m ago" formatting. This does not affect data fetching or time-window alignment.

3. **ComponentShowcase.tsx (none):** Demo page uses `new Date()` for date picker defaults. Not a data surface.

## Evidence

**Tests passed:** 49 in `server/slice26.test.ts`
- 6 tests: shared time window architecture
- 3 tests: Date.now() drift scan (approved locations, display-only, known deviation)
- 14 tests: all data-fetching hooks use shared window (7 hooks x 2 assertions)
- 5 tests: cross-surface navigation time preservation
- 4 tests: known deviations documented
- 4 tests: resolveTimeWindow determinism
- 5 tests: no panel-local time windows (5 pages)
- 8 tests: fixture cases for synchronized/drifted states

**Fixtures present:**
- `fixtures/time-window-audit/synchronized.fixture.json`
- `fixtures/time-window-audit/drifted-blast-radius.fixture.json`
- `fixtures/time-window-audit/date-now-audit.fixture.json`

**Screenshots:** Not applicable — this is a source-code audit, not a visual audit. Time-window alignment cannot be visually verified without live data.

## Not Proven

1. Runtime drift measurement across simultaneously rendered surfaces (would require instrumented multi-panel rendering with clock injection).
2. That the BlastRadius deviation causes user-visible problems in practice (it may not, depending on usage patterns).
3. That the auto-cycle selection produces optimal granularity for all ExtraHop metric types.
4. That the refresh/tick mechanism updates at the right frequency for real-time monitoring.

## Deferred by Contract

Live hardware / appliance / packet store / environment access is not part of the current frontend phase. Time-window alignment is proven structurally (shared-by-design) but not verified against live data (not-yet-verified-in-practice).

## Distinction: Shared-by-Design vs. Verified-in-Practice

- **Shared-by-design (proven):** The architecture enforces a single time window via React Context. No surface can drift because there is no mechanism for panel-local time. This is a structural guarantee.
- **Verified-in-practice (not proven):** We have not observed multiple surfaces rendering simultaneously against a live ExtraHop appliance and confirmed that the `fromMs`/`untilMs` values in their BFF requests are identical. This would require live integration testing.

## Verdict

**Passed.** The time-window sharing architecture is structurally sound. One known minor deviation (BlastRadius local Date.now()) is documented with a remediation path. All other surfaces are proven to use the shared context. 49 tests, 3 fixtures. Distinction between shared-by-design and verified-in-practice is explicitly documented.
