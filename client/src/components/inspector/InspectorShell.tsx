/**
 * InspectorShell — Right-side collapsible detail panel.
 *
 * Opens/closes without breaking layout. In Slice 00 this was a placeholder shell.
 * Slice 13 adds InspectorBreadcrumb between the header and content area.
 */
import { X } from 'lucide-react';
import { GOLD, MUTED, BRIGHT } from '@/components/DashboardWidgets';
import { InspectorBreadcrumb } from './InspectorBreadcrumb';

export interface InspectorShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
}

export function InspectorShell({ isOpen, onClose, title, children }: InspectorShellProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed top-0 right-0 h-full z-50 flex flex-col"
      style={{
        width: 420,
        background: 'oklch(0.08 0.005 260 / 98%)',
        borderLeft: '1px solid oklch(1 0 0 / 8%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 h-14 shrink-0"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)' }}
      >
        <span className="text-sm font-semibold" style={{ color: BRIGHT }}>
          {title || 'Inspector'}
        </span>
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" style={{ color: MUTED }} />
        </button>
      </div>

      {/* Breadcrumb trail (Slice 13) — only renders when history exists */}
      <InspectorBreadcrumb />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {children || (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'oklch(0.769 0.108 85.805 / 8%)' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
            </div>
            <p className="text-xs text-center" style={{ color: MUTED }}>
              Select an item to inspect
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
