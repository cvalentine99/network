/**
 * ForceGraph — D3-force-directed topology visualization (Slice 39)
 *
 * CONTRACT:
 * - Renders TopologyPayload as an interactive force-directed graph
 * - Supports drag, zoom, pan via d3-zoom and d3-drag
 * - Preserves all existing features: search, critical path, anomaly overlay
 * - Cluster gravity groups nodes by clusterId
 * - Node sizing by traffic volume, edge width by bytes
 * - Optimized for ultrawide monitors (5120x1440)
 * - Exposes SVG ref for export (PNG/SVG)
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
import { drag as d3Drag, type SubjectPosition } from 'd3-drag';
import type {
  TopologyNode,
  TopologyEdge,
  TopologyPayload,
  TopologyDeviceRole,
} from '../../../shared/topology-types';
import { ROLE_DISPLAY, TOPOLOGY_PERFORMANCE } from '../../../shared/topology-types';
import type {
  CriticalPathResult,
  AnomalyOverlayPayload,
  EdgeAnomaly,
  NodeAnomaly,
  AnomalySeverity,
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
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  edge: TopologyEdge;
  width: number;
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

// ─── Props ───────────────────────────────────────────────────────
export interface ForceGraphProps {
  payload: TopologyPayload;
  selectedNodeId: number | null;
  onSelectNode: (id: number | null) => void;
  searchTerm: string;
  criticalPath: CriticalPathResult | null;
  anomalyOverlay: AnomalyOverlayPayload | null;
  showAnomalyOverlay: boolean;
}

export interface ForceGraphHandle {
  svgElement: SVGSVGElement | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

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
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  const [, forceRender] = useState(0);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  // Expose handle for parent (zoom controls + SVG ref for export)
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
  }));

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

  // ─── Precompute max values ─────────────────────────────────────
  const maxNodeBytes = useMemo(
    () => Math.max(...payload.nodes.map((n) => n.totalBytes), 1),
    [payload]
  );
  const maxEdgeBytes = useMemo(
    () => Math.max(...payload.edges.map((e) => e.bytes), 1),
    [payload]
  );

  // ─── Cluster color map ─────────────────────────────────────────
  const clusterColorMap = useMemo(() => {
    const m = new Map<string, string>();
    payload.clusters.forEach((c, i) => m.set(c.id, CLUSTER_COLORS[i % CLUSTER_COLORS.length]));
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

  // ─── Search highlighting ───────────────────────────────────────
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
    // Build nodes
    const nodeById = new Map<number, SimNode>();
    const simNodes: SimNode[] = payload.nodes.map((n) => {
      // Preserve existing positions if we have them
      const existing = nodesRef.current.find((prev) => prev.id === n.id);
      const center = clusterCenters.get(n.clusterId) || {
        x: dimensions.width / 2,
        y: dimensions.height / 2,
      };
      const sn: SimNode = {
        id: n.id,
        node: n,
        clusterId: n.clusterId,
        radius: nodeRadius(n.totalBytes, maxNodeBytes),
        x: existing?.x ?? center.x + (Math.random() - 0.5) * 80,
        y: existing?.y ?? center.y + (Math.random() - 0.5) * 80,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      };
      nodeById.set(n.id, sn);
      return sn;
    });

    // Build links
    const simLinks: SimLink[] = payload.edges
      .filter((e) => nodeById.has(e.sourceId) && nodeById.has(e.targetId))
      .map((e) => ({
        source: nodeById.get(e.sourceId)!,
        target: nodeById.get(e.targetId)!,
        edge: e,
        width: edgeWidth(e.bytes, maxEdgeBytes),
      }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create simulation
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
      // Cluster gravity: pull nodes toward their cluster center
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
  }, [payload, dimensions, maxNodeBytes, maxEdgeBytes, clusterCenters]);

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

    // Disable double-click zoom (conflicts with node selection)
    select(svg).on('dblclick.zoom', null);

    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  // ─── Drag handler ──────────────────────────────────────────────
  const handleDragStart = useCallback(
    (event: { active: number }, d: SimNode) => {
      if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    },
    []
  );

  const handleDrag = useCallback(
    (event: { x: number; y: number }, d: SimNode) => {
      d.fx = event.x;
      d.fy = event.y;
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: { active: number }, d: SimNode) => {
      if (!event.active) simulationRef.current?.alphaTarget(0);
      d.fx = null;
      d.fy = null;
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
        payload.edges.some(
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
    [selectedNodeId, matchingIds, pathNodeIds, anomalyNodeMap, payload.edges]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      data-testid="force-graph-container"
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        data-testid="topology-svg"
        style={{ cursor: 'grab', background: 'transparent' }}
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
          {/* Glow filter for hovered/selected nodes */}
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
            const clusterNodes = nodes.filter((sn) => sn.clusterId === c.id);
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
              const src = link.source as SimNode;
              const tgt = link.target as SimNode;
              if (src.x == null || tgt.x == null) return null;

              const { strokeColor, strokeOp, strokeW, isOnPath, anomaly } =
                getEdgeStyle(link);

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
                    filter={isOnPath ? 'url(#path-glow-fg)' : undefined}
                    strokeLinecap="round"
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
                    >
                      {anomaly.direction === 'spike' ? '+' : '-'}
                      {Math.abs(Math.round(anomaly.deviationPercent))}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>

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
              const color = ROLE_DISPLAY[n.role].color;
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
                    onSelectNode(isSelected ? null : n.id);
                  }}
                  style={{ cursor: 'pointer' }}
                  data-testid={`topology-node-${n.id}`}
                  opacity={isDimmed ? 0.15 : 1}
                >
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
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
});

export default ForceGraph;
