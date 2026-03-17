/**
 * Topology — Saved Views Panel (Rec 6 extraction from Topology.tsx)
 */

import { memo, useState } from 'react';
import { Save, FolderOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export interface SavedViewsCurrentState {
  viewMode: string;
  zoom: number;
  searchTerm: string;
  anomalyOverlayEnabled: boolean;
  criticalPathSource: number | null;
  criticalPathDestination: number | null;
  nodePositions: Record<string, { x: number; y: number }> | null;
}

export interface SavedViewsPanelProps {
  onLoadView: (view: any) => void;
  currentState: SavedViewsCurrentState;
}

function SavedViewsPanel({ onLoadView, currentState }: SavedViewsPanelProps) {
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const listQuery = trpc.savedViews.list.useQuery();
  const createMutation = trpc.savedViews.create.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setSaveName('');
      setShowSaveInput(false);
      toast.success('View saved');
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });
  const deleteMutation = trpc.savedViews.delete.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      toast.success('View deleted');
    },
  });

  const handleSave = () => {
    if (!saveName.trim()) return;
    createMutation.mutate({
      name: saveName.trim(),
      viewMode: currentState.viewMode,
      zoom: currentState.zoom,
      searchTerm: currentState.searchTerm,
      anomalyOverlayEnabled: currentState.anomalyOverlayEnabled,
      criticalPathSource: currentState.criticalPathSource,
      criticalPathDestination: currentState.criticalPathDestination,
      collapsedSubnets: [],
      roleFilters: [],
      protocolFilters: [],
      anomalyThreshold: 50,
      panX: 0,
      panY: 0,
      nodePositions: currentState.nodePositions,
    });
  };

  return (
    <div className="p-3 space-y-3" data-testid="saved-views-panel">
      {/* Save current view */}
      {showSaveInput ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="View name..."
            className="flex-1 px-2 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/30"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim() || createMutation.isPending}
            className="px-2 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {createMutation.isPending ? '...' : 'Save'}
          </button>
          <button
            onClick={() => { setShowSaveInput(false); setSaveName(''); }}
            className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <Save size={12} /> Save current view
        </button>
      )}

      {/* Saved views list */}
      <div className="space-y-1">
        {listQuery.isLoading && (
          <p className="text-xs text-zinc-600">Loading saved views...</p>
        )}
        {listQuery.data && listQuery.data.length === 0 && (
          <p className="text-xs text-zinc-600 italic">No saved views yet</p>
        )}
        {listQuery.data?.map((view: any) => (
          <div
            key={view.id}
            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.04] group"
          >
            <button
              onClick={() => onLoadView(view)}
              className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white flex-1 min-w-0 text-left"
            >
              <FolderOpen size={10} className="text-zinc-500 flex-shrink-0" />
              <span className="truncate">{view.name}</span>
            </button>
            <button
              onClick={() => deleteMutation.mutate({ id: view.id })}
              className="p-1 rounded hover:bg-red-500/10 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SavedViewsPanel);
