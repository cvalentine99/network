/**
 * AlertDetailPane — Full alert detail inspector pane.
 *
 * Slice 11 — Replaces the compact AlertPreview (Slice 08) when an alert is selected.
 *
 * CONTRACT:
 *   - Receives alertId from InspectorSelection (kind: 'alert')
 *   - Fetches full detail via useAlertDetail hook (BFF route)
 *   - Renders 4 sections: Alert Info, Trigger History, Associated Devices, Associated Detections
 *   - Handles all 6 states: loading, quiet, populated, error, malformed, not-found
 *   - No ExtraHop calls — all data comes via BFF
 *   - Uses shared types only (AlertDetail, NormalizedAlert, etc.)
 */
import type { InspectorSelection, AlertDetail, NormalizedDetection } from '../../../../shared/cockpit-types';
import type { DeviceIdentity } from '../../../../shared/cockpit-types';
import { useAlertDetail } from '@/hooks/useAlertDetail';
import { SeverityBadge, GOLD, CYAN, MUTED, BRIGHT, RED, GREEN } from '@/components/DashboardWidgets';
import { riskScoreToSeverity } from '@/components/tables/DetectionsTable';
import {
  Bell, Monitor, Shield, Activity, Clock,
  Loader2, AlertTriangle, Search, Info, TrendingUp, TrendingDown
} from 'lucide-react';

// ─── Shared field row ───────────────────────────────────────────────────
function FieldRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <span className="text-[11px] uppercase tracking-wider shrink-0" style={{ color: MUTED }}>
        {label}
      </span>
      <span
        className="text-[12px] text-right truncate"
        style={{ color: BRIGHT, fontFamily: mono ? 'var(--font-mono)' : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────
function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-2">
      <span style={{ color: GOLD }}>{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
        {label}
      </span>
    </div>
  );
}

// ─── Mini device row ────────────────────────────────────────────────────
function MiniDeviceRow({ device }: { device: DeviceIdentity }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center gap-2 mb-0.5">
        <Monitor className="h-3 w-3" style={{ color: CYAN }} />
        <span className="text-[12px] font-semibold truncate" style={{ color: BRIGHT }}>
          {device.displayName}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: MUTED }}>
        {device.ipaddr4 && <span style={{ fontFamily: 'var(--font-mono)' }}>{device.ipaddr4}</span>}
        <span>{device.role}</span>
        {device.critical && <span style={{ color: RED }}>Critical</span>}
      </div>
    </div>
  );
}

// ─── Mini detection row ─────────────────────────────────────────────────
function MiniDetectionRow({ detection }: { detection: NormalizedDetection }) {
  const severity = riskScoreToSeverity(detection.riskScore);
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center gap-2 mb-0.5">
        <SeverityBadge level={severity} />
        <span className="text-[12px] font-semibold truncate" style={{ color: BRIGHT }}>
          {detection.title}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: MUTED }}>
        <span>Risk {detection.riskScore}</span>
        <span>{detection.status}</span>
        {detection.mitreTactics.length > 0 && (
          <span style={{ color: CYAN }}>{detection.mitreTactics[0]}</span>
        )}
      </div>
    </div>
  );
}

