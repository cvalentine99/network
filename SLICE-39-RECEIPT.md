# SLICE 39 — Force-Directed Topology Graph

## TRUTH RECEIPT

| Field | Value |
|---|---|
| Slice | 39 — Force-Directed Topology Graph |
| Status | PASSED |
| Commit | pending checkpoint |

## SCOPE CONTRACT

**In scope:** Replace static ConstellationView SVG with interactive D3-force graph. Drag, zoom, pan. Cluster gravity grouping. Node sizing by traffic volume. Edge width by bytes. Search highlighting. Critical path overlay. Anomaly overlay. SVG/PNG export via ForceGraphHandle. Detail panel integration. All 5 UI states (loading, quiet, populated, error, malformed).

**Out of scope:** Live ExtraHop integration. Authentication. Subnet Map view changes. Saved Views persistence changes.

## DATA CONTRACT

Request shape: unchanged — useTopology hook fetches from `/api/bff/topology/live` and returns `TopologyPayload`.

Response shape: unchanged — `TopologyPayload` with nodes, edges, clusters, summary. `edgesAreSynthetic` flag added in Slice 38.

Validators: `TopologyPayloadSchema` (Zod) validates all fixtures. Node/edge scaling produces no NaN/Infinity.

Quiet-state behavior: ForceGraph renders empty SVG with no simulation when nodes.length === 0.

Error-state behavior: Topology page shows error banner; ForceGraph is not rendered.

## UI CONTRACT

| State | Implementation |
|---|---|
| Loading | Topology page shows loading skeleton (unchanged) |
| Quiet | ForceGraph renders empty SVG, no simulation started |
| Populated | Force-directed graph with 15 nodes, 20 edges, 3 clusters |
| Malformed | Topology page shows malformed-data rejection banner |
| Transport error | Topology page shows transport-failure banner |

## GREP PROOF

1. **ForceGraph component exists:** `client/src/components/ForceGraph.tsx` (26,537 bytes)
2. **ForceGraph imported in Topology.tsx:** line 20 `import ForceGraph, { type ForceGraphHandle } from '@/components/ForceGraph'`
3. **d3-force in package.json:** d3-force, d3-selection, d3-zoom, d3-drag all present
4. **ConstellationView no longer rendered:** `grep -n "<ConstellationView" Topology.tsx` returns zero matches
5. **38 tests in slice39-force-graph.test.ts:** all passing
6. **ForceGraphHandle ref wired:** zoom in/out/reset buttons call `forceGraphRef.current?.zoomIn/zoomOut/resetZoom`
7. **SVG export preserved:** `forceGraphRef.current?.svgElement` passed to ExportMenu
8. **Full test suite:** 38 files, 2515 tests, 0 failures

## CLAIMS

| Claim | Evidence |
|---|---|
| ForceGraph replaces ConstellationView | grep confirms `<ConstellationView` not rendered, `<ForceGraph` at line 1609 |
| D3-force simulation with cluster gravity | ForceGraph.tsx uses `forceX`/`forceY` with cluster center targets |
| Drag, zoom, pan | d3-drag and d3-zoom integrated in ForceGraph.tsx |
| Node sizing by traffic volume | Proven against fixtures by slice39-force-graph.test.ts scaling tests |
| Edge width by bytes | Proven against fixtures by slice39-force-graph.test.ts edge width tests |
| No NaN/Infinity reaches UI | Proven against fixtures by explicit NaN/Infinity checks on all nodes/edges |
| Search highlighting preserved | ForceGraph accepts searchTerm prop, dims non-matching nodes |
| Critical path overlay preserved | ForceGraph accepts criticalPath prop, highlights path edges |
| Anomaly overlay preserved | ForceGraph accepts anomalyOverlay prop, colors anomaly nodes/edges |
| SVG/PNG export preserved | ForceGraphHandle exposes svgElement for ExportMenu |
| All 5 UI states handled | Proven against fixtures by schema validation + state-specific tests |

## NOT PROVEN

ConstellationView component definition still exists in Topology.tsx (lines 377-706) as dead code. It is no longer rendered but was not deleted to preserve git history and allow rollback. This is a known limitation, not a false claim.

## DEFERRED BY CONTRACT

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase.

## LIVE INTEGRATION STATUS

Not attempted. Deferred by contract.

## KNOWN LIMITATIONS

1. ConstellationView dead code remains in Topology.tsx (not rendered, kept for rollback safety)
2. Force simulation re-runs on every payload change (expected behavior for live topology refresh)
3. Large-scale (200 nodes, 600 edges) performance not browser-tested, only fixture-validated
4. Cluster background circles use fixed radius calculation; very large clusters may overflow
