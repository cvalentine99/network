/**
 * Topology ForceGraph — Shared types
 * Extracted from ForceGraph.tsx for composability.
 */

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type {
  TopologyNode,
  TopologyEdge,
  TopologyPayload,
} from '../../../../shared/topology-types';
import type {
  CriticalPathResult,
  AnomalyOverlayPayload,
  EdgeAnomaly,
  NodeAnomaly,
} from '../../../../shared/topology-advanced-types';

// ─── D3 Simulation Node ──────────────────────────────────────────
export interface SimNode extends SimulationNodeDatum {
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

export interface SimLink extends SimulationLinkDatum<SimNode> {
  edge: TopologyEdge;
  width: number;
  /** For super-node edges: aggregated from multiple real edges */
  isSuperEdge?: boolean;
  /** Aggregated bytes for super-edges */
  superBytes?: number;
}

// ─── Tooltip types ──────────────────────────────────────────────
export interface NodeTooltipData {
  kind: 'node';
  name: string;
  ip: string;
  role: string;
  traffic: string;
  detections: number;
  alerts: number;
  cluster: string;
}

export interface SuperNodeTooltipData {
  kind: 'supernode';
  clusterLabel: string;
  nodeCount: number;
  totalTraffic: string;
  detections: number;
  alerts: number;
}

export interface EdgeTooltipData {
  kind: 'edge';
  protocol: string;
  traffic: string;
  sourceName: string;
  targetName: string;
  hasDetection: boolean;
}

export type TooltipData = NodeTooltipData | SuperNodeTooltipData | EdgeTooltipData;

// ─── Context Menu types ─────────────────────────────────────────
export interface ContextMenuAction {
  label: string;
  icon: string;
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

// ─── Edge Bundle types ──────────────────────────────────────────
export interface EdgeBundle {
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

// ─── Saved position for layout persistence ──────────────────────
export interface SavedPosition {
  x: number;
  y: number;
}

// ─── Props ──────────────────────────────────────────────────────
export interface ForceGraphProps {
  payload: TopologyPayload;
  selectedNodeId: number | null;
  onSelectNode: (id: number | null) => void;
  searchTerm: string;
  criticalPath: CriticalPathResult | null;
  anomalyOverlay: AnomalyOverlayPayload | null;
  showAnomalyOverlay: boolean;
  /** Whether pulse animation is enabled */
  pulseEnabled?: boolean;
  /** Whether the data source is live (not fixture) — pulse only animates when live */
  isLiveData?: boolean;
  /** Whether edge bundling is enabled — auto-enables at 200+ nodes */
  edgeBundlingEnabled?: boolean;
  /** View key for per-view position persistence */
  viewKey?: string;
  /** Callback when user selects "Trace in Flow Theater" from context menu */
  onTraceInFlowTheater?: (nodeId: number, displayName: string) => void;
  /** Callback when user selects "Show Blast Radius" from context menu */
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
  /** Collapse a cluster into a super-node */
  collapseCluster: (clusterId: string) => void;
  /** Expand a collapsed super-node back to individual nodes */
  expandCluster: (clusterId: string) => void;
  /** Get the set of currently collapsed cluster IDs */
  collapsedClusters: Set<string>;
  /** Toggle collapse for a cluster */
  toggleCluster: (clusterId: string) => void;
}

// Re-export upstream types used by sub-modules
export type { TopologyNode, TopologyEdge, TopologyPayload };
export type { CriticalPathResult, AnomalyOverlayPayload, EdgeAnomaly, NodeAnomaly };
