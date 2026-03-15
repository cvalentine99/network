/**
 * Correlation Surface — Standalone Page (Slice 20)
 *
 * CONTRACT:
 * - First-class named surface answering "What changed at roughly the same moment?"
 * - Reuses the same CorrelationPayload / CorrelationEvent contracts as the Impact Deck overlay (Slice 19)
 * - Shares the global time window via useTimeWindow()
 * - Fetches via POST /api/bff/correlation/events (same BFF route as the overlay)
 * - Validates response via CorrelationPayloadSchema
 * - Category filter pills toggle event visibility
 * - Event feed with expandable detail rows
 * - All 6 UI states: idle, loading, populated, quiet, error, malformed
 * - Browser never contacts ExtraHop directly
 */
import { useState, useMemo, useCallback } from 'react';
import {
  ShieldAlert,
  BellRing,
  Settings,
  Cpu,
  Network,
  Gauge,
  Globe,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  List,
  Info,
} from 'lucide-react';
import {
  GlassCard,
  PageHeader,
  MUTED,
  GOLD,
  BRIGHT,
  CYAN,
  RED,
  ORANGE,
} from '@/components/DashboardWidgets';
import { useCorrelationOverlay } from '@/hooks/useCorrelationOverlay';
import type {
  CorrelationEvent,
  CorrelationEventCategory,
} from '../../../shared/correlation-types';
import {
  getCategoryVisual,
  CORRELATION_CATEGORY_VISUALS,
  filterEventsByCategory,
} from '../../../shared/correlation-types';
import { useTimeWindow } from '@/lib/useTimeWindow';
import CrossSurfaceNavButton from '@/components/CrossSurfaceNavButton';
import { buildCorrelationToBlastRadiusLink } from '../../../shared/cross-surface-nav-types';

// ─── Icon map ─────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  'shield-alert': ShieldAlert,
  'bell-ring': BellRing,
  'settings': Settings,
  'cpu': Cpu,
  'network': Network,
  'gauge': Gauge,
  'globe': Globe,
};

function CategoryIcon({
  iconHint,
  color,
  size = 14,
}: {
  iconHint: string;
  color: string;
  size?: number;
}) {
  const Icon = ICON_MAP[iconHint] || Globe;
  return <Icon style={{ color, width: size, height: size }} />;
}

// ─── Severity colors ─────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: RED,
  high: ORANGE,
  medium: 'oklch(0.795 0.184 86.047)',
  low: MUTED,
};

function SeverityPill({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity] || MUTED;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ background: `${c}18`, color: c, border: `1px solid ${c}30` }}
    >
      {severity}
    </span>
  );
}

