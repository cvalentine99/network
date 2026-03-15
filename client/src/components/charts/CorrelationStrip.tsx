/**
 * CorrelationStrip — Causal strip markers overlaid on the Impact Deck timeline (Slice 19)
 *
 * CONTRACT:
 * - Renders colored vertical markers on the timeline for each correlation event
 * - Clusters nearby events to avoid visual clutter
 * - Shows a legend strip with category toggles
 * - Clicking a marker shows a popover with event details
 * - All 5 UI states: idle, loading, quiet, populated, error/malformed
 * - Uses shared types and category visuals from correlation-types
 * - Never contacts ExtraHop directly
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShieldAlert,
  BellRing,
  Settings,
  Cpu,
  Network,
  Gauge,
  Globe,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { GlassCard, MUTED, GOLD } from '@/components/DashboardWidgets';
import type {
  CorrelationOverlayState,
  CorrelationEvent,
  CorrelationEventCategory,
  CorrelationEventCluster,
} from '../../../../shared/correlation-types';
import {
  getCategoryVisual,
  clusterEvents,
  CORRELATION_CATEGORY_VISUALS,
} from '../../../../shared/correlation-types';

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
  size = 12,
}: {
  iconHint: string;
  color: string;
  size?: number;
}) {
  const Icon = ICON_MAP[iconHint] || Globe;
  return <Icon className={`w-[${size}px] h-[${size}px]`} style={{ color, width: size, height: size }} />;
}

// ─── Severity badge ───────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'oklch(0.628 0.258 29.234)',
    high: 'oklch(0.705 0.213 47.604)',
    medium: 'oklch(0.795 0.184 86.047)',
    low: 'oklch(0.600 0.000 0)',
  };
  const c = colors[severity] || colors.low;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
      style={{ background: `${c}20`, color: c }}
    >
      {severity}
    </span>
  );
}

// ─── Event detail popover ─────────────────────────────────────────────────
function EventPopover({
  events,
  onClose,
}: {
  events: CorrelationEvent[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 rounded-lg shadow-2xl p-3 max-w-sm max-h-64 overflow-y-auto"
      style={{
        background: 'oklch(0.14 0.005 260 / 98%)',
        border: '1px solid oklch(1 0 0 / 12%)',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 4,
      }}
      data-testid="correlation-popover"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
          {events.length} Event{events.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-white/5"
          aria-label="Close popover"
        >
          <X className="w-3 h-3" style={{ color: MUTED }} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {events.map((evt) => {
          const visual = getCategoryVisual(evt.category);
          return (
            <div
              key={evt.id}
              className="flex gap-2 p-2 rounded"
              style={{ background: 'oklch(1 0 0 / 3%)' }}
            >
              <div className="flex-shrink-0 mt-0.5">
                <CategoryIcon iconHint={visual.iconHint} color={visual.color} size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: 'oklch(0.95 0 0)' }}>
                  {evt.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-mono" style={{ color: MUTED }}>
                    {new Date(evt.timestampMs).toLocaleTimeString()}
                  </span>
                  <span
                    className="text-[9px] px-1 rounded"
                    style={{ background: `${visual.color}20`, color: visual.color }}
                  >
                    {visual.label}
                  </span>
                  {evt.severity && <SeverityBadge severity={evt.severity} />}
                </div>
                {evt.description && (
                  <p
                    className="text-[9px] mt-1 line-clamp-2"
                    style={{ color: MUTED }}
                  >
                    {evt.description}
                  </p>
                )}
                {evt.riskScore !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[8px] uppercase" style={{ color: MUTED }}>Risk</span>
                    <div className="flex-1 h-1 rounded-full" style={{ background: 'oklch(1 0 0 / 6%)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${evt.riskScore}%`,
                          background: evt.riskScore >= 80
                            ? 'oklch(0.628 0.258 29.234)'
                            : evt.riskScore >= 50
                            ? 'oklch(0.705 0.213 47.604)'
                            : 'oklch(0.795 0.184 86.047)',
                        }}
                      />
                    </div>
                    <span className="text-[8px] font-mono" style={{ color: MUTED }}>
                      {evt.riskScore}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cluster marker ───────────────────────────────────────────────────────
function ClusterMarker({
  cluster,
  position,
  chartWidth,
  fromMs,
  untilMs,
}: {
  cluster: CorrelationEventCluster;
  position: number;
  chartWidth: number;
  fromMs: number;
  untilMs: number;
}) {
  const [showPopover, setShowPopover] = useState(false);
  const visual = getCategoryVisual(cluster.dominantCategory);
  const range = untilMs - fromMs;
  const leftPct = range > 0 ? ((cluster.timestampMs - fromMs) / range) * 100 : 0;
  // Clamp to 2-98% to keep markers visible
  const clampedPct = Math.max(2, Math.min(98, leftPct));

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${clampedPct}%`,
        top: 0,
        bottom: 0,
        transform: 'translateX(-50%)',
        zIndex: showPopover ? 40 : 10 + position,
      }}
    >
      {/* Vertical line */}
      <div
        className="w-px h-full opacity-40"
        style={{ background: visual.color }}
      />
      {/* Marker dot */}
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="absolute top-0 flex items-center justify-center rounded-full cursor-pointer transition-transform hover:scale-125"
        style={{
          width: cluster.count > 1 ? 20 : 16,
          height: cluster.count > 1 ? 20 : 16,
          background: `${visual.color}30`,
          border: `1.5px solid ${visual.color}`,
          transform: 'translateY(-50%)',
        }}
        aria-label={`${cluster.count} correlation event${cluster.count !== 1 ? 's' : ''}`}
        data-testid={`correlation-marker-${position}`}
      >
        {cluster.count > 1 ? (
          <span className="text-[8px] font-bold" style={{ color: visual.color }}>
            {cluster.count}
          </span>
        ) : (
          <CategoryIcon iconHint={visual.iconHint} color={visual.color} size={10} />
        )}
      </button>
      {/* Popover */}
      {showPopover && (
        <EventPopover
          events={cluster.events}
          onClose={() => setShowPopover(false)}
        />
      )}
    </div>
  );
}

