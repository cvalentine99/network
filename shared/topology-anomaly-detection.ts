/**
 * Slice 35C — Anomaly Detection Overlay: Detection Logic
 *
 * Pure functions that compare current topology metrics against a baseline
 * to detect anomalous traffic patterns on edges and nodes.
 * No side effects, no network calls, no DOM access.
 */

import type {
  TopologyPayload,
  TopologyEdge,
  TopologyNode,
} from './topology-types';
import type {
  EdgeAnomaly,
  NodeAnomaly,
  AnomalyOverlayPayload,
  AnomalySeverity,
} from './topology-advanced-types';
import {
  DEFAULT_ANOMALY_THRESHOLD,
  ANOMALY_SEVERITY_THRESHOLDS,
} from './topology-advanced-types';

/**
 * Classify the severity of a deviation percentage.
 */
export function classifySeverity(absDeviationPercent: number): AnomalySeverity {
  if (absDeviationPercent >= ANOMALY_SEVERITY_THRESHOLDS.critical) return 'critical';
  if (absDeviationPercent >= ANOMALY_SEVERITY_THRESHOLDS.high) return 'high';
  if (absDeviationPercent >= ANOMALY_SEVERITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Compute deviation percentage: ((current - baseline) / baseline) * 100.
 * Returns 0 if baseline is 0 and current is also 0.
 * Returns Infinity guard: if baseline is 0 but current > 0, returns 100% of current as deviation.
 */
export function computeDeviation(current: number, baseline: number): number {
  if (baseline === 0 && current === 0) return 0;
  if (baseline === 0) return 100; // Treat new traffic as 100% deviation (capped)
  return ((current - baseline) / baseline) * 100;
}

/**
 * Detect anomalies on edges by comparing current topology against a baseline.
 *
 * @param current - Current topology payload
 * @param baseline - Baseline topology payload (historical average)
 * @param threshold - Minimum absolute deviation percentage to flag (default: 50%)
 */
export function detectEdgeAnomalies(
  current: TopologyPayload,
  baseline: TopologyPayload,
  threshold: number = DEFAULT_ANOMALY_THRESHOLD,
): EdgeAnomaly[] {
  // Build baseline edge lookup: "sourceId-targetId" → bytes
  const baselineEdgeBytes = new Map<string, number>();
  for (const edge of baseline.edges) {
    const key = `${edge.sourceId}-${edge.targetId}`;
    baselineEdgeBytes.set(key, edge.bytes);
    // Also store reverse for undirected comparison
    const reverseKey = `${edge.targetId}-${edge.sourceId}`;
    if (!baselineEdgeBytes.has(reverseKey)) {
      baselineEdgeBytes.set(reverseKey, edge.bytes);
    }
  }

  const anomalies: EdgeAnomaly[] = [];

  for (const edge of current.edges) {
    const key = `${edge.sourceId}-${edge.targetId}`;
    const baselineBytes = baselineEdgeBytes.get(key) ?? 0;
    const deviation = computeDeviation(edge.bytes, baselineBytes);
    const absDeviation = Math.abs(deviation);

    if (absDeviation >= threshold) {
      const direction = deviation >= 0 ? 'spike' : 'drop';
      const severity = classifySeverity(absDeviation);

      anomalies.push({
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        currentBytes: edge.bytes,
        baselineBytes,
        deviationPercent: Math.round(deviation * 100) / 100,
        severity,
        direction,
        description: `${direction === 'spike' ? 'Traffic spike' : 'Traffic drop'} of ${Math.abs(Math.round(deviation))}% on edge ${edge.sourceId}→${edge.targetId}`,
      });
    }
  }

  return anomalies;
}

/**
 * Detect anomalies on nodes by comparing current vs baseline total bytes.
 */
export function detectNodeAnomalies(
  current: TopologyPayload,
  baseline: TopologyPayload,
  threshold: number = DEFAULT_ANOMALY_THRESHOLD,
): NodeAnomaly[] {
  // Build baseline node bytes lookup
  const baselineNodeBytes = new Map<number, number>();
  for (const node of baseline.nodes) {
    baselineNodeBytes.set(node.id, node.totalBytes);
  }

  const anomalies: NodeAnomaly[] = [];

  for (const node of current.nodes) {
    const baselineBytes = baselineNodeBytes.get(node.id) ?? 0;
    const deviation = computeDeviation(node.totalBytes, baselineBytes);
    const absDeviation = Math.abs(deviation);

    if (absDeviation >= threshold) {
      const direction = deviation >= 0 ? 'spike' : 'drop';
      const severity = classifySeverity(absDeviation);

      anomalies.push({
        nodeId: node.id,
        currentBytes: node.totalBytes,
        baselineBytes,
        deviationPercent: Math.round(deviation * 100) / 100,
        severity,
        direction,
        description: `${direction === 'spike' ? 'Traffic spike' : 'Traffic drop'} of ${Math.abs(Math.round(deviation))}% on ${node.displayName}`,
      });
    }
  }

  return anomalies;
}

/**
 * Build a full AnomalyOverlayPayload from current and baseline topologies.
 */
export function buildAnomalyOverlay(
  current: TopologyPayload,
  baseline: TopologyPayload,
  threshold: number = DEFAULT_ANOMALY_THRESHOLD,
): AnomalyOverlayPayload {
  const edgeAnomalies = detectEdgeAnomalies(current, baseline, threshold);
  const nodeAnomalies = detectNodeAnomalies(current, baseline, threshold);

  const criticalCount =
    edgeAnomalies.filter((a) => a.severity === 'critical').length +
    nodeAnomalies.filter((a) => a.severity === 'critical').length;
  const highCount =
    edgeAnomalies.filter((a) => a.severity === 'high').length +
    nodeAnomalies.filter((a) => a.severity === 'high').length;
  const mediumCount =
    edgeAnomalies.filter((a) => a.severity === 'medium').length +
    nodeAnomalies.filter((a) => a.severity === 'medium').length;
  const lowCount =
    edgeAnomalies.filter((a) => a.severity === 'low').length +
    nodeAnomalies.filter((a) => a.severity === 'low').length;

  return {
    edgeAnomalies,
    nodeAnomalies,
    baselineWindow: baseline.timeWindow,
    currentWindow: current.timeWindow,
    deviationThreshold: threshold,
    summary: {
      totalEdgeAnomalies: edgeAnomalies.length,
      totalNodeAnomalies: nodeAnomalies.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
    },
  };
}

/**
 * Get the set of edge keys that have anomalies (for visual highlighting).
 */
export function getAnomalyEdgeKeys(anomalies: EdgeAnomaly[]): Map<string, EdgeAnomaly> {
  const map = new Map<string, EdgeAnomaly>();
  for (const a of anomalies) {
    map.set(`${a.sourceId}-${a.targetId}`, a);
    map.set(`${a.targetId}-${a.sourceId}`, a);
  }
  return map;
}

/**
 * Get the set of node IDs that have anomalies (for visual highlighting).
 */
export function getAnomalyNodeIds(anomalies: NodeAnomaly[]): Map<number, NodeAnomaly> {
  const map = new Map<number, NodeAnomaly>();
  for (const a of anomalies) {
    map.set(a.nodeId, a);
  }
  return map;
}
