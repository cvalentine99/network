/**
 * Topology ForceGraph — Node rendering (regular nodes + super-nodes)
 */

import type { SimNode } from './types';
import { ROLE_DISPLAY } from '../../../../shared/topology-types';
import { ANOMALY_SEVERITY_COLORS } from '../../../../shared/topology-advanced-types';
import type { NodeAnomaly } from '../../../../shared/topology-advanced-types';
import { formatBytes, hexPoints } from './scaling';

interface NodeStyle {
  isSelected: boolean;
  isDimmed: boolean;
  isOnPath: boolean;
  nodeAnom: NodeAnomaly | undefined;
  hasIssue: boolean;
}

interface NodeRendererProps {
  nodes: SimNode[];
  clusterColorMap: Map<string, string>;
  getNodeStyle: (simNode: SimNode) => NodeStyle;
  onNodeClick: (e: React.MouseEvent, simNode: SimNode) => void;
  onNodeMouseEnter: (e: React.MouseEvent, simNode: SimNode) => void;
  onNodeMouseLeave: () => void;
  onNodeContextMenu: (e: React.MouseEvent, simNode: SimNode) => void;
}

export default function NodeRenderer({
  nodes,
  clusterColorMap,
  getNodeStyle,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeContextMenu,
}: NodeRendererProps) {
  return (
    <g data-testid="topology-nodes">
      {nodes.map((simNode) => {
        if (simNode.x == null || simNode.y == null) return null;
        const n = simNode.node;
        const r = simNode.radius;
        const color = simNode.isSuperNode
          ? clusterColorMap.get(simNode.clusterId) || '#94a3b8'
          : ROLE_DISPLAY[n.role].color;
        const clusterColor = clusterColorMap.get(n.clusterId) || '#475569';
        const { isSelected, isDimmed, isOnPath, nodeAnom, hasIssue } = getNodeStyle(simNode);

        return (
          <g
            key={n.id}
            className="force-node"
            transform={`translate(${simNode.x}, ${simNode.y})`}
            onClick={(e) => onNodeClick(e, simNode)}
            onMouseEnter={(e) => onNodeMouseEnter(e, simNode)}
            onMouseMove={(e) => onNodeMouseEnter(e, simNode)}
            onMouseLeave={onNodeMouseLeave}
            onContextMenu={(e) => {
              if (!simNode.isSuperNode) {
                onNodeContextMenu(e, simNode);
              }
            }}
            style={{ cursor: 'pointer' }}
            data-testid={
              simNode.isSuperNode
                ? `topology-supernode-${simNode.clusterId}`
                : `topology-node-${n.id}`
            }
            opacity={isDimmed ? 0.15 : 1}
          >
            {/* Super-node: hexagonal shape */}
            {simNode.isSuperNode ? (
              <>
                {/* Hexagon background */}
                <polygon
                  points={hexPoints(r + 4)}
                  fill={color}
                  fillOpacity={0.2}
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                />
                <polygon points={hexPoints(r - 2)} fill={color} fillOpacity={0.4} />
                {/* Count badge */}
                <text
                  y={1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={Math.max(r * 0.5, 10)}
                  fontWeight={700}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {simNode.childNodeIds?.length ?? '?'}
                </text>
                {/* Label below */}
                <text
                  y={r + 16}
                  textAnchor="middle"
                  fill={color}
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {n.displayName.length > 22
                    ? n.displayName.substring(0, 20) + '…'
                    : n.displayName}
                </text>
                <text
                  y={r + 28}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={8}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  click to expand
                </text>
              </>
            ) : (
              <>
                {/* Anomaly ring */}
                {nodeAnom && (
                  <circle
                    r={r + 10}
                    fill="none"
                    stroke={ANOMALY_SEVERITY_COLORS[nodeAnom.severity]}
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    strokeDasharray="4 2"
                  />
                )}
                {/* Critical path ring */}
                {isOnPath && (
                  <circle
                    r={r + 7}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    strokeOpacity={0.8}
                    filter="url(#path-glow-fg)"
                  />
                )}
                {/* Issue/critical glow */}
                {(n.critical || hasIssue) && !isOnPath && !nodeAnom && (
                  <circle
                    r={r + 8}
                    fill="none"
                    stroke={hasIssue ? '#ef4444' : '#f59e0b'}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    strokeDasharray={hasIssue ? 'none' : '3 3'}
                  />
                )}
                {/* Selection glow */}
                {isSelected && (
                  <circle
                    r={r + 12}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                    filter="url(#node-select-glow)"
                  />
                )}
                {/* Pin indicator ring — dashed violet ring for pinned/dragged nodes */}
                {simNode.fx != null &&
                  simNode.fy != null &&
                  !isOnPath &&
                  !isSelected &&
                  !nodeAnom && (
                    <circle
                      r={r + 5}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      strokeDasharray="3 3"
                      data-testid={`pin-indicator-${n.id}`}
                    />
                  )}
                {/* Node circle */}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={isSelected ? 0.9 : 0.65}
                  stroke={isOnPath ? '#22d3ee' : isSelected ? '#fff' : clusterColor}
                  strokeWidth={isSelected || isOnPath ? 2.5 : 1}
                  strokeOpacity={isSelected || isOnPath ? 1 : 0.35}
                />
                {/* Icon indicator for role (small dot) */}
                {r >= 12 && <circle r={3} cx={0} cy={0} fill="#fff" fillOpacity={0.5} />}
                {/* Label */}
                {(r > 14 || isSelected || isOnPath) && (
                  <text
                    y={r + 14}
                    textAnchor="middle"
                    fill={isOnPath ? '#22d3ee' : isSelected ? '#fff' : '#94a3b8'}
                    fontSize={10}
                    fontWeight={isSelected || isOnPath ? 600 : 400}
                    fontFamily="Inter, system-ui, sans-serif"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.displayName.length > 18
                      ? n.displayName.substring(0, 16) + '…'
                      : n.displayName}
                  </text>
                )}
                {/* Bytes label for selected */}
                {isSelected && (
                  <text
                    y={r + 26}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={8}
                    fontFamily="JetBrains Mono, monospace"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {formatBytes(n.totalBytes)}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}
