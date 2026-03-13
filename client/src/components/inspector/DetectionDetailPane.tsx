/**
 * DetectionDetailPane — Full detection detail inspector pane.
 *
 * Slice 11 — Replaces the compact DetectionPreview (Slice 08) when a detection is selected.
 *
 * CONTRACT:
 *   - Receives detectionId from InspectorSelection (kind: 'detection')
 *   - Fetches full detail via useDetectionDetail hook (BFF route)
 *   - Renders 5 sections: Detection Info, MITRE, Related Devices, Related Alerts, Timeline
 *   - Handles all 6 states: loading, quiet, populated, error, malformed, not-found
 *   - No ExtraHop calls — all data comes via BFF
 *   - Uses shared types only (DetectionDetail, NormalizedDetection, etc.)
 */
import type { InspectorSelection, DetectionDetail, NormalizedAlert } from '../../../../shared/cockpit-types';
import type { DeviceIdentity } from '../../../../shared/cockpit-types';
import { useDetectionDetail } from '@/hooks/useDetectionDetail';
import { SeverityBadge, GOLD, CYAN, MUTED, BRIGHT, RED, GREEN } from '@/components/DashboardWidgets';
import { riskScoreToSeverity } from '@/components/tables/DetectionsTable';
import { alertSeverityToLabel } from '@/components/tables/AlertsPanel';
import {
  Shield, Monitor, Bell, Clock, Tag, FileText, Users,
  Loader2, AlertTriangle, Search, Info
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

// ─── Mini alert row ─────────────────────────────────────────────────────
function MiniAlertRow({ alert }: { alert: NormalizedAlert }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center gap-2 mb-0.5">
        <SeverityBadge level={alert.severityLabel} />
        <span className="text-[12px] font-semibold truncate" style={{ color: BRIGHT }}>
          {alert.name}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: MUTED }}>
        <span>{alert.type}</span>
        <span>{alert.statName}</span>
      </div>
    </div>
  );
}

// ─── Timeline event row ─────────────────────────────────────────────────
function TimelineRow({ event }: { event: { timestamp: string; event: string; detail: string } }) {
  const eventColors: Record<string, string> = {
    created: GREEN,
    updated: CYAN,
    assigned: GOLD,
    status_changed: BRIGHT,
    resolved: GREEN,
    reopened: RED,
  };
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
          style={{
            color: eventColors[event.event] || MUTED,
            background: 'oklch(1 0 0 / 4%)',
          }}
        >
          {event.event.replace('_', ' ')}
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
          {new Date(event.timestamp).toLocaleString()}
        </span>
      </div>
      <p className="text-[11px] pl-1" style={{ color: BRIGHT }}>{event.detail}</p>
    </div>
  );
}

// ─── Note row ───────────────────────────────────────────────────────────
function NoteRow({ note }: { note: { timestamp: string; author: string; text: string } }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] font-semibold" style={{ color: CYAN }}>{note.author}</span>
        <span className="text-[10px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
          {new Date(note.timestamp).toLocaleString()}
        </span>
      </div>
      <p className="text-[11px] pl-1" style={{ color: BRIGHT }}>{note.text}</p>
    </div>
  );
}