// ─── Trigger event row ──────────────────────────────────────────────────
function TriggerRow({ trigger }: { trigger: { timestamp: string; deviceId: number; deviceName: string; value: number; threshold: number | string; exceeded: boolean } }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center gap-2 mb-0.5">
        {trigger.exceeded ? (
          <TrendingUp className="h-3 w-3" style={{ color: RED }} />
        ) : (
          <TrendingDown className="h-3 w-3" style={{ color: GREEN }} />
        )}
        <span className="text-[12px] font-semibold truncate" style={{ color: BRIGHT }}>
          {trigger.deviceName}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
          style={{
            color: trigger.exceeded ? RED : GREEN,
            background: trigger.exceeded ? 'oklch(0.628 0.258 29.234 / 10%)' : 'oklch(0.723 0.219 142.136 / 10%)',
          }}
        >
          {trigger.exceeded ? 'exceeded' : 'normal'}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: MUTED }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          Value: <span style={{ color: trigger.exceeded ? RED : BRIGHT }}>{trigger.value.toLocaleString()}</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          Threshold: {String(trigger.threshold)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {new Date(trigger.timestamp).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ─── Alert header ───────────────────────────────────────────────────────
function AlertHeader({ alert }: { alert: AlertDetail['alert'] }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'oklch(0.769 0.108 85.805 / 12%)' }}
      >
        <Bell className="h-5 w-5" style={{ color: GOLD }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: BRIGHT }}>
          {alert.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <SeverityBadge level={alert.severityLabel} />
          <span className="text-[10px]" style={{ color: MUTED }}>
            {alert.type}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Loading state ──────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="alert-detail-loading">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      <p className="text-[12px]" style={{ color: MUTED }}>Loading alert detail…</p>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────
function ErrorState({ error, message }: { error: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="alert-detail-error">
      <AlertTriangle className="h-6 w-6" style={{ color: RED }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>{error}</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
    </div>
  );
}

// ─── Not-found state ────────────────────────────────────────────────────
function NotFoundState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="alert-detail-not-found">
      <Search className="h-6 w-6" style={{ color: MUTED }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>Alert Not Found</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
    </div>
  );
}

// ─── Malformed state ────────────────────────────────────────────────────
function MalformedState({ message, details }: { message: string; details: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="alert-detail-malformed">
      <AlertTriangle className="h-6 w-6" style={{ color: GOLD }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>Data Contract Violation</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
      <pre className="text-[10px] mt-2 px-3 py-2 rounded-lg max-h-32 overflow-auto w-full" style={{ background: 'oklch(1 0 0 / 3%)', color: RED, fontFamily: 'var(--font-mono)' }}>
        {details}
      </pre>
    </div>
  );
}

// ─── Quiet state ────────────────────────────────────────────────────────
function QuietState({ detail }: { detail: AlertDetail }) {
  return (
    <div data-testid="alert-detail-quiet">
      <AlertHeader alert={detail.alert} />

      {/* Core alert info */}
      <SectionHeader icon={<Info className="h-3.5 w-3.5" />} label="Alert Configuration" />
      <FieldRow label="ID" value={String(detail.alert.id)} mono />
      <FieldRow label="Author" value={detail.alert.author} />
      <FieldRow label="Stat" value={detail.alert.statName} mono />
      <FieldRow label="Field" value={detail.alert.fieldName} mono />
      <FieldRow label="Operator" value={detail.alert.operator} />
      <FieldRow label="Operand" value={String(detail.alert.operand)} mono />
      <FieldRow label="Interval" value={`${detail.alert.intervalLength}s`} mono />
      <FieldRow label="Refire" value={`${detail.alert.refireInterval}s`} mono />
      {detail.alert.description && <FieldRow label="Description" value={detail.alert.description} />}

      {/* Quiet message */}
      <div className="flex flex-col items-center py-8 gap-2">
        <Info className="h-5 w-5" style={{ color: MUTED }} />
        <p className="text-[11px] text-center" style={{ color: MUTED }}>
          No trigger history, associated devices, or associated detections for this alert.
        </p>
      </div>
    </div>
  );
}

// ─── Populated state ────────────────────────────────────────────────────
function PopulatedState({ detail }: { detail: AlertDetail }) {
  return (
    <div data-testid="alert-detail-populated">
      <AlertHeader alert={detail.alert} />

      {/* Core alert info */}
      <SectionHeader icon={<Info className="h-3.5 w-3.5" />} label="Alert Configuration" />
      <FieldRow label="ID" value={String(detail.alert.id)} mono />
      <FieldRow label="Author" value={detail.alert.author} />
      <FieldRow label="Stat" value={detail.alert.statName} mono />
      <FieldRow label="Field" value={detail.alert.fieldName} mono />
      <FieldRow label="Operator" value={detail.alert.operator} />
      <FieldRow label="Operand" value={String(detail.alert.operand)} mono />
      <FieldRow label="Interval" value={`${detail.alert.intervalLength}s`} mono />
      <FieldRow label="Refire" value={`${detail.alert.refireInterval}s`} mono />
      {detail.alert.description && <FieldRow label="Description" value={detail.alert.description} />}

      {/* Trigger history */}
      {detail.triggerHistory.length > 0 && (
        <>
          <SectionHeader icon={<Activity className="h-3.5 w-3.5" />} label={`Trigger History (${detail.triggerHistory.length})`} />
          {detail.triggerHistory.map((t, i) => (
            <TriggerRow key={`${t.timestamp}-${t.deviceId}-${i}`} trigger={t} />
          ))}
        </>
      )}

      {/* Associated devices */}
      {detail.associatedDevices.length > 0 && (
        <>
          <SectionHeader icon={<Monitor className="h-3.5 w-3.5" />} label={`Associated Devices (${detail.associatedDevices.length})`} />
          {detail.associatedDevices.map((d) => (
            <MiniDeviceRow key={d.id} device={d} />
          ))}
        </>
      )}

      {/* Associated detections */}
      {detail.associatedDetections.length > 0 && (
        <>
          <SectionHeader icon={<Shield className="h-3.5 w-3.5" />} label={`Associated Detections (${detail.associatedDetections.length})`} />
          {detail.associatedDetections.map((d) => (
            <MiniDetectionRow key={d.id} detection={d} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────
interface AlertDetailPaneProps {
  selection: Extract<InspectorSelection, { kind: 'alert' }>;
}

export function AlertDetailPane({ selection }: AlertDetailPaneProps) {
  const alertId = selection.alert.id;
  const state = useAlertDetail(alertId);

  switch (state.status) {
    case 'loading':
      return <LoadingState />;
    case 'quiet':
      return <QuietState detail={state.alertDetail} />;
    case 'populated':
      return <PopulatedState detail={state.alertDetail} />;
    case 'error':
      return <ErrorState error={state.error} message={state.message} />;
    case 'not-found':
      return <NotFoundState message={state.message} />;
    case 'malformed':
      return <MalformedState message={state.message} details={state.details} />;
    default:
      return null;
  }
}
