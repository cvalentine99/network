# Slice 45 — Screenshots

## Screenshot 1: Topology Constellation View (Populated State)
- **State**: Populated with 15 nodes, 20 edges, 3 clusters
- **Observations**:
  - All nodes visible in three clusters: Infrastructure, Servers, Clients
  - Cluster labels visible: "Subnet 10.1.20.0/24 (Servers)", "Subnet 10.1.30.0/24 (Clients)", "Infrastructure"
  - Nodes are draggable (cursor: pointer on hover)
  - No pin indicators visible yet (no nodes have been dragged/pinned)
  - Toolbar shows all buttons including reset layout (button 18), lock layout (button 19)
  - Edge bundling toggle visible (button 21)
  - Minimap visible in bottom-right corner

## Screenshot 2: After Drag (Pin Indicator)
- Need to verify pin indicator appears after dragging a node
- Pin indicator should be a dashed violet ring (stroke: #8b5cf6, dasharray: 3 3)
- Only visible when node is pinned AND not selected/on-path/has-anomaly

## Notes on Browser Testing Limitations
- Cannot simulate D3 drag events via browser automation (requires mousedown + mousemove + mouseup on SVG elements)
- Pin indicator logic is tested via Vitest (shouldShowPinIndicator tests)
- Drag behavior is tested via source code contract tests (handleDragEnd saves to localStorage)
- Position persistence is tested via serialization/deserialization round-trip tests
