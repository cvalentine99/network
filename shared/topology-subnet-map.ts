/**
 * Slice 35A — Subnet Map View: Aggregation Logic
 *
 * Pure functions that transform a TopologyPayload into SubnetMapPayload.
 * No side effects, no network calls, no DOM access.
 * Used by both BFF (server) and frontend (client).
 */

import type {
  TopologyPayload,
  TopologyNode,
  TopologyEdge,
  TopologyProtocol,
} from './topology-types';
import type {
  SubnetContainer,
  InterSubnetEdge,
  SubnetMapPayload,
} from './topology-advanced-types';

/**
 * Build a SubnetMapPayload from a standard TopologyPayload.
 *
 * Groups nodes into subnet containers, aggregates inter-subnet edges,
 * and separates intra-subnet edges for drill-down.
 */
export function buildSubnetMap(payload: TopologyPayload): SubnetMapPayload {
  // 1. Build node-to-cluster lookup
  const nodeCluster = new Map<number, string>();
  for (const node of payload.nodes) {
    nodeCluster.set(node.id, node.clusterId);
  }

  // 2. Group nodes by cluster
  const clusterNodes = new Map<string, TopologyNode[]>();
  for (const node of payload.nodes) {
    const list = clusterNodes.get(node.clusterId) || [];
    list.push(node);
    clusterNodes.set(node.clusterId, list);
  }

  // 3. Build subnet containers
  const subnets: SubnetContainer[] = payload.clusters.map((cluster) => {
    const nodes = clusterNodes.get(cluster.id) || [];
    return {
      clusterId: cluster.id,
      label: cluster.label,
      cidr: extractCidr(cluster.label),
      groupBy: cluster.groupBy,
      nodes,
      totalBytes: nodes.reduce((sum, n) => sum + n.totalBytes, 0),
      totalDetections: nodes.reduce((sum, n) => sum + n.activeDetections, 0),
      totalAlerts: nodes.reduce((sum, n) => sum + n.activeAlerts, 0),
      collapsed: false,
    };
  });

  // 4. Separate edges into inter-subnet and intra-subnet
  const interEdgeMap = new Map<string, {
    sourceClusterId: string;
    targetClusterId: string;
    totalBytes: number;
    edgeCount: number;
    protocols: Set<TopologyProtocol>;
    hasDetection: boolean;
    deviceEdges: TopologyEdge[];
  }>();

  const intraEdgeMap = new Map<string, TopologyEdge[]>();

  for (const edge of payload.edges) {
    const srcCluster = nodeCluster.get(edge.sourceId);
    const tgtCluster = nodeCluster.get(edge.targetId);

    if (!srcCluster || !tgtCluster) continue;

    if (srcCluster === tgtCluster) {
      // Intra-subnet edge
      const list = intraEdgeMap.get(srcCluster) || [];
      list.push(edge);
      intraEdgeMap.set(srcCluster, list);
    } else {
      // Inter-subnet edge — use sorted key for bidirectional aggregation
      const key = [srcCluster, tgtCluster].sort().join('↔');
      const existing = interEdgeMap.get(key);
      if (existing) {
        existing.totalBytes += edge.bytes;
        existing.edgeCount += 1;
        existing.protocols.add(edge.protocol);
        existing.hasDetection = existing.hasDetection || edge.hasDetection;
        existing.deviceEdges.push(edge);
      } else {
        interEdgeMap.set(key, {
          sourceClusterId: srcCluster,
          targetClusterId: tgtCluster,
          totalBytes: edge.bytes,
          edgeCount: 1,
          protocols: new Set([edge.protocol]),
          hasDetection: edge.hasDetection,
          deviceEdges: [edge],
        });
      }
    }
  }

  // 5. Convert inter-subnet edge map to array
  const interSubnetEdges: InterSubnetEdge[] = Array.from(interEdgeMap.values()).map((e) => ({
    sourceClusterId: e.sourceClusterId,
    targetClusterId: e.targetClusterId,
    totalBytes: e.totalBytes,
    edgeCount: e.edgeCount,
    protocols: Array.from(e.protocols),
    hasDetection: e.hasDetection,
    deviceEdges: e.deviceEdges,
  }));

  // 6. Compute summary
  const totalCrossSubnetBytes = interSubnetEdges.reduce((sum, e) => sum + e.totalBytes, 0);
  let totalIntraSubnetBytes = 0;
  intraEdgeMap.forEach((edges) => {
    totalIntraSubnetBytes += edges.reduce((sum: number, e: TopologyEdge) => sum + e.bytes, 0);
  });

  return {
    subnets,
    interSubnetEdges,
    intraSubnetEdges: intraEdgeMap,
    summary: {
      totalSubnets: subnets.length,
      totalInterSubnetEdges: interSubnetEdges.length,
      totalCrossSubnetBytes,
      totalIntraSubnetBytes,
    },
  };
}

/**
 * Extract CIDR notation from a cluster label if present.
 * Examples:
 *   "Subnet 10.1.20.0/24 (Servers)" → "10.1.20.0/24"
 *   "Infrastructure" → null
 */
export function extractCidr(label: string): string | null {
  const match = label.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2})/);
  return match ? match[1] : null;
}

/**
 * Get the top N inter-subnet edges by bytes.
 */
export function topInterSubnetEdges(
  edges: InterSubnetEdge[],
  n: number,
): InterSubnetEdge[] {
  return [...edges].sort((a, b) => b.totalBytes - a.totalBytes).slice(0, n);
}

/**
 * Format bytes for display in subnet containers.
 */
export function formatSubnetBytes(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}