// ─── Category legend ──────────────────────────────────────────────────────
function CategoryLegend({
  categoryCounts,
  enabledCategories,
  onToggle,
}: {
  categoryCounts: Record<CorrelationEventCategory, number>;
  enabledCategories: Set<CorrelationEventCategory>;
  onToggle: (cat: CorrelationEventCategory) => void;
}) {
  const activeCats = CORRELATION_CATEGORY_VISUALS.filter(
    (v) => categoryCounts[v.category] > 0,
  );
  if (activeCats.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="correlation-legend">
      {activeCats.map((v) => {
        const enabled = enabledCategories.has(v.category);
        return (
          <button
            key={v.category}
            onClick={() => onToggle(v.category)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-opacity"
            style={{
              background: enabled ? `${v.color}15` : 'transparent',
              border: `1px solid ${enabled ? v.color : 'oklch(1 0 0 / 8%)'}`,
              opacity: enabled ? 1 : 0.4,
              color: enabled ? v.color : MUTED,
            }}
            aria-label={`Toggle ${v.label}`}
          >
            <CategoryIcon iconHint={v.iconHint} color={enabled ? v.color : MUTED} size={10} />
            <span>{v.label}</span>
            <span className="font-mono font-bold">{categoryCounts[v.category]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export function CorrelationStrip({
  state,
  chartHeight = 260,
}: {
  state: CorrelationOverlayState;
  chartHeight?: number;
}) {
  const [enabledCategories, setEnabledCategories] = useState<Set<CorrelationEventCategory>>(
    () => new Set(CORRELATION_CATEGORY_VISUALS.map((v) => v.category)),
  );

  const toggleCategory = (cat: CorrelationEventCategory) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  // Cluster events for rendering
  const clusters = useMemo(() => {
    if (state.kind !== 'populated') return [];
    const filtered = state.payload.events.filter((e) => enabledCategories.has(e.category));
    // Bucket size: 1% of time range
    const range = state.payload.timeWindow.untilMs - state.payload.timeWindow.fromMs;
    const bucketMs = Math.max(1000, range * 0.02);
    return clusterEvents(filtered, bucketMs);
  }, [state, enabledCategories]);

  // ─── Idle state ─────────────────────────────────────────────────────────
  if (state.kind === 'idle') {
    return null; // Don't render anything before first fetch
  }

  // ─── Loading state ──────────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <div data-testid="correlation-loading" className="mb-2">
        <div className="flex items-center gap-2 px-1">
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: GOLD }} />
          <span className="text-[10px]" style={{ color: MUTED }}>
            Loading correlation events...
          </span>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (state.kind === 'error') {
    return (
      <div data-testid="correlation-error" className="mb-2">
        <GlassCard>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'oklch(0.628 0.258 29.234)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'oklch(0.628 0.258 29.234)' }}>
              Correlation overlay failed
            </span>
          </div>
          <p className="text-[10px] font-mono mt-1" style={{ color: MUTED }}>
            {state.message}
          </p>
        </GlassCard>
      </div>
    );
  }

  // ─── Malformed state ────────────────────────────────────────────────────
  if (state.kind === 'malformed') {
    return (
      <div data-testid="correlation-malformed" className="mb-2">
        <GlassCard>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'oklch(0.705 0.213 47.604)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'oklch(0.705 0.213 47.604)' }}>
              Correlation data contract violation
            </span>
          </div>
          <p className="text-[10px] font-mono mt-1" style={{ color: MUTED }}>
            {state.message}
          </p>
        </GlassCard>
      </div>
    );
  }

  // ─── Quiet state ────────────────────────────────────────────────────────
  if (state.kind === 'quiet') {
    return (
      <div data-testid="correlation-quiet" className="mb-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px]" style={{ color: MUTED }}>
            No correlation events in this time window
          </span>
        </div>
      </div>
    );
  }

  // ─── Populated state ───────────────────────────────────────────────────
  const { payload } = state;

  return (
    <div data-testid="correlation-populated" className="mb-2">
      {/* Header row: title + legend */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Correlation Events
          </h3>
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums"
            style={{
              background: `${GOLD}20`,
              color: GOLD,
            }}
          >
            {payload.totalCount}
          </span>
        </div>
        <CategoryLegend
          categoryCounts={payload.categoryCounts}
          enabledCategories={enabledCategories}
          onToggle={toggleCategory}
        />
      </div>

      {/* Marker overlay strip — positioned to align with the chart area below */}
      <div
        className="relative w-full"
        style={{
          height: 24,
          marginLeft: 80, // align with chart area (YAxis left width + margin)
          marginRight: 60, // align with chart area (YAxis right width + margin)
          width: 'calc(100% - 140px)',
        }}
        data-testid="correlation-strip"
      >
        {clusters.map((cluster, i) => (
          <ClusterMarker
            key={`${cluster.timestampMs}-${i}`}
            cluster={cluster}
            position={i}
            chartWidth={0}
            fromMs={payload.timeWindow.fromMs}
            untilMs={payload.timeWindow.untilMs}
          />
        ))}
      </div>
    </div>
  );
}