// ─── Detection header ───────────────────────────────────────────────────
function DetectionHeader({ detection }: { detection: DetectionDetail['detection'] }) {
  const severity = riskScoreToSeverity(detection.riskScore);
  return (
    <div className="flex items-start gap-3 mb-4">
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
          <span className="text-[10px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
            Risk {detection.riskScore}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Loading state ──────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="detection-detail-loading">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      <p className="text-[12px]" style={{ color: MUTED }}>Loading detection detail…</p>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────
function ErrorState({ error, message }: { error: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="detection-detail-error">
      <AlertTriangle className="h-6 w-6" style={{ color: RED }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>{error}</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
    </div>
  );
}

// ─── Not-found state ────────────────────────────────────────────────────
function NotFoundState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="detection-detail-not-found">
      <Search className="h-6 w-6" style={{ color: MUTED }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>Detection Not Found</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
    </div>
  );
}

// ─── Malformed state ────────────────────────────────────────────────────
function MalformedState({ message, details }: { message: string; details: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="detection-detail-malformed">
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
function QuietState({ detail }: { detail: DetectionDetail }) {
  return (
    <div data-testid="detection-detail-quiet">
      <DetectionHeader detection={detail.detection} />

      {/* Core detection info */}
      <SectionHeader icon={<Info className="h-3.5 w-3.5" />} label="Detection Info" />
      <FieldRow label="ID" value={String(detail.detection.id)} mono />
      <FieldRow label="Type" value={detail.detection.type} />
      <FieldRow label="Status" value={detail.detection.status} />
      <FieldRow label="Resolution" value={detail.detection.resolution} />
      <FieldRow label="Assignee" value={detail.detection.assignee} />
      <FieldRow label="Start" value={detail.detection.startTimeIso} mono />
      <FieldRow label="End" value={detail.detection.endTimeIso} mono />

      {/* Categories */}
      {detail.detection.categories.length > 0 && (
        <>
          <SectionHeader icon={<Tag className="h-3.5 w-3.5" />} label="Categories" />
          <div className="flex flex-wrap gap-1.5">
            {detail.detection.categories.map((cat) => (
              <span key={cat} className="px-2 py-0.5 rounded text-[10px]" style={{ background: 'oklch(1 0 0 / 5%)', color: MUTED }}>
                {cat}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Quiet message */}
      <div className="flex flex-col items-center py-8 gap-2">
        <Info className="h-5 w-5" style={{ color: MUTED }} />
        <p className="text-[11px] text-center" style={{ color: MUTED }}>
          No related devices, alerts, notes, or timeline events for this detection.
        </p>
      </div>
    </div>
  );
}

// ─── Populated state ────────────────────────────────────────────────────
function PopulatedState({ detail }: { detail: DetectionDetail }) {
  return (
    <div data-testid="detection-detail-populated">
      <DetectionHeader detection={detail.detection} />

      {/* Core detection info */}
      <SectionHeader icon={<Info className="h-3.5 w-3.5" />} label="Detection Info" />
      <FieldRow label="ID" value={String(detail.detection.id)} mono />
      <FieldRow label="Type" value={detail.detection.type} />
      <FieldRow label="Status" value={detail.detection.status} />
      <FieldRow label="Resolution" value={detail.detection.resolution} />
      <FieldRow label="Assignee" value={detail.detection.assignee} />
      <FieldRow label="Start" value={detail.detection.startTimeIso} mono />
      <FieldRow label="End" value={detail.detection.endTimeIso} mono />

      {/* Categories */}
      {detail.detection.categories.length > 0 && (
        <>
          <SectionHeader icon={<Tag className="h-3.5 w-3.5" />} label="Categories" />
          <div className="flex flex-wrap gap-1.5">
            {detail.detection.categories.map((cat) => (
              <span key={cat} className="px-2 py-0.5 rounded text-[10px]" style={{ background: 'oklch(1 0 0 / 5%)', color: MUTED }}>
                {cat}
              </span>
            ))}
          </div>
        </>
      )}

      {/* MITRE ATT&CK */}
      {(detail.detection.mitreTactics.length > 0 || detail.detection.mitreTechniques.length > 0) && (
        <>
          <SectionHeader icon={<Shield className="h-3.5 w-3.5" />} label="MITRE ATT&CK" />
          {detail.detection.mitreTactics.length > 0 && (
            <FieldRow label="Tactics" value={detail.detection.mitreTactics.join(', ')} />
          )}
          {detail.detection.mitreTechniques.length > 0 && (
            <FieldRow label="Techniques" value={detail.detection.mitreTechniques.join(', ')} mono />
          )}
        </>
      )}

      {/* Related devices */}
      {detail.relatedDevices.length > 0 && (
        <>
          <SectionHeader icon={<Users className="h-3.5 w-3.5" />} label={`Related Devices (${detail.relatedDevices.length})`} />
          {detail.relatedDevices.map((d) => (
            <MiniDeviceRow key={d.id} device={d} />
          ))}
        </>
      )}

      {/* Related alerts */}
      {detail.relatedAlerts.length > 0 && (
        <>
          <SectionHeader icon={<Bell className="h-3.5 w-3.5" />} label={`Related Alerts (${detail.relatedAlerts.length})`} />
          {detail.relatedAlerts.map((a) => (
            <MiniAlertRow key={a.id} alert={a} />
          ))}
        </>
      )}

      {/* Notes */}
      {detail.notes.length > 0 && (
        <>
          <SectionHeader icon={<FileText className="h-3.5 w-3.5" />} label={`Notes (${detail.notes.length})`} />
          {detail.notes.map((n, i) => (
            <NoteRow key={`${n.timestamp}-${i}`} note={n} />
          ))}
        </>
      )}

      {/* Timeline */}
      {detail.timeline.length > 0 && (
        <>
          <SectionHeader icon={<Clock className="h-3.5 w-3.5" />} label={`Timeline (${detail.timeline.length})`} />
          {detail.timeline.map((e, i) => (
            <TimelineRow key={`${e.timestamp}-${i}`} event={e} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────
interface DetectionDetailPaneProps {
  selection: Extract<InspectorSelection, { kind: 'detection' }>;
}

export function DetectionDetailPane({ selection }: DetectionDetailPaneProps) {
  const detectionId = selection.detection.id;
  const state = useDetectionDetail(detectionId);

  switch (state.status) {
    case 'loading':
      return <LoadingState />;
    case 'quiet':
      return <QuietState detail={state.detectionDetail} />;
    case 'populated':
      return <PopulatedState detail={state.detectionDetail} />;
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
