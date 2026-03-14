# Release Reconciliation Matrix

**Date:** 2026-03-14
**Phase:** Frontend / BFF Contract Build (complete)
**Overall verdict:** All contract-phase deliverables are complete. No live integration has been attempted. The project is ready to transition to the live integration phase.

---

## Quantitative Summary

| Metric | Count |
|--------|-------|
| Slices delivered | 28 (Slices 00–26, including 17-BFF, 22b) |
| Test files | 31 |
| Tests passing | 2,108 |
| Tests failing | 0 |
| Fixture files (JSON) | 146 |
| Fixture directories | 26 |
| Screenshots (PNG) | 92 |
| Screenshot observation files (MD) | 19 |
| Shared type files | 25 |
| BFF route files | 7 |
| BFF endpoints | 18 |
| Truth receipts | 12 standalone + 17 inline in CONTRACTS.md |
| ADR documents | 1 |
| Architectural deviations documented | 7 |

---

## Surface-by-Surface Reconciliation Matrix

Each surface is labeled with its exact proof status. The five proof categories are:

- **Fixture-proven:** Implemented and tested against deterministic fixture payloads. BFF routes return fixture data. UI renders all states (loading, populated, quiet, error, malformed). Shared types and Zod validators enforce contracts.
- **Sandbox-performance-validated:** Render time measured by Puppeteer harness in sandbox VM against fixture-backed BFF routes. Budget pass/fail determined. Not a production performance claim.
- **Structurally audited:** Source code analyzed for architectural invariants (e.g., shared time window, no direct ExtraHop calls, BFF-only fetch). Proven by file scanning and regex matching, not by runtime observation.
- **Live-integrated:** BFF routes connected to a real ExtraHop appliance with real API calls returning real data. **Not attempted for any surface.**
- **Deferred:** Explicitly excluded from the current phase by contract. Will be addressed in the live integration phase.

| Surface | Fixture-Proven | Sandbox-Perf | Structurally Audited | Live-Integrated | Receipt |
|---------|:-:|:-:|:-:|:-:|---------|
| Impact Deck — KPI Strip | Yes | Yes (937ms / 2000ms) | Yes | No | CONTRACTS.md Slice 02 |
| Impact Deck — Throughput Chart | Yes | (included in Impact Deck) | Yes | No | CONTRACTS.md Slice 04 |
| Impact Deck — Top Talkers | Yes | (included in Impact Deck) | Yes | No | CONTRACTS.md Slice 05 |
| Impact Deck — Detections Table | Yes | (included in Impact Deck) | Yes | No | CONTRACTS.md Slice 06 |
| Impact Deck — Alerts Table | Yes | (included in Impact Deck) | Yes | No | CONTRACTS.md Slice 06 |
| Impact Deck — Appliance Footer | Yes | (included in Impact Deck) | Yes | No | CONTRACTS.md Slice 07 |
| Flow Theater | Yes | Yes (547ms / 5000ms) | Yes | No | SLICE-17-RECEIPT.md |
| Blast Radius | Yes | Yes (487ms / 3000ms) | Yes | No | SLICE-18-RECEIPT.md |
| Correlation | Yes | Yes (574ms / 2000ms) | Yes | No | SLICE-19-RECEIPT.md |
| Topology | Yes | Yes (530ms / 4000ms) | Yes | No | SLICE-21-RECEIPT.md |
| Inspector — Device Detail | Yes | Yes (tab switch 112ms / 200ms) | Yes | No | CONTRACTS.md Slices 08–10 |
| Inspector — Detection Detail | Yes | (included in tab switch) | Yes | No | CONTRACTS.md Slice 11 |
| Inspector — Alert Detail | Yes | (included in tab switch) | Yes | No | CONTRACTS.md Slice 11 |
| Inspector — Breadcrumb/History | Yes | N/A | Yes | No | CONTRACTS.md Slices 12–13 |
| Inspector — PCAP Download | Yes | N/A | Yes | No | CONTRACTS.md Slice 09 |
| Appliance Settings | Yes (+ DB) | N/A | Yes | No | CONTRACTS.md Slice 14 |
| Help Page | Yes | N/A | Yes | N/A (no live dependency) | SLICE-24-RECEIPT.md |
| Cross-Surface Navigation | Yes | N/A | Yes | No | SLICE-23-RECEIPT.md |

