/**
 * Tier 5 — NOC-Grade Analytical Topology Surface
 *
 * CONTRACT:
 * - Extends Slice 21 Living Topology with 6 NOC-grade features:
 *   35A: Subnet Map View — hierarchical containers with aggregated inter-subnet edges
 *   35B: Critical Path Highlighting — BFS shortest path between source/destination
 *   35C: Anomaly Detection Overlay — flag edges/nodes deviating from baseline
 *   35D: Export Topology — PNG/SVG/JSON/CSV export
 *   35E: Saved Views — persist/recall filter/grouping/zoom configs (DB-backed, no auth)
 *   35F: Multi-Appliance Merge — REMOVED (dead code, audit C4). Shared utility exists but no UI/endpoint wired.
 * - All data from BFF routes — never contacts ExtraHop directly
 * - Shared time window via useTimeWindow()
 * - No Manus OAuth dependency — all features work locally
 *
 * Live integration: deferred by contract.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Network,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Shield,
  Activity,
  Server,
  Monitor,
  Database,
  Globe,
  HardDrive,
  Key,
  Phone,
  Printer as PrinterIcon,
  Scale,
  CircleDot,
  HelpCircle,
  Puzzle,
  Layers,
  Route,
  BarChart3,
  Download,
  Save,
  FolderOpen,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useTopology, type TopologyState } from '@/hooks/useTopology';
import CrossSurfaceNavButton from '@/components/CrossSurfaceNavButton';
import { buildTopologyToBlastRadiusLink } from '../../../shared/cross-surface-nav-types';
import type {
  TopologyNode,
  TopologyEdge,
  TopologyCluster,
  TopologyPayload,
  TopologyDeviceRole,
} from '../../../shared/topology-types';
import { ROLE_DISPLAY, TOPOLOGY_PERFORMANCE } from '../../../shared/topology-types';
import type {
  TopologyViewMode,
  SubnetContainer,
  InterSubnetEdge,
  CriticalPathResult,
  AnomalyOverlayPayload,
  EdgeAnomaly,
  NodeAnomaly,
  AnomalySeverity,
} from '../../../shared/topology-advanced-types';
import { ANOMALY_SEVERITY_COLORS } from '../../../shared/topology-advanced-types';
import { buildSubnetMap, formatSubnetBytes } from '../../../shared/topology-subnet-map';
import { findCriticalPath, getPathNodeIds, getPathEdgeKeys } from '../../../shared/topology-critical-path';
import { buildAnomalyOverlay, getAnomalyEdgeKeys, getAnomalyNodeIds } from '../../../shared/topology-anomaly-detection';
import {
  exportTopologyAsJson,
  exportTopologyAsCsv,
  exportNodesAsCsv,
  exportEdgesAsCsv,
  downloadExport,
  downloadBinaryExport,
} from '../../../shared/topology-export';
// mergeTopologies import removed — dead code with no UI or endpoint (audit C4)
// The shared utility (topology-merge.ts) still exists and passes tests,
// but is not wired to any user-reachable path.

// ─── Icon Map ──────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Server, Monitor, Router: Network, Shield, Scale, Database, Globe, Key, HardDrive,
  Printer: PrinterIcon, Phone, Puzzle, CircleDot, HelpCircle,
};

function RoleIcon({ role, size = 14 }: { role: TopologyDeviceRole; size?: number }) {
  const meta = ROLE_DISPLAY[role];
  const Icon = ICON_MAP[meta.icon] || CircleDot;
  return <Icon size={size} className="flex-shrink-0" />;
}

// ─── Layout Engine (deterministic force-directed approximation) ────
interface NodePos {
  id: number;
  x: number;
  y: number;
  cluster: string;
  node: TopologyNode;
}

function computeLayout(payload: TopologyPayload, width: number, height: number): NodePos[] {
  const { nodes, clusters } = payload;
  if (nodes.length === 0) return [];

  const clusterPositions = new Map<string, { cx: number; cy: number }>();
  const cx = width / 2;
  const cy = height / 2;
  const ringRadius = Math.min(width, height) * 0.32;

  clusters.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / Math.max(clusters.length, 1) - Math.PI / 2;
    clusterPositions.set(c.id, {
      cx: cx + ringRadius * Math.cos(angle),
      cy: cy + ringRadius * Math.sin(angle),
    });
  });

  const clusterNodes = new Map<string, TopologyNode[]>();
  for (const n of nodes) {
    const arr = clusterNodes.get(n.clusterId) || [];
    arr.push(n);
    clusterNodes.set(n.clusterId, arr);
  }

  const positions: NodePos[] = [];
  for (const [clusterId, cnodes] of Array.from(clusterNodes.entries())) {
    const center = clusterPositions.get(clusterId) || { cx, cy };
    const spread = Math.min(80, 20 + cnodes.length * 4);
    cnodes.forEach((n: TopologyNode, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(cnodes.length, 1);
      const r = cnodes.length === 1 ? 0 : spread;
      positions.push({
        id: n.id,
        x: center.cx + r * Math.cos(angle),
        y: center.cy + r * Math.sin(angle),
        cluster: clusterId,
        node: n,
      });
    });
  }

  return positions;
}

// ─── Node/Edge Size Scaling ───────────────────────────────────────
function nodeSize(bytes: number, maxBytes: number): number {
  if (maxBytes === 0) return TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN;
  const ratio = bytes / maxBytes;
  return (
    TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN +
    ratio * (TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX - TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN)
  );
}

function edgeWidth(bytes: number, maxBytes: number): number {
  if (maxBytes === 0) return TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN;
  const ratio = bytes / maxBytes;
  return (
    TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN +
    ratio * (TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX - TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN)
  );
}

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

const CLUSTER_COLORS = [
  '#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#f97316',
  '#6366f1', '#ec4899', '#84cc16', '#14b8a6', '#ef4444',
];

// ─── Severity Badge ───────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const color = ANOMALY_SEVERITY_COLORS[severity];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {severity}
    </span>
  );
}

// ─── Detail Panel ──────────────────────────────────────────────────
function DetailPanel({
  node,
  edges,
  nodeMap,
  onClose,
  nodeAnomaly,
}: {
  node: TopologyNode;
  edges: TopologyEdge[];
  nodeMap: Map<number, TopologyNode>;
  onClose: () => void;
  nodeAnomaly?: NodeAnomaly;
}) {
  const meta = ROLE_DISPLAY[node.role];
  const connections = edges.filter((e) => e.sourceId === node.id || e.targetId === node.id);
  const peers = connections.map((e) => {
    const peerId = e.sourceId === node.id ? e.targetId : e.sourceId;
    return { edge: e, peer: nodeMap.get(peerId) };
  });

  return (
    <div
      data-testid="topology-detail-panel"
      className="absolute right-0 top-0 h-full w-80 bg-[#0d1117] border-l border-white/10 overflow-y-auto z-20"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white truncate flex-1">{node.displayName}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
            data-testid="detail-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Identity */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <RoleIcon role={node.role} size={12} />
            <span style={{ color: meta.color }}>{meta.label}</span>
            {node.critical && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-medium">
                CRITICAL
              </span>
            )}
          </div>
          {node.ipaddr && (
            <div className="text-xs text-zinc-400">
              IP: <span className="text-zinc-300 font-mono">{node.ipaddr}</span>
            </div>
          )}
          {node.macaddr && (
            <div className="text-xs text-zinc-400">
              MAC: <span className="text-zinc-300 font-mono">{node.macaddr}</span>
            </div>
          )}
          <div className="text-xs text-zinc-400">
            Traffic: <span className="text-zinc-300">{formatBytes(node.totalBytes)}</span>
          </div>
        </div>

        {/* Anomaly indicator */}
        {nodeAnomaly && (
          <div className="mb-4 p-2 rounded border" style={{
            borderColor: `${ANOMALY_SEVERITY_COLORS[nodeAnomaly.severity]}40`,
            backgroundColor: `${ANOMALY_SEVERITY_COLORS[nodeAnomaly.severity]}10`,
          }}>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={12} style={{ color: ANOMALY_SEVERITY_COLORS[nodeAnomaly.severity] }} />
              <SeverityBadge severity={nodeAnomaly.severity} />
            </div>
            <p className="text-xs text-zinc-300">{nodeAnomaly.description}</p>
            <div className="flex gap-3 mt-1 text-[10px] text-zinc-500">
              <span>Baseline: {formatBytes(nodeAnomaly.baselineBytes)}</span>
              <span>Current: {formatBytes(nodeAnomaly.currentBytes)}</span>
            </div>
          </div>
        )}

        {/* Issues */}
        {(node.activeDetections > 0 || node.activeAlerts > 0) && (
          <div className="space-y-1 mb-4">
            {node.activeDetections > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle size={10} />
                {node.activeDetections} active detection{node.activeDetections > 1 ? 's' : ''}
              </div>
            )}
            {node.activeAlerts > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Activity size={10} />
                {node.activeAlerts} active alert{node.activeAlerts > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Connections */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">
            Connections ({connections.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {peers.map(({ edge, peer }, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/[0.02] hover:bg-white/[0.05]"
              >
                <span className="text-zinc-300 truncate flex-1">
                  {peer?.displayName || `Device ${edge.sourceId === node.id ? edge.targetId : edge.sourceId}`}
                </span>
                <span className="text-zinc-500 ml-2">{edge.protocol}</span>
                <span className="text-zinc-500 ml-2">{formatBytes(edge.bytes)}</span>
              </div>
            ))}
            {connections.length === 0 && (
              <p className="text-xs text-zinc-600 italic">No connections</p>
            )}
          </div>
        </div>

        {/* Cross-surface nav */}
        <div className="pt-2 border-t border-white/[0.06]">
          <CrossSurfaceNavButton
            link={buildTopologyToBlastRadiusLink(node.id, node.displayName)}
            compact
          />
        </div>
      </div>
    </div>
  );
}

// ─── Cluster Legend ────────────────────────────────────────────────
function ClusterLegend({ clusters }: { clusters: TopologyCluster[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[10px]" data-testid="topology-cluster-legend">
      {clusters.map((c, i) => (
        <div key={c.id} className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
          />
          <span className="text-zinc-400">{c.label}</span>
          <span className="text-zinc-600">({c.nodeCount})</span>
        </div>
      ))}
    </div>
  );
}

// ─── Role Legend ───────────────────────────────────────────────────
function RoleLegend({ roles }: { roles: TopologyDeviceRole[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[10px]" data-testid="topology-role-legend">
      {roles.map((role) => {
        const meta = ROLE_DISPLAY[role];
        return (
          <div key={role} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
            <span className="text-zinc-400">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Constellation View (SVG) ─────────────────────────────────────
function ConstellationView({
  payload,
  selectedNodeId,
  onSelectNode,
  searchTerm,
  zoom,
  criticalPath,
  anomalyOverlay,
  showAnomalyOverlay,
  svgRef,
}: {
  payload: TopologyPayload;
  selectedNodeId: number | null;
  onSelectNode: (id: number | null) => void;
  searchTerm: string;
  zoom: number;
  criticalPath: CriticalPathResult | null;
  anomalyOverlay: AnomalyOverlayPayload | null;
  showAnomalyOverlay: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}) {
  const WIDTH = 900;
  const HEIGHT = 600;

  const positions = useMemo(() => computeLayout(payload, WIDTH, HEIGHT), [payload]);
  const posMap = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const maxNodeBytes = useMemo(
    () => Math.max(...payload.nodes.map((n) => n.totalBytes), 1),
    [payload]
  );
  const maxEdgeBytes = useMemo(
    () => Math.max(...payload.edges.map((e) => e.bytes), 1),
    [payload]
  );

  const matchingIds = useMemo(() => {
    if (!searchTerm) return null;
    const lower = searchTerm.toLowerCase();
    return new Set(
      payload.nodes
        .filter(
          (n) =>
            n.displayName.toLowerCase().includes(lower) ||
            (n.ipaddr && n.ipaddr.includes(lower))
        )
        .map((n) => n.id)
    );
  }, [payload.nodes, searchTerm]);

  // Critical path highlighting sets
  const pathNodeIds = useMemo(
    () => (criticalPath?.pathFound ? getPathNodeIds(criticalPath) : new Set<number>()),
    [criticalPath]
  );
  const pathEdgeKeys = useMemo(
    () => (criticalPath?.pathFound ? getPathEdgeKeys(criticalPath) : new Set<string>()),
    [criticalPath]
  );

  // Anomaly highlighting maps
  const anomalyEdgeMap = useMemo(
    () => (showAnomalyOverlay && anomalyOverlay ? getAnomalyEdgeKeys(anomalyOverlay.edgeAnomalies) : new Map<string, EdgeAnomaly>()),
    [anomalyOverlay, showAnomalyOverlay]
  );
  const anomalyNodeMap = useMemo(
    () => (showAnomalyOverlay && anomalyOverlay ? getAnomalyNodeIds(anomalyOverlay.nodeAnomalies) : new Map<number, NodeAnomaly>()),
    [anomalyOverlay, showAnomalyOverlay]
  );

  const clusterColorMap = useMemo(() => {
    const m = new Map<string, string>();
    payload.clusters.forEach((c, i) => m.set(c.id, CLUSTER_COLORS[i % CLUSTER_COLORS.length]));
    return m;
  }, [payload.clusters]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-full"
      data-testid="topology-svg"
      style={{ minHeight: 400 }}
    >
      <defs>
        <radialGradient id="node-glow">
          <stop offset="0%" stopColor="rgba(34,211,238,0.3)" />
          <stop offset="100%" stopColor="rgba(34,211,238,0)" />
        </radialGradient>
        {/* Critical path glow filter */}
        <filter id="path-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Cluster background circles */}
      {payload.clusters.map((c, i) => {
        const clusterPositions2 = positions.filter((p) => p.cluster === c.id);
        if (clusterPositions2.length === 0) return null;
        const avgX = clusterPositions2.reduce((s, p) => s + p.x, 0) / clusterPositions2.length;
        const avgY = clusterPositions2.reduce((s, p) => s + p.y, 0) / clusterPositions2.length;
        const maxDist = Math.max(
          ...clusterPositions2.map((p) => Math.sqrt((p.x - avgX) ** 2 + (p.y - avgY) ** 2)),
          30
        );
        return (
          <circle
            key={c.id}
            cx={avgX}
            cy={avgY}
            r={maxDist + 30}
            fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
            fillOpacity={0.04}
            stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
            strokeOpacity={0.12}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        );
      })}

      {/* Cluster labels */}
      {payload.clusters.map((c, i) => {
        const clusterPositions2 = positions.filter((p) => p.cluster === c.id);
        if (clusterPositions2.length === 0) return null;
        const avgX = clusterPositions2.reduce((s, p) => s + p.x, 0) / clusterPositions2.length;
        const minY = Math.min(...clusterPositions2.map((p) => p.y));
        return (
          <text
            key={`label-${c.id}`}
            x={avgX}
            y={minY - 40}
            textAnchor="middle"
            fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
            fillOpacity={0.5}
            fontSize={10}
            fontWeight={500}
          >
            {c.label}
          </text>
        );
      })}

      {/* Edges */}
      <g data-testid="topology-edges">
        {payload.edges.map((e, i) => {
          const src = posMap.get(e.sourceId);
          const tgt = posMap.get(e.targetId);
          if (!src || !tgt) return null;
          const w = edgeWidth(e.bytes, maxEdgeBytes);
          const isHighlighted =
            selectedNodeId !== null &&
            (e.sourceId === selectedNodeId || e.targetId === selectedNodeId);
          const isDimmed = selectedNodeId !== null && !isHighlighted;

          // Critical path edge
          const edgeKey = `${e.sourceId}-${e.targetId}`;
          const isOnPath = pathEdgeKeys.has(edgeKey);

          // Anomaly edge
          const anomaly = anomalyEdgeMap.get(edgeKey);

          let strokeColor = e.hasDetection ? '#ef4444' : '#475569';
          let strokeOp = isDimmed ? 0.08 : isHighlighted ? 0.7 : 0.25;
          let strokeW = w;

          if (isOnPath) {
            strokeColor = '#22d3ee';
            strokeOp = 0.9;
            strokeW = Math.max(w, 3);
          }
          if (anomaly) {
            strokeColor = ANOMALY_SEVERITY_COLORS[anomaly.severity];
            strokeOp = 0.8;
            strokeW = Math.max(w, 2.5);
          }

          return (
            <g key={`edge-${i}`}>
              <line
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeOpacity={strokeOp}
                filter={isOnPath ? 'url(#path-glow)' : undefined}
              />
              {/* Anomaly label on edge */}
              {anomaly && (
                <text
                  x={(src.x + tgt.x) / 2}
                  y={(src.y + tgt.y) / 2 - 6}
                  textAnchor="middle"
                  fill={ANOMALY_SEVERITY_COLORS[anomaly.severity]}
                  fontSize={8}
                  fontWeight={600}
                >
                  {anomaly.direction === 'spike' ? '+' : '-'}{Math.abs(Math.round(anomaly.deviationPercent))}%
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Critical path direction arrows */}
      {criticalPath?.pathFound && criticalPath.path.length > 1 && (
        <g data-testid="critical-path-arrows">
          {criticalPath.path.slice(0, -1).map((pn, i) => {
            const nextPn = criticalPath.path[i + 1];
            const src = posMap.get(pn.nodeId);
            const tgt = posMap.get(nextPn.nodeId);
            if (!src || !tgt) return null;
            const mx = (src.x + tgt.x) / 2;
            const my = (src.y + tgt.y) / 2;
            const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x) * (180 / Math.PI);
            return (
              <g key={`arrow-${i}`} transform={`translate(${mx},${my}) rotate(${angle})`}>
                <polygon
                  points="-5,-4 5,0 -5,4"
                  fill="#22d3ee"
                  fillOpacity={0.9}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* Nodes */}
      <g data-testid="topology-nodes">
        {positions.map((pos) => {
          const n = pos.node;
          const size = nodeSize(n.totalBytes, maxNodeBytes);
          const color = ROLE_DISPLAY[n.role].color;
          const clusterColor = clusterColorMap.get(n.clusterId) || '#475569';
          const isSelected = selectedNodeId === n.id;
          const isDimmed =
            (selectedNodeId !== null && !isSelected &&
              !payload.edges.some(
                (e) =>
                  (e.sourceId === selectedNodeId && e.targetId === n.id) ||
                  (e.targetId === selectedNodeId && e.sourceId === n.id)
              )) ||
            (matchingIds !== null && !matchingIds.has(n.id));
          const hasIssue = n.activeDetections > 0 || n.activeAlerts > 0;

          // Critical path node
          const isOnPath = pathNodeIds.has(n.id);

          // Anomaly node
          const nodeAnom = anomalyNodeMap.get(n.id);

          return (
            <g
              key={n.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => onSelectNode(isSelected ? null : n.id)}
              className="cursor-pointer"
              data-testid={`topology-node-${n.id}`}
              opacity={isDimmed ? 0.2 : 1}
            >
              {/* Anomaly ring */}
              {nodeAnom && (
                <circle
                  r={size + 8}
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
                  r={size + 5}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  strokeOpacity={0.8}
                  filter="url(#path-glow)"
                />
              )}
              {/* Glow for critical/issue nodes */}
              {(n.critical || hasIssue) && !isOnPath && !nodeAnom && (
                <circle
                  r={size + 6}
                  fill="none"
                  stroke={hasIssue ? '#ef4444' : '#f59e0b'}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                  strokeDasharray={hasIssue ? 'none' : '3 3'}
                />
              )}
              {/* Node circle */}
              <circle
                r={size / 2}
                fill={color}
                fillOpacity={isSelected ? 0.9 : 0.6}
                stroke={isOnPath ? '#22d3ee' : isSelected ? '#fff' : clusterColor}
                strokeWidth={isSelected || isOnPath ? 2 : 1}
                strokeOpacity={isSelected || isOnPath ? 1 : 0.4}
              />
              {/* Label */}
              {(size > 16 || isSelected || isOnPath) && (
                <text
                  y={size / 2 + 12}
                  textAnchor="middle"
                  fill={isOnPath ? '#22d3ee' : '#94a3b8'}
                  fontSize={9}
                  fontWeight={isSelected || isOnPath ? 600 : 400}
                >
                  {n.displayName.length > 16
                    ? n.displayName.substring(0, 14) + '...'
                    : n.displayName}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ─── Subnet Map View ──────────────────────────────────────────────
function SubnetMapView({
  payload,
  collapsedSubnets,
  onToggleCollapse,
}: {
  payload: TopologyPayload;
  collapsedSubnets: Set<string>;
  onToggleCollapse: (clusterId: string) => void;
}) {
  const subnetMap = useMemo(() => buildSubnetMap(payload), [payload]);

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="subnet-map-view">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-zinc-400 pb-2 border-b border-white/[0.06]">
        <span><span className="text-white font-medium">{subnetMap.summary.totalSubnets}</span> subnets</span>
        <span><span className="text-white font-medium">{subnetMap.summary.totalInterSubnetEdges}</span> inter-subnet links</span>
        <span>Cross-subnet: {formatSubnetBytes(subnetMap.summary.totalCrossSubnetBytes)}</span>
        <span>Intra-subnet: {formatSubnetBytes(subnetMap.summary.totalIntraSubnetBytes)}</span>
      </div>

      {/* Subnet containers */}
      <div className="grid gap-3">
        {subnetMap.subnets.map((subnet, i) => {
          const isCollapsed = collapsedSubnets.has(subnet.clusterId);
          const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

          return (
            <div
              key={subnet.clusterId}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: `${color}30` }}
              data-testid={`subnet-container-${subnet.clusterId}`}
            >
              {/* Subnet header */}
              <button
                onClick={() => onToggleCollapse(subnet.clusterId)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
                style={{ backgroundColor: `${color}08` }}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight size={14} style={{ color }} /> : <ChevronDown size={14} style={{ color }} />}
                  <Layers size={14} style={{ color }} />
                  <span className="text-sm font-medium text-white">{subnet.label}</span>
                  {subnet.cidr && (
                    <span className="text-[10px] font-mono text-zinc-500">{subnet.cidr}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                  <span>{subnet.nodes.length} devices</span>
                  <span>{formatSubnetBytes(subnet.totalBytes)}</span>
                  {subnet.totalDetections > 0 && (
                    <span className="text-red-400">{subnet.totalDetections} detections</span>
                  )}
                  {subnet.totalAlerts > 0 && (
                    <span className="text-amber-400">{subnet.totalAlerts} alerts</span>
                  )}
                </div>
              </button>

              {/* Expanded: show devices */}
              {!isCollapsed && (
                <div className="px-3 py-2 space-y-1 border-t" style={{ borderColor: `${color}15` }}>
                  {subnet.nodes.map((node) => {
                    const meta = ROLE_DISPLAY[node.role];
                    return (
                      <div
                        key={node.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <RoleIcon role={node.role} size={10} />
                          <span className="text-zinc-300 truncate">{node.displayName}</span>
                          {node.ipaddr && (
                            <span className="text-zinc-600 font-mono text-[10px]">{node.ipaddr}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span>{formatBytes(node.totalBytes)}</span>
                          {node.activeDetections > 0 && (
                            <AlertTriangle size={10} className="text-red-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inter-subnet edges */}
      {subnetMap.interSubnetEdges.length > 0 && (
        <div className="pt-3 border-t border-white/[0.06]">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Inter-Subnet Traffic</h4>
          <div className="space-y-1">
            {subnetMap.interSubnetEdges
              .sort((a, b) => b.totalBytes - a.totalBytes)
              .map((edge, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-zinc-300 truncate">{edge.sourceClusterId}</span>
                    <ArrowRight size={10} className="text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">{edge.targetClusterId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 flex-shrink-0">
                    <span>{edge.edgeCount} links</span>
                    <span>{formatSubnetBytes(edge.totalBytes)}</span>
                    <span className="text-[10px]">{edge.protocols.join(', ')}</span>
                    {edge.hasDetection && <AlertTriangle size={10} className="text-red-400" />}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Critical Path Panel ──────────────────────────────────────────
function CriticalPathPanel({
  nodes,
  sourceId,
  destinationId,
  onSetSource,
  onSetDestination,
  result,
}: {
  nodes: TopologyNode[];
  sourceId: number | null;
  destinationId: number | null;
  onSetSource: (id: number | null) => void;
  onSetDestination: (id: number | null) => void;
  result: CriticalPathResult | null;
}) {
  return (
    <div className="p-3 space-y-3" data-testid="critical-path-panel">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Source</label>
          <select
            value={sourceId ?? ''}
            onChange={(e) => onSetSource(e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 focus:outline-none focus:border-cyan-500/30"
            data-testid="path-source-select"
          >
            <option value="">Select source...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Destination</label>
          <select
            value={destinationId ?? ''}
            onChange={(e) => onSetDestination(e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 focus:outline-none focus:border-cyan-500/30"
            data-testid="path-dest-select"
          >
            <option value="">Select destination...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {result && (
        <div className="pt-2 border-t border-white/[0.06]">
          {result.pathFound ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span><span className="text-cyan-400 font-medium">{result.hopCount}</span> hops</span>
                <span>{formatBytes(result.totalBytes)} total</span>
                {result.totalLatencyMs !== null && (
                  <span>{result.totalLatencyMs.toFixed(1)} ms latency</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {result.path.map((pn, i) => (
                  <div key={pn.nodeId} className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-medium">
                      {pn.displayName}
                    </span>
                    {i < result.path.length - 1 && (
                      <ArrowRight size={10} className="text-cyan-500/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">No path found between selected devices</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Anomaly Summary Panel ────────────────────────────────────────
function AnomalySummaryPanel({ overlay }: { overlay: AnomalyOverlayPayload }) {
  const { summary } = overlay;
  const total = summary.totalEdgeAnomalies + summary.totalNodeAnomalies;

  return (
    <div className="p-3 space-y-2" data-testid="anomaly-summary-panel">
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span><span className="text-white font-medium">{total}</span> anomalies detected</span>
        <span>Threshold: {overlay.deviationThreshold}%</span>
      </div>
      <div className="flex gap-2">
        {summary.criticalCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.critical}20`, color: ANOMALY_SEVERITY_COLORS.critical }}>
            {summary.criticalCount} critical
          </span>
        )}
        {summary.highCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.high}20`, color: ANOMALY_SEVERITY_COLORS.high }}>
            {summary.highCount} high
          </span>
        )}
        {summary.mediumCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.medium}20`, color: ANOMALY_SEVERITY_COLORS.medium }}>
            {summary.mediumCount} medium
          </span>
        )}
        {summary.lowCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.low}20`, color: ANOMALY_SEVERITY_COLORS.low }}>
            {summary.lowCount} low
          </span>
        )}
      </div>
      {/* Top anomalies list */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {[...overlay.edgeAnomalies, ...overlay.nodeAnomalies]
          .sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
          .slice(0, 5)
          .map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
              <SeverityBadge severity={a.severity} />
              <span className="text-zinc-400 truncate">{a.description}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Export Menu ───────────────────────────────────────────────────
function ExportMenu({
  payload,
  svgRef,
  onClose,
}: {
  payload: TopologyPayload;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onClose: () => void;
}) {
  const handleExport = useCallback((format: 'json' | 'csv' | 'nodes-csv' | 'edges-csv' | 'svg' | 'png') => {
    try {
      if (format === 'json') {
        downloadExport(exportTopologyAsJson(payload));
      } else if (format === 'csv') {
        downloadExport(exportTopologyAsCsv(payload));
      } else if (format === 'nodes-csv') {
        downloadExport(exportNodesAsCsv(payload.nodes));
      } else if (format === 'edges-csv') {
        downloadExport(exportEdgesAsCsv(payload.edges));
      } else if (format === 'svg') {
        const svgEl = svgRef.current;
        if (!svgEl) { toast.error('SVG element not found'); return; }
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const ts = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date()).replace(/[: ]/g, '-');
        downloadBinaryExport(blob, `topology-${ts}.svg`);
      } else if (format === 'png') {
        const svgEl = svgRef.current;
        if (!svgEl) { toast.error('SVG element not found'); return; }
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const canvas = document.createElement('canvas');
        canvas.width = 1800;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        if (!ctx) { toast.error('Canvas not supported'); return; }
        const pngTs = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date()).replace(/[: ]/g, '-');
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = '#0d1117';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) downloadBinaryExport(blob, `topology-${pngTs}.png`);
          }, 'image/png');
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
      onClose();
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  }, [payload, svgRef, onClose]);

  return (
    <div
      className="absolute right-0 top-full mt-1 w-48 bg-[#161b22] border border-white/[0.08] rounded-lg shadow-xl z-30 py-1"
      data-testid="export-menu"
    >
      <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as JSON
      </button>
      <button onClick={() => handleExport('csv')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as CSV (full)
      </button>
      <button onClick={() => handleExport('nodes-csv')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export nodes CSV
      </button>
      <button onClick={() => handleExport('edges-csv')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export edges CSV
      </button>
      <div className="border-t border-white/[0.06] my-1" />
      <button onClick={() => handleExport('svg')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as SVG
      </button>
      <button onClick={() => handleExport('png')} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]">
        Export as PNG
      </button>
    </div>
  );
}

// ─── Saved Views Panel ────────────────────────────────────────────
function SavedViewsPanel({
  onLoadView,
  currentState,
}: {
  onLoadView: (view: any) => void;
  currentState: {
    viewMode: string;
    zoom: number;
    searchTerm: string;
    anomalyOverlayEnabled: boolean;
    criticalPathSource: number | null;
    criticalPathDestination: number | null;
  };
}) {
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const listQuery = trpc.savedViews.list.useQuery();
  const createMutation = trpc.savedViews.create.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setSaveName('');
      setShowSaveInput(false);
      toast.success('View saved');
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  const deleteMutation = trpc.savedViews.delete.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      toast.success('View deleted');
    },
  });

  const handleSave = () => {
    if (!saveName.trim()) return;
    createMutation.mutate({
      name: saveName.trim(),
      viewMode: currentState.viewMode,
      zoom: currentState.zoom,
      searchTerm: currentState.searchTerm,
      anomalyOverlayEnabled: currentState.anomalyOverlayEnabled,
      criticalPathSource: currentState.criticalPathSource,
      criticalPathDestination: currentState.criticalPathDestination,
      collapsedSubnets: [],
      roleFilters: [],
      protocolFilters: [],
      anomalyThreshold: 50,
      panX: 0,
      panY: 0,
    });
  };

  return (
    <div className="p-3 space-y-3" data-testid="saved-views-panel">
      {/* Save current view */}
      {showSaveInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="View name..."
            className="flex-1 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/30"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim() || createMutation.isPending}
            className="px-2 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {createMutation.isPending ? '...' : 'Save'}
          </button>
          <button
            onClick={() => { setShowSaveInput(false); setSaveName(''); }}
            className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <Save size={12} /> Save current view
        </button>
      )}

      {/* Saved views list */}
      <div className="space-y-1">
        {listQuery.isLoading && (
          <p className="text-xs text-zinc-600">Loading saved views...</p>
        )}
        {listQuery.data && listQuery.data.length === 0 && (
          <p className="text-xs text-zinc-600 italic">No saved views yet</p>
        )}
        {listQuery.data?.map((view: any) => (
          <div
            key={view.id}
            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.04] group"
          >
            <button
              onClick={() => onLoadView(view)}
              className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white flex-1 min-w-0 text-left"
            >
              <FolderOpen size={10} className="text-zinc-500 flex-shrink-0" />
              <span className="truncate">{view.name}</span>
            </button>
            <button
              onClick={() => deleteMutation.mutate({ id: view.id })}
              className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Summary Bar ──────────────────────────────────────────────────
function SummaryBar({ payload }: { payload: TopologyPayload }) {
  const s = payload.summary;
  return (
    <div
      className="flex items-center gap-4 text-xs text-zinc-400"
      data-testid="topology-summary"
    >
      <span>
        <span className="text-white font-medium">{s.totalNodes}</span> nodes
      </span>
      <span>
        <span className="text-white font-medium">{s.totalEdges}</span> edges
      </span>
      <span>
        <span className="text-white font-medium">{s.totalClusters}</span> clusters
      </span>
      {s.nodesWithDetections > 0 && (
        <span className="text-red-400">
          <AlertTriangle size={10} className="inline mr-1" />
          {s.nodesWithDetections} with detections
        </span>
      )}
      {s.nodesWithAlerts > 0 && (
        <span className="text-amber-400">
          <Activity size={10} className="inline mr-1" />
          {s.nodesWithAlerts} with alerts
        </span>
      )}
      <span>{formatBytes(s.totalBytes)} total</span>
      {s.truncated && (
        <span className="text-amber-400 font-medium">
          Truncated to {s.maxNodes} nodes
        </span>
      )}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────
export default function Topology() {
  const { state, refetch } = useTopology();
  const svgRef = useRef<SVGSVGElement | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<TopologyViewMode>('constellation');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1);

  // Feature toggles
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showAnomalyOverlay, setShowAnomalyOverlay] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSavedViews, setShowSavedViews] = useState(false);

  // Critical path state
  const [pathSourceId, setPathSourceId] = useState<number | null>(null);
  const [pathDestId, setPathDestId] = useState<number | null>(null);

  // Subnet map state
  const [collapsedSubnets, setCollapsedSubnets] = useState<Set<string>>(new Set());

  // Anomaly baseline state
  const [baselinePayload, setBaselinePayload] = useState<TopologyPayload | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);

  // Clear selection when state changes
  useEffect(() => {
    setSelectedNodeId(null);
  }, [state]);

  // Fetch baseline when anomaly overlay is enabled
  useEffect(() => {
    if (!showAnomalyOverlay || baselinePayload) return;
    setBaselineLoading(true);
    fetch('/api/bff/topology/baseline')
      .then((res) => res.json())
      .then((json) => {
        if (json.payload) {
          setBaselinePayload(json.payload);
        }
      })
      .catch(() => toast.error('Failed to load baseline data'))
      .finally(() => setBaselineLoading(false));
  }, [showAnomalyOverlay, baselinePayload]);

  const nodeMap = useMemo(() => {
    if (state.kind !== 'populated' && state.kind !== 'quiet') return new Map<number, TopologyNode>();
    return new Map(state.payload.nodes.map((n) => [n.id, n]));
  }, [state]);

  const activeRoles = useMemo(() => {
    if (state.kind !== 'populated') return [];
    const roles = new Set(state.payload.nodes.map((n) => n.role));
    return Array.from(roles) as TopologyDeviceRole[];
  }, [state]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;

  // Compute critical path
  const criticalPath = useMemo(() => {
    if (!showCriticalPath || !pathSourceId || !pathDestId) return null;
    if (state.kind !== 'populated') return null;
    return findCriticalPath(state.payload, pathSourceId, pathDestId);
  }, [showCriticalPath, pathSourceId, pathDestId, state]);

  // Compute anomaly overlay
  const anomalyOverlay = useMemo(() => {
    if (!showAnomalyOverlay || !baselinePayload) return null;
    if (state.kind !== 'populated') return null;
    return buildAnomalyOverlay(state.payload, baselinePayload);
  }, [showAnomalyOverlay, baselinePayload, state]);

  // Get node anomaly for detail panel
  const selectedNodeAnomaly = useMemo(() => {
    if (!anomalyOverlay || !selectedNodeId) return undefined;
    return anomalyOverlay.nodeAnomalies.find((a) => a.nodeId === selectedNodeId);
  }, [anomalyOverlay, selectedNodeId]);

  // Load saved view
  const handleLoadView = useCallback((view: any) => {
    setViewMode(view.viewMode || 'constellation');
    setZoom(view.zoom || 1);
    setSearchTerm(view.searchTerm || '');
    setShowAnomalyOverlay(view.anomalyOverlayEnabled || false);
    setPathSourceId(view.criticalPathSource || null);
    setPathDestId(view.criticalPathDestination || null);
    if (view.criticalPathSource && view.criticalPathDestination) {
      setShowCriticalPath(true);
    }
    if (view.collapsedSubnets) {
      setCollapsedSubnets(new Set(JSON.parse(view.collapsedSubnets || '[]')));
    }
    setShowSavedViews(false);
    toast.success(`Loaded view: ${view.name}`);
  }, []);

  const toggleSubnetCollapse = useCallback((clusterId: string) => {
    setCollapsedSubnets((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  }, []);

  // ─── Loading ────────────────────────────────────────────────────
  if (state.kind === 'idle' || state.kind === 'loading') {
    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4"
        data-testid="topology-loading"
      >
        <Loader2 size={32} className="text-cyan-400 animate-spin" />
        <p className="text-sm text-zinc-400">Loading topology...</p>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────
  if (state.kind === 'error') {
    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4"
        data-testid="topology-error"
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <p className="text-sm text-zinc-300 font-medium">Topology Unavailable</p>
        <p className="text-xs text-zinc-500 max-w-md text-center">{state.message}</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-300"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  // ─── Malformed ──────────────────────────────────────────────────
  if (state.kind === 'malformed') {
    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4"
        data-testid="topology-malformed"
      >
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <AlertTriangle size={24} className="text-amber-400" />
        </div>
        <p className="text-sm text-zinc-300 font-medium">Malformed Topology Data</p>
        <p className="text-xs text-zinc-500">The response did not match the expected schema.</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-300"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  // ─── Quiet ──────────────────────────────────────────────────────
  if (state.kind === 'quiet') {
    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4"
        data-testid="topology-quiet"
      >
        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
          <Network size={24} className="text-zinc-500" />
        </div>
        <p className="text-sm text-zinc-300 font-medium">No Devices Observed</p>
        <p className="text-xs text-zinc-500">No network activity detected in the current time window.</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.06] hover:bg-white/[0.1] text-xs text-zinc-300"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
    );
  }

  // ─── Populated ──────────────────────────────────────────────────
  const { payload } = state;

  return (
    <div className="flex flex-col h-full" data-testid="topology-populated">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Network size={18} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Living Topology</h2>
          {/* View mode toggle */}
          <div className="flex items-center bg-white/[0.04] rounded p-0.5 ml-2">
            <button
              onClick={() => setViewMode('constellation')}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                viewMode === 'constellation'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              data-testid="view-mode-constellation"
            >
              Constellation
            </button>
            <button
              onClick={() => setViewMode('subnet-map')}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                viewMode === 'subnet-map'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              data-testid="view-mode-subnet"
            >
              Subnet Map
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 placeholder:text-zinc-600 w-40 focus:outline-none focus:border-cyan-500/30"
              data-testid="topology-search"
            />
          </div>

          {/* Feature toggles */}
          <button
            onClick={() => { setShowCriticalPath(!showCriticalPath); setShowSavedViews(false); setShowExportMenu(false); }}
            className={`p-1.5 rounded transition-colors ${showCriticalPath ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/[0.06] text-zinc-400'}`}
            title="Critical Path"
            data-testid="toggle-critical-path"
          >
            <Route size={14} />
          </button>
          <button
            onClick={() => { setShowAnomalyOverlay(!showAnomalyOverlay); setShowSavedViews(false); setShowExportMenu(false); }}
            className={`p-1.5 rounded transition-colors ${showAnomalyOverlay ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-white/[0.06] text-zinc-400'}`}
            title="Anomaly Detection"
            data-testid="toggle-anomaly-overlay"
          >
            <BarChart3 size={14} />
          </button>

          {/* Zoom controls */}
          {viewMode === 'constellation' && (
            <>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.2, 0.4))}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Reset zoom"
              >
                <Maximize2 size={14} />
              </button>
            </>
          )}

          {/* Export */}
          <div className="relative">
            <button
              onClick={() => { setShowExportMenu(!showExportMenu); setShowSavedViews(false); }}
              className={`p-1.5 rounded transition-colors ${showExportMenu ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.06] text-zinc-400'}`}
              title="Export"
              data-testid="toggle-export"
            >
              <Download size={14} />
            </button>
            {showExportMenu && (
              <ExportMenu payload={payload} svgRef={svgRef} onClose={() => setShowExportMenu(false)} />
            )}
          </div>

          {/* Saved views */}
          <button
            onClick={() => { setShowSavedViews(!showSavedViews); setShowExportMenu(false); }}
            className={`p-1.5 rounded transition-colors ${showSavedViews ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.06] text-zinc-400'}`}
            title="Saved Views"
            data-testid="toggle-saved-views"
          >
            <FolderOpen size={14} />
          </button>

          <button
            onClick={refetch}
            className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-white/[0.04]">
        <SummaryBar payload={payload} />
      </div>

      {/* Synthetic edges disclaimer (audit C2) */}
      {payload.edgesAreSynthetic && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20"
          data-testid="synthetic-edges-disclaimer"
        >
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300">
            <strong>Edges are inferred, not observed.</strong> Connections shown are heuristically derived from per-device byte totals.
            Real protocol, latency, and connection data requires ExtraHop Activity Map API integration (not yet implemented).
          </span>
        </div>
      )}

      {/* Feature panels (collapsible) */}
      {showCriticalPath && (
        <div className="border-b border-white/[0.06] bg-[#0d1117]">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
            <Route size={12} className="text-cyan-400" />
            <span className="text-[10px] font-medium text-cyan-400 uppercase tracking-wider">Critical Path</span>
          </div>
          <CriticalPathPanel
            nodes={payload.nodes}
            sourceId={pathSourceId}
            destinationId={pathDestId}
            onSetSource={setPathSourceId}
            onSetDestination={setPathDestId}
            result={criticalPath}
          />
        </div>
      )}

      {showAnomalyOverlay && (
        <div className="border-b border-white/[0.06] bg-[#0d1117]">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
            <BarChart3 size={12} className="text-amber-400" />
            <span className="text-[10px] font-medium text-amber-400 uppercase tracking-wider">Anomaly Detection</span>
            {baselineLoading && <Loader2 size={10} className="animate-spin text-zinc-500" />}
          </div>
          {anomalyOverlay ? (
            <AnomalySummaryPanel overlay={anomalyOverlay} />
          ) : baselineLoading ? (
            <p className="p-3 text-xs text-zinc-500">Loading baseline data...</p>
          ) : (
            <p className="p-3 text-xs text-zinc-500">Enable anomaly overlay to compare against baseline.</p>
          )}
        </div>
      )}

      {showSavedViews && (
        <div className="border-b border-white/[0.06] bg-[#0d1117]">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
            <FolderOpen size={12} className="text-zinc-400" />
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Saved Views</span>
          </div>
          <SavedViewsPanel
            onLoadView={handleLoadView}
            currentState={{
              viewMode,
              zoom,
              searchTerm,
              anomalyOverlayEnabled: showAnomalyOverlay,
              criticalPathSource: pathSourceId,
              criticalPathDestination: pathDestId,
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'constellation' ? (
          <>
            <div
              className="w-full h-full"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            >
              <ConstellationView
                payload={payload}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                searchTerm={searchTerm}
                zoom={zoom}
                criticalPath={criticalPath}
                anomalyOverlay={anomalyOverlay}
                showAnomalyOverlay={showAnomalyOverlay}
                svgRef={svgRef}
              />
            </div>
            {/* Detail Panel */}
            {selectedNode && (
              <DetailPanel
                node={selectedNode}
                edges={payload.edges}
                nodeMap={nodeMap}
                onClose={() => setSelectedNodeId(null)}
                nodeAnomaly={selectedNodeAnomaly}
              />
            )}
          </>
        ) : (
          <SubnetMapView
            payload={payload}
            collapsedSubnets={collapsedSubnets}
            onToggleCollapse={toggleSubnetCollapse}
          />
        )}
      </div>

      {/* Footer legends */}
      <div className="px-4 py-2 border-t border-white/[0.06] space-y-1.5">
        <ClusterLegend clusters={payload.clusters} />
        {activeRoles.length > 0 && <RoleLegend roles={activeRoles} />}
        {/* Anomaly severity legend */}
        {showAnomalyOverlay && anomalyOverlay && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-zinc-500">Anomaly severity:</span>
            {(['low', 'medium', 'high', 'critical'] as AnomalySeverity[]).map((sev) => (
              <div key={sev} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ANOMALY_SEVERITY_COLORS[sev] }} />
                <span className="text-zinc-400 capitalize">{sev}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
