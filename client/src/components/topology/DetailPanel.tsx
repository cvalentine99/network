/**
 * Topology — Device detail side panel (Rec 6 extraction from Topology.tsx)
 */

import { memo } from 'react';
import { X, AlertTriangle, Activity, BarChart3 } from 'lucide-react';
import type { TopologyNode, TopologyEdge, TopologyDeviceRole } from '../../../../shared/topology-types';
import { ROLE_DISPLAY } from '../../../../shared/topology-types';
import { ANOMALY_SEVERITY_COLORS } from '../../../../shared/topology-advanced-types';
import type { NodeAnomaly, AnomalySeverity } from '../../../../shared/topology-advanced-types';
import CrossSurfaceNavButton from '../CrossSurfaceNavButton';
import { buildTopologyToBlastRadiusLink } from '../../../../shared/cross-surface-nav-types';

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

const ICON_MAP_PLACEHOLDER: Record<string, string> = {}; // Icons are inline via RoleIcon below

function RoleIcon({ role, size = 14 }: { role: TopologyDeviceRole; size?: number }) {
  const meta = ROLE_DISPLAY[role];
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: meta.color }}
      title={meta.label}
    />
  );
}

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

export interface DetailPanelProps {
  node: TopologyNode;
  edges: TopologyEdge[];
  nodeMap: Map<number, TopologyNode>;
  onClose: () => void;
  nodeAnomaly?: NodeAnomaly;
}

function DetailPanel({ node, edges, nodeMap, onClose, nodeAnomaly }: DetailPanelProps) {
  const meta = ROLE_DISPLAY[node.role];
  const connections = edges.filter((e) => e.sourceId === node.id || e.targetId === node.id);
  const peers = connections.map((e) => {
    const peerId = e.sourceId === node.id ? e.targetId : e.sourceId;
    return { edge: e, peer: nodeMap.get(peerId) };
  });

  return (
    <div
      data-testid="topology-detail-panel"
      className="absolute right-0 top-0 h-full w-80 bg-[#0d1117] border-l border-white/10 overflow-y-auto z-20"
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white truncate flex-1">{node.displayName}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
            data-testid="detail-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Identity */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-xs">
            <RoleIcon role={node.role} size={12} />
            <span style={{ color: meta.color }}>{meta.label}</span>
            {node.critical && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-medium">
                CRITICAL
              </span>
            )}
          </div>
          {node.ipaddr && (
            <div className="text-xs text-zinc-400">
              IP: <span className="text-zinc-300 font-mono">{node.ipaddr}</span>
            </div>
          )}
          {node.macaddr && (
            <div className="text-xs text-zinc-400">
              MAC: <span className="text-zinc-300 font-mono">{node.macaddr}</span>
            </div>
          )}
          <div className="text-xs text-zinc-400">
            Traffic: <span className="text-zinc-300">{formatBytes(node.totalBytes)}</span>
          </div>
        </div>

        {/* Anomaly indicator */}
        {nodeAnomaly && (
          <div className="mb-4 p-2 rounded border" style={{
            borderColor: `${ANOMALY_SEVERITY_COLORS[nodeAnomaly.severity]}40`,
            backgroundColor: `${ANOMALY_SEVERITY_COLORS[nodeAnomaly.severity]}10`,
          }}>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={12} style={{ color: ANOMALY_SEVERITY_COLORS[nodeAnomaly.severity] }} />
              <SeverityBadge severity={nodeAnomaly.severity} />
            </div>
            <p className="text-xs text-zinc-300">{nodeAnomaly.description}</p>
            <div className="flex gap-3 mt-1 text-[10px] text-zinc-500">
              <span>Baseline: {formatBytes(nodeAnomaly.baselineBytes)}</span>
              <span>Current: {formatBytes(nodeAnomaly.currentBytes)}</span>
            </div>
          </div>
        )}

        {/* Issues */}
        {(node.activeDetections > 0 || node.activeAlerts > 0) && (
          <div className="space-y-1 mb-4">
            {node.activeDetections > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle size={10} />
                {node.activeDetections} active detection{node.activeDetections > 1 ? 's' : ''}
              </div>
            )}
            {node.activeAlerts > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Activity size={10} />
                {node.activeAlerts} active alert{node.activeAlerts > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Connections */}
        <div className="mb-4">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">
            Connections ({connections.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {peers.map(({ edge, peer }, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white/[0.02] hover:bg-white/[0.05]"
              >
                <span className="text-zinc-300 truncate flex-1">
                  {peer?.displayName || `Device ${edge.sourceId === node.id ? edge.targetId : edge.sourceId}`}
                </span>
                <span className="text-zinc-500 ml-2">{edge.protocol}</span>
                <span className="text-zinc-500 ml-2">{formatBytes(edge.bytes)}</span>
              </div>
            ))}
            {connections.length === 0 && (
              <p className="text-xs text-zinc-600 italic">No connections</p>
            )}
          </div>
        </div>

        {/* Cross-surface nav */}
        <div className="pt-2 border-t border-white/[0.06]">
          <CrossSurfaceNavButton
            link={buildTopologyToBlastRadiusLink(node.id, node.displayName)}
            compact
          />
        </div>
      </div>
    </div>
  );
}

export default memo(DetailPanel);