// ─── Risk bar ────────────────────────────────────────────────────────────
function RiskBar({ score }: { score: number }) {
  const barColor =
    score >= 80 ? RED : score >= 50 ? ORANGE : 'oklch(0.795 0.184 86.047)';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase font-medium" style={{ color: MUTED }}>
        Risk
      </span>
      <div
        className="flex-1 h-1.5 rounded-full"
        style={{ background: 'oklch(1 0 0 / 6%)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: barColor }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums" style={{ color: MUTED }}>
        {score}
      </span>
    </div>
  );
}

// ─── Event detail card (expanded row) ────────────────────────────────────
function EventDetailCard({ event }: { event: CorrelationEvent }) {
  const visual = getCategoryVisual(event.category);
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'oklch(0.12 0.005 260 / 60%)',
        border: '1px solid oklch(1 0 0 / 6%)',
      }}
      data-testid={`event-detail-${event.id}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: metadata */}
        <div className="flex flex-col gap-2">
          {event.description && (
            <p className="text-[12px] leading-relaxed" style={{ color: 'oklch(0.8 0.005 260)' }}>
              {event.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <Clock style={{ width: 12, height: 12, color: MUTED }} />
              <span className="text-[10px] font-mono" style={{ color: MUTED }}>
                {new Date(event.timestampMs).toLocaleString()}
              </span>
            </div>
            {event.durationMs > 0 && (
              <span className="text-[10px] font-mono" style={{ color: MUTED }}>
                Duration: {event.durationMs >= 60000
                  ? `${(event.durationMs / 60000).toFixed(1)}m`
                  : `${(event.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        </div>
        {/* Right: source, refs, risk */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-medium" style={{ color: MUTED }}>
              Source
            </span>
            <span
              className="text-[11px] px-2 py-0.5 rounded"
              style={{ background: 'oklch(1 0 0 / 4%)', color: BRIGHT }}
            >
              {event.source.displayName}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded uppercase"
              style={{ background: `${visual.color}15`, color: visual.color }}
            >
              {event.source.kind}
            </span>
          </div>
          {event.riskScore !== null && <RiskBar score={event.riskScore} />}
          {event.refs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[10px] uppercase font-medium" style={{ color: MUTED }}>
                Refs:
              </span>
              {event.refs.map((ref: { kind: string; label: string }, i: number) => {
                const navLink = buildCorrelationToBlastRadiusLink(ref.kind, ref.label);
                if (navLink) {
                  return (
                    <CrossSurfaceNavButton
                      key={i}
                      link={navLink}
                      compact
                    />
                  );
                }
                return (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'oklch(1 0 0 / 5%)', color: CYAN }}
                  >
                    {ref.kind}:{ref.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event row (feed item) ───────────────────────────────────────────────
function EventRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: CorrelationEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const visual = getCategoryVisual(event.category);
  const Chevron = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div data-testid={`event-row-${event.id}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/[0.03] text-left"
        style={{
          background: isExpanded ? 'oklch(1 0 0 / 3%)' : 'transparent',
        }}
        aria-expanded={isExpanded}
        aria-label={`${event.title} - click to ${isExpanded ? 'collapse' : 'expand'} details`}
      >
        <Chevron style={{ width: 14, height: 14, color: MUTED, flexShrink: 0 }} />
        <div
          className="flex items-center justify-center rounded-md flex-shrink-0"
          style={{
            width: 28,
            height: 28,
            background: `${visual.color}15`,
            border: `1px solid ${visual.color}30`,
          }}
        >
          <CategoryIcon iconHint={visual.iconHint} color={visual.color} size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium truncate" style={{ color: BRIGHT }}>
            {event.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono" style={{ color: MUTED }}>
              {new Date(event.timestampMs).toLocaleTimeString()}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: `${visual.color}15`, color: visual.color }}
            >
              {visual.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {event.severity && <SeverityPill severity={event.severity} />}
          {event.riskScore !== null && (
            <span
              className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
              style={{
                color: event.riskScore >= 80 ? RED : event.riskScore >= 50 ? ORANGE : MUTED,
                background: 'oklch(1 0 0 / 4%)',
              }}
            >
              R:{event.riskScore}
            </span>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="ml-11 mt-1 mb-2">
          <EventDetailCard event={event} />
        </div>
      )}
    </div>
  );
}

// ─── Category filter bar ─────────────────────────────────────────────────
function CategoryFilterBar({
  categoryCounts,
  enabledCategories,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  categoryCounts: Record<CorrelationEventCategory, number>;
  enabledCategories: Set<CorrelationEventCategory>;
  onToggle: (cat: CorrelationEventCategory) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  const activeCats = CORRELATION_CATEGORY_VISUALS.filter(
    (v: { category: CorrelationEventCategory }) => categoryCounts[v.category] > 0,
  );
  const allEnabled = activeCats.every((v: { category: CorrelationEventCategory }) => enabledCategories.has(v.category));

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="correlation-filter-bar">
      <div className="flex items-center gap-1 mr-2">
        <Filter style={{ width: 12, height: 12, color: MUTED }} />
        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: MUTED }}>
          Categories
        </span>
      </div>
      {activeCats.map((v: { category: CorrelationEventCategory; color: string; label: string; iconHint: string }) => {
        const enabled = enabledCategories.has(v.category);
        return (
          <button
            key={v.category}
            onClick={() => onToggle(v.category)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] transition-all"
            style={{
              background: enabled ? `${v.color}12` : 'transparent',
              border: `1px solid ${enabled ? v.color : 'oklch(1 0 0 / 8%)'}`,
              opacity: enabled ? 1 : 0.4,
              color: enabled ? v.color : MUTED,
            }}
            aria-label={`Toggle ${v.label}`}
            aria-pressed={enabled}
            data-testid={`filter-${v.category}`}
          >
            <CategoryIcon iconHint={v.iconHint} color={enabled ? v.color : MUTED} size={12} />
            <span className="font-medium">{v.label}</span>
            <span className="font-mono font-bold">{categoryCounts[v.category]}</span>
          </button>
        );
      })}
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={allEnabled ? onClearAll : onSelectAll}
          className="text-[9px] uppercase font-bold px-2 py-0.5 rounded transition-colors hover:bg-white/5"
          style={{ color: GOLD }}
        >
          {allEnabled ? 'Clear All' : 'Select All'}
        </button>
      </div>
    </div>
  );
}

// ─── Summary strip ───────────────────────────────────────────────────────
function SummaryStrip({
  totalCount,
  categoryCounts,
  timeWindow,
}: {
  totalCount: number;
  categoryCounts: Record<CorrelationEventCategory, number>;
  timeWindow: { fromMs: number; untilMs: number };
}) {
  const activeCategories = Object.entries(categoryCounts).filter(([, c]: [string, number]) => (c as number) > 0).length;
  const durationMs = timeWindow.untilMs - timeWindow.fromMs;
  const durationLabel =
    durationMs >= 3600000
      ? `${(durationMs / 3600000).toFixed(1)}h`
      : durationMs >= 60000
      ? `${(durationMs / 60000).toFixed(0)}m`
      : `${(durationMs / 1000).toFixed(0)}s`;

  return (
    <div
      className="flex flex-wrap items-center gap-4 p-3 rounded-lg"
      style={{ background: 'oklch(1 0 0 / 2%)', border: '1px solid oklch(1 0 0 / 5%)' }}
      data-testid="correlation-summary"
    >
      <div className="flex items-center gap-2">
        <List style={{ width: 14, height: 14, color: GOLD }} />
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: BRIGHT }}>
          {totalCount}
        </span>
        <span className="text-[11px]" style={{ color: MUTED }}>
          event{totalCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px]" style={{ color: MUTED }}>
          across
        </span>
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: BRIGHT }}>
          {activeCategories}
        </span>
        <span className="text-[11px]" style={{ color: MUTED }}>
          categor{activeCategories !== 1 ? 'ies' : 'y'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Clock style={{ width: 12, height: 12, color: MUTED }} />
        <span className="text-[11px]" style={{ color: MUTED }}>
          Window: {durationLabel}
        </span>
        <span className="text-[10px] font-mono" style={{ color: MUTED }}>
          {new Date(timeWindow.fromMs).toLocaleTimeString()} — {new Date(timeWindow.untilMs).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

// ─── Main Correlation Page ───────────────────────────────────────────────
export default function Correlation() {
  const { state, refetch } = useCorrelationOverlay();
  const { window: tw } = useTimeWindow();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [enabledCategories, setEnabledCategories] = useState<Set<CorrelationEventCategory>>(
    () => new Set(CORRELATION_CATEGORY_VISUALS.map((v: { category: CorrelationEventCategory }) => v.category)),
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleCategory = useCallback((cat: CorrelationEventCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setEnabledCategories(new Set(CORRELATION_CATEGORY_VISUALS.map((v: { category: CorrelationEventCategory }) => v.category)));
  }, []);

  const clearAll = useCallback(() => {
    setEnabledCategories(new Set());
  }, []);

  // Filtered and sorted events
  const filteredEvents = useMemo(() => {
    if (state.kind !== 'populated') return [];
    const filtered = filterEventsByCategory(
      state.payload.events,
      Array.from(enabledCategories),
    );
    // Sort by timestamp descending (most recent first)
    return [...filtered].sort((a, b) => b.timestampMs - a.timestampMs);
  }, [state, enabledCategories]);

  // ─── Idle state ─────────────────────────────────────────────────────────
  if (state.kind === 'idle') {
    return (
      <div data-testid="correlation-page-idle">
        <PageHeader
          title="Correlation"
          subtitle="What changed at roughly the same moment?"
        />
        <GlassCard>
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
            <span className="text-[12px]" style={{ color: MUTED }}>
              Initializing...
            </span>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <div data-testid="correlation-page-loading">
        <PageHeader
          title="Correlation"
          subtitle="What changed at roughly the same moment?"
        />
        <GlassCard>
          <div className="flex items-center gap-3 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: GOLD }} />
            <span className="text-[13px]" style={{ color: MUTED }}>
              Loading correlation events...
            </span>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (state.kind === 'error') {
    return (
      <div data-testid="correlation-page-error">
        <PageHeader
          title="Correlation"
          subtitle="What changed at roughly the same moment?"
        />
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-12">
            <AlertTriangle className="w-8 h-8" style={{ color: RED }} />
            <p className="text-[14px] font-medium" style={{ color: RED }}>
              Failed to load correlation events
            </p>
            <p className="text-[12px] font-mono max-w-md text-center" style={{ color: MUTED }}>
              {state.message}
            </p>
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 rounded-lg mt-2 transition-colors hover:bg-white/5"
              style={{ border: `1px solid ${GOLD}40`, color: GOLD }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
              <span className="text-[12px] font-medium">Retry</span>
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Malformed state ────────────────────────────────────────────────────
  if (state.kind === 'malformed') {
    return (
      <div data-testid="correlation-page-malformed">
        <PageHeader
          title="Correlation"
          subtitle="What changed at roughly the same moment?"
        />
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-12">
            <AlertTriangle className="w-8 h-8" style={{ color: ORANGE }} />
            <p className="text-[14px] font-medium" style={{ color: ORANGE }}>
              Correlation data contract violation
            </p>
            <p className="text-[12px] font-mono max-w-lg text-center" style={{ color: MUTED }}>
              {state.message}
            </p>
            <div
              className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded"
              style={{ background: 'oklch(1 0 0 / 3%)' }}
            >
              <Info style={{ width: 12, height: 12, color: MUTED }} />
              <span className="text-[10px]" style={{ color: MUTED }}>
                The BFF returned data that does not match the correlation payload schema.
              </span>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Quiet state ────────────────────────────────────────────────────────
  if (state.kind === 'quiet') {
    return (
      <div data-testid="correlation-page-quiet">
        <PageHeader
          title="Correlation"
          subtitle="What changed at roughly the same moment?"
        />
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-12">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 48,
                height: 48,
                background: 'oklch(1 0 0 / 4%)',
                border: '1px solid oklch(1 0 0 / 8%)',
              }}
            >
              <List style={{ width: 20, height: 20, color: MUTED }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: BRIGHT }}>
              No correlation events
            </p>
            <p className="text-[12px] max-w-sm text-center" style={{ color: MUTED }}>
              No configuration changes, detections, alerts, or other events were recorded
              in the current time window.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Clock style={{ width: 12, height: 12, color: MUTED }} />
              <span className="text-[10px] font-mono" style={{ color: MUTED }}>
                {new Date(state.timeWindow.fromMs).toLocaleTimeString()} — {new Date(state.timeWindow.untilMs).toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 rounded-lg mt-2 transition-colors hover:bg-white/5"
              style={{ border: `1px solid oklch(1 0 0 / 10%)`, color: MUTED }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
              <span className="text-[12px] font-medium">Refresh</span>
            </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ─── Populated state ───────────────────────────────────────────────────
  const { payload } = state;

  return (
    <div data-testid="correlation-page-populated">
      <PageHeader
        title="Correlation"
        subtitle="What changed at roughly the same moment?"
      />

      <div className="flex flex-col gap-4">
        {/* Summary strip */}
        <SummaryStrip
          totalCount={payload.totalCount}
          categoryCounts={payload.categoryCounts}
          timeWindow={payload.timeWindow}
        />

        {/* Category filter bar */}
        <CategoryFilterBar
          categoryCounts={payload.categoryCounts}
          enabledCategories={enabledCategories}
          onToggle={toggleCategory}
          onSelectAll={selectAll}
          onClearAll={clearAll}
        />

        {/* Event feed */}
        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: MUTED }}
              >
                Event Feed
              </h3>
              <span
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
                style={{ background: `${GOLD}20`, color: GOLD }}
              >
                {filteredEvents.length}
              </span>
              {filteredEvents.length !== payload.events.length && (
                <span className="text-[10px]" style={{ color: MUTED }}>
                  of {payload.events.length} total
                </span>
              )}
            </div>
            <button
              onClick={refetch}
              className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors hover:bg-white/5"
              style={{ color: MUTED }}
              aria-label="Refresh correlation events"
            >
              <RefreshCw style={{ width: 12, height: 12 }} />
              <span className="text-[10px]">Refresh</span>
            </button>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8" data-testid="correlation-feed-empty-filter">
              <Filter style={{ width: 20, height: 20, color: MUTED }} />
              <p className="text-[12px]" style={{ color: MUTED }}>
                No events match the current filter selection.
              </p>
              <button
                onClick={selectAll}
                className="text-[11px] font-medium px-3 py-1 rounded transition-colors hover:bg-white/5"
                style={{ color: GOLD }}
              >
                Show all categories
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y" style={{ borderColor: 'oklch(1 0 0 / 5%)' }}>
              {filteredEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isExpanded={expandedIds.has(event.id)}
                  onToggle={() => toggleExpand(event.id)}
                />
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
