/**
 * InspectorBreadcrumb — Slice 13
 *
 * Renders a clickable breadcrumb trail showing the inspector navigation history.
 * Displayed between the InspectorShell header and the content area.
 *
 * CONTRACT:
 *   - Reads history[] and current selection from InspectorContext
 *   - Each breadcrumb entry is clickable → calls goToIndex(i)
 *   - Current selection is shown as the last (non-clickable) breadcrumb
 *   - Back button calls goBack() when canGoBack is true
 *   - Empty history → no breadcrumb bar rendered (quiet state)
 *   - Uses shared labelForSelection and kindLabel from inspector-history.ts
 *   - All interactive elements have data-testid attributes
 *   - Keyboard accessible (Enter/Space on breadcrumb items)
 */
import { useInspector } from '@/contexts/InspectorContext';
import { labelForSelection, kindLabel } from '../../../../shared/inspector-history';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GOLD, MUTED, BRIGHT, CYAN } from '@/components/DashboardWidgets';

const KIND_COLORS: Record<string, string> = {
  device: CYAN,
  detection: 'oklch(0.628 0.258 29.234)', // RED
  alert: 'oklch(0.769 0.188 70.08)', // AMBER
};

function kindColor(kind: string): string {
  return KIND_COLORS[kind] || MUTED;
}

export function InspectorBreadcrumb() {
  const { history, selection, canGoBack, goBack, goToIndex } = useInspector();

  // Quiet state: no history and no selection, or no history at all
  if (history.length === 0) return null;

  return (
    <div
      className="flex items-center gap-1 px-5 py-2 overflow-x-auto shrink-0"
      style={{
        borderBottom: '1px solid oklch(1 0 0 / 6%)',
        background: 'oklch(0.06 0.005 260 / 60%)',
      }}
      data-testid="inspector-breadcrumb"
    >
      {/* Back button */}
      {canGoBack && (
        <button
          onClick={goBack}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goBack(); }}
          className="h-6 w-6 flex items-center justify-center rounded transition-colors hover:bg-white/5 shrink-0"
          aria-label="Go back"
          data-testid="breadcrumb-back"
        >
          <ChevronLeft className="h-3.5 w-3.5" style={{ color: GOLD }} />
        </button>
      )}

      {/* History entries (clickable) */}
      {history.map((entry, i) => (
        <span key={`${entry.timestamp}-${i}`} className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => goToIndex(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goToIndex(i); }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-white/8 cursor-pointer"
            data-testid={`breadcrumb-entry-${i}`}
            aria-label={`Navigate to ${entry.label}`}
            tabIndex={0}
          >
            <span
              className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded"
              style={{
                color: kindColor(entry.selection.kind),
                background: `${kindColor(entry.selection.kind)}15`,
              }}
            >
              {kindLabel(entry.selection)}
            </span>
            <span className="text-[10px] truncate max-w-[100px]" style={{ color: MUTED }}>
              {entry.label}
            </span>
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'oklch(1 0 0 / 15%)' }} />
        </span>
      ))}

      {/* Current selection (non-clickable, highlighted) */}
      {selection && (
        <span
          className="flex items-center gap-1 px-1.5 py-0.5 shrink-0"
          data-testid="breadcrumb-current"
        >
          <span
            className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded"
            style={{
              color: kindColor(selection.kind),
              background: `${kindColor(selection.kind)}20`,
            }}
          >
            {kindLabel(selection)}
          </span>
          <span className="text-[10px] font-semibold truncate max-w-[120px]" style={{ color: BRIGHT }}>
            {labelForSelection(selection)}
          </span>
        </span>
      )}
    </div>
  );
}
