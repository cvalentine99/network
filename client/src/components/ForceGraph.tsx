/**
 * ForceGraph — D3-force-directed topology visualization (Slices 39-43)
 *
 * CONTRACT:
 * - Renders TopologyPayload as an interactive force-directed graph
 * - Supports drag, zoom, pan via d3-zoom and d3-drag
 * - Preserves all existing features: search, critical path, anomaly overlay
 * - Cluster gravity groups nodes by clusterId
 * - Node sizing by traffic volume, edge width by bytes
 * - Optimized for ultrawide monitors (5120x1440)
 * - Exposes SVG ref for export (PNG/SVG)
 * - Node tooltip on hover: device name, IP, traffic, detection count (Slice 40)
 * - Edge label on hover: protocol name and traffic volume (Slice 40)
 * - Layout persistence: saves node positions to localStorage on drag-end (Slice 41)
 * - Restores pinned positions on page load; Reset Layout clears saved state
 * - Lock All toggle: freeze/unfreeze simulation (Slice 42)
 * - getNodePositions / applyNodePositions for Saved Views (Slice 42)
 * - Minimap overlay: bottom-right inset showing full topology + viewport rect (Slice 43)
 * - Node grouping: collapse/expand clusters into super-nodes (Slice 43)
 * - Real-time pulse animation: edge dash animation proportional to traffic (Slice 43)
 * - Right-click context menu: Trace in Flow Theater, Show Blast Radius, Copy IP, Pin/Unpin (Slice 44)
 * - Edge bundling: bundle parallel inter-cluster edges into single thick curved lines (Slice 44)
 * - Node drag-to-rearrange: drag nodes to reposition, auto-pin at new location (Slice 45)
 * - Position persistence: saved per-view to localStorage, survives page reload (Slice 45)
 * - Visual pin indicator: dashed ring around pinned/dragged nodes (Slice 45)
 *
 * Live integration: deferred by contract.
 */

