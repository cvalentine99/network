/**
 * Slice 35D — Export Topology: Serialization Utilities
 *
 * Pure functions that serialize topology data into exportable formats.
 * PNG/SVG export requires DOM access and is handled in the frontend.
 * JSON/CSV export is pure data transformation handled here.
 */

import type {
  TopologyPayload,
  TopologyNode,
  TopologyEdge,
} from './topology-types';
import type { TopologyExportResult, TopologyExportFormat } from './topology-advanced-types';

/**
 * Export topology data as JSON.
 */
export function exportTopologyAsJson(
  payload: TopologyPayload,
  filename?: string,
): TopologyExportResult {
  const data = JSON.stringify(payload, null, 2);
  return {
    format: 'json',
    filename: filename || `topology-export-${Date.now()}.json`,
    mimeType: 'application/json',
    data,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Export topology nodes as CSV.
 */
export function exportNodesAsCsv(
  nodes: TopologyNode[],
  filename?: string,
): TopologyExportResult {
  const headers = [
    'id',
    'displayName',
    'ipaddr',
    'macaddr',
    'role',
    'critical',
    'activeDetections',
    'activeAlerts',
    'totalBytes',
    'clusterId',
  ];

  const rows = nodes.map((n) => [
    n.id,
    csvEscape(n.displayName),
    n.ipaddr || '',
    n.macaddr || '',
    n.role,
    n.critical,
    n.activeDetections,
    n.activeAlerts,
    n.totalBytes,
    n.clusterId,
  ].join(','));

  const data = [headers.join(','), ...rows].join('\n');

  return {
    format: 'csv',
    filename: filename || `topology-nodes-${Date.now()}.csv`,
    mimeType: 'text/csv',
    data,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Export topology edges as CSV.
 */
export function exportEdgesAsCsv(
  edges: TopologyEdge[],
  filename?: string,
): TopologyExportResult {
  const headers = [
    'sourceId',
    'targetId',
    'protocol',
    'bytes',
    'hasDetection',
    'latencyMs',
  ];

  const rows = edges.map((e) => [
    e.sourceId,
    e.targetId,
    e.protocol,
    e.bytes,
    e.hasDetection,
    e.latencyMs ?? '',
  ].join(','));

  const data = [headers.join(','), ...rows].join('\n');

  return {
    format: 'csv',
    filename: filename || `topology-edges-${Date.now()}.csv`,
    mimeType: 'text/csv',
    data,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Export full topology as combined CSV (nodes + edges in separate sections).
 */
export function exportTopologyAsCsv(
  payload: TopologyPayload,
  filename?: string,
): TopologyExportResult {
  const nodeExport = exportNodesAsCsv(payload.nodes);
  const edgeExport = exportEdgesAsCsv(payload.edges);

  const data = [
    '# NODES',
    nodeExport.data,
    '',
    '# EDGES',
    edgeExport.data,
    '',
    '# SUMMARY',
    `totalNodes,${payload.summary.totalNodes}`,
    `totalEdges,${payload.summary.totalEdges}`,
    `totalClusters,${payload.summary.totalClusters}`,
    `totalBytes,${payload.summary.totalBytes}`,
    `nodesWithDetections,${payload.summary.nodesWithDetections}`,
    `nodesWithAlerts,${payload.summary.nodesWithAlerts}`,
    `timeWindow.fromMs,${payload.timeWindow.fromMs}`,
    `timeWindow.toMs,${payload.timeWindow.toMs}`,
  ].join('\n');

  return {
    format: 'csv',
    filename: filename || `topology-full-${Date.now()}.csv`,
    mimeType: 'text/csv',
    data,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Trigger a browser download of an export result.
 * This is a frontend-only function (requires DOM).
 */
export function downloadExport(result: TopologyExportResult): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([result.data], { type: result.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of binary data (PNG/SVG from canvas).
 */
export function downloadBinaryExport(
  data: Blob,
  filename: string,
): void {
  if (typeof window === 'undefined') return;

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Escape a value for CSV output.
 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
