// client/src/components/tables/DetectionsTable.tsx
import { SeverityBadge, MUTED, BRIGHT } from '@/components/DashboardWidgets';
import { formatRelativeTime } from '@/lib/formatters';
import type { NormalizedDetection, Severity } from '../../../../shared/impact-types';

function riskToSeverity(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

interface Props {
  detections: NormalizedDetection[];
}

export default function DetectionsTable({ detections }: Props) {
  if (detections.length === 0) {
    return <p className="text-sm py-4 text-center" style={{ color: MUTED }}>No detections in this window</p>;
  }

  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: 'oklch(0.08 0.005 260)' }}>
          <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
            {['Severity', 'Detection', 'Type', 'Status', 'Time'].map(h => (
              <th
                key={h}
                className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: MUTED }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detections.map(d => (
            <tr
              key={d.id}
              className="transition-colors"
              style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'oklch(1 0 0 / 3%)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="py-2.5 px-3"><SeverityBadge level={riskToSeverity(d.riskScore)} /></td>
              <td className="py-2.5 px-3 text-[13px]" style={{ color: BRIGHT }}>{d.title}</td>
              <td className="py-2.5 px-3 text-[11px] uppercase tracking-wider" style={{ color: MUTED }}>{d.type}</td>
              <td className="py-2.5 px-3 text-[11px]" style={{ color: MUTED }}>{d.status}</td>
              <td className="py-2.5 px-3 text-[11px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
                {formatRelativeTime(d.startTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
