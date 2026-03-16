# TRUTH RECEIPT — SLICE 43

**Slice:** Minimap Overlay, Node Grouping Controls, Real-Time Pulse Animation
**Status:** PASSED
**Commit:** (pending checkpoint)

## SCOPE

**In scope:**
- Canvas-based minimap overlay in bottom-right corner (180x120px)
- Minimap viewport rectangle (amber outline) showing current zoom/pan area
- Minimap click-to-navigate (click minimap to pan main view)
- Node grouping: collapse subnet into super-node (aggregated bytes, detections, alerts)
- Node grouping: expand super-node back to individual nodes
- Collapse/Expand All toolbar button (Shrink icon)
- Real-time pulse animation: edge stroke-dashoffset proportional to traffic bytes
- Pulse animation: requestAnimationFrame loop with cleanup
- Pulse toggle toolbar button (Zap icon, cyan highlight when active)
- isLiveData guard: pulse only activates when both pulseEnabled AND isLiveData are true

**Out of scope:**
- Live ExtraHop appliance connectivity (deferred by contract)
- Minimap drag-to-pan (click only)
- Per-cluster collapse buttons on the graph itself (toolbar only)

## DATA CONTRACT

**Minimap inputs:** nodesRef.current (SimNode[]), linksRef.current (SimLink[]), transform state
**Grouping inputs:** TopologyPayload.clusters[].id, nodes[].clusterId
**Pulse inputs:** edge.bytes, maxEdgeBytes, pulseEnabled prop, isLiveData prop
**Super-node shape:** { id: negative int, isSuperNode: true, clusterId, totalBytes: sum, activeDetections: sum, activeAlerts: sum }

## UI CONTRACT

| State | Minimap | Grouping | Pulse |
|-------|---------|----------|-------|
| Loading | Not rendered (no nodes) | Not rendered | Not rendered |
| Quiet | Empty canvas (no nodes to draw) | No clusters to collapse | No edges to pulse |
| Populated | Full topology at reduced scale + viewport rect | Collapse/expand functional | Edges animate when enabled + live |
| Error | Not rendered | Not rendered | Not rendered |

## EVIDENCE

**Tests:** 44 new tests in slice39-force-graph.test.ts, 2646 total passing, 0 failures
**Fixtures:** Existing topology fixtures validated for cluster grouping (clusterId, bytes, label fields)
**Screenshots:** Minimap visible at bottom-right (element 18), Collapse All button visible, Pulse toggle visible, Export menu with layout JSON options
**Validators:** TopologyPayloadSchema validates all input data

## GREP PROOF

- Minimap: 21 references in ForceGraph.tsx (MINIMAP_WIDTH, MINIMAP_HEIGHT, minimapCanvasRef, handleMinimapClick, topology-minimap, minimap-canvas)
- Node grouping: 33 references in ForceGraph.tsx (collapsedClusters, collapseCluster, expandCluster, isSuperNode, superNodeId, collapsedNodeIds)
- Collapse All: 3 references in Topology.tsx (toggle-collapse-all, Shrink)
- Pulse animation: 16 references in ForceGraph.tsx (pulseEnabled, shouldPulse, pulseOffsetRef, getPulseDash, requestAnimationFrame, cancelAnimationFrame)
- Pulse toggle: 7 references in Topology.tsx (toggle-pulse, Zap, pulseEnabled)
- isLiveData deferred: `const isLiveData = false;` in Topology.tsx

## NOT PROVEN

- Minimap click-to-navigate accuracy at extreme zoom levels (not tested in browser)
- Super-node edge deduplication correctness with complex multi-cluster topologies (tested with 3-cluster fixture only)
- Pulse animation visual smoothness (requestAnimationFrame loop verified in code, not measured FPS)

## DEFERRED BY CONTRACT

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. Pulse animation requires isLiveData=true which is currently hardcoded to false. When live ExtraHop integration is connected, set isLiveData based on the data source mode.

## VERDICT

Implemented against fixtures. Validated against schema. UI states complete for mocked payloads. Live integration not yet performed.
