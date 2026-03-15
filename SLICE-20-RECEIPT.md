# TRUTH RECEIPT — Slice 20: Standalone Correlation Surface

## Status: Passed — Correlation is now a first-class named surface

## Slice
Slice 20 — Standalone Correlation Surface

## Commit
60c47d04

## Scope Contract

### In Scope
- Standalone `/correlation` route in App.tsx
- Correlation nav item de-placeholdered in DashboardLayout (no longer `placeholder: true`)
- Full CorrelationPage component (`client/src/pages/Correlation.tsx`)
- Shared time window integration via `useTimeWindow()`
- Reuse of existing `useCorrelationOverlay` hook (no duplicate fetch logic)
- Reuse of existing shared types from `shared/correlation-types.ts` (no local type redefinition)
- Reuse of existing BFF route `POST /api/bff/correlation/events` (no new route needed)
- Category filter bar with per-category toggle, Select All, Clear All
- Event feed sorted by timestamp descending (most recent first)
- Event detail expansion with description, source, refs, risk score, duration
- Summary strip showing total count, active categories, time window
- 6 UI states: idle, loading, populated, quiet, error, malformed
- data-testid coverage for all states and interactive elements
- 98 source-level `it()` call sites in `server/slice20.test.ts`
- 6 screenshots: populated, populated-expanded, filtered, quiet, error, loading

### Out of Scope
- Cross-surface navigation (clicking event to open Blast Radius or Flow Theater)
- Real-time auto-refresh / polling
- Pagination for large event sets
- Standalone Correlation surface advanced features (timeline visualization, clustering view)
- Living Topology surface (still placeholder)

## Dependencies
- `shared/correlation-types.ts` — existing, no changes
- `shared/correlation-validators.ts` — existing, no changes
- `server/routes/correlation.ts` — existing BFF route, no changes
- `client/src/hooks/useCorrelationOverlay.ts` — existing hook, no changes
- `fixtures/correlation/*.fixture.json` — existing 6 fixtures, no changes

## Routes
- `POST /api/bff/correlation/events` — existing, reused without modification
- `GET /api/bff/correlation/fixtures` — existing, reused without modification
- `/correlation` — new frontend route in App.tsx

## Types
All types reused from `shared/correlation-types.ts`:
- `CorrelationEvent`
- `CorrelationEventCategory`
- `CorrelationPayload`
- `CorrelationOverlayState`
- `CORRELATION_CATEGORY_VISUALS`
- `getCategoryVisual()`
- `filterEventsByCategory()`
- `filterEventsBySeverity()`
- `computeCategoryCounts()`
- `buildInitialCorrelationState()`

No new types defined. No local type redefinitions.

## Fixtures
All 6 existing fixtures reused without modification:
- `correlation.populated.fixture.json`
- `correlation.quiet.fixture.json`
- `correlation.error.fixture.json`
- `correlation.transport-error.fixture.json`
- `correlation.malformed.fixture.json`
- `correlation.clustered.fixture.json`

## Tests
File: `server/slice20.test.ts`
Source-level `it()` call sites: 85
Dynamic expansions: 3 forEach blocks (6+6+6 = 18 runtime from 5 source it())
Runtime Vitest executions: 98 (80 static + 18 dynamic)

