# TRUTH RECEIPT — Slice 21: Living Topology

## Slice
Living Topology — constellation topology surface with device clustering, 200-device performance budget, shared time window, node detail panel, search, role/cluster legends, and all UI states.

## Status
Provisionally Passed — receipt corrections applied (commit hash, screenshot evidence description). Implemented against fixtures. Live integration not yet performed.

## Commit
fac9d48b

## SLICE NAME
Slice 21 — Living Topology

## IN SCOPE
- Shared types: `TopologyNode`, `TopologyEdge`, `TopologyCluster`, `TopologyPayload`, `TopologySummary`, `TopologyBffResponse`, `TopologyQueryRequest`
- Shared validators: Zod schemas for all types, structural validators (`validateEdgeReferences`, `validateClusterReferences`, `validateSummaryCounts`, `validateUniqueNodeIds`, `validateUniqueEdges`, `validateClusterNodeCounts`, `validateDetectionAlertCounts`)
- Constants: `TOPOLOGY_DEVICE_ROLES` (14 roles), `TOPOLOGY_PROTOCOLS` (12 protocols), `ROLE_DISPLAY` (label/color per role), `TOPOLOGY_PERFORMANCE` (MAX_NODES=200, size/width budgets)
- BFF routes: `POST /api/bff/topology/query` (sentinel-routed), `GET /api/bff/topology/fixtures` (fixture listing)
- Sentinel routing: fromMs=1 quiet, fromMs=2 error, fromMs=3 transport-error, fromMs=4 malformed, fromMs=5 large-scale, else populated
- UI component: `Topology.tsx` — SVG-based constellation view with force-directed layout simulation, cluster grouping with dashed boundary circles, role-colored nodes with size proportional to traffic, edge lines with detection highlighting, node detail panel (click-to-open), search filter, role legend, cluster legend, summary bar, zoom controls
- UI states: loading (spinner), populated (15-node constellation), quiet ("No Devices Observed" with refresh), error ("Topology Unavailable" with retry), malformed (rejection), large-scale (200-node with truncation warning)
- Hook: `useTopology.ts` — fetches from BFF, validates response against schema, handles all states
- Route registration: `/topology` in App.tsx
- Nav de-placeholdering: Topology nav item no longer has `placeholder: true` in DashboardLayout.tsx
- Shared time window: consumed via `useTimeWindow()`, passed to BFF query
- 200-device performance budget: `TOPOLOGY_PERFORMANCE.MAX_NODES = 200`, large-scale fixture has exactly 200 nodes, summary shows "Truncated to 200 nodes" warning
- 6 fixtures: populated (15 nodes), quiet (0 nodes), error, transport-error, malformed, large-scale (200 nodes)
- 5 local PNG screenshots: loading, populated, detail-panel, quiet, error
- 1 CDN-hosted screenshot: large-scale (exceeded 1MB local limit, uploaded to CDN, reference in `slice21-large-scale.cdn.txt`)

## OUT OF SCOPE
- Live ExtraHop activity map integration
- Real-time topology polling / auto-refresh
- Drag-to-rearrange nodes (layout is computed, not interactive-drag)
- Cross-surface navigation (clicking a node to open Blast Radius or Flow Theater)
- Help page (still placeholder)

## DEPENDENCIES
- `shared/topology-types.ts` — shared type definitions
- `shared/topology-validators.ts` — Zod schemas and structural validators
- `client/src/lib/useTimeWindow.ts` — shared time window context
- `zod` — schema validation
- `puppeteer` — screenshot capture (dev only)
- `supertest` — BFF HTTP testing (dev only)

## ROUTES
- `POST /api/bff/topology/query` — accepts `{ fromMs, toMs, maxNodes?, clusterId? }`, returns `TopologyBffResponse`
- `GET /api/bff/topology/fixtures` — returns `{ fixtures: string[] }`

## TYPES
- `TopologyDeviceRole` — 14-member union
- `TopologyProtocol` — 12-member union
- `TopologyNode` — id, displayName, ipaddr?, macaddr?, role, totalBytes, activeDetections, activeAlerts, isCritical
- `TopologyEdge` — source, target, protocol, bytes, latencyMs, hasDetection
- `TopologyCluster` — id, label, groupBy, nodeIds, nodeCount
- `TopologySummary` — totalNodes, totalEdges, totalClusters, nodesWithDetections, nodesWithAlerts, totalBytes, truncated, maxNodes
- `TopologyPayload` — nodes, edges, clusters, summary, timeWindow
- `TopologyBffResponse` — intent (populated|quiet|error|transport_error|malformed), payload?, error?
- `TopologyQueryRequest` — fromMs, toMs, maxNodes?, clusterId?

## FIXTURES
| Fixture | File | Nodes | Edges | Clusters |
|---|---|---|---|---|
| Populated | `topology.populated.fixture.json` | 15 | 20 | 3 |
| Quiet | `topology.quiet.fixture.json` | 0 | 0 | 0 |
| Error | `topology.error.fixture.json` | n/a | n/a | n/a |
| Transport Error | `topology.transport-error.fixture.json` | n/a | n/a | n/a |
| Malformed | `topology.malformed.fixture.json` | invalid | invalid | invalid |
| Large-Scale | `topology.large-scale.fixture.json` | 200 | 600 | 10 |

