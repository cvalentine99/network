/**
 * Impact Deck — Landing page (Slice 00 shell + Slice 02 KPI Strip + Slice 03 Timeseries)
 *
 * CONTRACT:
 * - Global time window is wired and readable
 * - Inspector shell opens/closes without breaking layout
 * - KPI Strip fetches from /api/bff/impact/headline (never ExtraHop directly)
 * - GhostedTimeline fetches from /api/bff/impact/timeseries (never ExtraHop directly)
 * - All 5 UI states are reachable per panel: loading, quiet, populated, error, malformed
 * - No direct ExtraHop calls from this component
 */
import { useState } from 'react';
import { PageHeader } from '@/components/DashboardWidgets';
import { TimeWindowSelector } from '@/components/shared/TimeWindowSelector';
import { InspectorShell } from '@/components/inspector/InspectorShell';
import { KPIStrip } from '@/components/impact/KPIStrip';
import { GhostedTimeline } from '@/components/charts/GhostedTimeline';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { useImpactHeadline } from '@/hooks/useImpactHeadline';
import { useImpactTimeseries } from '@/hooks/useImpactTimeseries';
import { MUTED, GOLD } from '@/components/DashboardWidgets';
import { PanelRightOpen } from 'lucide-react';

export default function Home() {
  const { window: tw } = useTimeWindow();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const { state: kpiState } = useImpactHeadline();
  const { state: timeseriesState } = useImpactTimeseries();

  return (
    <div className="relative">
      {/* Page header with time window selector */}
      <PageHeader
        title="Impact Deck"
        subtitle="Network performance cockpit"
      />

      {/* Toolbar: time window + inspector toggle */}
      <div
        className="flex items-center justify-between mb-6 px-1"
      >
        <TimeWindowSelector />
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-mono tabular-nums"
            style={{ color: MUTED }}
          >
            {new Date(tw.fromMs).toLocaleTimeString()} — {new Date(tw.untilMs).toLocaleTimeString()} · {tw.cycle}
          </span>
          <button
            onClick={() => setInspectorOpen(!inspectorOpen)}
            className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            aria-label="Toggle inspector"
            title="Toggle inspector panel"
          >
            <PanelRightOpen className="h-4 w-4" style={{ color: GOLD }} />
          </button>
        </div>
      </div>

      {/* KPI Strip — 5 headline cards */}
      <div className="mb-6">
        <KPIStrip state={kpiState} />
      </div>

      {/* Timeseries chart — throughput and packet rate over time */}
      <div className="mb-6">
        <GhostedTimeline state={timeseriesState} />
      </div>

      {/* Dashboard content area — placeholder for future slices */}
      <div
        className="rounded-xl p-8 flex items-center justify-center"
        style={{
          minHeight: 200,
          background: 'oklch(0.08 0.005 260 / 50%)',
          border: '1px solid oklch(1 0 0 / 6%)',
        }}
      >
        <p className="text-xs" style={{ color: MUTED }}>
          Additional Impact Deck panels will be built in subsequent slices
        </p>
      </div>

      {/* Inspector shell */}
      <InspectorShell
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        title="Inspector"
      />
    </div>
  );
}
