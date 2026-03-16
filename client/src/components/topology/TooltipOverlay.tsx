/**
 * Topology ForceGraph — Tooltip overlay (HTML positioned over SVG)
 */

import type { TooltipData } from './types';

interface TooltipOverlayProps {
  tooltip: { data: TooltipData; x: number; y: number } | null;
}

export default function TooltipOverlay({ tooltip }: TooltipOverlayProps) {
  if (!tooltip) return null;

  return (
    <div
      data-testid="topology-tooltip"
      className="absolute pointer-events-none z-50"
      style={{
        left: tooltip.x + 16,
        top: tooltip.y - 8,
        maxWidth: 280,
      }}
    >
      <div
        className="rounded-lg border shadow-xl text-xs"
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderColor: 'rgba(71, 85, 105, 0.5)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {tooltip.data.kind === 'node' && (
          <div className="p-3 space-y-1.5">
            <div className="font-semibold text-white text-sm truncate">
              {tooltip.data.name}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
              <span className="text-slate-500">IP</span>
              <span className="font-mono text-xs">{tooltip.data.ip}</span>
              <span className="text-slate-500">Role</span>
              <span>{tooltip.data.role}</span>
              <span className="text-slate-500">Cluster</span>
              <span className="truncate">{tooltip.data.cluster}</span>
              <span className="text-slate-500">Traffic</span>
              <span className="font-mono text-amber-400">{tooltip.data.traffic}</span>
              <span className="text-slate-500">Detections</span>
              <span className={tooltip.data.detections > 0 ? 'text-red-400 font-semibold' : ''}>
                {tooltip.data.detections}
              </span>
              <span className="text-slate-500">Alerts</span>
              <span className={tooltip.data.alerts > 0 ? 'text-orange-400 font-semibold' : ''}>
                {tooltip.data.alerts}
              </span>
            </div>
          </div>
        )}
        {tooltip.data.kind === 'supernode' && (
          <div className="p-3 space-y-1.5">
            <div className="font-semibold text-white text-sm truncate">
              {tooltip.data.clusterLabel}
            </div>
            <div className="text-[10px] text-slate-400 mb-1">Collapsed super-node</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
              <span className="text-slate-500">Nodes</span>
              <span className="font-mono">{tooltip.data.nodeCount}</span>
              <span className="text-slate-500">Traffic</span>
              <span className="font-mono text-amber-400">{tooltip.data.totalTraffic}</span>
              <span className="text-slate-500">Detections</span>
              <span className={tooltip.data.detections > 0 ? 'text-red-400 font-semibold' : ''}>
                {tooltip.data.detections}
              </span>
              <span className="text-slate-500">Alerts</span>
              <span className={tooltip.data.alerts > 0 ? 'text-orange-400 font-semibold' : ''}>
                {tooltip.data.alerts}
              </span>
            </div>
            <div className="text-[10px] text-cyan-400 mt-1">Click to expand</div>
          </div>
        )}
        {tooltip.data.kind === 'edge' && (
          <div className="p-3 space-y-1.5">
            <div className="font-semibold text-white text-sm flex items-center gap-2">
              <span className="truncate max-w-[90px]">{tooltip.data.sourceName}</span>
              <span className="text-slate-500 text-xs flex-shrink-0">&rarr;</span>
              <span className="truncate max-w-[90px]">{tooltip.data.targetName}</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-slate-300">
              <span className="text-slate-500">Protocol</span>
              <span className="font-mono text-cyan-400">{tooltip.data.protocol}</span>
              <span className="text-slate-500">Traffic</span>
              <span className="font-mono text-amber-400">{tooltip.data.traffic}</span>
              {tooltip.data.hasDetection && (
                <>
                  <span className="text-slate-500">Status</span>
                  <span className="text-red-400 font-semibold">Detection active</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
