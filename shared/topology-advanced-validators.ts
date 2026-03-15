/**
 * Tier 5 — NOC-Grade Analytical Features: Zod Validators
 *
 * Schema enforcement for all Tier 5 topology data contracts.
 */

import { z } from 'zod';
import { TOPOLOGY_DEVICE_ROLES, TOPOLOGY_PROTOCOLS } from './topology-types';
import {
  TopologyNodeSchema,
  TopologyEdgeSchema,
  TopologyClusterSchema,
} from './topology-validators';

// ─── View Mode ────────────────────────────────────────────────────
export const TopologyViewModeSchema = z.enum(['constellation', 'subnet-map']);

// ═══════════════════════════════════════════════════════════════════
// 35A — Subnet Map View
// ═══════════════════════════════════════════════════════════════════

export const SubnetContainerSchema = z.object({
  clusterId: z.string().min(1),
  label: z.string().min(1),
  cidr: z.string().nullable(),
  groupBy: z.enum(['subnet', 'role', 'vlan', 'custom']),
  nodes: z.array(TopologyNodeSchema),
  totalBytes: z.number().min(0),
  totalDetections: z.number().int().min(0),
  totalAlerts: z.number().int().min(0),
  collapsed: z.boolean(),
});

export const InterSubnetEdgeSchema = z.object({
  sourceClusterId: z.string().min(1),
  targetClusterId: z.string().min(1),
  totalBytes: z.number().min(0),
  edgeCount: z.number().int().min(0),
  protocols: z.array(z.enum(TOPOLOGY_PROTOCOLS)),
  hasDetection: z.boolean(),
  deviceEdges: z.array(TopologyEdgeSchema),
});

export const SubnetMapSummarySchema = z.object({
  totalSubnets: z.number().int().min(0),
  totalInterSubnetEdges: z.number().int().min(0),
  totalCrossSubnetBytes: z.number().min(0),
  totalIntraSubnetBytes: z.number().min(0),
});

// ═══════════════════════════════════════════════════════════════════
// 35B — Critical Path Highlighting
// ═══════════════════════════════════════════════════════════════════

export const PathNodeSchema = z.object({
  nodeId: z.number().int().positive(),
  displayName: z.string().min(1),
  stepIndex: z.number().int().min(0),
});

export const PathEdgeSchema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  protocol: z.enum(TOPOLOGY_PROTOCOLS),
  bytes: z.number().min(0),
  latencyMs: z.number().min(0).nullable(),
});

export const CriticalPathResultSchema = z.object({
  sourceId: z.number().int().positive(),
  destinationId: z.number().int().positive(),
  path: z.array(PathNodeSchema),
  edges: z.array(PathEdgeSchema),
  totalBytes: z.number().min(0),
  totalLatencyMs: z.number().min(0).nullable(),
  pathFound: z.boolean(),
  hopCount: z.number().int().min(0),
});

// ═══════════════════════════════════════════════════════════════════
// 35C — Anomaly Detection Overlay
// ═══════════════════════════════════════════════════════════════════

export const AnomalySeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const EdgeAnomalySchema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  currentBytes: z.number().min(0),
  baselineBytes: z.number().min(0),
  deviationPercent: z.number().finite(),
  severity: AnomalySeveritySchema,
  direction: z.enum(['spike', 'drop']),
  description: z.string().min(1),
});

export const NodeAnomalySchema = z.object({
  nodeId: z.number().int().positive(),
  currentBytes: z.number().min(0),
  baselineBytes: z.number().min(0),
  deviationPercent: z.number().finite(),
  severity: AnomalySeveritySchema,
  direction: z.enum(['spike', 'drop']),
  description: z.string().min(1),
});

export const AnomalyOverlaySummarySchema = z.object({
  totalEdgeAnomalies: z.number().int().min(0),
  totalNodeAnomalies: z.number().int().min(0),
  criticalCount: z.number().int().min(0),
  highCount: z.number().int().min(0),
  mediumCount: z.number().int().min(0),
  lowCount: z.number().int().min(0),
});

