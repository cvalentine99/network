/**
 * Tier 5 — NOC-Grade Analytical Features: Shared Types
 *
 * Extends the base topology contract (shared/topology-types.ts) with:
 * - Subnet map view (35A): hierarchical subnet containers, aggregated inter-subnet edges
 * - Critical path highlighting (35B): source-to-destination path trace
 * - Anomaly detection overlay (35C): baseline deviation flagging
 * - Export topology (35D): PNG/SVG/JSON/CSV export
 * - Saved views (35E): persist/recall filter/grouping/zoom configurations
 * - Multi-appliance merge (35F): merge topologies from multiple appliances
 */

import type {
  TopologyNode,
  TopologyEdge,
  TopologyCluster,
  TopologyPayload,
  TopologyDeviceRole,
  TopologyProtocol,
} from './topology-types';

// ═══════════════════════════════════════════════════════════════════
// 35A — Subnet Map View
// ═══════════════════════════════════════════════════════════════════

/** View mode for the topology surface */
export type TopologyViewMode = 'constellation' | 'subnet-map';

/** A subnet container in the hierarchical view */
export interface SubnetContainer {
  /** Cluster ID (matches TopologyCluster.id) */
  clusterId: string;
  /** Human-readable label */
  label: string;
  /** CIDR notation if available (e.g., "10.1.20.0/24") */
  cidr: string | null;
  /** Grouping strategy */
  groupBy: 'subnet' | 'role' | 'vlan' | 'custom';
  /** Nodes inside this subnet */
  nodes: TopologyNode[];
  /** Total bytes across all nodes in this subnet */
  totalBytes: number;
  /** Total detections across all nodes */
  totalDetections: number;
  /** Total alerts across all nodes */
  totalAlerts: number;
  /** Whether this container is collapsed (showing as super-node) */
  collapsed: boolean;
}

/** An aggregated edge between two subnets */
export interface InterSubnetEdge {
  /** Source subnet cluster ID */
  sourceClusterId: string;
  /** Target subnet cluster ID */
  targetClusterId: string;
  /** Total bytes flowing between these subnets */
  totalBytes: number;
  /** Number of individual device-to-device edges aggregated */
  edgeCount: number;
  /** Protocols observed on this inter-subnet link */
  protocols: TopologyProtocol[];
  /** Whether any aggregated edge has a detection */
  hasDetection: boolean;
  /** Individual edges (for drill-down) */
  deviceEdges: TopologyEdge[];
}

