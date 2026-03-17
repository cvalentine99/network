/**
 * Topology — Subnet Map View (Rec 6 extraction from Topology.tsx)
 */

import { memo, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Layers,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import type { TopologyPayload, TopologyDeviceRole } from '../../../../shared/topology-types';
import { ROLE_DISPLAY } from '../../../../shared/topology-types';
import { buildSubnetMap, formatSubnetBytes } from '../../../../shared/topology-subnet-map';

const CLUSTER_COLORS = [
  '#22d3ee', '#a78bfa', '#f59e0b', '#10b981', '#f97316',
  '#6366f1', '#ec4899', '#84cc16', '#14b8a6', '#ef4444',
];

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

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

export interface SubnetMapViewProps {
  payload: TopologyPayload;
  collapsedSubnets: Set<string>;
  onToggleCollapse: (clusterId: string) => void;
}

function SubnetMapView({ payload, collapsedSubnets, onToggleCollapse }: SubnetMapViewProps) {
  const subnetMap = useMemo(() => buildSubnetMap(payload), [payload]);

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full" data-testid="subnet-map-view">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-zinc-400 pb-2 border-b border-white/[0.06]">
        <span><span className="text-white font-medium">{subnetMap.summary.totalSubnets}</span> subnets</span>
        <span><span className="text-white font-medium">{subnetMap.summary.totalInterSubnetEdges}</span> inter-subnet links</span>
        <span>Cross-subnet: {formatSubnetBytes(subnetMap.summary.totalCrossSubnetBytes)}</span>
        <span>Intra-subnet: {formatSubnetBytes(subnetMap.summary.totalIntraSubnetBytes)}</span>
      </div>

      {/* Subnet containers */}
      <div className="grid gap-3">
        {subnetMap.subnets.map((subnet, i) => {
          const isCollapsed = collapsedSubnets.has(subnet.clusterId);
          const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

          return (
            <div
              key={subnet.clusterId}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: `${color}30` }}
              data-testid={`subnet-container-${subnet.clusterId}`}
            >
              {/* Subnet header */}
              <button
                onClick={() => onToggleCollapse(subnet.clusterId)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
                style={{ backgroundColor: `${color}08` }}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight size={14} style={{ color }} /> : <ChevronDown size={14} style={{ color }} />}
                  <Layers size={14} style={{ color }} />
                  <span className="text-sm font-medium text-white">{subnet.label}</span>
                  {subnet.cidr && (
                    <span className="text-[10px] font-mono text-zinc-500">{subnet.cidr}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                  <span>{subnet.nodes.length} devices</span>
                  <span>{formatSubnetBytes(subnet.totalBytes)}</span>
                  {subnet.totalDetections > 0 && (
                    <span className="text-red-400">{subnet.totalDetections} detections</span>
                  )}
                  {subnet.totalAlerts > 0 && (
                    <span className="text-amber-400">{subnet.totalAlerts} alerts</span>
                  )}
                </div>
              </button>

              {/* Expanded: show devices */}
              {!isCollapsed && (
                <div className="px-3 py-2 space-y-1 border-t" style={{ borderColor: `${color}15` }}>
                  {subnet.nodes.map((node) => {
                    const meta = ROLE_DISPLAY[node.role];
                    return (
                      <div
                        key={node.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <RoleIcon role={node.role} size={10} />
                          <span className="text-zinc-300 truncate">{node.displayName}</span>
                          {node.ipaddr && (
                            <span className="text-zinc-600 font-mono text-[10px]">{node.ipaddr}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                          <span>{formatBytes(node.totalBytes)}</span>
                          {node.activeDetections > 0 && (
                            <AlertTriangle size={10} className="text-red-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inter-subnet edges */}
      {subnetMap.interSubnetEdges.length > 0 && (
        <div className="pt-3 border-t border-white/[0.06]">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">Inter-Subnet Traffic</h4>
          <div className="space-y-1">
            {subnetMap.interSubnetEdges
              .sort((a, b) => b.totalBytes - a.totalBytes)
              .map((edge, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-zinc-300 truncate">{edge.sourceClusterId}</span>
                    <ArrowRight size={10} className="text-zinc-600 flex-shrink-0" />
                    <span className="text-zinc-300 truncate">{edge.targetClusterId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 flex-shrink-0">
                    <span>{edge.edgeCount} links</span>
                    <span>{formatSubnetBytes(edge.totalBytes)}</span>
                    <span className="text-[10px]">{edge.protocols.join(', ')}</span>
                    {edge.hasDetection && <AlertTriangle size={10} className="text-red-400" />}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(SubnetMapView);
