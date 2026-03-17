/**
 * Topology — Critical Path Panel (Rec 6 extraction from Topology.tsx)
 */

import { memo } from 'react';
import { ArrowRight } from 'lucide-react';
import type { TopologyNode } from '../../../../shared/topology-types';
import type { CriticalPathResult } from '../../../../shared/topology-advanced-types';

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

export interface CriticalPathPanelProps {
  nodes: TopologyNode[];
  sourceId: number | null;
  destinationId: number | null;
  onSetSource: (id: number | null) => void;
  onSetDestination: (id: number | null) => void;
  result: CriticalPathResult | null;
}

function CriticalPathPanel({
  nodes,
  sourceId,
  destinationId,
  onSetSource,
  onSetDestination,
  result,
}: CriticalPathPanelProps) {
  return (
    <div className="p-3 space-y-3" data-testid="critical-path-panel">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Source</label>
          <select
            value={sourceId ?? ''}
            onChange={(e) => onSetSource(e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 focus:outline-none focus:border-cyan-500/30"
            data-testid="path-source-select"
          >
            <option value="">Select source...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.displayName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">Destination</label>
          <select
            value={destinationId ?? ''}
            onChange={(e) => onSetDestination(e.target.value ? Number(e.target.value) : null)}
            className="w-full mt-1 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 focus:outline-none focus:border-cyan-500/30"
            data-testid="path-dest-select"
          >
            <option value="">Select destination...</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {result && (
        <div className="pt-2 border-t border-white/[0.06]">
          {result.pathFound ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span><span className="text-cyan-400 font-medium">{result.hopCount}</span> hops</span>
                <span>{formatBytes(result.totalBytes)} total</span>
                {result.totalLatencyMs !== null && (
                  <span>{result.totalLatencyMs.toFixed(1)} ms latency</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {result.path.map((pn, i) => (
                  <div key={pn.nodeId} className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-medium">
                      {pn.displayName}
                    </span>
                    {i < result.path.length - 1 && (
                      <ArrowRight size={10} className="text-cyan-500/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">No path found between selected devices</p>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(CriticalPathPanel);