export const AnomalyOverlayPayloadSchema = z.object({
  edgeAnomalies: z.array(EdgeAnomalySchema),
  nodeAnomalies: z.array(NodeAnomalySchema),
  baselineWindow: z.object({
    fromMs: z.number().int().positive(),
    toMs: z.number().int().positive(),
  }),
  currentWindow: z.object({
    fromMs: z.number().int().positive(),
    toMs: z.number().int().positive(),
  }),
  deviationThreshold: z.number().positive(),
  summary: AnomalyOverlaySummarySchema,
});

// ═══════════════════════════════════════════════════════════════════
// 35D — Export Topology
// ═══════════════════════════════════════════════════════════════════

export const TopologyExportFormatSchema = z.enum(['png', 'svg', 'json', 'csv']);

export const TopologyExportRequestSchema = z.object({
  format: TopologyExportFormatSchema,
  viewMode: TopologyViewModeSchema,
  includeAnomalies: z.boolean(),
  includeCriticalPath: z.boolean(),
});

export const TopologyExportResultSchema = z.object({
  format: TopologyExportFormatSchema,
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  data: z.string().min(1),
  exportedAt: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════════
// 35E — Saved Views
// ═══════════════════════════════════════════════════════════════════

export const TopologySavedViewSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  viewMode: TopologyViewModeSchema,
  zoom: z.number().positive().max(10),
  panX: z.number().finite(),
  panY: z.number().finite(),
  collapsedSubnets: z.array(z.string()),
  roleFilters: z.array(z.enum(TOPOLOGY_DEVICE_ROLES)),
  protocolFilters: z.array(z.enum(TOPOLOGY_PROTOCOLS)),
  anomalyOverlayEnabled: z.boolean(),
  anomalyThreshold: z.number().positive(),
  criticalPathSource: z.number().int().positive().nullable(),
  criticalPathDestination: z.number().int().positive().nullable(),
  searchTerm: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
});

export const SaveViewRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  viewMode: TopologyViewModeSchema,
  zoom: z.number().positive().max(10),
  panX: z.number().finite(),
  panY: z.number().finite(),
  collapsedSubnets: z.array(z.string()),
  roleFilters: z.array(z.enum(TOPOLOGY_DEVICE_ROLES)),
  protocolFilters: z.array(z.enum(TOPOLOGY_PROTOCOLS)),
  anomalyOverlayEnabled: z.boolean(),
  anomalyThreshold: z.number().positive(),
  criticalPathSource: z.number().int().positive().nullable(),
  criticalPathDestination: z.number().int().positive().nullable(),
  searchTerm: z.string(),
});

// ═══════════════════════════════════════════════════════════════════
// 35F — Multi-Appliance Merge
// ═══════════════════════════════════════════════════════════════════

export const ApplianceSourceSchema = z.object({
  applianceId: z.number().int().positive(),
  label: z.string().min(1),
  color: z.string().min(1),
});

export const MergedTopologyNodeSchema = TopologyNodeSchema.extend({
  applianceId: z.number().int().positive(),
  isShared: z.boolean(),
});

export const MergedTopologySummarySchema = z.object({
  totalAppliances: z.number().int().min(0),
  totalNodes: z.number().int().min(0),
  totalEdges: z.number().int().min(0),
  totalClusters: z.number().int().min(0),
  sharedNodes: z.number().int().min(0),
  totalBytes: z.number().min(0),
});

export const MergedTopologyPayloadSchema = z.object({
  appliances: z.array(ApplianceSourceSchema),
  nodes: z.array(MergedTopologyNodeSchema),
  edges: z.array(TopologyEdgeSchema),
  clusters: z.array(TopologyClusterSchema),
  applianceNodeCounts: z.record(z.string(), z.number().int().min(0)),
  sharedNodeCount: z.number().int().min(0),
  summary: MergedTopologySummarySchema,
});