/** The full subnet map payload (derived from TopologyPayload) */
export interface SubnetMapPayload {
  /** Subnet containers */
  subnets: SubnetContainer[];
  /** Aggregated inter-subnet edges */
  interSubnetEdges: InterSubnetEdge[];
  /** Intra-subnet edges (edges within the same subnet, for expanded view) */
  intraSubnetEdges: Map<string, TopologyEdge[]>;
  /** Summary statistics */
  summary: {
    totalSubnets: number;
    totalInterSubnetEdges: number;
    totalCrossSubnetBytes: number;
    totalIntraSubnetBytes: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// 35B — Critical Path Highlighting
// ═══════════════════════════════════════════════════════════════════

/** A node in the critical path */
export interface PathNode {
  /** Device ID */
  nodeId: number;
  /** Display name */
  displayName: string;
  /** Step index in the path (0 = source) */
  stepIndex: number;
}

/** An edge in the critical path */
export interface PathEdge {
  /** Source node ID */
  sourceId: number;
  /** Target node ID */
  targetId: number;
  /** Protocol on this hop */
  protocol: TopologyProtocol;
  /** Bytes on this hop */
  bytes: number;
  /** Latency on this hop (if available) */
  latencyMs: number | null;
}

/** The result of a critical path query */
export interface CriticalPathResult {
  /** Source device ID */
  sourceId: number;
  /** Destination device ID */
  destinationId: number;
  /** Ordered path nodes */
  path: PathNode[];
  /** Path edges */
  edges: PathEdge[];
  /** Total bytes along the path */
  totalBytes: number;
  /** Total latency along the path (sum of hops, null if any hop unknown) */
  totalLatencyMs: number | null;
  /** Whether the path is complete (source and destination connected) */
  pathFound: boolean;
  /** Number of hops */
  hopCount: number;
}

// ═══════════════════════════════════════════════════════════════════
// 35C — Anomaly Detection Overlay
// ═══════════════════════════════════════════════════════════════════

/** Severity level for anomalies */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/** An anomaly detected on an edge */
export interface EdgeAnomaly {
  /** Source node ID */
  sourceId: number;
  /** Target node ID */
  targetId: number;
  /** Current bytes in this time window */
  currentBytes: number;
  /** Baseline bytes (historical average) */
  baselineBytes: number;
  /** Deviation percentage: ((current - baseline) / baseline) * 100 */
  deviationPercent: number;
  /** Severity classification */
  severity: AnomalySeverity;
  /** Direction of anomaly */
  direction: 'spike' | 'drop';
  /** Human-readable description */
  description: string;
}

/** An anomaly detected on a node */
export interface NodeAnomaly {
  /** Device ID */
  nodeId: number;
  /** Current total bytes */
  currentBytes: number;
  /** Baseline bytes */
  baselineBytes: number;
  /** Deviation percentage */
  deviationPercent: number;
  /** Severity */
  severity: AnomalySeverity;
  /** Direction */
  direction: 'spike' | 'drop';
  /** Description */
  description: string;
}

/** Full anomaly overlay payload */
export interface AnomalyOverlayPayload {
  /** Edge anomalies */
  edgeAnomalies: EdgeAnomaly[];
  /** Node anomalies */
  nodeAnomalies: NodeAnomaly[];
  /** Baseline time window used for comparison */
  baselineWindow: {
    fromMs: number;
    toMs: number;
  };
  /** Current time window */
  currentWindow: {
    fromMs: number;
    toMs: number;
  };
  /** Threshold used for anomaly detection (percentage) */
  deviationThreshold: number;
  /** Summary */
  summary: {
    totalEdgeAnomalies: number;
    totalNodeAnomalies: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// 35D — Export Topology
// ═══════════════════════════════════════════════════════════════════

/** Export format options */
export type TopologyExportFormat = 'png' | 'svg' | 'json' | 'csv';

/** Export request */
export interface TopologyExportRequest {
  /** Format to export */
  format: TopologyExportFormat;
  /** Current view mode */
  viewMode: TopologyViewMode;
  /** Include anomaly overlay data */
  includeAnomalies: boolean;
  /** Include critical path data */
  includeCriticalPath: boolean;
}

/** Export result */
export interface TopologyExportResult {
  /** Format exported */
  format: TopologyExportFormat;
  /** Filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Data (base64 for binary, raw for text) */
  data: string;
  /** Timestamp of export */
  exportedAt: string;
}

// ═══════════════════════════════════════════════════════════════════
// 35E — Saved Views
// ═══════════════════════════════════════════════════════════════════

/** A saved topology view configuration */
export interface TopologySavedView {
  /** Unique view ID (DB-generated) */
  id: number;
  /** User-assigned name */
  name: string;
  /** View mode */
  viewMode: TopologyViewMode;
  /** Zoom level */
  zoom: number;
  /** Pan offset X */
  panX: number;
  /** Pan offset Y */
  panY: number;
  /** Collapsed subnet IDs (for subnet map view) */
  collapsedSubnets: string[];
  /** Active role filters (empty = show all) */
  roleFilters: TopologyDeviceRole[];
  /** Active protocol filters (empty = show all) */
  protocolFilters: TopologyProtocol[];
  /** Whether anomaly overlay is enabled */
  anomalyOverlayEnabled: boolean;
  /** Anomaly deviation threshold */
  anomalyThreshold: number;
  /** Critical path source/destination (null if not active) */
  criticalPathSource: number | null;
  /** Critical path destination */
  criticalPathDestination: number | null;
  /** Search term */
  searchTerm: string;
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Owner user ID */
  userId: string;
}

/** Request to create/update a saved view */
export interface SaveViewRequest {
  /** Name (required for create, optional for update) */
  name?: string;
  /** All view state fields */
  viewMode: TopologyViewMode;
  zoom: number;
  panX: number;
  panY: number;
  collapsedSubnets: string[];
  roleFilters: TopologyDeviceRole[];
  protocolFilters: TopologyProtocol[];
  anomalyOverlayEnabled: boolean;
  anomalyThreshold: number;
  criticalPathSource: number | null;
  criticalPathDestination: number | null;
  searchTerm: string;
}

// ═══════════════════════════════════════════════════════════════════
// 35F — Multi-Appliance Merge
// ═══════════════════════════════════════════════════════════════════

/** Source appliance metadata attached to merged topology data */
export interface ApplianceSource {
  /** Appliance config ID from DB */
  applianceId: number;
  /** Nickname or hostname */
  label: string;
  /** Color assigned for visual distinction */
  color: string;
}

/** A merged topology node (extends TopologyNode with source info) */
export interface MergedTopologyNode extends TopologyNode {
  /** Which appliance this node came from */
  applianceId: number;
  /** Whether this node appears in multiple appliances */
  isShared: boolean;
}

/** A merged topology payload */
export interface MergedTopologyPayload {
  /** All appliance sources */
  appliances: ApplianceSource[];
  /** Merged nodes (with appliance attribution) */
  nodes: MergedTopologyNode[];
  /** Merged edges */
  edges: TopologyEdge[];
  /** Merged clusters */
  clusters: TopologyCluster[];
  /** Per-appliance node counts */
  applianceNodeCounts: Record<number, number>;
  /** Nodes that appear in multiple appliances */
  sharedNodeCount: number;
  /** Summary */
  summary: {
    totalAppliances: number;
    totalNodes: number;
    totalEdges: number;
    totalClusters: number;
    sharedNodes: number;
    totalBytes: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// Utility Constants
// ═══════════════════════════════════════════════════════════════════

/** Default anomaly detection threshold (percentage deviation from baseline) */
export const DEFAULT_ANOMALY_THRESHOLD = 50;

/** Anomaly severity thresholds (percentage deviation) */
export const ANOMALY_SEVERITY_THRESHOLDS = {
  low: 50,
  medium: 100,
  high: 200,
  critical: 500,
} as const;

/** Colors for multi-appliance merge */
export const APPLIANCE_COLORS = [
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f97316', // orange
  '#6366f1', // indigo
  '#ec4899', // pink
  '#84cc16', // lime
] as const;

/** Anomaly severity colors */
export const ANOMALY_SEVERITY_COLORS: Record<AnomalySeverity, string> = {
  low: '#f59e0b',      // amber
  medium: '#f97316',   // orange
  high: '#ef4444',     // red
  critical: '#dc2626', // dark red
};
