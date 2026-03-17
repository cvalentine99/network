/**
 * Topology ForceGraph — Cluster background regions (dashed circles + labels)
 */

import React from 'react';
import type { SimNode } from './types';
import type { TopologyPayload } from '../../../../shared/topology-types';
import { CLUSTER_COLORS } from './constants';

interface ClusterBackgroundsProps {
  clusters: TopologyPayload['clusters'];
  nodes: SimNode[];
  collapsedClusters: Set<string>;
}

function ClusterBackgrounds({
  clusters,
  nodes,
  collapsedClusters,
}: ClusterBackgroundsProps) {
  return (
    <>
      {clusters.map((c, i) => {
        // Don't draw cluster background for collapsed clusters
        if (collapsedClusters.has(c.id)) return null;
        const clusterNodes = nodes.filter((sn) => sn.clusterId === c.id && !sn.isSuperNode);
        if (clusterNodes.length === 0) return null;
        const avgX =
          clusterNodes.reduce((s, sn) => s + (sn.x ?? 0), 0) / clusterNodes.length;
        const avgY =
          clusterNodes.reduce((s, sn) => s + (sn.y ?? 0), 0) / clusterNodes.length;
        const maxDist = Math.max(
          ...clusterNodes.map((sn) =>
            Math.sqrt(((sn.x ?? 0) - avgX) ** 2 + ((sn.y ?? 0) - avgY) ** 2)
          ),
          40
        );
        const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
        return (
          <g key={`cluster-bg-${c.id}`}>
            <circle
              cx={avgX}
              cy={avgY}
              r={maxDist + 50}
              fill={color}
              fillOpacity={0.03}
              stroke={color}
              strokeOpacity={0.1}
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <text
              x={avgX}
              y={avgY - maxDist - 30}
              textAnchor="middle"
              fill={color}
              fillOpacity={0.5}
              fontSize={11}
              fontWeight={500}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {c.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

// PERF-C2: Memoize SVG sub-component to prevent re-render on every simulation tick
export default React.memo(ClusterBackgrounds);
