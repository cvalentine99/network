/**
 * EmptyState — Quiet state component.
 *
 * Empty data is valid. Empty data is NOT an error.
 * This renders when a query returns zero rows or the appliance has no data yet.
 */
import { Inbox } from 'lucide-react';
import { MUTED, GOLD } from '@/components/DashboardWidgets';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No data available',
  message = 'This is a valid quiet state. Data will appear when the source provides it.',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: 'oklch(0.769 0.108 85.805 / 6%)' }}
      >
        {icon || <Inbox className="h-5 w-5" style={{ color: GOLD, opacity: 0.5 }} />}
      </div>
      <p className="text-sm font-medium" style={{ color: MUTED }}>
        {title}
      </p>
      <p className="text-xs text-center max-w-xs" style={{ color: MUTED, opacity: 0.7 }}>
        {message}
      </p>
    </div>
  );
}
