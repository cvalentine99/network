/**
 * Slice 35B — Critical Path Highlighting: Path Finding Algorithm
 *
 * Pure BFS shortest-path algorithm on the topology graph.
 * Finds the path between two devices using the edge graph.
 * No side effects, no network calls, no DOM access.
 */

import type {
  TopologyPayload,
  TopologyEdge,
  TopologyProtocol,
} from './topology-types';
import type {
  CriticalPathResult,
  PathNode,
  PathEdge,
} from './topology-advanced-types';

/**
 * Find the shortest path between two nodes in the topology graph using BFS.
 * Edges are treated as undirected (traffic can flow either way).
 *
 * Returns a CriticalPathResult with pathFound=false if no path exists.
 */
export function findCriticalPath(
  payload: TopologyPayload,
  sourceId: number,
  destinationId: number,
): CriticalPathResult {
  const emptyResult: CriticalPathResult = {
    sourceId,
    destinationId,
    path: [],
    edges: [],
    totalBytes: 0,
    totalLatencyMs: null,
    pathFound: false,
    hopCount: 0,
  };

  // Validate that both nodes exist
  const nodeMap = new Map(payload.nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(sourceId) || !nodeMap.has(destinationId)) {
    return emptyResult;
  }

  // Same node — trivial path
  if (sourceId === destinationId) {
    const node = nodeMap.get(sourceId)!;
    return {
      sourceId,
      destinationId,
      path: [{ nodeId: sourceId, displayName: node.displayName, stepIndex: 0 }],
      edges: [],
      totalBytes: 0,
      totalLatencyMs: 0,
      pathFound: true,
      hopCount: 0,
    };
  }

  // Build adjacency list (undirected)
  const adjacency = new Map<number, Array<{ neighborId: number; edge: TopologyEdge }>>();

  for (const edge of payload.edges) {
    // Forward direction
    if (!adjacency.has(edge.sourceId)) adjacency.set(edge.sourceId, []);
    adjacency.get(edge.sourceId)!.push({ neighborId: edge.targetId, edge });

    // Reverse direction (undirected graph)
    if (!adjacency.has(edge.targetId)) adjacency.set(edge.targetId, []);
    adjacency.get(edge.targetId)!.push({ neighborId: edge.sourceId, edge });
  }

  // BFS
  const visited = new Set<number>();
  const parent = new Map<number, { nodeId: number; edge: TopologyEdge }>();
  const queue: number[] = [sourceId];
  visited.add(sourceId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === destinationId) {
      // Reconstruct path
      return reconstructPath(sourceId, destinationId, parent, nodeMap);
    }

    const neighbors = adjacency.get(current) || [];
    for (const { neighborId, edge } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        parent.set(neighborId, { nodeId: current, edge });
        queue.push(neighborId);
      }
    }
  }

  // No path found
  return emptyResult;
}

/**
 * Reconstruct the path from BFS parent map.
 */
function reconstructPath(
  sourceId: number,
  destinationId: number,
  parent: Map<number, { nodeId: number; edge: TopologyEdge }>,
  nodeMap: Map<number, { id: number; displayName: string }>,
): CriticalPathResult {
  const pathNodeIds: number[] = [];
  const pathEdges: TopologyEdge[] = [];

  let current = destinationId;
  while (current !== sourceId) {
    pathNodeIds.unshift(current);
    const p = parent.get(current);
    if (!p) break; // Should not happen if BFS found the path
    pathEdges.unshift(p.edge);
    current = p.nodeId;
  }
  pathNodeIds.unshift(sourceId);

  // Build PathNode array
  const path: PathNode[] = pathNodeIds.map((id, index) => ({
    nodeId: id,
    displayName: nodeMap.get(id)?.displayName || `Device ${id}`,
    stepIndex: index,
  }));

  // Build PathEdge array
  const edges: PathEdge[] = pathEdges.map((e) => ({
    sourceId: e.sourceId,
    targetId: e.targetId,
    protocol: e.protocol,
    bytes: e.bytes,
    latencyMs: e.latencyMs,
  }));

  // Compute totals
  const totalBytes = edges.reduce((sum, e) => sum + e.bytes, 0);
  const allLatenciesKnown = edges.every((e) => e.latencyMs !== null);
  const totalLatencyMs = allLatenciesKnown
    ? edges.reduce((sum, e) => sum + (e.latencyMs || 0), 0)
    : null;

  return {
    sourceId,
    destinationId,
    path,
    edges,
    totalBytes,
    totalLatencyMs,
    pathFound: true,
    hopCount: edges.length,
  };
}

/**
 * Get all node IDs that are on the critical path (for highlighting).
 */
export function getPathNodeIds(result: CriticalPathResult): Set<number> {
  return new Set(result.path.map((p) => p.nodeId));
}

/**
 * Get all edge keys that are on the critical path (for highlighting).
 * Returns keys in "sourceId-targetId" format (both directions).
 */
export function getPathEdgeKeys(result: CriticalPathResult): Set<string> {
  const keys = new Set<string>();
  for (const edge of result.edges) {
    keys.add(`${edge.sourceId}-${edge.targetId}`);
    keys.add(`${edge.targetId}-${edge.sourceId}`);
  }
  return keys;
}
