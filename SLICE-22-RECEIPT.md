# SLICE 22 — Performance Budget Validation

## TRUTH RECEIPT

**SLICE NAME:** Performance Budget Validation
**STATUS:** Passed
**COMMIT:** (pending checkpoint)

---

## IN SCOPE

Formal timing proof that all major dashboard surfaces render within their documented performance budgets when driven by fixture-backed BFF routes in a sandbox Chromium environment.

Surfaces measured:

| Surface | Budget | Actual (mean) | StdDev | Runs | Status |
|---|---|---|---|---|---|
| Impact Deck | 2000ms | 937ms | 93ms | 3 | PASS |
| Flow Theater | 5000ms | 547ms | 8ms | 3 | PASS |
| Blast Radius | 3000ms | 487ms | 14ms | 3 | PASS |
| Correlation | 2000ms | 574ms | 18ms | 3 | PASS |
| Topology | 4000ms | 530ms | 28ms | 3 | PASS |
| Inspector Tab Switch | 200ms | 112ms | 35ms | 3 | PASS |

All 6 surfaces pass. Overall result: **6/6 passed, 0 failed.**

---

## OUT OF SCOPE

- Production SLA enforcement (these are contract-phase sandbox measurements)
- Load testing under concurrent users
- Network latency simulation
- Mobile viewport performance
- Cached BFF <50ms target (deferred — requires server-side cache layer not yet implemented)
- Uncached BFF <2s target (deferred — requires live ExtraHop appliance)

---

## DEPENDENCIES

- Dev server running on localhost:3000
- Fixture-backed BFF routes for all surfaces
- puppeteer-core (Chromium headless browser automation)
- System Chromium at /usr/bin/chromium-browser

---

## ROUTES

No new BFF routes added. This slice validates existing routes:

| Route | Method | Surface |
|---|---|---|
| / | GET | Impact Deck |
| /flow-theater | GET | Flow Theater |
| /blast-radius | GET | Blast Radius |
| /correlation | GET | Correlation |
| /topology | GET | Topology |

---

## TYPES

New shared types in `shared/performance-budget-types.ts`:

| Type | Purpose |
|---|---|
| `SurfaceId` | Union of 6 surface identifiers |
| `TimingMeasurement` | Individual surface timing result |
| `PerformanceBudgetReport` | Full report with all measurements |

Constants:

| Constant | Purpose |
|---|---|
| `SURFACE_IDS` | Array of 6 surface identifiers |
| `PERFORMANCE_BUDGETS` | Budget target (ms) per surface |
| `SURFACE_TERMINAL_TESTIDS` | CSS selector per surface for terminal state |
| `SURFACE_ROUTES` | Client route path per surface |

Validators:

| Validator | Purpose |
|---|---|
| `SurfaceIdSchema` | Zod enum for surface IDs |
| `TimingMeasurementSchema` | Zod schema for individual measurements |
| `PerformanceBudgetReportSchema` | Zod schema for full report |
| `validatePassedConsistency` | Checks passed field matches actualMs vs budgetMs |
| `validateReportConsistency` | Checks report summary counts match measurements |
| `validateRunTimesConsistency` | Checks runTimes length and mean match |
| `validateStdDev` | Checks stdDev computation correctness |
| `validateBudgetCoverage` | Checks all surfaces have budget/testid/route |

---

## FIXTURES

| File | Purpose |
|---|---|
| `fixtures/performance-budget-report.json` | Full measurement report (6 surfaces, 3 runs each) |

---

## TESTS

**58 source-level it() call sites, 58 runtime Vitest executions** (no dynamic expansion in this slice).

Test file: `server/slice22.test.ts`

