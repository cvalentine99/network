/**
 * TopTalkersTable — Ranked table of top devices by byte volume.
 *
 * Slice 04 — Contract-verified component.
 * Slice 08 — Added onRowClick prop for inspector wiring.
 *
 * UI STATES:
 *   1. loading — skeleton rows
 *   2. quiet — EmptyState ("No traffic data available")
 *   3. populated — ranked table with device identity, bytes in/out, total
 *   4. error (transport) — ErrorState transport
 *   5. error (malformed) — ErrorState contract
 *
 * DATA CONTRACT:
 *   Receives TopTalkerRow[] from shared/cockpit-types.ts.
 *   Uses formatBytes from shared/formatters.ts.
 *   Never interprets raw payloads — only normalized types.
 *
 * INTERACTION CONTRACT (Slice 08):
 *   onRowClick?: (row: TopTalkerRow) => void
 *   - Called when a populated row is clicked
 *   - Caller (Home.tsx) wires this to InspectorContext.selectDevice
 *   - selectedDeviceId?: number — highlights the currently selected row
 *
 * STYLING:
 *   Obsidian table: dark background, oklch(1 0 0 / 4%) row borders,
 *   oklch(1 0 0 / 3%) hover highlight. Monospace for numeric columns.
 *   GOLD for total bytes, CYAN for role, MUTED for rank, BRIGHT for device name.
 */
import type { TopTalkerRow } from '../../../../shared/cockpit-types';
import { formatBytes } from '../../../../shared/formatters';
import { GOLD, CYAN, MUTED, BRIGHT, MiniSparkline } from '@/components/DashboardWidgets';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { BarChart3 } from 'lucide-react';

