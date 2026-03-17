/**
 * Topology — Anomaly Summary Panel (Rec 6 extraction from Topology.tsx)
 */

import { memo } from 'react';
import { ANOMALY_SEVERITY_COLORS } from '../../../../shared/topology-advanced-types';
import type { AnomalyOverlayPayload, AnomalySeverity } from '../../../../shared/topology-advanced-types';

function SeverityBadge({ severity }: { severity: AnomalySeverity }) {
  const color = ANOMALY_SEVERITY_COLORS[severity];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {severity}
    </span>
  );
}

export interface AnomalySummaryPanelProps {
  overlay: AnomalyOverlayPayload;
}

function AnomalySummaryPanel({ overlay }: AnomalySummaryPanelProps) {
  const { summary } = overlay;
  const total = summary.totalEdgeAnomalies + summary.totalNodeAnomalies;

  return (
    <div className="p-3 space-y-2" data-testid="anomaly-summary-panel">
      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span><span className="text-white font-medium">{total}</span> anomalies detected</span>
        <span>Threshold: {overlay.deviationThreshold}%</span>
      </div>
      <div className="flex gap-2">
        {summary.criticalCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.critical}20`, color: ANOMALY_SEVERITY_COLORS.critical }}>
            {summary.criticalCount} critical
          </span>
        )}
        {summary.highCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.high}20`, color: ANOMALY_SEVERITY_COLORS.high }}>
            {summary.highCount} high
          </span>
        )}
        {summary.mediumCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.medium}20`, color: ANOMALY_SEVERITY_COLORS.medium }}>
            {summary.mediumCount} medium
          </span>
        )}
        {summary.lowCount > 0 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ANOMALY_SEVERITY_COLORS.low}20`, color: ANOMALY_SEVERITY_COLORS.low }}>
            {summary.lowCount} low
          </span>
        )}
      </div>
      {/* Top anomalies list */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {[...overlay.edgeAnomalies, ...overlay.nodeAnomalies]
          .sort((a, b) => Math.abs(b.deviationPercent) - Math.abs(a.deviationPercent))
          .slice(0, 5)
          .map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] py-0.5">
              <SeverityBadge severity={a.severity} />
              <span className="text-zinc-400 truncate">{a.description}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default memo(AnomalySummaryPanel);
