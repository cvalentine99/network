/**
 * Slice 21 — Living Topology Surface
 *
 * CONTRACT:
 * - First-class named surface answering "What does the network look like right now?"
 * - Constellation view: SVG-based node-edge graph with cluster grouping
 * - Shared time window via useTimeWindow()
 * - All data from BFF POST /api/bff/topology/query — never contacts ExtraHop directly
 * - Reuses shared types from shared/topology-types.ts — no local redefinition
 * - UI states: idle, loading, populated, quiet, error, malformed
 * - Performance budget: 200-node max, nodes scaled by traffic volume
 * - Detail panel: click a node to see device info, connections, detections
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
} from 'lucide-react';
import { useTopology, type TopologyState } from '@/hooks/useTopology';
import type {
  TopologyNode,
  TopologyEdge,
  TopologyCluster,
  TopologyPayload,
  TopologyDeviceRole,
} from '../../../shared/topology-types';
import { ROLE_DISPLAY, TOPOLOGY_PERFORMANCE } from '../../../shared/topology-types';

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

  // Assign cluster positions in a ring
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

  // Place nodes around their cluster center
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

// ─── Node Size Scaling ─────────────────────────────────────────────
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

// ─── Detail Panel ──────────────────────────────────────────────────
function DetailPanel({
  node,
  edges,
  nodeMap,
  onClose,
}: {
  node: TopologyNode;
  edges: TopologyEdge[];
  nodeMap: Map<number, TopologyNode>;
  onClose: () => void;
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white/[0.03] rounded p-2 text-center">
            <div className="text-[10px] text-zinc-500 uppercase">Traffic</div>
            <div className="text-xs font-medium text-white">{formatBytes(node.totalBytes)}</div>
          </div>
          <div className="bg-white/[0.03] rounded p-2 text-center">
            <div className="text-[10px] text-zinc-500 uppercase">Detections</div>
            <div className={`text-xs font-medium ${node.activeDetections > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
              {node.activeDetections}
            </div>
          </div>
          <div className="bg-white/[0.03] rounded p-2 text-center">
            <div className="text-[10px] text-zinc-500 uppercase">Alerts</div>
            <div className={`text-xs font-medium ${node.activeAlerts > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
              {node.activeAlerts}
            </div>
          </div>
        </div>

        {/* Connections */}
        <div className="mb-2">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Connections ({connections.length})
          </h4>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {peers.map(({ edge, peer }, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs p-2 rounded bg-white/[0.02] hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {peer && <RoleIcon role={peer.role} size={10} />}
                  <span className="text-zinc-300 truncate">{peer?.displayName || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-zinc-500 font-mono text-[10px]">{edge.protocol}</span>
                  <span className="text-zinc-400">{formatBytes(edge.bytes)}</span>
                  {edge.hasDetection && (
                    <AlertTriangle size={10} className="text-red-400" />
                  )}
                </div>
              </div>
            ))}
            {connections.length === 0 && (
              <div className="text-xs text-zinc-500 italic p-2">No connections in time window</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cluster Legend ─────────────────────────────────────────────────
function ClusterLegend({ clusters }: { clusters: TopologyCluster[] }) {
  const CLUSTER_COLORS = [
    '#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#f97316',
    '#6366f1', '#ec4899', '#84cc16', '#14b8a6', '#ef4444',
  ];
  return (
    <div className="flex flex-wrap gap-2" data-testid="topology-cluster-legend">
      {clusters.map((c, i) => (
        <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
          />
          <span>{c.label}</span>
          <span className="text-zinc-600">({c.nodeCount})</span>
        </div>
      ))}
    </div>
  );
}

// ─── Role Legend ────────────────────────────────────────────────────
function RoleLegend({ roles }: { roles: TopologyDeviceRole[] }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="topology-role-legend">
      {roles.map((role) => {
        const meta = ROLE_DISPLAY[role];
        return (
          <div key={role} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
            <span>{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── SVG Constellation ─────────────────────────────────────────────
function ConstellationView({
  payload,
  selectedNodeId,
  onSelectNode,
  searchTerm,
  zoom,
}: {
  payload: TopologyPayload;
  selectedNodeId: number | null;
  onSelectNode: (id: number | null) => void;
  searchTerm: string;
  zoom: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
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

  const CLUSTER_COLORS = [
    '#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#f97316',
    '#6366f1', '#ec4899', '#84cc16', '#14b8a6', '#ef4444',
  ];
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
          return (
            <line
              key={`edge-${i}`}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke={e.hasDetection ? '#ef4444' : '#475569'}
              strokeWidth={w}
              strokeOpacity={isDimmed ? 0.08 : isHighlighted ? 0.7 : 0.25}
            />
          );
        })}
      </g>

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

          return (
            <g
              key={n.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={() => onSelectNode(isSelected ? null : n.id)}
              className="cursor-pointer"
              data-testid={`topology-node-${n.id}`}
              opacity={isDimmed ? 0.2 : 1}
            >
              {/* Glow for critical/issue nodes */}
              {(n.critical || hasIssue) && (
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
                stroke={isSelected ? '#fff' : clusterColor}
                strokeWidth={isSelected ? 2 : 1}
                strokeOpacity={isSelected ? 1 : 0.4}
              />
              {/* Label (only for larger nodes or selected) */}
              {(size > 16 || isSelected) && (
                <text
                  y={size / 2 + 12}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={9}
                  fontWeight={isSelected ? 600 : 400}
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

// ─── Summary Bar ───────────────────────────────────────────────────
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

// ─── Main Page Component ───────────────────────────────────────────
export default function Topology() {
  const { state, refetch } = useTopology();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoom, setZoom] = useState(1);

  // Clear selection when state changes
  useEffect(() => {
    setSelectedNodeId(null);
  }, [state]);

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

  // ─── Loading ─────────────────────────────────────────────────────
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

  // ─── Error ───────────────────────────────────────────────────────
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

  // ─── Malformed ───────────────────────────────────────────────────
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

  // ─── Quiet ───────────────────────────────────────────────────────
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

  // ─── Populated ───────────────────────────────────────────────────
  const { payload } = state;

  return (
    <div className="flex flex-col h-full" data-testid="topology-populated">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Network size={18} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Living Topology</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 placeholder:text-zinc-600 w-48 focus:outline-none focus:border-cyan-500/30"
              data-testid="topology-search"
            />
          </div>
          {/* Zoom controls */}
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

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {/* SVG Canvas */}
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
          />
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            edges={payload.edges}
            nodeMap={nodeMap}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>

      {/* Footer legends */}
      <div className="px-4 py-2 border-t border-white/[0.06] space-y-1.5">
        <ClusterLegend clusters={payload.clusters} />
        {activeRoles.length > 0 && <RoleLegend roles={activeRoles} />}
      </div>
    </div>
  );
}
