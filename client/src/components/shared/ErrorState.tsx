/**
 * ErrorState — Failure state component.
 *
 * Covers two distinct failure modes:
 * 1. Transport error — BFF route failed (HTTP 5xx, network error, timeout)
 * 2. Data contract failure — payload arrived but failed schema validation
 *
 * These must NEVER be collapsed into quiet state.
 */
import { AlertTriangle, ShieldX } from 'lucide-react';
import { RED, MUTED, ORANGE } from '@/components/DashboardWidgets';

interface ErrorStateProps {
  type: 'transport' | 'contract';
  title?: string;
  message?: string;
  details?: string;
}

export function ErrorState({
  type,
  title,
  message,
  details,
}: ErrorStateProps) {
  const isTransport = type === 'transport';
  const color = isTransport ? RED : ORANGE;
  const defaultTitle = isTransport
    ? 'Connection failed'
    : 'Data contract violation';
  const defaultMessage = isTransport
    ? 'Unable to reach the BFF. The appliance may be unreachable or the server may be down.'
    : 'The response payload did not match the expected schema. This is a data integrity issue.';

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: `color-mix(in oklch, ${color}, transparent 90%)` }}
      >
        {isTransport ? (
          <AlertTriangle className="h-5 w-5" style={{ color }} />
        ) : (
          <ShieldX className="h-5 w-5" style={{ color }} />
        )}
      </div>
      <p className="text-sm font-medium" style={{ color }}>
        {title || defaultTitle}
      </p>
      <p className="text-xs text-center max-w-xs" style={{ color: MUTED }}>
        {message || defaultMessage}
      </p>
      {details && (
        <pre
          className="text-[10px] mt-2 px-3 py-2 rounded-lg max-w-md overflow-x-auto"
          style={{
            background: 'oklch(0.08 0.005 260)',
            color: MUTED,
            border: '1px solid oklch(1 0 0 / 6%)',
          }}
        >
          {details}
        </pre>
      )}
    </div>
  );
}
