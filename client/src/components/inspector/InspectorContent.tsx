/**
 * InspectorContent — Routes inspector content based on the selected entity kind.
 *
 * Slice 08 — Interaction contract component.
 *
 * CONTRACT:
 *   - Reads InspectorSelection from InspectorContext (never raw payloads)
 *   - Routes to kind-specific preview panels:
 *     - 'device' → DevicePreview (summary of TopTalkerRow + DeviceIdentity)
 *     - 'detection' → DetectionPreview (summary of NormalizedDetection)
 *     - 'alert' → AlertPreview (summary of NormalizedAlert)
 *   - null selection → empty state (handled by InspectorShell's default children)
 *   - Each preview is a compact summary, NOT the full detail pane (that is Slice 09+)
 *   - No ExtraHop calls — all data comes from the already-fetched entity
 *
 * Slice 09 replaced DevicePreview with DeviceDetailPane (full detail with BFF fetch).
 * Detection and Alert previews remain compact (Slice 08 level).
 */
import type { InspectorSelection } from '../../../../shared/cockpit-types';
import { formatBytes } from '../../../../shared/formatters';
import { SeverityBadge, GOLD, CYAN, MUTED, BRIGHT, RED, GREEN } from '@/components/DashboardWidgets';
import { riskScoreToSeverity } from '@/components/tables/DetectionsTable';
import { alertSeverityToLabel } from '@/components/tables/AlertsPanel';
import { DeviceDetailPane } from './DeviceDetailPane';
import { Monitor, Shield, Bell, Globe, Server, Tag, Clock, Activity } from 'lucide-react';

// ─── Shared field row ────────────────────────────────────────────────────
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

// ─── Section header ──────────────────────────────────────────────────────
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

