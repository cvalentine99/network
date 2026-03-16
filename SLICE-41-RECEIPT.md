# SLICE 41 — Topology Layout Persistence

## TRUTH RECEIPT

**Slice:** 41 — Topology Layout Persistence
**Status:** PASSED

### IN SCOPE

- Save node positions to localStorage after drag-end
- Restore pinned node positions from localStorage on page load
- Reset Layout button to clear saved positions and re-run simulation
- NaN/Infinity guard on serialization and deserialization
- Tests for persistence logic and source code contracts

### OUT OF SCOPE

- Server-side position persistence (database)
- Saved Views integration with position data
- Multi-user position sharing

### DEPENDENCIES

- ForceGraph component (Slice 39)
- Topology page toolbar (Slice 21)
- localStorage browser API

### ROUTES

No new routes. All persistence is client-side via localStorage.

### TYPES

| Type | File | Purpose |
|------|------|---------|
| SavedPosition | ForceGraph.tsx | `{ x: number; y: number }` per node |
| ForceGraphHandle.resetLayout | ForceGraph.tsx | Clears saved positions and unpins all nodes |
| ForceGraphHandle.hasCustomLayout | ForceGraph.tsx | Boolean indicating if any positions are saved |

### FILES CHANGED

| File | Change |
|------|--------|
| client/src/components/ForceGraph.tsx | Added persistence functions, drag-end pinning, restore on init, resetLayout handle |
| client/src/pages/Topology.tsx | Added RotateCcw import and Reset Layout button in toolbar |
| server/slice39-force-graph.test.ts | Added 23 new tests for persistence logic |

### PERSISTENCE FLOW

1. **On drag-end:** Node is pinned at its position (fx/fy set), position saved to localStorage under key `topology-node-positions`
2. **On page load:** Saved positions are loaded from localStorage. Nodes with saved positions are initialized at those coordinates and pinned (fx/fy set)
3. **On Reset Layout:** localStorage key is cleared, all nodes are unpinned (fx/fy = null), simulation restarts with alpha 0.8

### SAFETY GUARDS

- NaN and Infinity values are rejected during deserialization
- Non-numeric node IDs are rejected during deserialization
- Malformed entries (missing x/y, null values) are silently skipped
- localStorage errors (full, unavailable) are caught and silently ignored

### FIXTURES

No new fixture files. Tests use existing topology fixtures (populated, quiet, large-scale) to validate serialization round-trips.

### TESTS

38 files, 2561 tests, 0 failures.

23 new tests added:
- 10 serialization/deserialization tests (round-trip, empty, NaN, Infinity, malformed, large-scale)
- 13 source code contract tests (storage key, resetLayout, hasCustomLayout, localStorage calls, fx/fy pinning, NaN guard, button presence)

### SCREENSHOTS

- Populated state: Topology page with 15 nodes, 20 edges, 3 clusters. Reset Layout button visible at index 18 in toolbar with RotateCcw icon and tooltip "Reset layout (clear pinned positions)".

### KNOWN LIMITATIONS

- Positions are stored per-browser (localStorage). Clearing browser data loses saved layout.
- No integration with the Saved Views system (saved views store zoom/search/overlay state but not node positions).
- Large topologies (500+ nodes) may produce large localStorage entries (~50KB). No size limit enforced.

### LIVE INTEGRATION STATUS

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase.

### GREP PROOF

```
LAYOUT_STORAGE_KEY defined at line 104
loadSavedPositions at line 111
saveSavedPositions at line 129
clearSavedPositions at line 141
resetLayout in handle at line 188, 278
hasCustomLayout at line 189, 214, 289, 290
Drag-end pin at lines 520-521, persist at 524
Restore at lines 406, 412-413
NaN guard at lines 119, 522
Reset Layout button at Topology.tsx lines 1100, 1105, 1107
84 total tests in slice39-force-graph.test.ts
```

### NOT PROVEN

- Drag interaction cannot be proven in vitest (requires browser DOM with D3 event simulation)
- localStorage actual read/write cannot be tested in Node.js vitest (tested via serialization logic mirror)

### DEFERRED BY CONTRACT

Live hardware / appliance / packet store / environment access is not part of the current frontend phase.

### TRUTH VERDICT

**PASSED** — Implemented against fixtures. Validated against serialization contracts. UI state verified via browser screenshot. 23 tests passing. Live integration not yet performed.
