/**
 * DetectionsTable — Recent Detections panel for the Impact Deck
 *
 * CONTRACT:
 * - Receives state discriminated union, never raw payloads
 * - Uses NormalizedDetection from shared/cockpit-types.ts
 * - Risk score → severity mapping: ≥80 critical, ≥60 high, ≥30 medium, <30 low
 * - SeverityBadge from DashboardWidgets (not reimplemented)
 * - MITRE tactic tags rendered as inline pills
 * - Relative time display for startTime
 * - 5 UI states: loading, quiet, populated, error, malformed
 * - Max height ~400px with vertical scroll
 * - No direct ExtraHop calls
 * - All colors from DashboardWidgets constants (no hardcoded hex outside OKLCH system)
 */
import type { NormalizedDetection, Severity } from '../../../../shared/cockpit-types';
import { SeverityBadge, MUTED, BRIGHT, CYAN, RED, GREEN } from '@/components/DashboardWidgets';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

// ─── Risk Score → Severity Mapping ──────────────────────────────────────────
// Sprint doc: ≥80 critical, ≥60 high, ≥30 medium, <30 low
export function riskScoreToSeverity(riskScore: number): Severity {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}

// ─── Relative Time Formatter ────────────────────────────────────────────────
export function formatRelativeTime(epochMs: number): string {
  const now = Date.now();
  const diffMs = now - epochMs;
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── State Discriminated Union ──────────────────────────────────────────────
export type DetectionsState =
  | { kind: 'loading' }
  | { kind: 'quiet' }
  | { kind: 'populated'; detections: NormalizedDetection[] }
  | { kind: 'error'; error: string; message: string }
  | { kind: 'malformed'; message: string };

// ─── Loading Skeleton ───────────────────────────────────────────────────────
function DetectionRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 py-3 px-3"
      style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}
    >
      <div className="w-16 h-5 rounded" style={{ background: 'oklch(1 0 0 / 6%)' }} />
      <div className="flex-1 h-4 rounded" style={{ background: 'oklch(1 0 0 / 6%)' }} />
      <div className="w-20 h-4 rounded" style={{ background: 'oklch(1 0 0 / 6%)' }} />
      <div className="w-16 h-4 rounded" style={{ background: 'oklch(1 0 0 / 6%)' }} />
    </div>
  );
}

// ─── Detection Row ──────────────────────────────────────────────────────────
function DetectionRow({ detection }: { detection: NormalizedDetection }) {
  const severity = riskScoreToSeverity(detection.riskScore);

  return (
    <div
      className="flex items-start gap-3 py-3 px-3 transition-colors cursor-default"
      style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'oklch(1 0 0 / 3%)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      data-testid={`detection-row-${detection.id}`}
    >
      {/* Severity badge */}
      <div className="flex-shrink-0 pt-0.5">
        <SeverityBadge level={severity} />
      </div>

      {/* Title + type + MITRE tags */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: BRIGHT }}>
          {detection.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            {detection.type}
          </span>
          {detection.mitreTactics.map((tactic) => (
            <span
              key={tactic}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
              style={{
                background: 'oklch(0.75 0.15 195 / 12%)',
                color: CYAN,
              }}
            >
              {tactic}
            </span>
          ))}
          {detection.mitreTechniques.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono"
              style={{
                background: 'oklch(1 0 0 / 5%)',
                color: MUTED,
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 text-right">
        <span
          className="text-[11px] uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          {detection.status}
        </span>
      </div>

      {/* Time */}
      <div className="flex-shrink-0 text-right w-16">
        <span
          className="text-[11px] tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: MUTED }}
        >
          {formatRelativeTime(detection.startTime)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function DetectionsTable({ state }: { state: DetectionsState }) {
  if (state.kind === 'loading') {
    return (
      <div data-testid="detections-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <DetectionRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (state.kind === 'quiet') {
    return (
      <div data-testid="detections-quiet">
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" style={{ color: MUTED }} />}
          message="No detections found"
        />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div data-testid="detections-error">
        <ErrorState
          type="transport"
          message={state.message}
        />
      </div>
    );
  }

  if (state.kind === 'malformed') {
    return (
      <div data-testid="detections-malformed">
        <ErrorState
          type="contract"
          message={state.message}
        />
      </div>
    );
  }

  // Populated state
  const countBySeverity = {
    critical: state.detections.filter(d => riskScoreToSeverity(d.riskScore) === 'critical').length,
    high: state.detections.filter(d => riskScoreToSeverity(d.riskScore) === 'high').length,
    medium: state.detections.filter(d => riskScoreToSeverity(d.riskScore) === 'medium').length,
    low: state.detections.filter(d => riskScoreToSeverity(d.riskScore) === 'low').length,
  };

  return (
    <div data-testid="detections-populated">
      {/* Summary strip */}
      <div
        className="flex items-center gap-4 px-3 py-2 mb-2"
        style={{ borderBottom: '1px solid oklch(1 0 0 / 8%)' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
          {state.detections.length} detection{state.detections.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          {countBySeverity.critical > 0 && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: RED }}>
              {countBySeverity.critical} crit
            </span>
          )}
          {countBySeverity.high > 0 && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: 'oklch(0.705 0.213 47.604)' }}>
              {countBySeverity.high} high
            </span>
          )}
          {countBySeverity.medium > 0 && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: 'oklch(0.769 0.188 70.08)' }}>
              {countBySeverity.medium} med
            </span>
          )}
          {countBySeverity.low > 0 && (
            <span className="text-[10px] font-bold tabular-nums" style={{ color: GREEN }}>
              {countBySeverity.low} low
            </span>
          )}
        </div>
      </div>

      {/* Scrollable detection rows */}
      <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
        {state.detections.map((detection) => (
          <DetectionRow key={detection.id} detection={detection} />
        ))}
      </div>
    </div>
  );
}