---

## Cross-Cutting Audit Results

| Audit | Status | Receipt | Key Finding |
|-------|--------|---------|-------------|
| Time-Window Sync (Slice 15) | Proven by design | CONTRACTS.md Slice 15 | Single TimeWindowProvider wraps all routes |
| Time-Window Regression (Slice 26) | Structurally audited | SLICE-26-RECEIPT.md | 1 minor deviation: BlastRadius local Date.now() |
| Performance Budget (Slice 22) | Sandbox-validated | SLICE-22-RECEIPT.md | All 6 surfaces pass budgets |
| Inspector Perf Deep-Dive (Slice 22b) | Structurally audited | SLICE-22b-RECEIPT.md | No memoization in detail panes (documented) |
| Responsive Layout (Slice 25) | Audited at 3 breakpoints | SLICE-25-RECEIPT.md | Desktop-first; 4 narrow-width limitations |
| Fan-Out Reconciliation (ADR) | Decided: Option C (Hybrid) | ADR-FANOUT-RECONCILIATION.md | Keep decomposed, add optional fan-out later |

---

## Architectural Deviations Accepted

These deviations are documented in CONTRACTS.md and are accepted as part of the contract-phase architecture. They are not bugs or oversights — they are deliberate choices or known limitations that will be addressed in the live integration phase.

| # | Deviation | Severity | Remediation Path | Status |
|---|-----------|----------|------------------|--------|
| 1 | Impact Deck uses decomposed BFF routes instead of single fan-out | Medium | ADR Option C: add optional fan-out route during live integration | Decided |
| 2 | Appliance Settings is extra scope beyond original cockpit plan | Low | Accepted — needed for appliance configuration workflow | Accepted |
| 3 | Help was a placeholder nav item | Resolved | Slice 24 implemented full Help page | Closed |
| 4 | Performance budget proof is bounded to sandbox conditions | Medium | Re-measure with live ExtraHop data during integration phase | Documented |
| 5 | Slice numbering has gaps and non-sequential delivery | Low | Cosmetic — does not affect functionality | Accepted |
| 6 | Fan-out reconciliation deferred to live integration | Medium | ADR-FANOUT-RECONCILIATION.md documents the plan | Decided |
| 7 | BlastRadius uses local Date.now() instead of shared time window | Minor | Wire to useTimeWindow() during live integration | Documented |

---

## Unresolved Items

These items are explicitly unresolved and must be addressed before the project can be called production-ready.

| Item | Category | Blocking? | Notes |
|------|----------|-----------|-------|
| Live ExtraHop integration | Integration | Yes | No BFF route has been connected to a real ExtraHop appliance |
| Production performance measurement | Performance | Yes | Sandbox budget proof is not a production SLA |
| BlastRadius time-window drift fix | Bug | No | Minor — only affects Blast Radius query window |
| Fan-out route implementation | Architecture | No | Optional optimization per ADR decision |
| Inspector detail pane memoization | Performance | No | Documented in Slice 22b; React.memo not yet applied |
| Real ExtraHop API error handling | Resilience | Yes | Current error handling is fixture-based; real API errors may differ |
| Authentication/authorization for BFF routes | Security | Yes | BFF routes are currently unauthenticated |
| PCAP download binary contract | Integration | Yes | Binary download path is fixture-backed, not tested against real packet store |
| WebSocket/SSE for real-time updates | Feature | No | Not in scope for contract phase; may be needed for live monitoring |
| Load testing | Performance | No | No concurrent user testing has been performed |

---

## What Is Proven