// ─── State discriminator ─────────────────────────────────────────────────
export type TopTalkersState =
  | { status: 'loading' }
  | { status: 'quiet' }
  | { status: 'populated'; topTalkers: TopTalkerRow[] }
  | { status: 'transport-error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string };

interface TopTalkersTableProps {
  state: TopTalkersState;
  /** Slice 08: called when a populated row is clicked */
  onRowClick?: (row: TopTalkerRow) => void;
  /** Slice 08: highlights the currently selected device row */
  selectedDeviceId?: number | null;
}

// ─── Loading skeleton ────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-0" data-testid="top-talkers-loading">
      {/* Header skeleton */}
      <div
        className="flex gap-4 py-2 px-3"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)' }}
      >
        {['3rem', '12rem', '5rem', '6rem', '6rem', '6rem'].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded animate-pulse"
            style={{ width: w, background: 'oklch(1 0 0 / 6%)' }}
          />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 py-3 px-3"
          style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}
        >
          <div
            className="h-4 rounded animate-pulse"
            style={{ width: '2rem', background: 'oklch(1 0 0 / 4%)' }}
          />
          <div className="flex-1 space-y-1">
            <div
              className="h-4 rounded animate-pulse"
              style={{ width: '60%', background: 'oklch(1 0 0 / 6%)' }}
            />
            <div
              className="h-3 rounded animate-pulse"
              style={{ width: '30%', background: 'oklch(1 0 0 / 3%)' }}
            />
          </div>
          {[1, 2, 3].map((j) => (
            <div
              key={j}
              className="h-4 rounded animate-pulse"
              style={{ width: '5rem', background: 'oklch(1 0 0 / 4%)' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Table row ───────────────────────────────────────────────────────────
function TalkerRow({
  row,
  rank,
  onClick,
  isSelected,
}: {
  row: TopTalkerRow;
  rank: number;
  onClick?: (row: TopTalkerRow) => void;
  isSelected?: boolean;
}) {
  const sparkData = row.sparkline.map((p) => {
    const v = p.values?.bytes;
    return v != null && Number.isFinite(v) ? v : 0;
  });

  const selectedBg = 'oklch(0.769 0.108 85.805 / 8%)';
  const hoverBg = 'oklch(1 0 0 / 3%)';
  const defaultBg = isSelected ? selectedBg : 'transparent';

  return (
    <tr
      className="transition-colors"
      style={{
        borderBottom: '1px solid oklch(1 0 0 / 4%)',
        cursor: onClick ? 'pointer' : 'default',
        background: defaultBg,
      }}
      onClick={() => onClick?.(row)}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = defaultBg;
      }}
      data-testid={`top-talker-row-${row.device.id}`}
      aria-selected={isSelected}
    >
      {/* Rank */}
      <td
        className="py-2.5 px-3 text-[13px] tabular-nums text-right"
        style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}
      >
        {rank}
      </td>

      {/* Device identity */}
      <td className="py-2.5 px-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium" style={{ color: BRIGHT }}>
            {row.device.displayName}
          </span>
          {row.device.ipaddr4 && (
            <span
              className="text-[11px] tabular-nums"
              style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}
            >
              {row.device.ipaddr4}
            </span>
          )}
        </div>
      </td>

      {/* Role */}
      <td className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: CYAN }}>
        {row.device.role || '—'}
      </td>

      {/* Bytes In */}
      <td
        className="py-2.5 px-3 text-[13px] tabular-nums text-right"
        style={{ fontFamily: 'var(--font-mono)', color: 'oklch(0.85 0.005 85)' }}
      >
        {formatBytes(row.bytesIn)}
      </td>

      {/* Bytes Out */}
      <td
        className="py-2.5 px-3 text-[13px] tabular-nums text-right"
        style={{ fontFamily: 'var(--font-mono)', color: 'oklch(0.85 0.005 85)' }}
      >
        {formatBytes(row.bytesOut)}
      </td>

      {/* Total */}
      <td
        className="py-2.5 px-3 text-[13px] tabular-nums font-bold text-right"
        style={{ fontFamily: 'var(--font-mono)', color: GOLD }}
      >
        {formatBytes(row.totalBytes)}
      </td>

      {/* Sparkline */}
      <td className="py-2.5 px-3">
        {sparkData.length > 0 ? (
          <MiniSparkline data={sparkData} color={GOLD} />
        ) : (
          <span style={{ color: MUTED }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ──────────────────────────────────────────────────────
export function TopTalkersTable({ state, onRowClick, selectedDeviceId }: TopTalkersTableProps) {
  if (state.status === 'loading') {
    return <TableSkeleton />;
  }

  if (state.status === 'quiet') {
    return (
      <div data-testid="top-talkers-quiet">
        <EmptyState
          title="No traffic data available"
          message="No metric responses exist for device/net in the selected time window."
          icon={<BarChart3 className="h-5 w-5" style={{ color: GOLD, opacity: 0.5 }} />}
        />
      </div>
    );
  }

  if (state.status === 'transport-error') {
    return (
      <div data-testid="top-talkers-error">
        <ErrorState
          type="transport"
          title="Top talkers fetch failed"
          message={state.message}
        />
      </div>
    );
  }

  if (state.status === 'malformed') {
    return (
      <div data-testid="top-talkers-malformed">
        <ErrorState
          type="contract"
          title="Top talkers data contract violation"
          message={state.message}
        />
      </div>
    );
  }

  // Populated state
  return (
    <div className="overflow-x-auto" data-testid="top-talkers-populated">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)' }}>
            {['#', 'Device', 'Role', 'Bytes In', 'Bytes Out', 'Total', 'Trend'].map((h, i) => (
              <th
                key={i}
                className={`py-2 px-3 text-[11px] font-semibold uppercase tracking-wider ${
                  i === 0 || i >= 3 ? 'text-right' : 'text-left'
                }`}
                style={{ color: MUTED }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.topTalkers.map((row, i) => (
            <TalkerRow
              key={row.device.id}
              row={row}
              rank={i + 1}
              onClick={onRowClick}
              isSelected={selectedDeviceId === row.device.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
