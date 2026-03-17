/**
 * Topology ForceGraph — Edge rendering (individual edges, bundles, critical path arrows)
 */

import { memo } from 'react';
import type { SimNode, SimLink, EdgeBundle, CriticalPathResult } from './types';
import { ANOMALY_SEVERITY_COLORS } from '../../../../shared/topology-advanced-types';
import type { EdgeAnomaly } from '../../../../shared/topology-advanced-types';
import { formatBytes } from './scaling';
import { TOPOLOGY_PERFORMANCE } from '../../../../shared/topology-types';

interface EdgeStyle {
  strokeColor: string;
  strokeOp: number;
  strokeW: number;
  isOnPath: boolean;
  anomaly: EdgeAnomaly | undefined;
}

interface EdgeRendererProps {
  links: SimLink[];
  nodes: SimNode[];
  shouldBundle: boolean;
  bundledEdgeSet: Set<number>;
  edgeBundles: EdgeBundle[];
  criticalPath: CriticalPathResult | null;
  getEdgeStyle: (link: SimLink) => EdgeStyle;
  getPulseDash: (link: SimLink) => { strokeDasharray: string; strokeDashoffset: number } | undefined;
  onEdgeMouseEnter: (e: React.MouseEvent, link: SimLink) => void;
  onBundleMouseEnter: (e: React.MouseEvent, bundle: EdgeBundle) => void;
  onMouseLeave: () => void;
}

function EdgeRenderer({
  links,
  nodes,
  shouldBundle,
  bundledEdgeSet,
  edgeBundles,
  criticalPath,
  getEdgeStyle,
  getPulseDash,
  onEdgeMouseEnter,
  onBundleMouseEnter,
  onMouseLeave,
}: EdgeRendererProps) {
  return (
    <>
      {/* Individual edges */}
      <g data-testid="topology-edges">
        {links.map((link, i) => {
          // Skip edges that are bundled
          if (shouldBundle && bundledEdgeSet.has(i)) return null;
          const src = link.source as SimNode;
          const tgt = link.target as SimNode;
          if (src.x == null || tgt.x == null) return null;

          const { strokeColor, strokeOp, strokeW, isOnPath, anomaly } = getEdgeStyle(link);
          const pulseDash = getPulseDash(link);

          return (
            <g key={`edge-${i}`}>
              {/* Invisible wider hit area for hover */}
              <line
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="transparent"
                strokeWidth={Math.max(strokeW + 8, 12)}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => onEdgeMouseEnter(e, link)}
                onMouseMove={(e) => onEdgeMouseEnter(e, link)}
                onMouseLeave={onMouseLeave}
                data-testid={`edge-hit-${link.edge.sourceId}-${link.edge.targetId}`}
              />
              {/* Visible edge line */}
              <line
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeOpacity={strokeOp}
                filter={isOnPath ? 'url(#path-glow-fg)' : undefined}
                strokeLinecap="round"
                style={{
                  pointerEvents: 'none',
                  ...(pulseDash
                    ? {
                        strokeDasharray: pulseDash.strokeDasharray,
                        strokeDashoffset: pulseDash.strokeDashoffset,
                      }
                    : {}),
                }}
              />
              {/* Anomaly label on edge */}
              {anomaly && (
                <text
                  x={((src.x ?? 0) + (tgt.x ?? 0)) / 2}
                  y={((src.y ?? 0) + (tgt.y ?? 0)) / 2 - 6}
                  textAnchor="middle"
                  fill={ANOMALY_SEVERITY_COLORS[anomaly.severity]}
                  fontSize={8}
                  fontWeight={600}
                  fontFamily="Inter, system-ui, sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {anomaly.direction === 'spike' ? '+' : '-'}
                  {Math.abs(Math.round(anomaly.deviationPercent))}%
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Edge Bundles */}
      {shouldBundle && edgeBundles.length > 0 && (
        <g data-testid="topology-edge-bundles">
          {edgeBundles.map((bundle, i) => {
            const { srcCx, srcCy, tgtCx, tgtCy } = bundle;
            if (!Number.isFinite(srcCx) || !Number.isFinite(tgtCx)) return null;
            const bundleWidth = Math.min(
              Math.max(2, Math.log2(bundle.edgeCount + 1) * 3),
              TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX
            );
            const midX = (srcCx + tgtCx) / 2;
            const midY = (srcCy + tgtCy) / 2;
            const dx = tgtCx - srcCx;
            const dy = tgtCy - srcCy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpX = len > 0 ? (-dy / len) * 20 : 0;
            const perpY = len > 0 ? (dx / len) * 20 : 0;
            const ctrlX = midX + perpX;
            const ctrlY = midY + perpY;

            return (
              <g key={`bundle-${i}`}>
                {/* Invisible hit area */}
                <path
                  d={`M ${srcCx} ${srcCy} Q ${ctrlX} ${ctrlY} ${tgtCx} ${tgtCy}`}
                  stroke="transparent"
                  strokeWidth={Math.max(bundleWidth + 10, 16)}
                  fill="none"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => onBundleMouseEnter(e, bundle)}
                  onMouseMove={(e) => onBundleMouseEnter(e, bundle)}
                  onMouseLeave={onMouseLeave}
                  data-testid={`edge-bundle-${bundle.sourceClusterId}-${bundle.targetClusterId}`}
                />
                {/* Visible bundle path */}
                <path
                  d={`M ${srcCx} ${srcCy} Q ${ctrlX} ${ctrlY} ${tgtCx} ${tgtCy}`}
                  stroke={bundle.hasDetection ? '#ef4444' : '#6366f1'}
                  strokeWidth={bundleWidth}
                  strokeOpacity={0.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${bundleWidth * 2} ${bundleWidth}`}
                  style={{ pointerEvents: 'none' }}
                />
                {/* Bundle count label */}
                <text
                  x={ctrlX}
                  y={ctrlY - 8}
                  textAnchor="middle"
                  fill="#a78bfa"
                  fontSize={9}
                  fontWeight={600}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ pointerEvents: 'none' }}
                >
                  {bundle.edgeCount} edges · {formatBytes(bundle.totalBytes)}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Critical path direction arrows */}
      {criticalPath?.pathFound &&
        criticalPath.path.length > 1 &&
        criticalPath.path.slice(0, -1).map((pn, i) => {
          const nextPn = criticalPath.path[i + 1];
          const srcNode = nodes.find((sn) => sn.id === pn.nodeId);
          const tgtNode = nodes.find((sn) => sn.id === nextPn.nodeId);
          if (!srcNode || !tgtNode || srcNode.x == null || tgtNode.x == null) return null;
          const mx = ((srcNode.x ?? 0) + (tgtNode.x ?? 0)) / 2;
          const my = ((srcNode.y ?? 0) + (tgtNode.y ?? 0)) / 2;
          const angle =
            Math.atan2(
              (tgtNode.y ?? 0) - (srcNode.y ?? 0),
              (tgtNode.x ?? 0) - (srcNode.x ?? 0)
            ) *
            (180 / Math.PI);
          return (
            <g key={`arrow-${i}`} transform={`translate(${mx},${my}) rotate(${angle})`}>
              <polygon points="-6,-5 6,0 -6,5" fill="#22d3ee" fillOpacity={0.9} />
            </g>
          );
        })}
    </>
  );
}

export default memo(EdgeRenderer);