import {
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { drag as d3Drag } from 'd3-drag';
import type {
  TopologyNode,
  TopologyEdge,
  TopologyPayload,
} from '../../../shared/topology-types';
import { ROLE_DISPLAY, TOPOLOGY_PERFORMANCE } from '../../../shared/topology-types';
import type {
  CriticalPathResult,
  AnomalyOverlayPayload,
  EdgeAnomaly,
  NodeAnomaly,
} from '../../../shared/topology-advanced-types';
import { ANOMALY_SEVERITY_COLORS } from '../../../shared/topology-advanced-types';
import { getPathNodeIds, getPathEdgeKeys } from '../../../shared/topology-critical-path';
import { getAnomalyEdgeKeys, getAnomalyNodeIds } from '../../../shared/topology-anomaly-detection';

// ─── D3 Simulation Node ──────────────────────────────────────────
interface SimNode extends SimulationNodeDatum {
  id: number;
  node: TopologyNode;
  clusterId: string;
  radius: number;
  /** True if this is a collapsed super-node representing a cluster */
  isSuperNode?: boolean;
  /** For super-nodes: the IDs of the collapsed child nodes */
  childNodeIds?: number[];
  /** For super-nodes: aggregated total bytes */
  superBytes?: number;
  /** For super-nodes: aggregated detection count */
  superDetections?: number;
  /** For super-nodes: aggregated alert count */
  superAlerts?: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edge: TopologyEdge;
  width: number;
  /** For super-node edges: aggregated from multiple real edges */
  isSuperEdge?: boolean;
  /** Aggregated bytes for super-edges */
  superBytes?: number;
}

// ─── Scaling helpers ─────────────────────────────────────────────
function nodeRadius(bytes: number, maxBytes: number): number {
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

// ─── Layout persistence (Slice 41, enhanced Slice 45) ──────────
// View-keyed persistence: each view name gets its own saved positions
const LAYOUT_STORAGE_PREFIX = 'topology-node-positions';
const LAYOUT_STORAGE_KEY = LAYOUT_STORAGE_PREFIX; // default fallback

interface SavedPosition {
  x: number;
  y: number;
}

function getStorageKey(viewKey?: string): string {
  return viewKey ? `${LAYOUT_STORAGE_PREFIX}:${viewKey}` : LAYOUT_STORAGE_KEY;
}

function loadSavedPositions(viewKey?: string): Map<number, SavedPosition> {
  try {
    const raw = localStorage.getItem(getStorageKey(viewKey));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, SavedPosition>;
    const m = new Map<number, SavedPosition>();
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (!Number.isNaN(id) && v && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y)) {
        m.set(id, v);
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

function saveSavedPositions(positions: Map<number, SavedPosition>, viewKey?: string): void {
  try {
    const obj: Record<string, SavedPosition> = {};
    positions.forEach((v, k) => {
      obj[String(k)] = v;
    });
    localStorage.setItem(getStorageKey(viewKey), JSON.stringify(obj));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function clearSavedPositions(viewKey?: string): void {
  try {
    localStorage.removeItem(getStorageKey(viewKey));
  } catch {
    // silently ignore
  }
}

// ─── Tooltip types ──────────────────────────────────────────────
interface NodeTooltipData {
  kind: 'node';
  name: string;
  ip: string;
  role: string;
  traffic: string;
  detections: number;
  alerts: number;
  cluster: string;
}

interface SuperNodeTooltipData {
  kind: 'supernode';
  clusterLabel: string;
  nodeCount: number;
  totalTraffic: string;
  detections: number;
  alerts: number;
}

interface EdgeTooltipData {
  kind: 'edge';
  protocol: string;
  traffic: string;
  sourceName: string;
  targetName: string;
  hasDetection: boolean;
}

type TooltipData = NodeTooltipData | SuperNodeTooltipData | EdgeTooltipData;

// ─── Context Menu types (Slice 44) ──────────────────────────────
export interface ContextMenuAction {
  label: string;
  icon: string; // emoji or text icon
  action: () => void;
  disabled?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: number;
  displayName: string;
  ipaddr: string;
  isPinned: boolean;
}

// ─── Edge Bundle types (Slice 44) ───────────────────────────────
interface EdgeBundle {
  sourceClusterId: string;
  targetClusterId: string;
  edges: SimLink[];
  totalBytes: number;
  edgeCount: number;
  hasDetection: boolean;
  /** Centroid of source cluster nodes */
  srcCx: number;
  srcCy: number;
  /** Centroid of target cluster nodes */
  tgtCx: number;
  tgtCy: number;
}

// ─── Props ───────────────────────────────────────────────────────
export interface ForceGraphProps {
  payload: TopologyPayload;
  selectedNodeId: number | null;
  onSelectNode: (id: number | null) => void;
  searchTerm: string;
  criticalPath: CriticalPathResult | null;
  anomalyOverlay: AnomalyOverlayPayload | null;
  showAnomalyOverlay: boolean;
  /** Whether pulse animation is enabled (Slice 43) */
  pulseEnabled?: boolean;
  /** Whether the data source is live (not fixture) — pulse only animates when live */
  isLiveData?: boolean;
  /** Whether edge bundling is enabled (Slice 44) — auto-enables at 200+ nodes */
  edgeBundlingEnabled?: boolean;
  /** View key for per-view position persistence (Slice 45) */
  viewKey?: string;
  /** Callback when user selects "Trace in Flow Theater" from context menu (Slice 44) */
  onTraceInFlowTheater?: (nodeId: number, displayName: string) => void;
  /** Callback when user selects "Show Blast Radius" from context menu (Slice 44) */
  onShowBlastRadius?: (nodeId: number, displayName: string) => void;
}

export interface ForceGraphHandle {
  svgElement: SVGSVGElement | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  resetLayout: () => void;
  hasCustomLayout: boolean;
  isLocked: boolean;
  toggleLock: () => void;
  getNodePositions: () => Record<string, { x: number; y: number }>;
  applyNodePositions: (positions: Record<string, { x: number; y: number }>) => void;
  /** Collapse a cluster into a super-node (Slice 43) */
  collapseCluster: (clusterId: string) => void;
  /** Expand a collapsed super-node back to individual nodes (Slice 43) */
  expandCluster: (clusterId: string) => void;
  /** Get the set of currently collapsed cluster IDs (Slice 43) */
  collapsedClusters: Set<string>;
  /** Toggle collapse for a cluster (Slice 43) */
  toggleCluster: (clusterId: string) => void;
}

// ─── Minimap constants ──────────────────────────────────────────
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;
const MINIMAP_PADDING = 12;

// ─── Component ───────────────────────────────────────────────────
const ForceGraph = forwardRef<ForceGraphHandle, ForceGraphProps>(function ForceGraph(
  {
    payload,
    selectedNodeId,
    onSelectNode,
    searchTerm,
    criticalPath,
    anomalyOverlay,
    showAnomalyOverlay,
    pulseEnabled = false,
    isLiveData = false,
    edgeBundlingEnabled = false,
    viewKey,
    onTraceInFlowTheater,
    onShowBlastRadius,
  },
  ref
) {
  // Track viewKey in a ref so callbacks can access the latest value
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [, forceRender] = useState(0);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const savedPositionsRef = useRef<Map<number, SavedPosition>>(loadSavedPositions(viewKey));

  // Reload saved positions when viewKey changes (Slice 45)
  useEffect(() => {
    savedPositionsRef.current = loadSavedPositions(viewKey);
    // Apply loaded positions to existing nodes
    for (const n of nodesRef.current) {
      const saved = savedPositionsRef.current.get(n.id);
      if (saved) {
        n.fx = saved.x;
        n.fy = saved.y;
      }
    }
    setHasCustomLayout(savedPositionsRef.current.size > 0);
    forceRender((v) => v + 1);
  }, [viewKey]);
  const [hasCustomLayout, setHasCustomLayout] = useState(() => loadSavedPositions(viewKey).size > 0);
  const [isLocked, setIsLocked] = useState(false);

  // ─── Collapsed clusters state (Slice 43) ──────────────────────
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());

  // ─── Pulse animation (Slice 43) ───────────────────────────────
  const pulseOffsetRef = useRef(0);
  const pulseAnimFrameRef = useRef<number>(0);
  const shouldPulse = pulseEnabled && isLiveData;

  useEffect(() => {
    if (!shouldPulse) {
      pulseOffsetRef.current = 0;
      return;
    }
    let running = true;
    const animate = () => {
      if (!running) return;
      pulseOffsetRef.current = (pulseOffsetRef.current + 0.5) % 100;
      forceRender((v) => v + 1);
      pulseAnimFrameRef.current = requestAnimationFrame(animate);
    };
    pulseAnimFrameRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(pulseAnimFrameRef.current);
    };
  }, [shouldPulse]);

  // ─── Tooltip state ──────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{
    data: TooltipData;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback(
    (data: TooltipData, clientX: number, clientY: number) => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltip({
        data,
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    },
    []
  );

  const hideTooltip = useCallback(() => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
      tooltipTimeoutRef.current = null;
    }, 100);
  }, []);

  // ─── Context Menu state (Slice 44) ────────────────────────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, simNode: SimNode) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const isPinned = simNode.fx != null && simNode.fy != null;
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        nodeId: simNode.id,
        displayName: simNode.node.displayName,
        ipaddr: simNode.node.ipaddr || '',
        isPinned,
      });
    },
    [hideTooltip]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on click-away or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const handleCopyIp = useCallback(async (ip: string) => {
    try {
      await navigator.clipboard.writeText(ip);
    } catch {
      // Fallback for environments without clipboard API
    }
    setContextMenu(null);
  }, []);

  const handleTogglePin = useCallback((nodeId: number) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (!node) return;
    if (node.fx != null && node.fy != null) {
      // Unpin
      node.fx = null;
      node.fy = null;
      savedPositionsRef.current.delete(nodeId);
      saveSavedPositions(savedPositionsRef.current, viewKeyRef.current);
      simulationRef.current?.alpha(0.3).restart();
    } else {
      // Pin at current position
      node.fx = node.x;
      node.fy = node.y;
      if (node.x != null && node.y != null && Number.isFinite(node.x) && Number.isFinite(node.y)) {
        savedPositionsRef.current.set(nodeId, { x: node.x, y: node.y });
        saveSavedPositions(savedPositionsRef.current, viewKeyRef.current);
        setHasCustomLayout(true);
      }
    }
    setContextMenu(null);
    forceRender((v) => v + 1);
  }, []);

  // Expose handle for parent
  useImperativeHandle(ref, () => ({
    get svgElement() {
      return svgRef.current;
    },
    zoomIn: () => {
      if (svgRef.current && zoomBehaviorRef.current) {
        select(svgRef.current)
          .transition()
          .duration(300)
          .call(zoomBehaviorRef.current.scaleBy, 1.3);
      }
    },
    zoomOut: () => {
      if (svgRef.current && zoomBehaviorRef.current) {
        select(svgRef.current)
          .transition()
          .duration(300)
          .call(zoomBehaviorRef.current.scaleBy, 0.7);
      }
    },
    resetZoom: () => {
      if (svgRef.current && zoomBehaviorRef.current) {
        select(svgRef.current)
          .transition()
          .duration(500)
          .call(zoomBehaviorRef.current.transform, zoomIdentity);
      }
    },
    resetLayout: () => {
      clearSavedPositions(viewKeyRef.current);
      savedPositionsRef.current = new Map();
      setHasCustomLayout(false);
      setIsLocked(false);
      setCollapsedClusters(new Set());
      for (const n of nodesRef.current) {
        n.fx = null;
        n.fy = null;
      }
      simulationRef.current?.alpha(0.8).restart();
    },
    hasCustomLayout,
    isLocked,
    toggleLock: () => {
      setIsLocked((prev) => {
        const next = !prev;
        if (next) {
          for (const n of nodesRef.current) {
            n.fx = n.x;
            n.fy = n.y;
          }
          simulationRef.current?.stop();
        } else {
          const saved = savedPositionsRef.current;
          for (const n of nodesRef.current) {
            if (!saved.has(n.id)) {
              n.fx = null;
              n.fy = null;
            }
          }
          simulationRef.current?.alpha(0.3).restart();
        }
        return next;
      });
    },
    getNodePositions: () => {
      const positions: Record<string, { x: number; y: number }> = {};
      for (const n of nodesRef.current) {
        if (n.x != null && n.y != null && Number.isFinite(n.x) && Number.isFinite(n.y)) {
          positions[String(n.id)] = { x: n.x, y: n.y };
        }
      }
      return positions;
    },
    applyNodePositions: (positions: Record<string, { x: number; y: number }>) => {
      const posMap = new Map<number, SavedPosition>();
      for (const [k, v] of Object.entries(positions)) {
        const id = Number(k);
        if (!Number.isNaN(id) && Number.isFinite(v.x) && Number.isFinite(v.y)) {
          posMap.set(id, v);
        }
      }
      for (const n of nodesRef.current) {
        const pos = posMap.get(n.id);
        if (pos) {
          n.x = pos.x;
          n.y = pos.y;
          n.fx = pos.x;
          n.fy = pos.y;
        }
      }
      savedPositionsRef.current = posMap;
      saveSavedPositions(posMap, viewKeyRef.current);
      setHasCustomLayout(posMap.size > 0);
      forceRender((v) => v + 1);
    },
    collapsedClusters,
    collapseCluster: (clusterId: string) => {
      setCollapsedClusters((prev) => {
        const next = new Set(prev);
        next.add(clusterId);
        return next;
      });
    },
    expandCluster: (clusterId: string) => {
      setCollapsedClusters((prev) => {
        const next = new Set(prev);
        next.delete(clusterId);
        return next;
      });
    },
    toggleCluster: (clusterId: string) => {
      setCollapsedClusters((prev) => {
        const next = new Set(prev);
        if (next.has(clusterId)) {
          next.delete(clusterId);
        } else {
          next.add(clusterId);
        }
        return next;
      });
    },
  }), [hasCustomLayout, isLocked, collapsedClusters]);

  // ─── Responsive sizing ─────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─── Build effective payload with collapsed clusters ───────────
  const effectivePayload = useMemo(() => {
    if (collapsedClusters.size === 0) return payload;

    const collapsedNodeIds = new Set<number>();
    const superNodes: TopologyNode[] = [];

    for (const clusterId of Array.from(collapsedClusters)) {
      const cluster = payload.clusters.find((c) => c.id === clusterId);
      if (!cluster) continue;
      const clusterNodes = payload.nodes.filter((n) => n.clusterId === clusterId);
      if (clusterNodes.length === 0) continue;

      for (const n of clusterNodes) collapsedNodeIds.add(n.id);

      // Create a super-node with a negative ID to avoid collision
      const superNodeId = -(Math.abs(clusterId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) + 1);
      const totalBytes = clusterNodes.reduce((s, n) => s + n.totalBytes, 0);
      const totalDetections = clusterNodes.reduce((s, n) => s + n.activeDetections, 0);
      const totalAlerts = clusterNodes.reduce((s, n) => s + n.activeAlerts, 0);

      superNodes.push({
        id: superNodeId,
        displayName: `${cluster.label} (${clusterNodes.length})`,
        ipaddr: '',
        macaddr: '',
        role: 'server' as TopologyNode['role'],
        clusterId,
        totalBytes,
        activeDetections: totalDetections,
        activeAlerts: totalAlerts,
        critical: clusterNodes.some((n) => n.critical),
        _isSuperNode: true,
        _childNodeIds: clusterNodes.map((n) => n.id),
      } as TopologyNode & { _isSuperNode: boolean; _childNodeIds: number[] });
    }

    // Keep non-collapsed nodes + add super-nodes
    const effectiveNodes = [
      ...payload.nodes.filter((n) => !collapsedNodeIds.has(n.id)),
      ...superNodes,
    ];

    // Remap edges: if source or target is collapsed, remap to super-node
    const nodeToSuper = new Map<number, number>();
    for (const sn of superNodes) {
      const ext = sn as TopologyNode & { _childNodeIds: number[] };
      for (const childId of ext._childNodeIds) {
        nodeToSuper.set(childId, sn.id);
      }
    }

    const edgeMap = new Map<string, TopologyEdge>();
    for (const e of payload.edges) {
      const srcId = nodeToSuper.get(e.sourceId) ?? e.sourceId;
      const tgtId = nodeToSuper.get(e.targetId) ?? e.targetId;
      if (srcId === tgtId) continue; // Skip intra-cluster edges
      const key = srcId < tgtId ? `${srcId}-${tgtId}` : `${tgtId}-${srcId}`;
      const existing = edgeMap.get(key);
      if (existing) {
        // Aggregate
        edgeMap.set(key, {
          ...existing,
          bytes: existing.bytes + e.bytes,
          hasDetection: existing.hasDetection || e.hasDetection,
        });
      } else {
        edgeMap.set(key, {
          ...e,
          sourceId: srcId,
          targetId: tgtId,
        });
      }
    }

    return {
      ...payload,
      nodes: effectiveNodes,
      edges: Array.from(edgeMap.values()),
    };
  }, [payload, collapsedClusters]);

  // ─── Precompute max values ─────────────────────────────────────
  const maxNodeBytes = useMemo(
    () => Math.max(...effectivePayload.nodes.map((n) => n.totalBytes), 1),
    [effectivePayload]
  );
  const maxEdgeBytes = useMemo(
    () => Math.max(...effectivePayload.edges.map((e) => e.bytes), 1),
    [effectivePayload]
  );

  // ─── Cluster color map ─────────────────────────────────────────
  const clusterColorMap = useMemo(() => {
    const m = new Map<string, string>();
    payload.clusters.forEach((c, i) => m.set(c.id, CLUSTER_COLORS[i % CLUSTER_COLORS.length]));
    return m;
  }, [payload.clusters]);

  // ─── Cluster label map (for tooltip) ───────────────────────────
  const clusterLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    payload.clusters.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [payload.clusters]);

  // ─── Cluster center targets for cluster gravity ────────────────
  const clusterCenters = useMemo(() => {
    const centers = new Map<string, { x: number; y: number }>();
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const ringRadius = Math.min(dimensions.width, dimensions.height) * 0.28;
    payload.clusters.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / Math.max(payload.clusters.length, 1) - Math.PI / 2;
      centers.set(c.id, {
        x: cx + ringRadius * Math.cos(angle),
        y: cy + ringRadius * Math.sin(angle),
      });
    });
    return centers;
  }, [payload.clusters, dimensions]);

  // ─── Node map for edge tooltip lookups ─────────────────────────
  const nodeNameMap = useMemo(() => {
    const m = new Map<number, string>();
    effectivePayload.nodes.forEach((n) => m.set(n.id, n.displayName));
    return m;
  }, [effectivePayload.nodes]);

  // ─── Search highlighting ───────────────────────────────────────
  const matchingIds = useMemo(() => {
    if (!searchTerm) return null;
    const lower = searchTerm.toLowerCase();
    return new Set(
      effectivePayload.nodes
        .filter(
          (n) =>
            n.displayName.toLowerCase().includes(lower) ||
            (n.ipaddr && n.ipaddr.includes(lower))
        )
        .map((n) => n.id)
    );
  }, [effectivePayload.nodes, searchTerm]);

  // ─── Critical path sets ────────────────────────────────────────
  const pathNodeIds = useMemo(
    () => (criticalPath?.pathFound ? getPathNodeIds(criticalPath) : new Set<number>()),
    [criticalPath]
  );
  const pathEdgeKeys = useMemo(
    () => (criticalPath?.pathFound ? getPathEdgeKeys(criticalPath) : new Set<string>()),
    [criticalPath]
  );

  // ─── Anomaly maps ─────────────────────────────────────────────
  const anomalyEdgeMap = useMemo(
    () =>
      showAnomalyOverlay && anomalyOverlay
        ? getAnomalyEdgeKeys(anomalyOverlay.edgeAnomalies)
        : new Map<string, EdgeAnomaly>(),
    [anomalyOverlay, showAnomalyOverlay]
  );
  const anomalyNodeMap = useMemo(
    () =>
      showAnomalyOverlay && anomalyOverlay
        ? getAnomalyNodeIds(anomalyOverlay.nodeAnomalies)
        : new Map<number, NodeAnomaly>(),
    [anomalyOverlay, showAnomalyOverlay]
  );

  // ─── Build simulation data ─────────────────────────────────────
  useEffect(() => {
    const nodeById = new Map<number, SimNode>();
    const simNodes: SimNode[] = effectivePayload.nodes.map((n) => {
      const existing = nodesRef.current.find((prev) => prev.id === n.id);
      const center = clusterCenters.get(n.clusterId) || {
        x: dimensions.width / 2,
        y: dimensions.height / 2,
      };
      const saved = savedPositionsRef.current.get(n.id);
      const ext = n as TopologyNode & { _isSuperNode?: boolean; _childNodeIds?: number[] };
      const sn: SimNode = {
        id: n.id,
        node: n,
        clusterId: n.clusterId,
        radius: ext._isSuperNode
          ? Math.max(nodeRadius(n.totalBytes, maxNodeBytes), TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX * 0.8)
          : nodeRadius(n.totalBytes, maxNodeBytes),
        x: existing?.x ?? saved?.x ?? center.x + (Math.random() - 0.5) * 80,
        y: existing?.y ?? saved?.y ?? center.y + (Math.random() - 0.5) * 80,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing ? existing.fx : (saved ? saved.x : undefined),
        fy: existing ? existing.fy : (saved ? saved.y : undefined),
        isSuperNode: ext._isSuperNode ?? false,
        childNodeIds: ext._childNodeIds,
        superBytes: ext._isSuperNode ? n.totalBytes : undefined,
        superDetections: ext._isSuperNode ? n.activeDetections : undefined,
        superAlerts: ext._isSuperNode ? n.activeAlerts : undefined,
      };
      nodeById.set(n.id, sn);
      return sn;
    });

    const simLinks: SimLink[] = effectivePayload.edges
      .filter((e) => nodeById.has(e.sourceId) && nodeById.has(e.targetId))
      .map((e) => ({
        source: nodeById.get(e.sourceId)!,
        target: nodeById.get(e.targetId)!,
        edge: e,
        width: edgeWidth(e.bytes, maxEdgeBytes),
      }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => 60 + (1 - d.width / TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX) * 80)
          .strength(0.4)
      )
      .force('charge', forceManyBody<SimNode>().strength(-200).distanceMax(400))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05))
      .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 8).strength(0.7))
      .force(
        'clusterX',
        forceX<SimNode>((d) => clusterCenters.get(d.clusterId)?.x ?? dimensions.width / 2).strength(0.12)
      )
      .force(
        'clusterY',
        forceY<SimNode>((d) => clusterCenters.get(d.clusterId)?.y ?? dimensions.height / 2).strength(0.12)
      )
      .alphaDecay(0.02)
      .velocityDecay(0.3)
      .on('tick', () => {
        forceRender((v) => v + 1);
      });

    simulationRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [effectivePayload, dimensions, maxNodeBytes, maxEdgeBytes, clusterCenters]);

  // ─── D3 Zoom ───────────────────────────────────────────────────
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      });

    zoomBehaviorRef.current = zoomBehavior;
    select(svg).call(zoomBehavior);
    select(svg).on('dblclick.zoom', null);

    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  // ─── Drag handler (disabled when locked) ───────────────────────
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  const handleDragStart = useCallback(
    (event: { active: number }, d: SimNode) => {
      if (isLockedRef.current) return;
      if (d.x == null || d.y == null) return; // guard: node not yet positioned by simulation
      if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    },
    []
  );

  const handleDrag = useCallback(
    (event: { x: number; y: number }, d: SimNode) => {
      if (isLockedRef.current) return;
      if (event.x == null || event.y == null) return; // guard: invalid drag coordinates
      d.fx = event.x;
      d.fy = event.y;
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: { active: number }, d: SimNode) => {
      if (isLockedRef.current) return;
      if (!event.active) simulationRef.current?.alphaTarget(0);
      if (d.x == null || d.y == null) return; // guard: node not positioned
      d.fx = d.x;
      d.fy = d.y;
      if (d.x != null && d.y != null && Number.isFinite(d.x) && Number.isFinite(d.y)) {
        savedPositionsRef.current.set(d.id, { x: d.x, y: d.y });
        saveSavedPositions(savedPositionsRef.current, viewKeyRef.current);
        setHasCustomLayout(true);
      }
    },
    []
  );

  // Apply drag behavior to node groups
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const nodeGroups = select(svg).selectAll<SVGGElement, SimNode>('.force-node');
    const dragBehavior = d3Drag<SVGGElement, SimNode>()
      .on('start', (event, d) => handleDragStart(event, d))
      .on('drag', (event, d) => handleDrag(event, d))
      .on('end', (event, d) => handleDragEnd(event, d));

    nodeGroups.call(dragBehavior);
  });

  // ─── Minimap rendering (Slice 43) ─────────────────────────────
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const links = linksRef.current;
    if (nodes.length === 0) return;

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      minX = Math.min(minX, n.x - n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }
    if (!Number.isFinite(minX)) return;

    const pad = 30;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scaleX = MINIMAP_WIDTH / worldW;
    const scaleY = MINIMAP_HEIGHT / worldH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    // Clear
    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Border
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw edges
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
    ctx.lineWidth = 0.5;
    for (const link of links) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.x == null || tgt.x == null) continue;
      ctx.beginPath();
      ctx.moveTo((src.x - minX) * scale + offsetX, (src.y! - minY) * scale + offsetY);
      ctx.lineTo((tgt.x - minX) * scale + offsetX, (tgt.y! - minY) * scale + offsetY);
      ctx.stroke();
    }

    // Draw nodes
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const nx = (n.x - minX) * scale + offsetX;
      const ny = (n.y - minY) * scale + offsetY;
      const nr = Math.max(n.radius * scale, 1.5);
      const color = n.isSuperNode
        ? (clusterColorMap.get(n.clusterId) || '#94a3b8')
        : (ROLE_DISPLAY[n.node.role]?.color || '#94a3b8');
      ctx.fillStyle = color;
      ctx.globalAlpha = n.id === selectedNodeId ? 1 : 0.7;
      ctx.beginPath();
      ctx.arc(nx, ny, nr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw viewport rectangle
    const vx = (-transform.x / transform.k - minX) * scale + offsetX;
    const vy = (-transform.y / transform.k - minY) * scale + offsetY;
    const vw = (dimensions.width / transform.k) * scale;
    const vh = (dimensions.height / transform.k) * scale;

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
    ctx.fillRect(vx, vy, vw, vh);

    // Store world bounds for click-to-navigate
    (canvas as any)._worldBounds = { minX, minY, worldW, worldH, scale, offsetX, offsetY };
  });

  // ─── Minimap click-to-navigate ────────────────────────────────
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = minimapCanvasRef.current;
      if (!canvas || !svgRef.current || !zoomBehaviorRef.current) return;
      const bounds = (canvas as any)._worldBounds;
      if (!bounds) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert minimap coords to world coords
      const worldX = (clickX - bounds.offsetX) / bounds.scale + bounds.minX;
      const worldY = (clickY - bounds.offsetY) / bounds.scale + bounds.minY;

      // Center the main view on this world position
      const newX = dimensions.width / 2 - worldX * transform.k;
      const newY = dimensions.height / 2 - worldY * transform.k;

      select(svgRef.current)
        .transition()
        .duration(300)
        .call(
          zoomBehaviorRef.current.transform,
          zoomIdentity.translate(newX, newY).scale(transform.k)
        );
    },
    [dimensions, transform]
  );

  // ─── Render helpers ────────────────────────────────────────────
  const nodes = nodesRef.current;
  const links = linksRef.current;

  const getEdgeStyle = useCallback(
    (link: SimLink) => {
      const e = link.edge;
      const edgeKey = `${e.sourceId}-${e.targetId}`;
      const isHighlighted =
        selectedNodeId !== null &&
        (e.sourceId === selectedNodeId || e.targetId === selectedNodeId);
      const isDimmed = selectedNodeId !== null && !isHighlighted;
      const isOnPath = pathEdgeKeys.has(edgeKey);
      const anomaly = anomalyEdgeMap.get(edgeKey);

      let strokeColor = e.hasDetection ? '#ef4444' : '#475569';
      let strokeOp = isDimmed ? 0.06 : isHighlighted ? 0.7 : 0.2;
      let strokeW = link.width;

      if (isOnPath) {
        strokeColor = '#22d3ee';
        strokeOp = 0.9;
        strokeW = Math.max(link.width, 3);
      }
      if (anomaly) {
        strokeColor = ANOMALY_SEVERITY_COLORS[anomaly.severity];
        strokeOp = 0.8;
        strokeW = Math.max(link.width, 2.5);
      }

      return { strokeColor, strokeOp, strokeW, isOnPath, anomaly };
    },
    [selectedNodeId, pathEdgeKeys, anomalyEdgeMap]
  );

  const getNodeStyle = useCallback(
    (simNode: SimNode) => {
      const n = simNode.node;
      const isSelected = selectedNodeId === n.id;
      const isConnected =
        selectedNodeId !== null &&
        effectivePayload.edges.some(
          (e) =>
            (e.sourceId === selectedNodeId && e.targetId === n.id) ||
            (e.targetId === selectedNodeId && e.sourceId === n.id)
        );
      const isDimmed =
        (selectedNodeId !== null && !isSelected && !isConnected) ||
        (matchingIds !== null && !matchingIds.has(n.id));
      const isOnPath = pathNodeIds.has(n.id);
      const nodeAnom = anomalyNodeMap.get(n.id);
      const hasIssue = n.activeDetections > 0 || n.activeAlerts > 0;

      return { isSelected, isDimmed, isOnPath, nodeAnom, hasIssue };
    },
    [selectedNodeId, matchingIds, pathNodeIds, anomalyNodeMap, effectivePayload.edges]
  );

  // ─── Node hover handler ───────────────────────────────────────
  const handleNodeMouseEnter = useCallback(
    (e: React.MouseEvent, simNode: SimNode) => {
      if (simNode.isSuperNode) {
        showTooltip(
          {
            kind: 'supernode',
            clusterLabel: clusterLabelMap.get(simNode.clusterId) || simNode.clusterId,
            nodeCount: simNode.childNodeIds?.length ?? 0,
            totalTraffic: formatBytes(simNode.superBytes ?? 0),
            detections: simNode.superDetections ?? 0,
            alerts: simNode.superAlerts ?? 0,
          },
          e.clientX,
          e.clientY
        );
      } else {
        const n = simNode.node;
        showTooltip(
          {
            kind: 'node',
            name: n.displayName,
            ip: n.ipaddr || 'N/A',
            role: ROLE_DISPLAY[n.role]?.label || n.role,
            traffic: formatBytes(n.totalBytes),
            detections: n.activeDetections,
            alerts: n.activeAlerts,
            cluster: clusterLabelMap.get(n.clusterId) || n.clusterId,
          },
          e.clientX,
          e.clientY
        );
      }
    },
    [showTooltip, clusterLabelMap]
  );

  // ─── Edge hover handler ───────────────────────────────────────
  const handleEdgeMouseEnter = useCallback(
    (e: React.MouseEvent, link: SimLink) => {
      const edge = link.edge;
      showTooltip(
        {
          kind: 'edge',
          protocol: edge.protocol || 'Unknown',
          traffic: formatBytes(edge.bytes),
          sourceName: nodeNameMap.get(edge.sourceId) || `Device ${edge.sourceId}`,
          targetName: nodeNameMap.get(edge.targetId) || `Device ${edge.targetId}`,
          hasDetection: edge.hasDetection,
        },
        e.clientX,
        e.clientY
      );
    },
    [showTooltip, nodeNameMap]
  );

  // ─── Pulse dash computation ───────────────────────────────
  const getPulseDash = useCallback(
    (link: SimLink) => {
      if (!shouldPulse) return undefined;
      // Dash speed proportional to traffic: more bytes = faster pulse
      const ratio = link.edge.bytes / maxEdgeBytes;
      const dashLen = 6 + ratio * 14;
      const gapLen = 4 + (1 - ratio) * 8;
      return {
        strokeDasharray: `${dashLen} ${gapLen}`,
        strokeDashoffset: -pulseOffsetRef.current * (0.5 + ratio * 1.5),
      };
    },
    [shouldPulse, maxEdgeBytes]
  );

  // ─── Edge Bundling computation (Slice 44) ────────────────────
  const EDGE_BUNDLE_THRESHOLD = 200;
  const shouldBundle = edgeBundlingEnabled && nodes.length >= EDGE_BUNDLE_THRESHOLD;

  const edgeBundles = useMemo((): EdgeBundle[] => {
    if (!shouldBundle) return [];

    // Group edges by cluster pair
    const bundleMap = new Map<string, { links: SimLink[]; totalBytes: number; hasDetection: boolean }>();
    const clusterMap = new Map<string, SimNode[]>();

    // Build cluster node map for centroids
    for (const n of nodes) {
      if (!clusterMap.has(n.clusterId)) clusterMap.set(n.clusterId, []);
      clusterMap.get(n.clusterId)!.push(n);
    }

    for (const link of links) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.clusterId === tgt.clusterId) continue; // Skip intra-cluster edges
      const key = src.clusterId < tgt.clusterId
        ? `${src.clusterId}||${tgt.clusterId}`
        : `${tgt.clusterId}||${src.clusterId}`;
      if (!bundleMap.has(key)) {
        bundleMap.set(key, { links: [], totalBytes: 0, hasDetection: false });
      }
      const b = bundleMap.get(key)!;
      b.links.push(link);
      b.totalBytes += link.edge.bytes;
      b.hasDetection = b.hasDetection || link.edge.hasDetection;
    }

    const bundles: EdgeBundle[] = [];
    for (const entry of Array.from(bundleMap.entries())) {
      const [key, data] = entry;
      if (data.links.length < 2) continue; // Only bundle when 2+ edges
      const [srcCluster, tgtCluster] = key.split('||');
      const srcNodes = clusterMap.get(srcCluster) || [];
      const tgtNodes = clusterMap.get(tgtCluster) || [];

      const srcCx = srcNodes.length > 0
        ? srcNodes.reduce((s, n) => s + (n.x ?? 0), 0) / srcNodes.length
        : 0;
      const srcCy = srcNodes.length > 0
        ? srcNodes.reduce((s, n) => s + (n.y ?? 0), 0) / srcNodes.length
        : 0;
      const tgtCx = tgtNodes.length > 0
        ? tgtNodes.reduce((s, n) => s + (n.x ?? 0), 0) / tgtNodes.length
        : 0;
      const tgtCy = tgtNodes.length > 0
        ? tgtNodes.reduce((s, n) => s + (n.y ?? 0), 0) / tgtNodes.length
        : 0;

      bundles.push({
        sourceClusterId: srcCluster,
        targetClusterId: tgtCluster,
        edges: data.links,
        totalBytes: data.totalBytes,
        edgeCount: data.links.length,
        hasDetection: data.hasDetection,
        srcCx, srcCy, tgtCx, tgtCy,
      });
    }
    return bundles;
  }, [shouldBundle, nodes, links]);

  // Set of edge indices that are bundled (to hide individual edges)
  const bundledEdgeSet = useMemo(() => {
    if (!shouldBundle) return new Set<number>();
    const set = new Set<number>();
    for (const bundle of edgeBundles) {
      for (const link of bundle.edges) {
        const idx = links.indexOf(link);
        if (idx >= 0) set.add(idx);
      }
    }
    return set;
  }, [shouldBundle, edgeBundles, links]);

  // ─── Edge bundle tooltip handler (Slice 44) ──────────────────
  const handleBundleMouseEnter = useCallback(
    (e: React.MouseEvent, bundle: EdgeBundle) => {
      const srcLabel = clusterLabelMap.get(bundle.sourceClusterId) || bundle.sourceClusterId;
      const tgtLabel = clusterLabelMap.get(bundle.targetClusterId) || bundle.targetClusterId;
      showTooltip(
        {
          kind: 'edge',
          protocol: `${bundle.edgeCount} bundled edges`,
          traffic: formatBytes(bundle.totalBytes),
          sourceName: srcLabel,
          targetName: tgtLabel,
          hasDetection: bundle.hasDetection,
        },
        e.clientX,
        e.clientY
      );
    },
    [showTooltip, clusterLabelMap]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      data-testid="force-graph-container"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        data-testid="topology-svg"
        style={{ cursor: 'grab', background: 'transparent' }}
        onMouseLeave={hideTooltip}
        onContextMenu={(e) => {
          // Suppress default context menu on the SVG canvas
          // Node-level context menu is handled per-node
          e.preventDefault();
        }}
      >
        <defs>
          <radialGradient id="node-glow-fg">
            <stop offset="0%" stopColor="rgba(34,211,238,0.3)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0)" />
          </radialGradient>
          <filter id="path-glow-fg" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="node-select-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Cluster background regions */}
          {payload.clusters.map((c, i) => {
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

          {/* Edges */}
          <g data-testid="topology-edges">
            {links.map((link, i) => {
              // Skip edges that are bundled (Slice 44)
              if (shouldBundle && bundledEdgeSet.has(i)) return null;
              const src = link.source as SimNode;
              const tgt = link.target as SimNode;
              if (src.x == null || tgt.x == null) return null;

              const { strokeColor, strokeOp, strokeW, isOnPath, anomaly } =
                getEdgeStyle(link);
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
                    onMouseEnter={(e) => handleEdgeMouseEnter(e, link)}
                    onMouseMove={(e) => handleEdgeMouseEnter(e, link)}
                    onMouseLeave={hideTooltip}
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
                      ...(pulseDash ? {
                        strokeDasharray: pulseDash.strokeDasharray,
                        strokeDashoffset: pulseDash.strokeDashoffset,
                      } : {}),
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

          {/* Edge Bundles (Slice 44) */}
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
                // Slight curve offset perpendicular to the line
                const perpX = len > 0 ? -dy / len * 20 : 0;
                const perpY = len > 0 ? dx / len * 20 : 0;
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
                      onMouseEnter={(e) => handleBundleMouseEnter(e, bundle)}
                      onMouseMove={(e) => handleBundleMouseEnter(e, bundle)}
                      onMouseLeave={hideTooltip}
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
                Math.atan2((tgtNode.y ?? 0) - (srcNode.y ?? 0), (tgtNode.x ?? 0) - (srcNode.x ?? 0)) *
                (180 / Math.PI);
              return (
                <g
                  key={`arrow-${i}`}
                  transform={`translate(${mx},${my}) rotate(${angle})`}
                >
                  <polygon points="-6,-5 6,0 -6,5" fill="#22d3ee" fillOpacity={0.9} />
                </g>
              );
            })}

          {/* Nodes */}
          <g data-testid="topology-nodes">
            {nodes.map((simNode) => {
              if (simNode.x == null || simNode.y == null) return null;
              const n = simNode.node;
              const r = simNode.radius;
              const color = simNode.isSuperNode
                ? (clusterColorMap.get(simNode.clusterId) || '#94a3b8')
                : ROLE_DISPLAY[n.role].color;
              const clusterColor = clusterColorMap.get(n.clusterId) || '#475569';
              const { isSelected, isDimmed, isOnPath, nodeAnom, hasIssue } =
                getNodeStyle(simNode);

              return (
                <g
                  key={n.id}
                  className="force-node"
                  transform={`translate(${simNode.x}, ${simNode.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (simNode.isSuperNode) {
                      // Double-click or click on super-node expands it
                      setCollapsedClusters((prev) => {
                        const next = new Set(prev);
                        next.delete(simNode.clusterId);
                        return next;
                      });
                    } else {
                      onSelectNode(isSelected ? null : n.id);
                    }
                  }}
                  onMouseEnter={(e) => handleNodeMouseEnter(e, simNode)}
                  onMouseMove={(e) => handleNodeMouseEnter(e, simNode)}
                  onMouseLeave={hideTooltip}
                  onContextMenu={(e) => {
                    if (!simNode.isSuperNode) {
                      handleContextMenu(e, simNode);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  data-testid={simNode.isSuperNode ? `topology-supernode-${simNode.clusterId}` : `topology-node-${n.id}`}
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
                      <polygon
                        points={hexPoints(r - 2)}
                        fill={color}
                        fillOpacity={0.4}
                      />
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
                      {/* Pin indicator ring (Slice 45) — dashed violet ring for pinned/dragged nodes */}
                      {simNode.fx != null && simNode.fy != null && !isOnPath && !isSelected && !nodeAnom && (
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
                      {r >= 12 && (
                        <circle
                          r={3}
                          cx={0}
                          cy={0}
                          fill="#fff"
                          fillOpacity={0.5}
                        />
                      )}
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
        </g>
      </svg>

      {/* ─── Minimap overlay (Slice 43) ──────────────────────────── */}
      <div
        className="absolute z-40"
        style={{
          right: MINIMAP_PADDING,
          bottom: MINIMAP_PADDING,
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
        data-testid="topology-minimap"
      >
        <canvas
          ref={minimapCanvasRef}
          width={MINIMAP_WIDTH}
          height={MINIMAP_HEIGHT}
          style={{ cursor: 'crosshair', display: 'block' }}
          onClick={handleMinimapClick}
          data-testid="minimap-canvas"
        />
      </div>

      {/* ─── Floating Tooltip (HTML overlay) ─────────────────────── */}
      {tooltip && (
        <div
          data-testid="topology-tooltip"
          className="absolute pointer-events-none z-50"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 8,
            maxWidth: 280,
          }}
        >
          <div
            className="rounded-lg border shadow-xl text-xs"
            style={{
              background: 'rgba(15, 23, 42, 0.95)',
              borderColor: 'rgba(71, 85, 105, 0.5)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {tooltip.data.kind === 'node' && (
              <div className="p-3 space-y-1.5">
                <div className="font-semibold text-white text-sm truncate">
                  {tooltip.data.name}
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
                  <span className="text-slate-500">IP</span>
                  <span className="font-mono text-xs">{tooltip.data.ip}</span>
                  <span className="text-slate-500">Role</span>
                  <span>{tooltip.data.role}</span>
                  <span className="text-slate-500">Cluster</span>
                  <span className="truncate">{tooltip.data.cluster}</span>
                  <span className="text-slate-500">Traffic</span>
                  <span className="font-mono text-amber-400">{tooltip.data.traffic}</span>
                  <span className="text-slate-500">Detections</span>
                  <span className={tooltip.data.detections > 0 ? 'text-red-400 font-semibold' : ''}>
                    {tooltip.data.detections}
                  </span>
                  <span className="text-slate-500">Alerts</span>
                  <span className={tooltip.data.alerts > 0 ? 'text-orange-400 font-semibold' : ''}>
                    {tooltip.data.alerts}
                  </span>
                </div>
              </div>
            )}
            {tooltip.data.kind === 'supernode' && (
              <div className="p-3 space-y-1.5">
                <div className="font-semibold text-white text-sm truncate">
                  {tooltip.data.clusterLabel}
                </div>
                <div className="text-[10px] text-slate-400 mb-1">Collapsed super-node</div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
                  <span className="text-slate-500">Nodes</span>
                  <span className="font-mono">{tooltip.data.nodeCount}</span>
                  <span className="text-slate-500">Traffic</span>
                  <span className="font-mono text-amber-400">{tooltip.data.totalTraffic}</span>
                  <span className="text-slate-500">Detections</span>
                  <span className={tooltip.data.detections > 0 ? 'text-red-400 font-semibold' : ''}>
                    {tooltip.data.detections}
                  </span>
                  <span className="text-slate-500">Alerts</span>
                  <span className={tooltip.data.alerts > 0 ? 'text-orange-400 font-semibold' : ''}>
                    {tooltip.data.alerts}
                  </span>
                </div>
                <div className="text-[10px] text-cyan-400 mt-1">Click to expand</div>
              </div>
            )}
            {tooltip.data.kind === 'edge' && (
              <div className="p-3 space-y-1.5">
                <div className="font-semibold text-white text-sm flex items-center gap-2">
                  <span className="truncate max-w-[90px]">{tooltip.data.sourceName}</span>
                  <span className="text-slate-500 text-xs flex-shrink-0">&rarr;</span>
                  <span className="truncate max-w-[90px]">{tooltip.data.targetName}</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
                  <span className="text-slate-500">Protocol</span>
                  <span className="font-mono text-cyan-400">{tooltip.data.protocol}</span>
                  <span className="text-slate-500">Traffic</span>
                  <span className="font-mono text-amber-400">{tooltip.data.traffic}</span>
                  {tooltip.data.hasDetection && (
                    <>
                      <span className="text-slate-500">Status</span>
                      <span className="text-red-400 font-semibold">Detection active</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Context Menu (Slice 44) ──────────────────────────────── */}
      {contextMenu && (
        <div
          data-testid="topology-context-menu"
          className="absolute z-[60]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="rounded-lg border shadow-2xl text-xs min-w-[180px] py-1"
            style={{
              background: 'rgba(15, 23, 42, 0.97)',
              borderColor: 'rgba(71, 85, 105, 0.5)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-white/[0.06]">
              <div className="font-semibold text-white text-xs truncate">{contextMenu.displayName}</div>
              {contextMenu.ipaddr && (
                <div className="text-[10px] text-slate-400 font-mono">{contextMenu.ipaddr}</div>
              )}
            </div>
            {/* Actions */}
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-slate-300 flex items-center gap-2 transition-colors"
              onClick={() => {
                onTraceInFlowTheater?.(contextMenu.nodeId, contextMenu.displayName);
                closeContextMenu();
              }}
              data-testid="ctx-trace-flow-theater"
            >
              <span className="w-4 text-center text-cyan-400">⇝</span>
              <span>Trace in Flow Theater</span>
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-slate-300 flex items-center gap-2 transition-colors"
              onClick={() => {
                onShowBlastRadius?.(contextMenu.nodeId, contextMenu.displayName);
                closeContextMenu();
              }}
              data-testid="ctx-show-blast-radius"
            >
              <span className="w-4 text-center text-amber-400">◎</span>
              <span>Show Blast Radius</span>
            </button>
            <div className="border-t border-white/[0.06] my-0.5" />
            <button
              className={`w-full px-3 py-1.5 text-left hover:bg-white/[0.06] flex items-center gap-2 transition-colors ${
                contextMenu.ipaddr ? 'text-slate-300' : 'text-slate-600 cursor-not-allowed'
              }`}
              onClick={() => {
                if (contextMenu.ipaddr) handleCopyIp(contextMenu.ipaddr);
              }}
              disabled={!contextMenu.ipaddr}
              data-testid="ctx-copy-ip"
            >
              <span className="w-4 text-center text-green-400">⎘</span>
              <span>Copy IP{contextMenu.ipaddr ? '' : ' (no IP)'}</span>
            </button>
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-slate-300 flex items-center gap-2 transition-colors"
              onClick={() => handleTogglePin(contextMenu.nodeId)}
              data-testid="ctx-toggle-pin"
            >
              <span className="w-4 text-center text-violet-400">{contextMenu.isPinned ? '✖' : '⌖'}</span>
              <span>{contextMenu.isPinned ? 'Unpin Node' : 'Pin Node'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── Hex helper for super-node shape ────────────────────────────
function hexPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

export default ForceGraph;
