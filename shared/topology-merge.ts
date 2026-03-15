/**
 * Slice 35F — Multi-Appliance Merge: Merge Logic
 *
 * Pure functions that merge topology payloads from multiple ExtraHop appliances
 * into a single unified view. Handles node deduplication by IP address.
 */

import type {
  TopologyPayload,
  TopologyNode,
  TopologyEdge,
  TopologyCluster,
} from './topology-types';
import type {
  ApplianceSource,
  MergedTopologyNode,
  MergedTopologyPayload,
} from './topology-advanced-types';
import { APPLIANCE_COLORS } from './topology-advanced-types';

/**
 * Merge topology payloads from multiple appliances into a single view.
 *
 * Node deduplication: nodes with the same IP address across appliances
 * are merged into a single node with isShared=true. The node with the
 * highest totalBytes is kept as the primary.
 *
 * Edges: all edges are included. Duplicate edges (same source+target
 * across appliances) have their bytes summed.
 */
export function mergeTopologies(
  sources: Array<{
    applianceId: number;
    label: string;
    payload: TopologyPayload;
  }>,
): MergedTopologyPayload {
  if (sources.length === 0) {
    return {
      appliances: [],
      nodes: [],
      edges: [],
      clusters: [],
      applianceNodeCounts: {},
      sharedNodeCount: 0,
      summary: {
        totalAppliances: 0,
        totalNodes: 0,
        totalEdges: 0,
        totalClusters: 0,
        sharedNodes: 0,
        totalBytes: 0,
      },
    };
  }

  // Single appliance — no merge needed
  if (sources.length === 1) {
    const src = sources[0];
    const appliance: ApplianceSource = {
      applianceId: src.applianceId,
      label: src.label,
      color: APPLIANCE_COLORS[0],
    };
    const nodes: MergedTopologyNode[] = src.payload.nodes.map((n) => ({
      ...n,
      applianceId: src.applianceId,
      isShared: false,
    }));
    return {
      appliances: [appliance],
      nodes,
      edges: [...src.payload.edges],
      clusters: [...src.payload.clusters],
      applianceNodeCounts: { [src.applianceId]: nodes.length },
      sharedNodeCount: 0,
      summary: {
        totalAppliances: 1,
        totalNodes: nodes.length,
        totalEdges: src.payload.edges.length,
        totalClusters: src.payload.clusters.length,
        sharedNodes: 0,
        totalBytes: src.payload.summary.totalBytes,
      },
    };
  }

  // Build appliance metadata
  const appliances: ApplianceSource[] = sources.map((src, i) => ({
    applianceId: src.applianceId,
    label: src.label,
    color: APPLIANCE_COLORS[i % APPLIANCE_COLORS.length],
  }));

  // Merge nodes — deduplicate by IP address
  const ipToNodes = new Map<string, Array<{ applianceId: number; node: TopologyNode }>>();
  const noIpNodes: Array<{ applianceId: number; node: TopologyNode }> = [];
  const applianceNodeCounts: Record<number, number> = {};

  for (const src of sources) {
    applianceNodeCounts[src.applianceId] = src.payload.nodes.length;
    for (const node of src.payload.nodes) {
      if (node.ipaddr) {
        const list = ipToNodes.get(node.ipaddr) || [];
        list.push({ applianceId: src.applianceId, node });
        ipToNodes.set(node.ipaddr, list);
      } else {
        noIpNodes.push({ applianceId: src.applianceId, node });
      }
    }
  }

  const mergedNodes: MergedTopologyNode[] = [];
  let sharedNodeCount = 0;

  // Process IP-matched nodes
  type NodeEntry = { applianceId: number; node: TopologyNode };
  ipToNodes.forEach((entries: NodeEntry[], _ip: string) => {
    const isShared = entries.length > 1;
    if (isShared) sharedNodeCount++;

    // Pick the entry with the highest totalBytes as primary
    entries.sort((a: NodeEntry, b: NodeEntry) => b.node.totalBytes - a.node.totalBytes);
    const primary = entries[0];

    mergedNodes.push({
      ...primary.node,
      applianceId: primary.applianceId,
      isShared,
      // Sum bytes from all appliances for shared nodes
      totalBytes: isShared
        ? entries.reduce((sum: number, e: { applianceId: number; node: TopologyNode }) => sum + e.node.totalBytes, 0)
        : primary.node.totalBytes,
      // Max detections/alerts across appliances
      activeDetections: Math.max(...entries.map((e: { applianceId: number; node: TopologyNode }) => e.node.activeDetections)),
      activeAlerts: Math.max(...entries.map((e: { applianceId: number; node: TopologyNode }) => e.node.activeAlerts)),
    });
  });

  // Add non-IP nodes (no deduplication possible)
  for (const entry of noIpNodes) {
    mergedNodes.push({
      ...entry.node,
      applianceId: entry.applianceId,
      isShared: false,
    });
  }

  // Merge edges — sum bytes for duplicate source-target pairs
  const edgeMap = new Map<string, TopologyEdge>();
  for (const src of sources) {
    for (const edge of src.payload.edges) {
      const key = `${edge.sourceId}-${edge.targetId}`;
      const existing = edgeMap.get(key);
      if (existing) {
        edgeMap.set(key, {
          ...existing,
          bytes: existing.bytes + edge.bytes,
          hasDetection: existing.hasDetection || edge.hasDetection,
        });
      } else {
        edgeMap.set(key, { ...edge });
      }
    }
  }
  const edges = Array.from(edgeMap.values());

  // Merge clusters — deduplicate by ID
  const clusterMap = new Map<string, TopologyCluster>();
  for (const src of sources) {
    for (const cluster of src.payload.clusters) {
      if (!clusterMap.has(cluster.id)) {
        clusterMap.set(cluster.id, { ...cluster });
      } else {
        const existing = clusterMap.get(cluster.id)!;
        clusterMap.set(cluster.id, {
          ...existing,
          nodeCount: existing.nodeCount + cluster.nodeCount,
        });
      }
    }
  }
  const clusters = Array.from(clusterMap.values());

  const totalBytes = mergedNodes.reduce((sum, n) => sum + n.totalBytes, 0);

  return {
    appliances,
    nodes: mergedNodes,
    edges,
    clusters,
    applianceNodeCounts,
    sharedNodeCount,
    summary: {
      totalAppliances: sources.length,
      totalNodes: mergedNodes.length,
      totalEdges: edges.length,
      totalClusters: clusters.length,
      sharedNodes: sharedNodeCount,
      totalBytes,
    },
  };
}
