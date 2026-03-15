/**
 * Slice 21 — Living Topology: Zod Validators
 *
 * Schema enforcement for all topology data contracts.
 * Used by BFF route (server-side) and tests (validation).
 */

import { z } from 'zod';
import { TOPOLOGY_DEVICE_ROLES, TOPOLOGY_PROTOCOLS } from './topology-types';

// ─── Enums ─────────────────────────────────────────────────────────
export const TopologyDeviceRoleSchema = z.enum(TOPOLOGY_DEVICE_ROLES);
export const TopologyProtocolSchema = z.enum(TOPOLOGY_PROTOCOLS);

// ─── Node ──────────────────────────────────────────────────────────
export const TopologyNodeSchema = z.object({
  id: z.number().int().positive(),
  displayName: z.string().min(1),
  ipaddr: z.string().nullable(),
  macaddr: z.string().nullable(),
  role: TopologyDeviceRoleSchema,
  critical: z.boolean(),
  activeDetections: z.number().int().min(0),
  activeAlerts: z.number().int().min(0),
  totalBytes: z.number().min(0),
  clusterId: z.string().min(1),
});

// ─── Edge ──────────────────────────────────────────────────────────
export const TopologyEdgeSchema = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  protocol: TopologyProtocolSchema,
  bytes: z.number().min(0),
  hasDetection: z.boolean(),
  latencyMs: z.number().min(0).nullable(),
});

// ─── Cluster ───────────────────────────────────────────────────────
export const TopologyClusterSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  groupBy: z.enum(['subnet', 'role', 'vlan', 'custom']),
  nodeCount: z.number().int().min(0),
});

// ─── Node Position ─────────────────────────────────────────────────
export const TopologyNodePositionSchema = z.object({
  nodeId: z.number().int().positive(),
  x: z.number().finite(),
  y: z.number().finite(),
});

// ─── Summary ───────────────────────────────────────────────────────
export const TopologySummarySchema = z.object({
  totalNodes: z.number().int().min(0),
  totalEdges: z.number().int().min(0),
  totalClusters: z.number().int().min(0),
  nodesWithDetections: z.number().int().min(0),
  nodesWithAlerts: z.number().int().min(0),
  totalBytes: z.number().min(0),
  truncated: z.boolean(),
  maxNodes: z.number().int().positive(),
});

// ─── Full Payload ──────────────────────────────────────────────────
export const TopologyPayloadSchema = z.object({
  nodes: z.array(TopologyNodeSchema),
  edges: z.array(TopologyEdgeSchema),
  clusters: z.array(TopologyClusterSchema),
  summary: TopologySummarySchema,
  timeWindow: z.object({
    fromMs: z.number().int().positive(),
    toMs: z.number().int().positive(),
  }),
});

// ─── BFF Request ───────────────────────────────────────────────────
export const TopologyQueryRequestSchema = z.object({
  fromMs: z.number().int().positive(),
  toMs: z.number().int().positive(),
  clusterId: z.string().min(1).optional(),
  maxNodes: z.number().int().positive().max(500).optional(),
}).refine((d) => d.toMs > d.fromMs, {
  message: 'toMs must be greater than fromMs',
});

// ─── BFF Response Envelope ─────────────────────────────────────────
export const TopologyBffResponseSchema = z.object({
  _meta: z.object({
    fixture: z.string(),
    generatedAt: z.string(),
  }),
  intent: z.enum(['populated', 'quiet', 'error', 'transport-error', 'malformed']),
  payload: TopologyPayloadSchema.nullable(),
  error: z.string().nullable(),
});

// ─── Refinement Helpers ────────────────────────────────────────────

/** Validate that all edge sourceId/targetId reference existing node IDs */
export function validateEdgeReferences(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  const nodeIds = new Set(payload.nodes.map((n) => n.id));
  return payload.edges.every((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
}

/** Validate that all node clusterIds reference existing cluster IDs */
export function validateClusterReferences(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  const clusterIds = new Set(payload.clusters.map((c) => c.id));
  return payload.nodes.every((n) => clusterIds.has(n.clusterId));
}

/** Validate summary counts match actual array lengths */
export function validateSummaryCounts(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  return (
    payload.summary.totalNodes === payload.nodes.length &&
    payload.summary.totalEdges === payload.edges.length &&
    payload.summary.totalClusters === payload.clusters.length
  );
}

/** Validate that node IDs are unique */
export function validateUniqueNodeIds(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  const ids = payload.nodes.map((n) => n.id);
  return new Set(ids).size === ids.length;
}

/** Validate that edges are unique (no duplicate source-target pairs) */
export function validateUniqueEdges(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  const keys = payload.edges.map((e) => `${e.sourceId}-${e.targetId}`);
  return new Set(keys).size === keys.length;
}

/** Validate cluster nodeCount matches actual node membership */
export function validateClusterNodeCounts(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  const counts = new Map<string, number>();
  for (const n of payload.nodes) {
    counts.set(n.clusterId, (counts.get(n.clusterId) || 0) + 1);
  }
  return payload.clusters.every((c) => (counts.get(c.id) || 0) === c.nodeCount);
}

/** Validate nodesWithDetections/Alerts summary fields */
export function validateDetectionAlertCounts(payload: z.infer<typeof TopologyPayloadSchema>): boolean {
  const withDetections = payload.nodes.filter((n) => n.activeDetections > 0).length;
  const withAlerts = payload.nodes.filter((n) => n.activeAlerts > 0).length;
  return (
    payload.summary.nodesWithDetections === withDetections &&
    payload.summary.nodesWithAlerts === withAlerts
  );
}
