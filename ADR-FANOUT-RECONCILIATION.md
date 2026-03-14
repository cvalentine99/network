# ADR: Impact Deck BFF Fan-Out Reconciliation

**Status:** Decided
**Date:** 2026-03-14
**Decision:** Option C — Hybrid (keep decomposed for contract phase, add optional fan-out for live integration)

---

## Context

The original sprint guide (Phase 3) specified a single fan-out BFF route at `GET /api/bff/impact/overview` that would issue five parallel ExtraHop API calls and return a unified response containing headline KPIs, time-series data, top talkers, detections, and alerts in one payload. The current implementation decomposes this into nine independent BFF routes under `/api/bff/impact/*`, each with its own fixture set, error handling, and truth receipt.

This deviation was documented in the Project Status & Deviation Register (CONTRACTS.md, Deviation 1) and in the Architectural Drift Record (CONTRACTS.md, lines 883–929). Three reconciliation options were identified. This ADR formally selects one.

---

## Route Inventory (Current State)

All routes are mounted under `/api/bff/impact` via `impactRouter` in `server/routes/impact.ts`.

| Route | Method | Purpose | Slice | Fixture-Backed |
|-------|--------|---------|-------|----------------|
| `/api/bff/impact/headline` | GET | KPI strip data (5 metrics + baseline delta) | 02 | Yes |
| `/api/bff/impact/timeseries` | GET | Throughput chart time-series data | 04 | Yes |
| `/api/bff/impact/top-talkers` | GET | Top talkers table (top N devices by bytes) | 05 | Yes |
| `/api/bff/impact/detections` | GET | Active detections list | 06 | Yes |
| `/api/bff/impact/alerts` | GET | Active alerts list | 06 | Yes |
| `/api/bff/impact/appliance-status` | GET | Appliance connection status for footer | 07 | Yes |
| `/api/bff/impact/device-detail` | GET | Inspector device detail pane data | 08 | Yes |
| `/api/bff/impact/detection-detail` | GET | Inspector detection detail pane data | 11 | Yes |
| `/api/bff/impact/alert-detail` | GET | Inspector alert detail pane data | 11 | Yes |

Additional BFF route groups:

| Route Group | Mount Point | Routes | Slice |
|-------------|-------------|--------|-------|
| Health | `/api/bff/health` | GET `/` | 01 |
| Packets | `/api/bff/packets` | POST `/metadata`, POST `/download` | 09 |
| Trace | `/api/bff/trace` | POST `/run`, GET `/fixtures` | 17 |
| Blast Radius | `/api/bff/blast-radius` | POST `/query`, GET `/fixtures` | 18 |
| Correlation | `/api/bff/correlation` | POST `/events`, GET `/fixtures` | 19 |
| Topology | `/api/bff/topology` | POST `/query`, GET `/fixtures` | 21 |

**Total BFF routes:** 18 endpoints across 7 route groups.

---

## Options Evaluated

### Option A: Keep Decomposed (No Change)

Keep the current 9 independent Impact routes. The browser makes 5–6 parallel requests on Impact Deck load.

**Advantages:**
- Each route has independent error handling (one failing ExtraHop call does not block the others).
- Each route has its own fixture set and truth receipt (slice isolation is preserved).
- Partial data is possible: if detections fail, the KPI strip and timeseries still render.
- Simpler to test: each route is a unit with clear input/output contracts.
- Simpler to cache: each route can have its own cache TTL based on data volatility.

**Disadvantages:**
- 5–6 parallel HTTP requests per page load instead of 1 (higher overhead, more TCP connections).
- Time-window consistency across requests is not guaranteed (each request resolves its own time window from the shared context, but network latency means they may hit the ExtraHop API at slightly different moments).
- Does not match the original sprint guide architecture.
- Harder to reason about "what the Impact Deck shows" as a single unit.

### Option B: Reintroduce Single Fan-Out

Add `GET /api/bff/impact/overview` that issues all 5 ExtraHop calls in parallel on the server and returns a unified response. Remove the individual routes.

