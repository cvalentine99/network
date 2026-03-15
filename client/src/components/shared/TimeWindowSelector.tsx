/**
 * TimeWindowSelector — Dropdown for selecting the shared time window.
 * Reads from and writes to the global TimeWindowContext.
 * Placed in the page header so every panel on the surface shares the same window.
 */
import { useTimeWindow } from '@/lib/useTimeWindow';
import { TIME_WINDOW_PRESETS } from '@shared/cockpit-constants';
import { Clock, RefreshCw } from 'lucide-react';
import { GOLD, MUTED, BRIGHT } from '@/components/DashboardWidgets';

export function TimeWindowSelector() {
  const { fromOffset, setFromOffset, refresh } = useTimeWindow();

  const currentPreset = TIME_WINDOW_PRESETS.find((p) => p.value === fromOffset);
  const label = currentPreset?.label ?? 'Custom';

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-3.5 w-3.5" style={{ color: MUTED }} />
      <select
        value={fromOffset}
        onChange={(e) => setFromOffset(Number(e.target.value))}
        className="text-xs font-medium rounded-md px-2 py-1.5 border-0 outline-none cursor-pointer"
        style={{
          background: 'oklch(0.12 0.005 260)',
          color: BRIGHT,
          border: '1px solid oklch(1 0 0 / 10%)',
        }}
        aria-label="Time window"
      >
        {TIME_WINDOW_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      <button
        onClick={refresh}
        className="h-7 w-7 flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
        aria-label="Refresh time window"
        title="Refresh"
      >
        <RefreshCw className="h-3.5 w-3.5" style={{ color: GOLD }} />
      </button>
    </div>
  );
}
