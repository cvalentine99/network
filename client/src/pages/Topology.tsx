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
 * Rec 6: Decomposed into focused sub-components under components/topology/.
 * This file is the orchestrator — state management, toolbar, and layout only.
 *
 * Live integration: deferred by contract.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ForceGraph, { type ForceGraphHandle } from '@/components/ForceGraph';
import {
  Network,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Activity,
  Layers,
  Route,
  BarChart3,
  Download,
  FolderOpen,
  RotateCcw,
  Lock,
  Unlock,
  Shrink,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { useTopology } from '@/hooks/useTopology';
import {
  DetailPanel,
  SubnetMapView,
  CriticalPathPanel,
  AnomalySummaryPanel,
  ExportMenu,
  SavedViewsPanel,
} from '@/components/topology';
import {
  buildFlowTheaterUrl,
  buildBlastRadiusUrl,
} from '../../../shared/cross-surface-nav-types';
import type {
  TopologyNode,
  TopologyPayload,
  TopologyDeviceRole,
} from '../../../shared/topology-types';
import { ROLE_DISPLAY } from '../../../shared/topology-types';
import type {
  TopologyViewMode,
  CriticalPathResult,
  AnomalyOverlayPayload,
  AnomalySeverity,
} from '../../../shared/topology-advanced-types';
import { ANOMALY_SEVERITY_COLORS } from '../../../shared/topology-advanced-types';
import { findCriticalPath } from '../../../shared/topology-critical-path';
import { buildAnomalyOverlay } from '../../../shared/topology-anomaly-detection';

const CLUSTER_COLORS = [
  '#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#f97316',
  '#6366f1', '#ec4899', '#84cc16', '#14b8a6', '#ef4444',
];

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

// ─── Cluster Legend ────────────────────────────────────────────────
function ClusterLegend({ clusters }: { clusters: TopologyPayload['clusters'] }) {
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
  const forceGraphRef = useRef<ForceGraphHandle>(null);

  // View state
  const [viewMode, setViewMode] = useState<TopologyViewMode>('constellation');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // zoom state kept for saved views compatibility, but ForceGraph manages its own zoom
  const [zoom, setZoom] = useState(1);

  // Feature toggles
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showAnomalyOverlay, setShowAnomalyOverlay] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSavedViews, setShowSavedViews] = useState(false);
  const [pulseEnabled, setPulseEnabled] = useState(false);
  const [edgeBundlingEnabled, setEdgeBundlingEnabled] = useState(false);
  // isLiveData: true when connected to a live ExtraHop appliance (not fixture/mock)
  // Currently always false — deferred by contract. Set to true when live integration is wired.
  const isLiveData = false;
  const [, setLocation] = useLocation();

  // Context menu navigation callbacks (Slice 44)
  const handleTraceInFlowTheater = useCallback((_nodeId: number, displayName: string) => {
    const url = buildFlowTheaterUrl({ mode: 'hostname', value: displayName, autoSubmit: true });
    setLocation(url);
  }, [setLocation]);

  const handleShowBlastRadius = useCallback((nodeId: number, _displayName: string) => {
    const url = buildBlastRadiusUrl({ mode: 'device-id', value: String(nodeId), autoSubmit: true });
    setLocation(url);
  }, [setLocation]);

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
    // Restore node positions if the saved view includes them (Slice 42)
    if (view.nodePositions && typeof view.nodePositions === 'object') {
      // Apply after a tick so ForceGraph has rendered
      setTimeout(() => {
        forceGraphRef.current?.applyNodePositions(view.nodePositions);
      }, 200);
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
                onClick={() => forceGraphRef.current?.zoomIn()}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => forceGraphRef.current?.zoomOut()}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => forceGraphRef.current?.resetZoom()}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Reset zoom"
              >
                <Maximize2 size={14} />
              </button>
              {/* Reset Layout — clears saved node positions (Slice 41) */}
              <button
                onClick={() => {
                  forceGraphRef.current?.resetLayout();
                  toast.success('Layout reset — nodes will re-simulate');
                }}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Reset layout (clear pinned positions)"
                data-testid="reset-layout"
              >
                <RotateCcw size={14} />
              </button>
              {/* Lock All toggle — freeze/unfreeze simulation (Slice 42) */}
              <button
                onClick={() => {
                  forceGraphRef.current?.toggleLock();
                  const willBeLocked = !forceGraphRef.current?.isLocked;
                  toast.success(willBeLocked ? 'Layout unlocked — simulation resumed' : 'Layout locked — nodes frozen');
                }}
                className={`p-1.5 rounded transition-colors ${
                  forceGraphRef.current?.isLocked
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'hover:bg-white/[0.06] text-zinc-400'
                }`}
                title={forceGraphRef.current?.isLocked ? 'Unlock layout (resume simulation)' : 'Lock layout (freeze all nodes)'}
                data-testid="toggle-lock"
              >
                {forceGraphRef.current?.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              {/* Collapse All Clusters — group subnets into super-nodes (Slice 43) */}
              <button
                onClick={() => {
                  const allClusterIds = payload.clusters.map((c) => c.id);
                  const currentCollapsed = forceGraphRef.current?.collapsedClusters ?? new Set();
                  const allCollapsed = allClusterIds.every((id) => currentCollapsed.has(id));
                  if (allCollapsed) {
                    for (const id of allClusterIds) forceGraphRef.current?.expandCluster(id);
                    toast.success('All clusters expanded');
                  } else {
                    for (const id of allClusterIds) forceGraphRef.current?.collapseCluster(id);
                    toast.success('All clusters collapsed into super-nodes');
                  }
                }}
                className="p-1.5 rounded hover:bg-white/[0.06] text-zinc-400"
                title="Collapse/Expand all clusters"
                data-testid="toggle-collapse-all"
              >
                <Shrink size={14} />
              </button>
              {/* Edge Bundling toggle (Slice 44) */}
              <button
                onClick={() => {
                  setEdgeBundlingEnabled((prev) => {
                    const next = !prev;
                    toast.success(next ? 'Edge bundling enabled (200+ nodes)' : 'Edge bundling disabled');
                    return next;
                  });
                }}
                className={`p-1.5 rounded transition-colors ${
                  edgeBundlingEnabled
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'hover:bg-white/[0.06] text-zinc-400'
                }`}
                title={edgeBundlingEnabled ? 'Disable edge bundling' : 'Enable edge bundling (200+ nodes)'}
                data-testid="toggle-edge-bundling"
              >
                <Layers size={14} />
              </button>
              {/* Pulse Animation toggle (Slice 43) */}
              <button
                onClick={() => {
                  setPulseEnabled((prev) => {
                    const next = !prev;
                    if (next && !isLiveData) {
                      toast.info('Pulse animation enabled — will animate when connected to live ExtraHop data');
                    } else if (next) {
                      toast.success('Pulse animation enabled');
                    } else {
                      toast.success('Pulse animation disabled');
                    }
                    return next;
                  });
                }}
                className={`p-1.5 rounded transition-colors ${
                  pulseEnabled
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'hover:bg-white/[0.06] text-zinc-400'
                }`}
                title={pulseEnabled ? 'Disable pulse animation' : 'Enable pulse animation (live data only)'}
                data-testid="toggle-pulse"
              >
                <Zap size={14} />
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
              <ExportMenu
                payload={payload}
                svgRef={{ current: forceGraphRef.current?.svgElement ?? svgRef.current } as React.RefObject<SVGSVGElement | null>}
                onClose={() => setShowExportMenu(false)}
                getNodePositions={() => forceGraphRef.current?.getNodePositions() ?? {}}
                applyNodePositions={(pos) => forceGraphRef.current?.applyNodePositions(pos)}
              />
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
              nodePositions: forceGraphRef.current?.getNodePositions() ?? null,
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === 'constellation' ? (
          <>
            <ForceGraph
              ref={forceGraphRef}
              payload={payload}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              searchTerm={searchTerm}
              criticalPath={criticalPath}
              anomalyOverlay={anomalyOverlay}
              showAnomalyOverlay={showAnomalyOverlay}
              pulseEnabled={pulseEnabled}
              edgeBundlingEnabled={edgeBundlingEnabled}
              viewKey="constellation"
              onTraceInFlowTheater={handleTraceInFlowTheater}
              onShowBlastRadius={handleShowBlastRadius}
            />
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
