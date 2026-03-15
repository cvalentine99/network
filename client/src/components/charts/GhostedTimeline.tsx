/**
 * GhostedTimeline — Time-series area chart for Impact Deck (Slice 03)
 *
 * CONTRACT:
 * - Renders throughput (bytes, gold) and packets (pkts, cyan) as stacked area chart
 * - Receives data as SeriesPoint[] from BFF via hook (never ExtraHop directly)
 * - All 5 UI states: loading, quiet, populated, error, malformed
 * - Uses shared formatters for axis labels and tooltips
 * - Uses shared color constants from DashboardWidgets
 * - Null values in SeriesPoint.values are treated as gaps (not zero)
 * - No direct ExtraHop calls from this component
 */
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { GlassCard, GOLD, CYAN, MUTED, BRIGHT } from '@/components/DashboardWidgets';
import { formatBytes } from '../../../../shared/formatters';
import type { SeriesPoint } from '../../../../shared/cockpit-types';

// ─── State discriminated union ───────────────────────────────────────────
export type TimeSeriesChartState =
  | { kind: 'loading' }
  | { kind: 'quiet' }
  | { kind: 'populated'; points: SeriesPoint[] }
  | { kind: 'error'; message: string }
  | { kind: 'malformed'; message: string };

// ─── Tooltip formatter ───────────────────────────────────────────────────
function formatTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatPacketsShort(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v < 1000) return `${v}`;
  if (v < 1_000_000) return `${(v / 1000).toFixed(1)}K`;
  if (v < 1_000_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  return `${(v / 1_000_000_000).toFixed(1)}B`;
}

// ─── Custom tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const ts = typeof label === 'number' ? formatTimestamp(label) : String(label);
  const bytesVal = payload.find((p: any) => p.dataKey === 'bytes');
  const pktsVal = payload.find((p: any) => p.dataKey === 'pkts');

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'oklch(0.12 0.005 260 / 95%)',
        border: '1px solid oklch(1 0 0 / 10%)',
      }}
    >
      <p className="font-mono mb-1" style={{ color: MUTED }}>{ts}</p>
      {bytesVal && (
        <p style={{ color: GOLD }}>
          Bytes: <span className="font-mono">{formatBytes(bytesVal.value)}</span>
        </p>
      )}
      {pktsVal && (
        <p style={{ color: CYAN }}>
          Packets: <span className="font-mono">{formatPacketsShort(pktsVal.value)}</span>
        </p>
      )}
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height: 260 }}
      data-testid="timeseries-loading"
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-48 h-2 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 8%)' }} />
        <div className="w-64 h-2 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 6%)' }} />
        <div className="w-56 h-2 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 5%)' }} />
        <div className="w-40 h-2 rounded animate-pulse" style={{ background: 'oklch(1 0 0 / 4%)' }} />
        <p className="text-[10px] mt-2" style={{ color: MUTED }}>Loading timeseries data...</p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────
export function GhostedTimeline({ state }: { state: TimeSeriesChartState }) {
  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          Network Throughput
        </h3>
        {state.kind === 'populated' && (
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: GOLD }} />
              <span style={{ color: MUTED }}>Bytes</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CYAN }} />
              <span style={{ color: MUTED }}>Packets</span>
            </span>
          </div>
        )}
      </div>

      {state.kind === 'loading' && <ChartSkeleton />}

      {state.kind === 'quiet' && (
        <div
          className="flex items-center justify-center"
          style={{ height: 260 }}
          data-testid="timeseries-quiet"
        >
          <p className="text-xs" style={{ color: MUTED }}>
            No timeseries data available
          </p>
        </div>
      )}

      {state.kind === 'error' && (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height: 260 }}
          data-testid="timeseries-error"
        >
          <p className="text-xs font-medium" style={{ color: 'oklch(0.628 0.258 29.234)' }}>
            Failed to load timeseries
          </p>
          <p className="text-[10px] font-mono max-w-md text-center" style={{ color: MUTED }}>
            {state.message}
          </p>
        </div>
      )}

      {state.kind === 'malformed' && (
        <div
          className="flex flex-col items-center justify-center gap-2"
          style={{ height: 260 }}
          data-testid="timeseries-malformed"
        >
          <p className="text-xs font-medium" style={{ color: 'oklch(0.705 0.213 47.604)' }}>
            Data contract violation
          </p>
          <p className="text-[10px] font-mono max-w-md text-center" style={{ color: MUTED }}>
            {state.message}
          </p>
        </div>
      )}

      {state.kind === 'populated' && (
        <div data-testid="timeseries-populated" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={state.points.map((p) => ({
                t: p.t,
                bytes: p.values.bytes ?? undefined,
                pkts: p.values.pkts ?? undefined,
              }))}
              margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CYAN} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CYAN} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(1 0 0 / 6%)"
                vertical={false}
              />
              <XAxis
                dataKey="t"
                tickFormatter={formatTimestamp}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={{ stroke: 'oklch(1 0 0 / 8%)' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="bytes"
                tickFormatter={(v: number) => formatBytes(v)}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <YAxis
                yAxisId="pkts"
                orientation="right"
                tickFormatter={(v: number) => formatPacketsShort(v)}
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                yAxisId="bytes"
                type="monotone"
                dataKey="bytes"
                stroke={GOLD}
                strokeWidth={2}
                fill="url(#goldGrad)"
                dot={false}
                activeDot={false}
                connectNulls={false}
              />
              <Area
                yAxisId="pkts"
                type="monotone"
                dataKey="pkts"
                stroke={CYAN}
                strokeWidth={1.5}
                fill="url(#cyanGrad)"
                dot={false}
                activeDot={false}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </GlassCard>
  );
}