The following claims are backed by deterministic software evidence (source code, validators, passing tests, fixtures, screenshots):

1. All 12 named surfaces render correctly against fixture payloads in all documented UI states (loading, populated, quiet, error, malformed).
2. All BFF routes return well-formed responses that pass Zod schema validation.
3. The browser never contacts ExtraHop directly — all data flows through BFF routes.
4. Shared types are used consistently across frontend, BFF, and test layers.
5. The shared time window is architecturally enforced via a single React Context provider.
6. Cross-surface navigation preserves entity identity and does not encode time parameters.
7. All 6 major surfaces render within their documented performance budgets under sandbox conditions.
8. The Help page provides a glossary, keyboard shortcuts, surface guide, and integration status.
9. The dashboard is functional at desktop, tablet, and narrow breakpoints (with 4 documented limitations at narrow width).
10. 2,108 tests pass with zero failures across 31 test files.

## What Is Not Proven

The following claims cannot be made under the current contract:

1. That any surface works correctly with real ExtraHop data.
2. That performance budgets hold under production conditions.
3. That error handling covers all real ExtraHop API failure modes.
4. That the dashboard is production-ready for end users.
5. That the PCAP download works with a real packet store.
6. That the appliance settings page successfully configures a real ExtraHop appliance.
7. That concurrent users can use the dashboard without contention.
8. That the fan-out route (when implemented) will improve latency.

---

## File Inventory

### Receipt Files
- `CONTRACTS.md` — Slices 00–16 inline receipts + Project Status & Deviation Register
- `SLICE-17-RECEIPT.md` — Flow Theater
- `SLICE-18-RECEIPT.md` — Blast Radius
- `SLICE-19-RECEIPT.md` — Correlation
- `SLICE-20-RECEIPT.md` — Topology Shared Types
- `SLICE-21-RECEIPT.md` — Topology Surface
- `SLICE-22-RECEIPT.md` — Performance Budget Validation
- `SLICE-22b-RECEIPT.md` — Inspector Performance Deep-Dive
- `SLICE-23-RECEIPT.md` — Cross-Surface Navigation
- `SLICE-24-RECEIPT.md` — Help Page
- `SLICE-25-RECEIPT.md` — Responsive Layout Audit
- `SLICE-26-RECEIPT.md` — Time-Window Regression Audit
- `ADR-FANOUT-RECONCILIATION.md` — Fan-Out Reconciliation Decision

### Shared Type Files (25)
Located in `shared/`. Define the contract vocabulary used across all layers.

### BFF Route Files (7)
Located in `server/routes/`. Define 18 endpoints across 7 route groups.

### Fixture Files (146)
Located in `fixtures/` across 26 subdirectories. Deterministic JSON payloads for all UI states.

### Screenshot Files (92 PNG + 19 MD observations)
Located in `screenshots/`. Visual evidence for all documented UI states.

### Test Files (31)
Located in `server/`. 2,108 passing tests covering schema validation, normalization, component contracts, state coverage, and architectural invariants.

---

## Transition Checklist: Contract Phase → Live Integration Phase

Before beginning live integration, the following must be true:

- [ ] Access to a real ExtraHop appliance (hostname, API key, network reachability)
- [ ] Decision on whether to implement the fan-out route (ADR Option C says "optional")
- [ ] BFF route authentication strategy decided and implemented
- [ ] Real ExtraHop API response shapes validated against current Zod schemas
- [ ] Error handling updated for real API failure modes (timeouts, 401, 403, 429, 500, network errors)
- [ ] BlastRadius time-window drift fixed (wire to useTimeWindow())
- [ ] Performance re-measured with live data
- [ ] PCAP download tested against real packet store
- [ ] Appliance settings tested against real ExtraHop configuration API

---

## Verdict

**Contract phase: Complete.** All named surfaces are fixture-proven, all cross-cutting audits are passed, all architectural deviations are documented, and all unresolved items are explicitly listed. The project is ready to transition to the live integration phase. No claim of production readiness is made or implied.
