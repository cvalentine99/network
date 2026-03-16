/**
 * Topology ForceGraph — Context menu overlay (right-click on node)
 */

import type { ContextMenuState } from './types';

interface ContextMenuOverlayProps {
  contextMenu: ContextMenuState | null;
  onTraceInFlowTheater?: (nodeId: number, displayName: string) => void;
  onShowBlastRadius?: (nodeId: number, displayName: string) => void;
  onCopyIp: (ip: string) => void;
  onTogglePin: (nodeId: number) => void;
  onClose: () => void;
}

export default function ContextMenuOverlay({
  contextMenu,
  onTraceInFlowTheater,
  onShowBlastRadius,
  onCopyIp,
  onTogglePin,
  onClose,
}: ContextMenuOverlayProps) {
  if (!contextMenu) return null;

  return (
    <div
      data-testid="topology-context-menu"
      className="absolute z-[60]"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-lg border shadow-2xl text-xs min-w-[180px] py-1"
        style={{
          background: 'rgba(15, 23, 42, 0.97)',
          borderColor: 'rgba(71, 85, 105, 0.5)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-1.5 border-b border-white/[0.06]">
          <div className="font-semibold text-white text-xs truncate">{contextMenu.displayName}</div>
          {contextMenu.ipaddr && (
            <div className="text-[10px] text-slate-400 font-mono">{contextMenu.ipaddr}</div>
          )}
        </div>
        {/* Actions */}
        <button
          className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-slate-300 flex items-center gap-2 transition-colors"
          onClick={() => {
            onTraceInFlowTheater?.(contextMenu.nodeId, contextMenu.displayName);
            onClose();
          }}
          data-testid="ctx-trace-flow-theater"
        >
          <span className="w-4 text-center text-cyan-400">⇝</span>
          <span>Trace in Flow Theater</span>
        </button>
        <button
          className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-slate-300 flex items-center gap-2 transition-colors"
          onClick={() => {
            onShowBlastRadius?.(contextMenu.nodeId, contextMenu.displayName);
            onClose();
          }}
          data-testid="ctx-show-blast-radius"
        >
          <span className="w-4 text-center text-amber-400">◎</span>
          <span>Show Blast Radius</span>
        </button>
        <div className="border-t border-white/[0.06] my-0.5" />
        <button
          className={`w-full px-3 py-1.5 text-left hover:bg-white/[0.06] flex items-center gap-2 transition-colors ${
            contextMenu.ipaddr ? 'text-slate-300' : 'text-slate-600 cursor-not-allowed'
          }`}
          onClick={() => {
            if (contextMenu.ipaddr) onCopyIp(contextMenu.ipaddr);
          }}
          disabled={!contextMenu.ipaddr}
          data-testid="ctx-copy-ip"
        >
          <span className="w-4 text-center text-green-400">⎘</span>
          <span>Copy IP{contextMenu.ipaddr ? '' : ' (no IP)'}</span>
        </button>
        <button
          className="w-full px-3 py-1.5 text-left hover:bg-white/[0.06] text-slate-300 flex items-center gap-2 transition-colors"
          onClick={() => onTogglePin(contextMenu.nodeId)}
          data-testid="ctx-toggle-pin"
        >
          <span className="w-4 text-center text-violet-400">{contextMenu.isPinned ? '✖' : '⌖'}</span>
          <span>{contextMenu.isPinned ? 'Unpin Node' : 'Pin Node'}</span>
        </button>
      </div>
    </div>
  );
}
