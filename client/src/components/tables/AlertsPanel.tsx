/**
 * AlertsPanel — Configured Alerts display.
 *
 * Shows NormalizedAlert rows in a 3-column card grid.
 * Each card shows:
 *   - SeverityBadge (ExtraHop convention: LOWER severity int = MORE severe)
 *   - Alert name in BRIGHT
 *   - Monitor details: statName fieldName operator operand in MUTED
 *   - Disabled indicator when alert.disabled === true
 *
 * 5 UI states:
 *   1. loading — skeleton cards
 *   2. quiet — EmptyState (no alerts configured, valid state)
 *   3. populated — card grid with severity badges
 *   4. error — ErrorState (transport failure)
 *   5. malformed — ErrorState (contract violation)
 *
 * Contract: this component never interprets raw payloads.
 * It receives NormalizedAlert[] from the hook, which is already schema-validated.
 */
import type { NormalizedAlert } from '../../../../shared/cockpit-types';
import { SeverityBadge, GlassCard, MUTED, BRIGHT, GOLD } from '@/components/DashboardWidgets';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bell, BellOff } from 'lucide-react';

// ─── State discriminator ─────────────────────────────────────────────────
export type AlertsState =
  | { status: 'loading' }
  | { status: 'quiet' }
  | { status: 'populated'; alerts: NormalizedAlert[] }
  | { status: 'error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string; details?: string };

// ─── Alert severity to label (ExtraHop: LOWER = MORE severe) ─────────────
export function alertSeverityToLabel(severity: number): 'critical' | 'high' | 'medium' | 'low' {
  if (severity <= 1) return 'critical';
  if (severity <= 3) return 'high';
  if (severity <= 5) return 'medium';
  return 'low';
}

// ─── Skeleton ────────────────────────────────────────────────────────────
function AlertCardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: 'oklch(0.12 0.005 260)', border: '1px solid oklch(1 0 0 / 4%)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-16 rounded" style={{ background: 'oklch(0.2 0.005 260)' }} />
        <div className="h-4 w-20 rounded" style={{ background: 'oklch(0.2 0.005 260)' }} />
      </div>
      <div className="h-4 w-3/4 rounded mb-2" style={{ background: 'oklch(0.18 0.005 260)' }} />
      <div className="h-3 w-full rounded" style={{ background: 'oklch(0.15 0.005 260)' }} />
    </div>
  );
}

// ─── Alert Card ──────────────────────────────────────────────────────────
function AlertCard({ alert }: { alert: NormalizedAlert }) {
  const monitorLine = [
    alert.statName,
    alert.fieldName,
    alert.fieldOp ? `(${alert.fieldOp})` : null,
    alert.operator,
    String(alert.operand),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        background: alert.disabled ? 'oklch(0.10 0.005 260)' : 'oklch(0.12 0.005 260)',
        border: '1px solid oklch(1 0 0 / 4%)',
        opacity: alert.disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(1 0 0 / 3%)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = alert.disabled ? 'oklch(0.10 0.005 260)' : 'oklch(0.12 0.005 260)'; }}
      data-testid={`alert-card-${alert.id}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <SeverityBadge level={alert.severityLabel} />
        <span
          className="text-[10px] uppercase tracking-wider font-medium"
          style={{ color: MUTED }}
        >
          {alert.type}
        </span>
        {alert.disabled && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium" style={{ color: MUTED }}>
            <BellOff className="h-3 w-3" />
            disabled
          </span>
        )}
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: BRIGHT }}>
        {alert.name}
      </p>
      <p
        className="text-[11px] tabular-nums truncate"
        style={{ fontFamily: 'var(--font-mono)', color: MUTED }}
        title={monitorLine}
      >
        {monitorLine}
      </p>
      {alert.description && (
        <p
          className="text-[11px] mt-1.5 line-clamp-2"
          style={{ color: MUTED, opacity: 0.7 }}
        >
          {alert.description}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────
export function AlertsPanel({ state }: { state: AlertsState }) {
  if (state.status === 'loading') {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Configured Alerts
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AlertCardSkeleton key={i} />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (state.status === 'quiet') {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Configured Alerts
          </p>
        </div>
        <EmptyState
          title="No alerts configured"
          message="No active alert rules found. Alerts will appear when configured on the appliance."
          icon={<Bell className="h-5 w-5" style={{ color: GOLD, opacity: 0.5 }} />}
        />
      </GlassCard>
    );
  }

  if (state.status === 'error') {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Configured Alerts
          </p>
        </div>
        <ErrorState
          type="transport"
          title={state.error}
          message={state.message}
        />
      </GlassCard>
    );
  }

  if (state.status === 'malformed') {
    return (
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Configured Alerts
          </p>
        </div>
        <ErrorState
          type="contract"
          title={state.error}
          message={state.message}
          details={state.details}
        />
      </GlassCard>
    );
  }

  // Populated state
  const activeAlerts = state.alerts.filter((a) => !a.disabled);
  const disabledAlerts = state.alerts.filter((a) => a.disabled);
  const activeCount = activeAlerts.length;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <p
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          Configured Alerts ({activeCount} active)
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {activeAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
        {disabledAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </GlassCard>
  );
}
