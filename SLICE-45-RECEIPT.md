# TRUTH RECEIPT — Slice 45: Node Drag-to-Rearrange with Position Persistence

## Slice Identification

| Field | Value |
|---|---|
| Slice | 45 — Node Drag-to-Rearrange with Position Persistence |
| Status | Passed |
| Commit | Pending checkpoint |

## Scope Contract

### In Scope

The slice enhances the existing ForceGraph drag mechanics with three improvements: view-keyed position persistence so that different topology views (constellation, subnet-map, custom saved views) each maintain their own saved node positions in localStorage; a visual pin indicator rendered as a dashed violet ring (stroke #8b5cf6, dasharray 3 3) around nodes that have been dragged to a fixed position; and propagation of the viewKey parameter through all save, load, and clear operations on the position persistence layer.

### Out of Scope

Database-backed persistence (positions are stored in localStorage only). Server-side position storage. Multi-user position sharing. Undo/redo for drag operations. Drag constraints or snap-to-grid behavior.

## Data Contract

### Storage Key Format

The storage key follows the pattern `topology-node-positions:{viewKey}` where viewKey is an optional string. When no viewKey is provided, the default key `topology-node-positions` is used. The `getStorageKey(viewKey?: string)` function generates the appropriate key.

### Serialized Position Format

Positions are serialized as a JSON object where keys are string-encoded node IDs and values are `{ x: number, y: number }` objects. Deserialization rejects entries with NaN, Infinity, non-numeric keys, or missing x/y fields.

### Quiet-State Behavior

When no saved positions exist for a given viewKey, `loadSavedPositions` returns an empty Map and `hasCustomLayout` is false. The graph renders with simulation-computed positions.

### Error-State Behavior

If localStorage is unavailable or full, save and clear operations silently fail (try/catch). Load operations return an empty Map on parse failure.

## UI Contract

| State | Behavior |
|---|---|
| Loading | Graph renders with simulation-computed positions; no pin indicators |
| Quiet/Empty | No saved positions; all nodes free-floating; no pin indicators visible |
| Populated | Dragged nodes show dashed violet pin indicator ring; positions restored from localStorage on page reload |
| Malformed rejection | Deserialization rejects NaN, Infinity, non-numeric IDs, missing x/y |
| Transport failure | N/A (localStorage is local; no network transport involved) |

## Truth Proof

### Tests

37 tests in `server/slice45-drag-persistence.test.ts`, all passing. Tests cover view-keyed storage key generation (5 tests), position serialization/deserialization (8 tests), pin indicator visibility logic (7 tests), drag-end persistence behavior (5 tests), reset layout clearing (2 tests), unpin behavior (2 tests), position restoration from saved state (3 tests), large-scale drag persistence (2 tests), and fixture schema re-validation (3 tests).

Additionally, 4 tests in `server/slice39-force-graph.test.ts` were updated to match the new view-keyed storage pattern. Full suite: 2720 tests passing across 40 files, zero failures.

### Fixtures

Existing topology fixtures revalidated: `topology.populated.fixture.json`, `topology.quiet.fixture.json`, `topology.large-scale.fixture.json`. No new fixtures required as this slice enhances existing drag mechanics rather than introducing new data shapes.

### Screenshots

Topology constellation view captured showing populated state with 15 nodes, 20 edges, 3 clusters. Pin indicator cannot be captured via browser automation (D3 drag requires mousedown+mousemove+mouseup on SVG elements which browser tools cannot simulate), but the rendering logic is deterministically tested via `shouldShowPinIndicator` unit tests.

### Validators

Position deserialization validates all entries for finite numeric values. NaN, Infinity, non-numeric keys, and missing coordinates are rejected. Tested with 8 dedicated deserialization tests.

## Known Limitations

Pin indicator is not visible when the node is also selected, on a critical path, or has an anomaly overlay active. This is intentional to avoid visual clutter from overlapping rings. The pin indicator uses a lower visual priority than selection, path, and anomaly rings.

Position persistence uses localStorage which has a ~5MB limit. For extremely large topologies (1000+ pinned nodes), this could theoretically approach the limit, though the serialized size for 200 nodes is well under 20KB (tested).

## Claims

| Claim | Evidence |
|---|---|
| Drag-to-rearrange implemented | D3 drag behavior applied to all `.force-node` SVG groups; handleDragStart/handleDrag/handleDragEnd callbacks in ForceGraph.tsx |
| Positions persist across page reload | `saveSavedPositions` writes to localStorage on drag-end; `loadSavedPositions` reads on component mount; round-trip tested |
| View-keyed persistence | `getStorageKey(viewKey)` generates unique keys per view; 5 unit tests verify isolation |
| Visual pin indicator | Dashed violet circle (r+5, stroke #8b5cf6, dasharray 3 3) rendered when fx/fy are set and no higher-priority overlay active; 7 visibility logic tests |
| Reset layout clears positions | `clearSavedPositions(viewKeyRef.current)` called in resetLayout; tested |
| No NaN/Infinity reaches UI | Deserialization rejects non-finite values; 2 dedicated rejection tests |

## Not Proven

Pin indicator visual appearance in browser screenshot (D3 drag events cannot be simulated via browser automation tools). The rendering logic is proven by unit tests but the visual appearance has not been captured in a screenshot.

## Deferred by Contract

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. Database-backed position persistence is deferred; localStorage is used for the current phase.

## Live Integration Status

Not attempted. Deferred by contract.

## Verdict

Slice 45 is implemented against fixtures and validated against schema. UI state is complete for the drag-to-rearrange feature with view-keyed localStorage persistence and visual pin indicator. BFF normalization is not applicable (client-only feature). Live integration not yet performed.
