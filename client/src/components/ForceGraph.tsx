/**
 * ForceGraph — D3-force-directed topology visualization (Slices 39-45)
 *
 * CONTRACT:
 * - Renders TopologyPayload as an interactive force-directed graph
 * - Supports drag, zoom, pan via d3-zoom and d3-drag
 * - Preserves all existing features: search, critical path, anomaly overlay
 * - Cluster gravity groups nodes by clusterId
 * - Node sizing by traffic volume, edge width by bytes
 * - Optimized for ultrawide monitors (5120x1440)
 * - Exposes SVG ref for export (PNG/SVG)
 * - Node tooltip on hover, edge label on hover
 * - Layout persistence per view key
 * - Lock All toggle, minimap, node grouping, pulse animation
 * - Right-click context menu, edge bundling, drag-to-rearrange
 *
 * Live integration: deferred by contract.
 *
 * DECOMPOSITION: This file is the orchestrator. Rendering logic is in
 * ./topology/ sub-modules. See topology/index.ts for the barrel export.
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
} from 'd3-force';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { drag as d3Drag } from 'd3-drag';
import { ROLE_DISPLAY, TOPOLOGY_PERFORMANCE } from '../../../shared/topology-types';
import { ANOMALY_SEVERITY_COLORS } from '../../../shared/topology-advanced-types';
import { getPathNodeIds, getPathEdgeKeys } from '../../../shared/topology-critical-path';
import { getAnomalyEdgeKeys, getAnomalyNodeIds } from '../../../shared/topology-anomaly-detection';

import {
  // Types
  type SimNode,
  type SimLink,
  type TooltipData,
  type ContextMenuState,
  type EdgeBundle,
  type SavedPosition,
  type ForceGraphProps,
  type ForceGraphHandle,
  type TopologyNode,
  type EdgeAnomaly,
  type NodeAnomaly,
  // Constants
  CLUSTER_COLORS,
  EDGE_BUNDLE_THRESHOLD,
  // Scaling
  nodeRadius,
  edgeWidth,
  formatBytes,
  // Layout persistence
  loadSavedPositions,
  saveSavedPositions,
  clearSavedPositions,
  // Components
  TooltipOverlay,
  ContextMenuOverlay,
  MinimapOverlay,
  EdgeRenderer,
  NodeRenderer,
  ClusterBackgrounds,
} from './topology';

// Re-export public types for consumers
export type { ForceGraphProps, ForceGraphHandle, ContextMenuState };
export type { ContextMenuAction } from './topology/types';

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
  // ─── Refs ──────────────────────────────────────────────────────
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const savedPositionsRef = useRef<Map<number, SavedPosition>>(loadSavedPositions(viewKey));
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseOffsetRef = useRef(0);
  const pulseAnimFrameRef = useRef<number>(0);
  const isLockedRef = useRef(false);

  // ─── State ─────────────────────────────────────────────────────
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [, forceRender] = useState(0);
  const [hasCustomLayout, setHasCustomLayout] = useState(() => loadSavedPositions(viewKey).size > 0);
  const [isLocked, setIsLocked] = useState(false);
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [tooltip, setTooltip] = useState<{ data: TooltipData; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  isLockedRef.current = isLocked;

  // ─── View key reload ───────────────────────────────────────────
  useEffect(() => {
    savedPositionsRef.current = loadSavedPositions(viewKey);
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

  // ─── Pulse animation ──────────────────────────────────────────
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

  // ─── Tooltip handlers ─────────────────────────────────────────
  const showTooltip = useCallback(
    (data: TooltipData, clientX: number, clientY: number) => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltip({ data, x: clientX - rect.left, y: clientY - rect.top });
    },
    []
  );

  const hideTooltip = useCallback(() => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
      tooltipTimeoutRef.current = null;
    }, 100);
  }, []);

  // ─── Context menu handlers ────────────────────────────────────
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

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

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
      node.fx = null;
      node.fy = null;
      savedPositionsRef.current.delete(nodeId);
      saveSavedPositions(savedPositionsRef.current, viewKeyRef.current);
      simulationRef.current?.alpha(0.3).restart();
    } else {
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

  // ─── Imperative handle ────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    get svgElement() {
      return svgRef.current;
    },
    zoomIn: () => {
      if (svgRef.current && zoomBehaviorRef.current) {
        select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
      }
    },
    zoomOut: () => {
      if (svgRef.current && zoomBehaviorRef.current) {
        select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
      }
    },
    resetZoom: () => {
      if (svgRef.current && zoomBehaviorRef.current) {
        select(svgRef.current).transition().duration(500).call(zoomBehaviorRef.current.transform, zoomIdentity);
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
        if (next.has(clusterId)) next.delete(clusterId);
        else next.add(clusterId);
        return next;
      });
    },
  }), [hasCustomLayout, isLocked, collapsedClusters]);

  // ─── Responsive sizing ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─── Build effective payload with collapsed clusters ──────────
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

      const superNodeId = -(
        Math.abs(clusterId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) + 1
      );
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

    const effectiveNodes = [
      ...payload.nodes.filter((n) => !collapsedNodeIds.has(n.id)),
      ...superNodes,
    ];

    const nodeToSuper = new Map<number, number>();
    for (const sn of superNodes) {
      const ext = sn as TopologyNode & { _childNodeIds: number[] };
      for (const childId of ext._childNodeIds) nodeToSuper.set(childId, sn.id);
    }

    const edgeMap = new Map<string, (typeof payload.edges)[0]>();
    for (const e of payload.edges) {
      const srcId = nodeToSuper.get(e.sourceId) ?? e.sourceId;
      const tgtId = nodeToSuper.get(e.targetId) ?? e.targetId;
      if (srcId === tgtId) continue;
      const key = srcId < tgtId ? `${srcId}-${tgtId}` : `${tgtId}-${srcId}`;
      const existing = edgeMap.get(key);
      if (existing) {
        edgeMap.set(key, {
          ...existing,
          bytes: existing.bytes + e.bytes,
          hasDetection: existing.hasDetection || e.hasDetection,
        });
      } else {
        edgeMap.set(key, { ...e, sourceId: srcId, targetId: tgtId });
      }
    }

    return { ...payload, nodes: effectiveNodes, edges: Array.from(edgeMap.values()) };
  }, [payload, collapsedClusters]);

  // ─── Precompute max values ────────────────────────────────────
  const maxNodeBytes = useMemo(
    () => Math.max(...effectivePayload.nodes.map((n) => n.totalBytes), 1),
    [effectivePayload]
  );
  const maxEdgeBytes = useMemo(
    () => Math.max(...effectivePayload.edges.map((e) => e.bytes), 1),
    [effectivePayload]
  );

  // ─── Cluster maps ─────────────────────────────────────────────
  const clusterColorMap = useMemo(() => {
    const m = new Map<string, string>();
    payload.clusters.forEach((c, i) => m.set(c.id, CLUSTER_COLORS[i % CLUSTER_COLORS.length]));
    return m;
  }, [payload.clusters]);

  const clusterLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    payload.clusters.forEach((c) => m.set(c.id, c.label));
    return m;
  }, [payload.clusters]);

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

  const nodeNameMap = useMemo(() => {
    const m = new Map<number, string>();
    effectivePayload.nodes.forEach((n) => m.set(n.id, n.displayName));
    return m;
  }, [effectivePayload.nodes]);

  // ─── Search highlighting ──────────────────────────────────────
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

  // ─── Critical path / anomaly sets ─────────────────────────────
  const pathNodeIds = useMemo(
    () => (criticalPath?.pathFound ? getPathNodeIds(criticalPath) : new Set<number>()),
    [criticalPath]
  );
  const pathEdgeKeys = useMemo(
    () => (criticalPath?.pathFound ? getPathEdgeKeys(criticalPath) : new Set<string>()),
    [criticalPath]
  );
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

  // ─── Build simulation data ────────────────────────────────────
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
        fx: existing ? existing.fx : saved ? saved.x : undefined,
        fy: existing ? existing.fy : saved ? saved.y : undefined,
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

    if (simulationRef.current) simulationRef.current.stop();

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
      .velocityDecay(0.3);

    // Throttle simulation ticks to ~30fps via rAF (Rec 4)
    // Instead of re-rendering on every d3-force tick (can be 60+ fps),
    // we batch tick updates and only trigger a React render once per animation frame.
    let rafId: number | null = null;
    let tickPending = false;
    sim.on('tick', () => {
      tickPending = true;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (tickPending) {
            forceRender((v) => v + 1);
            tickPending = false;
          }
          rafId = null;
        });
      }
    });

    simulationRef.current = sim;
    return () => {
      sim.stop();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [effectivePayload, dimensions, maxNodeBytes, maxEdgeBytes, clusterCenters]);

  // ─── D3 Zoom ──────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });
    zoomBehaviorRef.current = zoomBehavior;
    select(svg).call(zoomBehavior);
    select(svg).on('dblclick.zoom', null);
    return () => { select(svg).on('.zoom', null); };
  }, []);

  // ─── Drag handler ─────────────────────────────────────────────
  const handleDragStart = useCallback(
    (event: { active: number }, d: SimNode) => {
      if (isLockedRef.current) return;
      if (d.x == null || d.y == null) return;
      if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    },
    []
  );

  const handleDrag = useCallback(
    (event: { x: number; y: number }, d: SimNode) => {
      if (isLockedRef.current) return;
      if (event.x == null || event.y == null) return;
      d.fx = event.x;
      d.fy = event.y;
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: { active: number }, d: SimNode) => {
      if (isLockedRef.current) return;
      if (!event.active) simulationRef.current?.alphaTarget(0);
      if (d.x == null || d.y == null) return;
      d.fx = d.x;
      d.fy = d.y;
      if (Number.isFinite(d.x) && Number.isFinite(d.y)) {
        savedPositionsRef.current.set(d.id, { x: d.x, y: d.y });
        saveSavedPositions(savedPositionsRef.current, viewKeyRef.current);
        setHasCustomLayout(true);
      }
    },
    []
  );

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

  // ─── Render helpers (callbacks for sub-components) ────────────
  const nodes = nodesRef.current;
  const links = linksRef.current;

  const getEdgeStyle = useCallback(
    (link: SimLink) => {
      const e = link.edge;
      const edgeKey = `${e.sourceId}-${e.targetId}`;
      const isHighlighted =
        selectedNodeId !== null && (e.sourceId === selectedNodeId || e.targetId === selectedNodeId);
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

  const getPulseDash = useCallback(
    (link: SimLink) => {
      if (!shouldPulse) return undefined;
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

  // ─── Edge bundling ────────────────────────────────────────────
  const shouldBundle = edgeBundlingEnabled && nodes.length >= EDGE_BUNDLE_THRESHOLD;

  const edgeBundles = useMemo((): EdgeBundle[] => {
    if (!shouldBundle) return [];
    const bundleMap = new Map<string, { links: SimLink[]; totalBytes: number; hasDetection: boolean }>();
    const clusterMap = new Map<string, SimNode[]>();

    for (const n of nodes) {
      if (!clusterMap.has(n.clusterId)) clusterMap.set(n.clusterId, []);
      clusterMap.get(n.clusterId)!.push(n);
    }

    for (const link of links) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (src.clusterId === tgt.clusterId) continue;
      const key =
        src.clusterId < tgt.clusterId
          ? `${src.clusterId}||${tgt.clusterId}`
          : `${tgt.clusterId}||${src.clusterId}`;
      if (!bundleMap.has(key)) bundleMap.set(key, { links: [], totalBytes: 0, hasDetection: false });
      const b = bundleMap.get(key)!;
      b.links.push(link);
      b.totalBytes += link.edge.bytes;
      b.hasDetection = b.hasDetection || link.edge.hasDetection;
    }

    const bundles: EdgeBundle[] = [];
    for (const entry of Array.from(bundleMap.entries())) {
      const [key, data] = entry;
      if (data.links.length < 2) continue;
      const [srcCluster, tgtCluster] = key.split('||');
      const srcNodes = clusterMap.get(srcCluster) || [];
      const tgtNodes = clusterMap.get(tgtCluster) || [];
      const srcCx = srcNodes.length > 0 ? srcNodes.reduce((s, n) => s + (n.x ?? 0), 0) / srcNodes.length : 0;
      const srcCy = srcNodes.length > 0 ? srcNodes.reduce((s, n) => s + (n.y ?? 0), 0) / srcNodes.length : 0;
      const tgtCx = tgtNodes.length > 0 ? tgtNodes.reduce((s, n) => s + (n.x ?? 0), 0) / tgtNodes.length : 0;
      const tgtCy = tgtNodes.length > 0 ? tgtNodes.reduce((s, n) => s + (n.y ?? 0), 0) / tgtNodes.length : 0;
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

  // ─── Node click handler ───────────────────────────────────────
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, simNode: SimNode) => {
      e.stopPropagation();
      if (simNode.isSuperNode) {
        setCollapsedClusters((prev) => {
          const next = new Set(prev);
          next.delete(simNode.clusterId);
          return next;
        });
      } else {
        const isSelected = selectedNodeId === simNode.node.id;
        onSelectNode(isSelected ? null : simNode.node.id);
      }
    },
    [selectedNodeId, onSelectNode]
  );

  // ─── Render ───────────────────────────────────────────────────
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
        onContextMenu={(e) => e.preventDefault()}
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
          <ClusterBackgrounds
            clusters={payload.clusters}
            nodes={nodes}
            collapsedClusters={collapsedClusters}
          />

          <EdgeRenderer
            links={links}
            nodes={nodes}
            shouldBundle={shouldBundle}
            bundledEdgeSet={bundledEdgeSet}
            edgeBundles={edgeBundles}
            criticalPath={criticalPath}
            getEdgeStyle={getEdgeStyle}
            getPulseDash={getPulseDash}
            onEdgeMouseEnter={handleEdgeMouseEnter}
            onBundleMouseEnter={handleBundleMouseEnter}
            onMouseLeave={hideTooltip}
          />

          <NodeRenderer
            nodes={nodes}
            clusterColorMap={clusterColorMap}
            getNodeStyle={getNodeStyle}
            onNodeClick={handleNodeClick}
            onNodeMouseEnter={handleNodeMouseEnter}
            onNodeMouseLeave={hideTooltip}
            onNodeContextMenu={handleContextMenu}
          />
        </g>
      </svg>

      <MinimapOverlay
        nodes={nodes}
        links={links}
        selectedNodeId={selectedNodeId}
        clusterColorMap={clusterColorMap}
        transform={transform}
        dimensions={dimensions}
        svgRef={svgRef}
        zoomBehaviorRef={zoomBehaviorRef}
      />

      <TooltipOverlay tooltip={tooltip} />

      <ContextMenuOverlay
        contextMenu={contextMenu}
        onTraceInFlowTheater={onTraceInFlowTheater}
        onShowBlastRadius={onShowBlastRadius}
        onCopyIp={handleCopyIp}
        onTogglePin={handleTogglePin}
        onClose={closeContextMenu}
      />
    </div>
  );
});

export default ForceGraph;