// ─── Device Preview ──────────────────────────────────────────────────────
function DevicePreview({ selection }: { selection: Extract<InspectorSelection, { kind: 'device' }> }) {
  const { device, topTalkerRow } = selection;

  return (
    <div>
      {/* Identity header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'oklch(0.769 0.108 85.805 / 12%)' }}
        >
          <Monitor className="h-5 w-5" style={{ color: GOLD }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: BRIGHT }}>
            {device.displayName}
          </p>
          {device.ipaddr4 && (
            <p className="text-[11px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
              {device.ipaddr4}
            </p>
          )}
        </div>
      </div>

      {/* Identity fields */}
      <SectionHeader icon={<Server className="h-3.5 w-3.5" />} label="Identity" />
      <FieldRow label="ID" value={String(device.id)} mono />
      <FieldRow label="MAC" value={device.macaddr} mono />
      <FieldRow label="Role" value={device.role} />
      <FieldRow label="Vendor" value={device.vendor} />
      <FieldRow label="Class" value={device.deviceClass} />
      <FieldRow label="Software" value={device.software} />
      <FieldRow label="Analysis" value={device.analysis} />

      {/* Traffic summary */}
      <SectionHeader icon={<Activity className="h-3.5 w-3.5" />} label="Traffic" />
      <FieldRow label="Bytes In" value={formatBytes(topTalkerRow.bytesIn)} mono />
      <FieldRow label="Bytes Out" value={formatBytes(topTalkerRow.bytesOut)} mono />
      <FieldRow label="Total" value={formatBytes(topTalkerRow.totalBytes)} mono />
      <FieldRow label="Pkts In" value={topTalkerRow.pktsIn.toLocaleString()} mono />
      <FieldRow label="Pkts Out" value={topTalkerRow.pktsOut.toLocaleString()} mono />

      {/* Flags */}
      <SectionHeader icon={<Tag className="h-3.5 w-3.5" />} label="Flags" />
      <div className="flex flex-wrap gap-1.5 mt-1">
        {device.critical && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: 'oklch(0.628 0.258 29.234 / 15%)', color: RED }}>
            Critical
          </span>
        )}
        {device.onWatchlist && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: 'oklch(0.769 0.108 85.805 / 12%)', color: GOLD }}>
            Watchlist
          </span>
        )}
        {device.isL3 && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ background: 'oklch(1 0 0 / 5%)', color: MUTED }}>
            L3
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Detection Preview ───────────────────────────────────────────────────
function DetectionPreview({ selection }: { selection: Extract<InspectorSelection, { kind: 'detection' }> }) {
  const { detection } = selection;
  const severity = riskScoreToSeverity(detection.riskScore);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'oklch(0.628 0.258 29.234 / 12%)' }}
        >
          <Shield className="h-5 w-5" style={{ color: RED }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: BRIGHT }}>
            {detection.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <SeverityBadge level={severity} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
              Risk {detection.riskScore}
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <SectionHeader icon={<Shield className="h-3.5 w-3.5" />} label="Detection" />
      <FieldRow label="ID" value={String(detection.id)} mono />
      <FieldRow label="Type" value={detection.type} />
      <FieldRow label="Status" value={detection.status} />
      <FieldRow label="Resolution" value={detection.resolution} />
      <FieldRow label="Assignee" value={detection.assignee} />
      <FieldRow label="Ticket" value={detection.ticketId} mono />

      {/* Time */}
      <SectionHeader icon={<Clock className="h-3.5 w-3.5" />} label="Timeline" />
      <FieldRow label="Start" value={detection.startTimeIso} mono />
      <FieldRow label="End" value={detection.endTimeIso} mono />
      <FieldRow label="Created" value={detection.createTimeIso} mono />

      {/* MITRE */}
      {(detection.mitreTactics.length > 0 || detection.mitreTechniques.length > 0) && (
        <>
          <SectionHeader icon={<Globe className="h-3.5 w-3.5" />} label="MITRE ATT&CK" />
          <div className="flex flex-wrap gap-1.5 mt-1">
            {detection.mitreTactics.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                style={{ background: 'oklch(0.75 0.15 195 / 12%)', color: CYAN }}
              >
                {t}
              </span>
            ))}
            {detection.mitreTechniques.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-[10px] font-mono"
                style={{ background: 'oklch(1 0 0 / 5%)', color: MUTED }}
              >
                {t}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Participants */}
      {detection.participants.length > 0 && (
        <>
          <SectionHeader icon={<Monitor className="h-3.5 w-3.5" />} label="Participants" />
          {detection.participants.map((p, i) => (
            <div key={i} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: p.role === 'offender' ? RED : CYAN }}>
                {p.role}
              </span>
              <span className="text-[11px]" style={{ color: BRIGHT, fontFamily: 'var(--font-mono)' }}>
                {p.object_type === 'device' ? `device:${p.object_id}` : p.ipaddr || 'unknown'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Alert Preview ───────────────────────────────────────────────────────
function AlertPreview({ selection }: { selection: Extract<InspectorSelection, { kind: 'alert' }> }) {
  const { alert } = selection;

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
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
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
            <span className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
              {alert.type}
            </span>
            {alert.disabled && (
              <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: MUTED }}>
                (disabled)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alert details */}
      <SectionHeader icon={<Bell className="h-3.5 w-3.5" />} label="Alert Rule" />
      <FieldRow label="ID" value={String(alert.id)} mono />
      <FieldRow label="Author" value={alert.author} />
      <FieldRow label="Type" value={alert.type} />
      <FieldRow label="Severity" value={`${alert.severity} (${alert.severityLabel})`} />

      {/* Monitor expression */}
      <SectionHeader icon={<Activity className="h-3.5 w-3.5" />} label="Monitor" />
      <div className="py-2 px-3 rounded-lg mt-1" style={{ background: 'oklch(1 0 0 / 3%)' }}>
        <p className="text-[11px] tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: BRIGHT }}>
          {monitorLine}
        </p>
      </div>
      <FieldRow label="Stat" value={alert.statName} mono />
      <FieldRow label="Field" value={alert.fieldName} mono />
      <FieldRow label="Field Op" value={alert.fieldOp} mono />
      <FieldRow label="Operator" value={alert.operator} />
      <FieldRow label="Operand" value={String(alert.operand)} mono />

      {/* Timing */}
      {(alert.intervalLength || alert.refireInterval) && (
        <>
          <SectionHeader icon={<Clock className="h-3.5 w-3.5" />} label="Timing" />
          {alert.intervalLength && <FieldRow label="Interval" value={`${alert.intervalLength}s`} mono />}
          {alert.refireInterval && <FieldRow label="Refire" value={`${alert.refireInterval}s`} mono />}
        </>
      )}

      {/* Description */}
      {alert.description && (
        <>
          <SectionHeader icon={<Tag className="h-3.5 w-3.5" />} label="Description" />
          <p className="text-[12px] mt-1 leading-relaxed" style={{ color: MUTED }}>
            {alert.description}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Main Router ─────────────────────────────────────────────────────────
export function InspectorContent({ selection }: { selection: InspectorSelection | null }) {
  if (!selection) return null;

  switch (selection.kind) {
    case 'device':
      return <DeviceDetailPane selection={selection} />;
    case 'detection':
      return <DetectionPreview selection={selection} />;
    case 'alert':
      return <AlertPreview selection={selection} />;
    default:
      return null;
  }
}

/**
 * Returns the inspector title based on the current selection kind.
 */
export function inspectorTitle(selection: InspectorSelection | null): string {
  if (!selection) return 'Inspector';
  switch (selection.kind) {
    case 'device':
      return 'Device Inspector';
    case 'detection':
      return 'Detection Inspector';
    case 'alert':
      return 'Alert Inspector';
    default:
      return 'Inspector';
  }
}
