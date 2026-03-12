/**
 * Impact Deck — KPI Strip (Slice 02)
 *
 * Renders 5 headline KPI cards:
 *   1. Total Bytes
 *   2. Total Packets
 *   3. Bytes/sec
 *   4. Packets/sec
 *   5. Baseline Delta %
 *
 * CONTRACT:
 * - Consumes ImpactOverviewPayload.headline shape only (from shared/cockpit-types.ts)
 * - Uses shared formatters from shared/formatters.ts — no inline formatting
 * - Handles 5 UI states: loading, quiet, populated, error, malformed-rejection
 * - Never contacts ExtraHop directly — data arrives via props from parent
 * - null baselineDeltaPct renders as "—" (quiet for that metric)
 * - All values pass through formatters which guard against NaN/Infinity
 */
import { GlassCard, MUTED, BRIGHT, GOLD, GREEN, RED, AMBER } from '@/components/DashboardWidgets';
import { KPICardSkeleton } from '@/components/shared/LoadingSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import {
  formatBytes,
  formatBytesPerSec,
  formatPackets,
  formatPacketsPerSec,
  formatPercent,
} from '../../../../shared/formatters';
import type { ImpactOverviewPayload } from '../../../../shared/cockpit-types';
import { ImpactHeadlineSchema } from '../../../../shared/cockpit-validators';
import { HardDrive, Activity, ArrowUpDown, Zap, TrendingUp } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────

type HeadlineData = ImpactOverviewPayload['headline'];

export type KPIStripState =
  | { kind: 'loading' }
  | { kind: 'quiet' }
  | { kind: 'populated'; headline: HeadlineData }
  | { kind: 'error'; message: string }
  | { kind: 'malformed'; message: string };

interface KPIStripProps {
  state: KPIStripState;
}

// ─── Individual KPI Card ─────────────────────────────────────────────────

interface KPICardDef {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor: string;
  delta?: { text: string; direction: 'up' | 'down' | 'neutral' };
}

function KPICardItem({ label, value, icon, accentColor, delta }: KPICardDef) {
  const deltaColor = delta?.direction === 'up' ? RED : delta?.direction === 'down' ? GREEN : MUTED;
  const deltaArrow = delta?.direction === 'up' ? '▲' : delta?.direction === 'down' ? '▼' : '●';

  return (
    <GlassCard>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider truncate"
            style={{ color: MUTED }}
          >
            {label}
          </p>
          <p
            className="text-xl font-bold mt-1.5 tabular-nums truncate"
            style={{ fontFamily: 'var(--font-mono)', color: BRIGHT }}
            title={value}
          >
            {value}
          </p>
          {delta && (
            <p className="text-[11px] mt-1 font-medium" style={{ color: deltaColor }}>
              {deltaArrow} {delta.text}
            </p>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ml-3"
          style={{ background: `color-mix(in oklch, ${accentColor} 12%, transparent)` }}
        >
          {icon}
        </div>
      </div>
    </GlassCard>
  );
}

// ─── KPI Strip Component ─────────────────────────────────────────────────

export function KPIStrip({ state }: KPIStripProps) {
  // Loading state
  if (state.kind === 'loading') {
    return (
      <div className="grid grid-cols-5 gap-3" data-testid="kpi-strip-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state (transport failure)
  if (state.kind === 'error') {
    return (
      <div data-testid="kpi-strip-error">
        <ErrorState
          type="transport"
          title="KPI data unavailable"
          message={state.message}
        />
      </div>
    );
  }

  // Malformed data rejection state
  if (state.kind === 'malformed') {
    return (
      <div data-testid="kpi-strip-malformed">
        <ErrorState
          type="contract"
          title="KPI data rejected"
          message={state.message}
        />
      </div>
    );
  }

  // Quiet state (no data / all zeros)
  if (state.kind === 'quiet') {
    return (
      <div data-testid="kpi-strip-quiet">
        <EmptyState
          title="No traffic data"
          message="No network traffic observed in the selected time window."
        />
      </div>
    );
  }

  // Populated state — validate headline before rendering
  const validation = ImpactHeadlineSchema.safeParse(state.headline);
  if (!validation.success) {
    return (
      <div data-testid="kpi-strip-malformed">
        <ErrorState
          type="contract"
          title="KPI data rejected"
          message="Headline data failed client-side schema validation"
        />
      </div>
    );
  }

  const h = validation.data;

  // Determine baseline delta display
  const baselineDelta = h.baselineDeltaPct != null
    ? {
        text: formatPercent(h.baselineDeltaPct),
        direction: (h.baselineDeltaPct > 0 ? 'up' : h.baselineDeltaPct < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
      }
    : undefined;

  const cards: KPICardDef[] = [
    {
      label: 'Total Bytes',
      value: formatBytes(h.totalBytes),
      icon: <HardDrive className="w-4 h-4" style={{ color: GOLD }} />,
      accentColor: GOLD,
    },
    {
      label: 'Total Packets',
      value: formatPackets(h.totalPackets),
      icon: <Activity className="w-4 h-4" style={{ color: AMBER }} />,
      accentColor: AMBER,
    },
    {
      label: 'Throughput',
      value: formatBytesPerSec(h.bytesPerSecond),
      icon: <ArrowUpDown className="w-4 h-4" style={{ color: GREEN }} />,
      accentColor: GREEN,
    },
    {
      label: 'Packet Rate',
      value: formatPacketsPerSec(h.packetsPerSecond),
      icon: <Zap className="w-4 h-4" style={{ color: GOLD }} />,
      accentColor: GOLD,
    },
    {
      label: 'Baseline Delta',
      value: h.baselineDeltaPct != null ? formatPercent(h.baselineDeltaPct) : '—',
      icon: <TrendingUp className="w-4 h-4" style={{ color: RED }} />,
      accentColor: RED,
      delta: baselineDelta,
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-3" data-testid="kpi-strip-populated">
      {cards.map((card) => (
        <KPICardItem key={card.label} {...card} />
      ))}
    </div>
  );
}
