// client/src/components/tables/TopTalkersTable.tsx
import { GOLD, CYAN, MUTED, BRIGHT, MiniSparkline } from '@/components/DashboardWidgets';
import { formatBytes } from '@/lib/formatters';
import type { TopTalkerRow } from '../../../../shared/impact-types';

interface Props {
  talkers: TopTalkerRow[];
  onDeviceClick?: (deviceId: number) => void;
}

export default function TopTalkersTable({ talkers, onDeviceClick }: Props) {
  if (talkers.length === 0) {
    return <p className="text-sm py-4 text-center" style={{ color: MUTED }}>No top talkers in this window</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
            {['#', 'Device', 'Role', 'Bytes In', 'Bytes Out', 'Total', 'Trend'].map(h => (
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
          {talkers.map((row, i) => (
            <tr
              key={row.device.id}
              className="transition-colors cursor-pointer"
              style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}
              onClick={() => onDeviceClick?.(row.device.id)}
              onMouseEnter={e => (e.currentTarget.style.background = 'oklch(1 0 0 / 3%)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
                {i + 1}
              </td>
              <td className="py-2.5 px-3">
                <div>
                  <span className="text-[13px] font-medium" style={{ color: BRIGHT }}>{row.device.displayName}</span>
                  {row.device.ipaddr4 && (
                    <span className="text-[11px] ml-2" style={{ color: MUTED }}>{row.device.ipaddr4}</span>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3 text-[11px] uppercase tracking-wider" style={{ color: CYAN }}>
                {row.device.role || '—'}
              </td>
              <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ color: 'oklch(0.85 0.005 85)', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(row.bytesIn)}
              </td>
              <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ color: 'oklch(0.85 0.005 85)', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(row.bytesOut)}
              </td>
              <td className="py-2.5 px-3 text-[13px] font-bold tabular-nums" style={{ color: GOLD, fontFamily: 'var(--font-mono)' }}>
                {formatBytes(row.totalBytes)}
              </td>
              <td className="py-2.5 px-3">
                {row.sparkline.length > 0 ? (
                  <MiniSparkline data={row.sparkline.map(p => p.values.bytes_in ?? 0)} />
                ) : (
                  <span className="text-[11px]" style={{ color: MUTED }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