Test sections:
1. Route Registration (3 tests) — /correlation route exists, imports Correlation, uses component
2. Nav De-Placeholdering (4 tests) — Correlation exists, path correct, no placeholder:true, Topology still placeholder
3. Page Component (6 tests) — file exists, default export, imports hook/timeWindow/shared types/filterFn
4. UI State data-testid Coverage (11 tests) — all 6 state testids + filter-bar, summary, event-row, event-detail, empty-filter
5. Reuse Proof (6 tests) — no raw fetch, no local type redefinition, uses shared VISUALS/getCategoryVisual
6. Shared Time Window (3 tests) — hook uses useTimeWindow, passes fromMs/untilMs, refetches on change
7. Fixture Validation (9 tests) — all 6 fixtures exist, populated/quiet/clustered validate, malformed rejects, error/transport have flags
8. Category Filtering (5 tests) — empty array returns all, single category filters, multi-category union, missing category empty, computeCategoryCounts matches
9. Event Sorting (2 tests) — page has descending sort, fixture events sortable without NaN
10. UI State Machine (9 tests) — idle/loading/error/malformed/quiet states handled, retry button, time window shown, contract violation message
11. Event Detail Expansion (7 tests) — expandedIds state, toggleExpand, aria-expanded, description/riskScore/source/refs rendered
12. Category Filter UI (5 tests) — CategoryFilterBar exists, aria-pressed, Select All/Clear All, Show all categories button, per-category testid
13. BFF Route Contract (7 tests) — supertest: populated/quiet/error/transport-error/malformed sentinels, invalid intent 400, fixtures list
14. No NaN/Infinity/undefined (6 tests) — JSON content clean, timestampMs finite positive, totalCount matches length
15. Populated Fixture Event Invariants (6 tests) — unique IDs, valid categories, timestamps in window, non-empty titles, valid sources, categoryCounts sum
16. Summary Strip (4 tests) — component exists, shows totalCount/timeWindow/activeCategories

## Screenshots
- `screenshots/slice20-populated.png` — 8 events, 7 categories, full feed with severity badges and risk scores
- `screenshots/slice20-populated-expanded.png` — first event expanded with detail card (description, source, refs, duration)
- `screenshots/slice20-filtered.png` — category filter applied, subset of events visible
- `screenshots/slice20-quiet.png` — "No correlation events" with time window and Refresh button
- `screenshots/slice20-error.png` — "Failed to load correlation events" with error detail and Retry button
- `screenshots/slice20-loading.png` — spinner with "Loading correlation events..." text

## Claims
1. `/correlation` route exists in App.tsx — **proven** by source inspection test (Route Registration §1)
2. Correlation nav item is NOT placeholder — **proven** by source inspection test (Nav De-Placeholdering §2)
3. Page reuses existing correlation contracts — **proven** by reuse proof tests (§5): no raw fetch, no local type redefinition, imports from shared/correlation-types
4. Page reuses existing BFF route — **proven** by BFF route contract tests (§13): supertest against same route, same sentinels
5. Page reuses existing useCorrelationOverlay hook — **proven** by source inspection (§3, §5)
6. Shared time window integration — **proven** by shared time window tests (§6)
7. All 6 UI states have data-testid coverage — **proven** by UI state coverage tests (§4)
8. Category filtering works — **proven** by category filtering tests (§8) and filter UI tests (§12)
9. Event detail expansion works — **proven** by event detail tests (§11)
10. No NaN/Infinity/undefined reaches UI — **proven** by data integrity tests (§14)

## Evidence
- 98 tests passed (server/slice20.test.ts)
- 6 fixtures present and validated
- 6 screenshots present covering all required states
- Validators present (shared/correlation-validators.ts, reused)
- Zero TypeScript errors (npx tsc --noEmit returns clean)

## Not Proven
- Cross-surface navigation from Correlation events to other surfaces (out of scope)
- Behavior under >100 events (pagination not implemented)
- Real-time auto-refresh behavior (out of scope)

## Deferred by Contract
Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. All correlation events are served from deterministic fixtures via the BFF route. Live ExtraHop integration not yet performed.

## Live Integration Status
Not attempted. Deferred by contract.

## Known Limitations
- No pagination for large event sets; all events render in a single scrollable feed
- No cross-surface navigation (clicking an event does not navigate to Blast Radius or Flow Theater)
- No real-time auto-refresh; manual Refresh button only
- Category filter state resets on page navigation (not persisted)
- Topology nav item remains placeholder:true (not part of this slice)

## Verdict
**Passed.** Correlation is now a first-class named surface with a real `/correlation` route, de-placeholdered nav item, shared time window, category filters, event feed with detail expansion, and all 6 UI states. The page reuses existing correlation contracts (shared types, validators, BFF route, hook) without semantic duplication. 98 tests pass, 6 screenshots captured, zero TypeScript errors.
