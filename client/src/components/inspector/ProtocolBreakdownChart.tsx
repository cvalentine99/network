/**
 * ProtocolBreakdownChart — Donut chart + legend for protocol traffic breakdown (Slice 16)
 *
 * CONTRACT:
 *   - Receives DeviceProtocolActivity[] from DeviceDetailPane
 *   - Normalizes via normalizeProtocolChart (shared pure function)
 *   - Renders donut chart via Recharts PieChart
 *   - Renders legend with protocol name, percentage, and formatted bytes
 *   - Handles quiet state (empty protocols) with explicit message
 *   - No ExtraHop calls — data comes from parent component
 *   - Uses shared types only (ProtocolChartEntry, ProtocolChartData)
 *   - Guards against NaN/Infinity reaching the chart
 */
import { useMemo, useState, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import type { DeviceProtocolActivity } from '../../../../shared/cockpit-types';
import { normalizeProtocolChart, type ProtocolChartEntry } from '../../../../shared/protocol-chart-types';
import { formatBytes } from '../../../../shared/formatters';
import { GOLD, MUTED, BRIGHT } from '@/components/DashboardWidgets';

// ─── Active shape renderer for hover state ──────────────────────────────
function renderActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill,
    payload, percent,
  } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={BRIGHT} fontSize={13} fontWeight={600}>
        {payload.protocol}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill={MUTED} fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
}

// ─── Legend row ──────────────────────────────────────────────────────────
function LegendRow({
  entry,
  isActive,
  onHover,
  onLeave,
}: {
  entry: ProtocolChartEntry;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2 py-1 px-1 rounded transition-colors cursor-default"
      style={{
        background: isActive ? 'oklch(1 0 0 / 5%)' : 'transparent',
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      data-testid={`protocol-legend-${entry.protocol}`}
    >
      <span
        className="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ background: entry.color }}
      />
      <span
        className="text-[11px] font-semibold truncate flex-1"
        style={{ color: isActive ? BRIGHT : MUTED }}
      >
        {entry.protocol}
      </span>
      <span
        className="text-[10px] tabular-nums shrink-0"
        style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}
      >
        {entry.pct.toFixed(1)}%
      </span>
      <span
        className="text-[10px] tabular-nums shrink-0 w-16 text-right"
        style={{ color: BRIGHT, fontFamily: 'var(--font-mono)' }}
      >
        {formatBytes(entry.totalBytes)}
      </span>
    </div>
  );
}

// ─── Quiet state ────────────────────────────────────────────────────────
function QuietState() {
  return (
    <div
      className="flex flex-col items-center py-6 gap-2"
      data-testid="protocol-chart-quiet"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ border: `2px dashed oklch(1 0 0 / 10%)` }}
      >
        <span className="text-[10px]" style={{ color: MUTED }}>No data</span>
      </div>
      <p className="text-[11px] text-center" style={{ color: MUTED }}>
        No protocol activity observed in the current time window.
      </p>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────
interface ProtocolBreakdownChartProps {
  protocols: DeviceProtocolActivity[];
}

export function ProtocolBreakdownChart({ protocols }: ProtocolBreakdownChartProps) {
  const chartData = useMemo(() => normalizeProtocolChart(protocols), [protocols]);
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  if (chartData.isEmpty) {
    return <QuietState />;
  }

  return (
    <div data-testid="protocol-chart-populated">
      {/* Donut chart */}
      <div className="flex justify-center" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.entries}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              dataKey="totalBytes"
              nameKey="protocol"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              stroke="none"
            >
              {chartData.entries.map((entry, index) => (
                <Cell key={entry.protocol} fill={entry.color} opacity={
                  activeIndex === undefined || activeIndex === index ? 1 : 0.4
                } />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Grand total label */}
      <div className="text-center mb-2">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
          Total:{' '}
        </span>
        <span
          className="text-[12px] font-semibold tabular-nums"
          style={{ color: GOLD, fontFamily: 'var(--font-mono)' }}
        >
          {formatBytes(chartData.grandTotal)}
        </span>
        <span className="text-[10px] ml-2" style={{ color: MUTED }}>
          ({chartData.protocolCount} protocol{chartData.protocolCount !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Legend */}
      <div className="space-y-0.5" data-testid="protocol-chart-legend">
        {chartData.entries.map((entry, index) => (
          <LegendRow
            key={entry.protocol}
            entry={entry}
            isActive={activeIndex === index}
            onHover={() => setActiveIndex(index)}
            onLeave={() => setActiveIndex(undefined)}
          />
        ))}
      </div>

      {/* In/Out breakdown for active protocol */}
      {activeIndex !== undefined && chartData.entries[activeIndex] && (
        <div
          className="mt-2 px-2 py-1.5 rounded-md"
          style={{ background: 'oklch(1 0 0 / 3%)' }}
          data-testid="protocol-chart-detail"
        >
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: MUTED }}>
              <span style={{ color: 'oklch(0.75 0.15 195)' }}>In:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: BRIGHT }}>
                {formatBytes(chartData.entries[activeIndex].bytesIn)}
              </span>
            </span>
            <span style={{ color: MUTED }}>
              <span style={{ color: GOLD }}>Out:</span>{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: BRIGHT }}>
                {formatBytes(chartData.entries[activeIndex].bytesOut)}
              </span>
            </span>
            <span style={{ color: MUTED }}>
              Conns:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: BRIGHT }}>
                {chartData.entries[activeIndex].connections.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
