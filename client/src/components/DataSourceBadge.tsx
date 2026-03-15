/**
 * DataSourceBadge — visible indicator of data source mode.
 *
 * DECONTAMINATION (Slice 28):
 *   Shows on every surface so the user always knows whether they're
 *   looking at fixture/demo data or live ExtraHop data.
 *
 *   - Fixture Mode: amber badge with "FIXTURE MODE — DEMO DATA"
 *   - Live Mode: green badge with "LIVE — ExtraHop Connected"
 *   - Live Degraded: yellow badge with "LIVE — Degraded"
 *   - Error: red badge with "Health Check Failed"
 *   - Loading: gray badge with "Checking..."
 */
import { useDataSourceMode, type DataSourceMode } from '../hooks/useDataSourceMode';

const modeStyles: Record<DataSourceMode, { bg: string; text: string; dot: string; border: string }> = {
  fixture: {
    bg: 'oklch(0.25 0.08 70)',
    text: 'oklch(0.85 0.12 70)',
    dot: 'oklch(0.75 0.15 70)',
    border: 'oklch(0.45 0.1 70)',
  },
  live: {
    bg: 'oklch(0.2 0.06 145)',
    text: 'oklch(0.85 0.12 145)',
    dot: 'oklch(0.7 0.18 145)',
    border: 'oklch(0.4 0.1 145)',
  },
  error: {
    bg: 'oklch(0.25 0.08 25)',
    text: 'oklch(0.85 0.12 25)',
    dot: 'oklch(0.65 0.2 25)',
    border: 'oklch(0.45 0.1 25)',
  },
  loading: {
    bg: 'oklch(0.18 0 0)',
    text: 'oklch(0.6 0 0)',
    dot: 'oklch(0.5 0 0)',
    border: 'oklch(0.3 0 0)',
  },
};

export function DataSourceBadge() {
  const { mode, label } = useDataSourceMode();
  const style = modeStyles[mode];

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest select-none"
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
      }}
      title={label}
      data-testid="data-source-badge"
      data-mode={mode}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: style.dot,
          boxShadow: mode === 'live' ? `0 0 6px ${style.dot}` : 'none',
        }}
      />
      {label}
    </div>
  );
}
