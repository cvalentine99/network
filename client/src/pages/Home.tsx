/**
 * Impact Deck — Landing page (Slice 00-07)
 *
 * CONTRACT:
 * - Global time window is wired and readable
 * - Inspector shell opens/closes without breaking layout
 * - KPI Strip fetches from /api/bff/impact/headline (never ExtraHop directly)
 * - GhostedTimeline fetches from /api/bff/impact/timeseries (never ExtraHop directly)
 * - TopTalkersTable fetches from /api/bff/impact/top-talkers (never ExtraHop directly)
 * - DetectionsTable fetches from /api/bff/impact/detections (never ExtraHop directly)
 * - AlertsPanel fetches from /api/bff/impact/alerts (never ExtraHop directly)
 * - ApplianceFooter fetches from /api/bff/impact/appliance-status (never ExtraHop directly)
 * - All 5 UI states are reachable per panel: loading, quiet, populated, error, malformed
 * - No direct ExtraHop calls from this component
 */
import { useState } from 'react';
import { PageHeader, GlassCard, MUTED, GOLD, RED, GREEN } from '@/components/DashboardWidgets';
import { TimeWindowSelector } from '@/components/shared/TimeWindowSelector';
import { InspectorShell } from '@/components/inspector/InspectorShell';
import { KPIStrip } from '@/components/impact/KPIStrip';
import { GhostedTimeline } from '@/components/charts/GhostedTimeline';
import { TopTalkersTable } from '@/components/tables/TopTalkersTable';
import { DetectionsTable } from '@/components/tables/DetectionsTable';
import { AlertsPanel } from '@/components/tables/AlertsPanel';
import { ApplianceFooter } from '@/components/impact/ApplianceFooter';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { useImpactHeadline } from '@/hooks/useImpactHeadline';
import { useImpactTimeseries } from '@/hooks/useImpactTimeseries';
import { useTopTalkers } from '@/hooks/useTopTalkers';
import { useDetections } from '@/hooks/useDetections';
import { useAlerts } from '@/hooks/useAlerts';
import { useApplianceStatus } from '@/hooks/useApplianceStatus';
import { PanelRightOpen } from 'lucide-react';

export default function Home() {
  const { window: tw } = useTimeWindow();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const { state: kpiState } = useImpactHeadline();
  const { state: timeseriesState } = useImpactTimeseries();
  const topTalkersState = useTopTalkers();
  const detectionsState = useDetections();
  const alertsState = useAlerts();
  const applianceState = useApplianceStatus();

  // Detection count badge color
  const detectionCount = detectionsState.kind === 'populated' ? detectionsState.detections.length : 0;
  const detectionBadgeColor = detectionCount > 0 ? RED : GREEN;

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

      {/* Two-column: Top Talkers (2/3) + Detections (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Top Talkers — 2/3 width */}
        <div className="lg:col-span-2">
          <GlassCard>
            <p
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: MUTED }}
            >
              Top Talkers — By Total Bytes
            </p>
            <TopTalkersTable state={topTalkersState} />
          </GlassCard>
        </div>

        {/* Recent Detections — 1/3 width */}
        <div className="lg:col-span-1">
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <p
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: MUTED }}
              >
                Recent Detections
              </p>
              <span
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
                style={{
                  background: `${detectionBadgeColor}20`,
                  color: detectionBadgeColor,
                }}
              >
                {detectionCount}
              </span>
            </div>
            <DetectionsTable state={detectionsState} />
          </GlassCard>
        </div>
      </div>

      {/* Alerts Panel — configured alert rules */}
      <div className="mb-6">
        <AlertsPanel state={alertsState} />
      </div>

      {/* Appliance Status Footer — Slice 07 */}
      <div className="mb-6">
        <ApplianceFooter state={applianceState} />
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