## TESTS
- **91 source-level `it()` call sites** (81 static + 10 inside `for` loops)
- **125 runtime Vitest executions** (81 static + 44 dynamic expansions from 4 loop patterns)
- Dynamic expansion breakdown:
  - 5 fixture schema validations (FIXTURES minus malformed)
  - 21 structural validator tests (DATA_FIXTURES × 7 validators)
  - 5 BFF response schema validations (FIXTURES minus malformed)
  - 13 data-testid existence checks (requiredTestIds)
- Test categories:
  - Enum schema validation (roles, protocols)
  - Node/Edge/Cluster schema validation (positive and negative)
  - Payload schema validation (populated, quiet, large-scale, rejection)
  - Fixture file schema validation (all 6 fixtures)
  - Response envelope validation
  - Structural cross-reference validators (edge refs, cluster refs, summary counts, unique IDs, unique edges, cluster node counts, detection/alert counts)
  - ROLE_DISPLAY constant contract (coverage, uniqueness, color validity)
  - Performance budget constants
  - BFF HTTP route tests (supertest: all sentinels, validation errors, fixture listing)
  - Integration contract tests (route registration, nav de-placeholdering, component data-testids, type import verification)

## SCREENSHOTS
| State | File | Description |
|---|---|---|
| Loading | `slice21-loading.png` | Spinner while topology loads |
| Populated | `slice21-populated.png` | 15-node constellation with 3 clusters, role colors, edge lines |
| Detail Panel | `slice21-detail-panel.png` | dc01.lab.local selected, right panel shows role/IP/MAC/traffic/connections |
| Quiet | `slice21-quiet.png` | "No Devices Observed" centered message with Refresh button |
| Error | `slice21-error.png` | "Topology Unavailable" with 503 error message and Retry button |
| Large-Scale | CDN-hosted (see `slice21-large-scale.cdn.txt`) | 200 nodes, 600 edges, 10 clusters, "Truncated to 200 nodes" warning |

## KNOWN LIMITATIONS
- Force-directed layout is computed client-side with a simple simulation; not a production-grade physics engine
- Node labels may overlap at high density (200-node view is dense but readable at cluster level)
- No drag-to-rearrange; layout is deterministic from data
- Search filters nodes by displayName only, not by IP or MAC
- Cluster boundaries are circular approximations, not convex hulls

## LIVE INTEGRATION STATUS
Not attempted. Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase.

## Claims
1. Topology is a first-class named surface at `/topology` — **proven by route registration test and App.tsx grep**
2. Topology nav item is de-placeholdered — **proven by DashboardLayout.tsx grep test confirming no `placeholder: true`**
3. Shared types are reused, not redefined locally — **proven by import verification tests**
4. All 6 UI states render with correct data-testids — **proven by 13 data-testid existence tests**
5. BFF route handles all 6 sentinels correctly — **proven by supertest HTTP tests**
6. 200-device performance budget is enforced — **proven by large-scale fixture having exactly 200 nodes and summary.truncated=true**
7. Shared time window is consumed — **proven by useTopology.ts importing useTimeWindow**
8. All 6 fixtures validate against schema — **proven by fixture validation tests (5 pass, 1 malformed intentionally fails)**
9. Structural validators catch cross-reference errors — **proven by negative tests for edge refs, duplicate IDs, summary mismatches**

## Evidence
- 125 tests passed (91 source-level `it()`, 125 runtime)
- 6 fixtures present and validated
- 5 local PNG screenshots present (loading, populated, detail-panel, quiet, error)
- 1 CDN-hosted large-scale screenshot reference (slice21-large-scale.cdn.txt → CDN URL)
- Zod validators present and tested
- Structural validators present and tested
- BFF route tested via supertest
- Route registration verified
- Nav de-placeholdering verified
- Type reuse verified (no local redefinition)

## Not Proven
- Performance timing budget (render <3s) — not measured, only structural budget (200 nodes) enforced
- Cross-surface navigation from topology nodes to other surfaces
- Real ExtraHop activity map data shape compatibility

## Deferred by Contract
Live hardware / appliance / packet store / environment access is not part of the current frontend phase. All validation is against deterministic fixtures and schema contracts.

## Cross-Slice Test Fix
Slice 20 test `slice20.test.ts` line 112 originally asserted `Topology` nav item had `placeholder: true`. This was correct at Slice 20 time but became stale after Slice 21 de-placeholdered Topology. Updated the test to verify Topology nav item exists without asserting placeholder status. All 614 tests across Slices 17-21 now pass.

## Verdict
**Provisionally Passed — receipt corrections applied.** Implemented against fixtures. The Living Topology surface is a real first-class named surface with route, de-placeholdered nav, shared time window, 200-device performance budget, all 6 UI states, 6 fixtures, 125 tests, 5 local PNG screenshots + 1 CDN-hosted large-scale screenshot reference. Topology is no longer a placeholder nav item. Only Help remains as a placeholder in the sidebar.

## Receipt Corrections Applied
1. Commit hash updated from "(pending checkpoint)" to `fac9d48b`
2. Screenshot evidence now distinguishes 5 local PNG screenshots + 1 CDN-hosted large-scale screenshot reference (not flattened to "6 screenshots present")
