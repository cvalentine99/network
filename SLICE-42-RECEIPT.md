# TRUTH RECEIPT — Slice 42

**Slice:** Saved Views Position Integration, Lock All Toggle, JSON Layout Export/Import
**Commit:** (pending checkpoint)
**Status:** PASSED

## IN SCOPE

1. Saved Views captures node positions when saving a view (DB column, tRPC schema, SavedViewsPanel)
2. Saved Views restores node positions when loading a view (handleLoadView + applyNodePositions)
3. Lock All toggle freezes/unfreezes the entire D3-force simulation
4. Lock All toolbar button with Lock/Unlock icon and amber highlight when locked
5. Export layout as JSON with format version `network-performance-topology-layout-v1`
6. Import layout from JSON with format validation, position validation, NaN/Infinity rejection
7. 41 new tests covering all three features

## OUT OF SCOPE

- Live ExtraHop integration (deferred by contract)
- Saved Views CRUD UI changes beyond position capture/restore
- Multi-user layout sharing

## DEPENDENCIES

- Slice 39: ForceGraph component (D3-force simulation)
- Slice 41: localStorage position persistence, ForceGraphHandle ref

## ROUTES

- `savedViews.create` — tRPC mutation, now accepts `nodePositions` (Zod: `z.record(z.string(), z.object({ x: z.number().finite(), y: z.number().finite() })).nullable()`)
- `savedViews.update` — tRPC mutation, now accepts `nodePositions` (same Zod schema)

## TYPES

- `saved_topology_views.node_positions` — JSON column in Drizzle schema
- `ForceGraphHandle.isLocked` — boolean, current lock state
- `ForceGraphHandle.toggleLock` — method, freeze/unfreeze simulation
- `ForceGraphHandle.getNodePositions` — method, returns `Record<string, { x: number; y: number }>`
- `ForceGraphHandle.applyNodePositions` — method, accepts `Record<string, { x: number; y: number }>`

## FIXTURES

- Existing topology fixtures used for all tests (topology.populated.fixture.json, topology.quiet.fixture.json, etc.)

## TESTS

- 125 source-level `it()` call sites in slice39-force-graph.test.ts (includes Slices 39, 40, 41, 42)
- 41 new tests for Slice 42 specifically:
  - 15 tests for Saved Views position integration (DB schema, helpers, tRPC, ForceGraph handle, Topology wiring)
  - 12 tests for Lock All toggle (state, handle, drag guards, toolbar button)
  - 14 tests for JSON export/import (format version, validation, data-testid, file input)
- Full suite: 38 files, 2602 tests, 0 failures

## SCREENSHOTS

- Populated state: topology page with force-directed graph, Lock All button visible at index 19
- Export menu: dropdown showing "Export layout JSON" and "Import layout JSON" options with download/upload icons

## KNOWN LIMITATIONS

- Import layout only matches nodes by ID — if the topology changes (nodes added/removed), unmatched positions are silently ignored
- Lock All does not persist across page refresh (intentional — localStorage persistence is separate from lock state)
- Saved Views position restore uses a 200ms setTimeout to wait for ForceGraph render — this is a pragmatic delay, not a guaranteed synchronization

## LIVE INTEGRATION STATUS

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase.

## GREP PROOF

```
DB schema: nodePositions column at drizzle/schema.ts:519
DB helpers: nodePositions param at server/db.ts:773,792,811
tRPC router: nodePositions Zod at server/routers.ts:216,242
ForceGraph handle: isLocked/toggleLock/getNodePositions/applyNodePositions at ForceGraph.tsx:190-193,219,296-330
Drag lock guard: isLockedRef.current check at ForceGraph.tsx:568,578,587
Topology toolbar: toggle-lock button at Topology.tsx:1233
Export menu: layout export/import at Topology.tsx:732,739
Format version: network-performance-topology-layout-v1 at Topology.tsx:639,669
```

## TRUTH VERDICT

All three features implemented against fixtures. Saved Views captures and restores node positions via DB column with Zod validation. Lock All toggle freezes simulation and blocks drag. JSON export/import uses versioned format with per-entry NaN/Infinity rejection. 41 new tests passing. Live integration not yet performed.

**Claims:**
- Saved Views position capture: proven against fixtures by DB column, tRPC Zod schema, SavedViewsPanel wiring, handleLoadView restore
- Lock All toggle: proven against fixtures by isLocked state, toggleLock method, drag guard, toolbar button
- JSON export: proven against fixtures by format version, Blob download, data-testid
- JSON import: proven against fixtures by file input, format validation, position validation, applyNodePositions call

**Not proven:**
- Multi-user layout sharing
- Import behavior with topology changes (nodes added/removed between export and import)

**Deferred by contract:**
Live hardware / appliance / packet store / environment access is not part of the current frontend phase.
