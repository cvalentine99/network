// client/src/components/charts/GhostedTimeline.tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { GOLD, CYAN, MUTED } from '@/components/DashboardWidgets';
import { formatBytes, formatTimestamp } from '@/lib/formatters';
import type { SeriesPoint } from '../../../../shared/impact-types';

interface Props {
  points: SeriesPoint[];
  height?: number;
}

export default function GhostedTimeline({ points, height = 260 }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height, color: MUTED }}>
        <p className="text-sm">No timeseries data available</p>
      </div>
    );
  }

  const chartData = points.map(p => ({
    time: p.t,
    bytes: p.values.bytes ?? 0,
    pkts: p.values.pkts ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CYAN} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(1 0 0 / 5%)"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tickFormatter={(v) => formatTimestamp(v)}
          tick={{ fill: MUTED, fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={{ stroke: 'oklch(1 0 0 / 8%)' }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          yAxisId="bytes"
          tickFormatter={(v) => formatBytes(v)}
          tick={{ fill: MUTED, fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={65}
        />
        <YAxis
          yAxisId="pkts"
          orientation="right"
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
          tick={{ fill: MUTED, fontSize: 10, fontFamily: 'var(--font-mono)' }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: 'oklch(0.12 0.005 260)',
            border: '1px solid oklch(1 0 0 / 10%)',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: 'oklch(0.95 0.005 85)',
          }}
          labelFormatter={(v) => formatTimestamp(v as number)}
          formatter={(value: number, name: string) => {
            if (name === 'bytes') return [formatBytes(value), 'Bytes'];
            return [`${(value / 1000).toFixed(1)}K`, 'Packets'];
          }}
        />
        <Area
          yAxisId="bytes"
          type="monotone"
          dataKey="bytes"
          stroke={GOLD}
          strokeWidth={2}
          fill="url(#goldGradient)"
          dot={false}
          activeDot={{ r: 4, stroke: GOLD, strokeWidth: 2, fill: 'oklch(0.08 0 0)' }}
        />
        <Area
          yAxisId="pkts"
          type="monotone"
          dataKey="pkts"
          stroke={CYAN}
          strokeWidth={1.5}
          fill="url(#cyanGradient)"
          dot={false}
          activeDot={{ r: 3, stroke: CYAN, strokeWidth: 2, fill: 'oklch(0.08 0 0)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
