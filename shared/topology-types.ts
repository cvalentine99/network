/**
 * Slice 21 — Living Topology: Shared Types
 *
 * Defines the data contract for the constellation topology surface.
 * Nodes represent devices, edges represent observed traffic between them,
 * and clusters group nodes by role/subnet for visual organization.
 *
 * The BFF normalizes ExtraHop activity-map / peer-graph data into this
 * shape. The frontend never interprets raw ExtraHop payloads directly.
 */

// ─── Device Roles (ExtraHop-aligned) ───────────────────────────────
export const TOPOLOGY_DEVICE_ROLES = [
  'server',
  'client',
  'gateway',
  'firewall',
  'load_balancer',
  'db_server',
  'dns_server',
  'domain_controller',
  'file_server',
  'printer',
  'voip',
  'custom',
  'other',
  'unknown',
] as const;
export type TopologyDeviceRole = (typeof TOPOLOGY_DEVICE_ROLES)[number];

// ─── Edge Protocol Categories ──────────────────────────────────────
export const TOPOLOGY_PROTOCOLS = [
  'TCP',
  'UDP',
  'HTTP',
  'HTTPS',
  'DNS',
  'SSH',
  'SMB',
  'NFS',
  'LDAP',
  'RDP',
  'ICMP',
  'OTHER',
] as const;
export type TopologyProtocol = (typeof TOPOLOGY_PROTOCOLS)[number];

// ─── Node (Device) ─────────────────────────────────────────────────
export interface TopologyNode {
  /** Unique device ID (ExtraHop device OID) */
  id: number;
  /** Human-readable display name (hostname, IP, or ExtraHop default) */
  displayName: string;
  /** IPv4 address if available */
  ipaddr: string | null;
  /** MAC address */
  macaddr: string | null;
  /** Assigned or auto-detected role */
  role: TopologyDeviceRole;
  /** Whether this device is on the watchlist / critical list */
  critical: boolean;
  /** Active detection count in current time window */
  activeDetections: number;
  /** Active alert count in current time window */
  activeAlerts: number;
  /** Total bytes transferred in current time window */
  totalBytes: number;
  /** Cluster ID this node belongs to (matches TopologyCluster.id) */
  clusterId: string;
}

// ─── Edge (Traffic Link) ───────────────────────────────────────────
export interface TopologyEdge {
  /** Source node ID */
  sourceId: number;
  /** Target node ID */
  targetId: number;
  /** Dominant protocol on this link */
  protocol: TopologyProtocol;
  /** Total bytes on this edge in the time window */
  bytes: number;
  /** Whether this edge carries detection-flagged traffic */
  hasDetection: boolean;
  /** Latency in milliseconds (round-trip, if available) */
  latencyMs: number | null;
}

// ─── Cluster (Grouping) ───────────────────────────────────────────
export interface TopologyCluster {
  /** Unique cluster identifier (e.g., "subnet-10.1.20", "role-gateway") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Grouping strategy that produced this cluster */
  groupBy: 'subnet' | 'role' | 'vlan' | 'custom';
  /** Number of nodes in this cluster */
  nodeCount: number;
}

// ─── Layout Position (computed by BFF or frontend) ─────────────────
export interface TopologyNodePosition {
  /** Node ID */
  nodeId: number;
  /** X coordinate (0-1 normalized, or pixel) */
  x: number;
  /** Y coordinate (0-1 normalized, or pixel) */
  y: number;
}

// ─── Summary Statistics ────────────────────────────────────────────
export interface TopologySummary {
  /** Total node count */
  totalNodes: number;
  /** Total edge count */
  totalEdges: number;
  /** Total cluster count */
  totalClusters: number;
  /** Nodes with active detections */
  nodesWithDetections: number;
  /** Nodes with active alerts */
  nodesWithAlerts: number;
  /** Total bytes across all edges */
  totalBytes: number;
  /** Whether the result was truncated to fit performance budget */
  truncated: boolean;
  /** Max nodes the BFF will return (performance budget) */
  maxNodes: number;
}

// ─── Full Topology Payload ─────────────────────────────────────────
export interface TopologyPayload {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  clusters: TopologyCluster[];
  summary: TopologySummary;
  timeWindow: {
    fromMs: number;
    toMs: number;
  };
}

// ─── BFF Request Shape ─────────────────────────────────────────────
export interface TopologyQueryRequest {
  fromMs: number;
  toMs: number;
  /** Optional: filter to specific cluster */
  clusterId?: string;
  /** Optional: max nodes to return (default: 200) */
  maxNodes?: number;
}

// ─── BFF Response Envelope ─────────────────────────────────────────
export interface TopologyBffResponse {
  _meta: {
    fixture: string;
    generatedAt: string;
  };
  intent: 'populated' | 'quiet' | 'error' | 'transport-error' | 'malformed';
  payload: TopologyPayload | null;
  error: string | null;
}

// ─── Role Display Metadata ─────────────────────────────────────────
export interface TopologyRoleMeta {
  label: string;
  color: string;
  icon: string; // Lucide icon name
}

export const ROLE_DISPLAY: Record<TopologyDeviceRole, TopologyRoleMeta> = {
  server:            { label: 'Server',            color: '#22d3ee', icon: 'Server' },
  client:            { label: 'Client',            color: '#a78bfa', icon: 'Monitor' },
  gateway:           { label: 'Gateway',           color: '#f59e0b', icon: 'Router' },
  firewall:          { label: 'Firewall',          color: '#ef4444', icon: 'Shield' },
  load_balancer:     { label: 'Load Balancer',     color: '#10b981', icon: 'Scale' },
  db_server:         { label: 'Database',          color: '#f97316', icon: 'Database' },
  dns_server:        { label: 'DNS Server',        color: '#6366f1', icon: 'Globe' },
  domain_controller: { label: 'Domain Controller', color: '#ec4899', icon: 'Key' },
  file_server:       { label: 'File Server',       color: '#84cc16', icon: 'HardDrive' },
  printer:           { label: 'Printer',           color: '#78716c', icon: 'Printer' },
  voip:              { label: 'VoIP',              color: '#14b8a6', icon: 'Phone' },
  custom:            { label: 'Custom',            color: '#8b5cf6', icon: 'Puzzle' },
  other:             { label: 'Other',             color: '#64748b', icon: 'CircleDot' },
  unknown:           { label: 'Unknown',           color: '#475569', icon: 'HelpCircle' },
};

// ─── Performance Budget Constants ──────────────────────────────────
export const TOPOLOGY_PERFORMANCE = {
  /** Maximum nodes the BFF should return */
  MAX_NODES: 200,
  /** Target render time in ms */
  TARGET_RENDER_MS: 4000,
  /** Node size range (px) for scaling by traffic volume */
  NODE_SIZE_MIN: 8,
  NODE_SIZE_MAX: 32,
  /** Edge width range (px) for scaling by bytes */
  EDGE_WIDTH_MIN: 1,
  EDGE_WIDTH_MAX: 6,
} as const;