**Advantages:**
- Single HTTP request from browser (lower overhead, single TCP connection).
- Server-side parallelism ensures all ExtraHop calls use the same time window.
- Matches the original sprint guide architecture.
- Easier to reason about the Impact Deck as a single data unit.

**Disadvantages:**
- All-or-nothing error handling: if one ExtraHop call fails, the entire response fails (unless partial success is explicitly handled, adding complexity).
- Breaks all existing fixture sets, tests, and truth receipts (massive rework).
- Harder to cache: the unified response has mixed volatility (KPIs change every second, detections change every minute).
- Harder to test: the fan-out route is a complex integration point.
- Loses slice isolation: the fan-out route is a cross-cutting concern.

### Option C: Hybrid (Recommended)

Keep the decomposed routes as the primary contract-phase architecture. When live integration begins, add an **optional** `GET /api/bff/impact/overview` fan-out route that internally calls the same handler functions used by the individual routes, aggregates the results, and returns a unified response. The individual routes remain available for debugging, partial loading, and independent testing.

**Advantages:**
- No rework of existing fixtures, tests, or receipts.
- Fan-out route reuses existing handler logic (DRY).
- Browser can choose: use individual routes (current behavior) or fan-out route (future optimization).
- Partial success is natural: the fan-out route can return `{ headline: {...}, timeseries: {...}, topTalkers: null, detections: {...}, alerts: {...} }` when one call fails.
- Individual routes remain available for debugging and monitoring.
- Gradual migration: switch the frontend to the fan-out route when ready, without removing the decomposed routes.

**Disadvantages:**
- Two code paths to maintain (individual + fan-out).
- Fan-out route adds complexity (aggregation, partial error handling).
- Must ensure both paths produce identical normalized output.

---

## Decision

**Option C — Hybrid.**

The decomposed routes are the correct architecture for the contract-first phase. They enable slice isolation, independent testing, and fixture determinism. The fan-out route is an optimization for the live integration phase that can be added without breaking existing contracts.

### Implementation Plan (Deferred to Live Integration Phase)

1. Extract the handler logic from each individual route into shared functions (e.g., `fetchHeadline(timeWindow)`, `fetchTimeseries(timeWindow)`, etc.).
2. Create `GET /api/bff/impact/overview` that calls all 5 handler functions in `Promise.allSettled()`.
3. Return a unified response with partial success support: each section is either the data or `{ error: string }`.
4. Add a feature flag or query parameter (`?mode=fanout`) to let the frontend opt into the fan-out route.
5. Update the frontend to use the fan-out route when the flag is set.
6. Keep the individual routes available for debugging and monitoring.

### What the Browser Calls and Why

**Current (contract phase):** The browser calls 5–6 individual BFF routes in parallel on Impact Deck load. Each route returns its own fixture-backed response. This is correct for the contract phase because it preserves slice isolation and enables independent testing.

**Future (live integration phase):** The browser will call `GET /api/bff/impact/overview` once. The BFF server will issue 5 parallel ExtraHop API calls, normalize the responses, and return a unified payload. The individual routes will remain available for debugging. The browser will **never** call ExtraHop directly — this invariant is unchanged.

---

## Consequences

1. No existing tests, fixtures, or receipts need to change.
2. The fan-out route is additive scope for the live integration phase.
3. The deviation register should be updated to reflect this decision.
4. The performance budget (Slice 22) was measured against the decomposed architecture and remains valid for that architecture. The fan-out architecture will need its own performance measurement.

---

## What This ADR Does Not Decide

1. **When to implement the fan-out route.** That is a live integration phase decision.
2. **Whether the fan-out route is necessary.** If the decomposed routes perform well enough with a live ExtraHop appliance, the fan-out may never be needed.
3. **Cache strategy.** Cache TTLs and invalidation are deferred to live integration.
4. **WebSocket/SSE streaming.** Real-time updates are out of scope for this ADR.