| Describe Group | Tests | Purpose |
|---|---|---|
| Budget Constant Contracts | 10 | Surface IDs, budget values, testids, routes, sanity bounds |
| SurfaceIdSchema | 2 | Valid/invalid surface ID validation |
| TimingMeasurementSchema | 9 | Schema acceptance/rejection for measurements |
| PerformanceBudgetReportSchema | 4 | Schema acceptance/rejection for reports |
| validatePassedConsistency | 5 | Passed field consistency with actual vs budget |
| validateReportConsistency | 5 | Report summary count consistency |
| validateRunTimesConsistency | 4 | RunTimes length and mean consistency |
| validateStdDev | 4 | Standard deviation computation correctness |
| validateBudgetCoverage | 2 | All surfaces covered |
| Performance Budget Report Fixture | 10 | Report fixture exists, validates, consistent |
| Budget Ordering Invariants | 3 | Inspector tightest, Flow Theater most generous, Impact Deck = Correlation |

---

## SCREENSHOTS

5 local PNG screenshots captured by the measurement harness:

| File | Surface | State |
|---|---|---|
| `screenshots/slice22-impact-deck.png` | Impact Deck | Populated (KPI strip, correlation, timeline, top talkers, detections) |
| `screenshots/slice22-flow-theater.png` | Flow Theater | Idle (entry form, 8-step rail) |
| `screenshots/slice22-blast-radius.png` | Blast Radius | Idle/quiet (query form) |
| `screenshots/slice22-correlation.png` | Correlation | Populated (event feed, category filters, summary) |
| `screenshots/slice22-topology.png` | Topology | Populated (constellation view, device nodes, clusters) |

Note: Inspector tab switch is measured on the Impact Deck page and does not produce a separate screenshot.

---

## KNOWN LIMITATIONS

1. **Sandbox-only measurements.** Timing data reflects sandbox Chromium headless performance, not production hardware. Actual production performance will differ based on hardware, network latency, and ExtraHop appliance response times.

2. **Fixture-backed data only.** All surfaces are measured against BFF fixture sentinels. Live ExtraHop integration will introduce additional latency from appliance API calls.

3. **Inspector tab switch measurement.** The inspector opens via clicking a Top Talkers table row. If no table rows exist (e.g., quiet state), the measurement falls back to 0ms. The current measurement (112ms mean) reflects the populated state with a clickable row.

4. **Cached BFF <50ms and Uncached BFF <2s targets.** These require server-side caching infrastructure and live appliance access respectively, neither of which is in scope for the frontend contract phase.

5. **Cold start vs warm.** The first run for each surface includes Chromium page creation overhead. The 3-run average mitigates this but does not eliminate it.

---

## LIVE INTEGRATION STATUS

Not attempted. Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase.

---

## CLAIMS

1. All 6 surfaces render within their documented performance budgets in sandbox Chromium headless.
2. Shared types, constants, and Zod validators define the budget contract.
3. 58 Vitest tests validate budget constants, schemas, consistency validators, and the measurement report fixture.
4. The measurement harness produces a structured JSON report with per-surface timing data.
5. 5 screenshots capture each surface's rendered state at measurement time.
6. The report fixture validates against the PerformanceBudgetReportSchema.
7. All consistency validators pass on the generated report.
8. No NaN, Infinity, or undefined values reach the report.
9. The InspectorShell component now has `data-testid="inspector-shell"` for measurement targeting.

## EVIDENCE

- 58 tests passed (server/slice22.test.ts)
- 1 fixture present (fixtures/performance-budget-report.json)
- 5 screenshots present (screenshots/slice22-*.png)
- 7 validators present (shared/performance-budget-types.ts)
- Measurement harness present (screenshots/measure-performance.mjs)

## NOT PROVEN

- Production performance under real load
- Performance with live ExtraHop appliance data
- Cached BFF response times
- Mobile viewport performance
- Concurrent user performance

## DEFERRED BY CONTRACT

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. Production SLA enforcement requires live integration testing.

## VERDICT

**PASSED.** All 6 surfaces render within budget. 58 tests pass. Report fixture validates. Consistency validators confirm. Screenshots captured. Budget contract formally proven for sandbox fixture-backed conditions.
