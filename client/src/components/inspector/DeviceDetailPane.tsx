/**
 * DeviceDetailPane — Full device detail inspector pane.
 *
 * Slice 09 — Replaces the compact DevicePreview (Slice 08) when a device is selected.
 *
 * CONTRACT:
 *   - Receives deviceId from InspectorSelection (kind: 'device')
 *   - Fetches full detail via useDeviceDetail hook (BFF route)
 *   - Renders 5 sections: Identity, Traffic, Protocols, Associated Detections, Associated Alerts
 *   - Handles all 6 states: loading, quiet, populated, error, malformed, not-found
 *   - No ExtraHop calls — all data comes via BFF
 *   - Uses shared types only (DeviceDetail, DeviceProtocolActivity, etc.)
 */
import type { InspectorSelection } from '../../../../shared/cockpit-types';
import type { DeviceDetail, DeviceProtocolActivity, NormalizedDetection, NormalizedAlert } from '../../../../shared/cockpit-types';
import { useDeviceDetail, type DeviceDetailState } from '@/hooks/useDeviceDetail';
import { formatBytes } from '../../../../shared/formatters';
import { SeverityBadge, GOLD, CYAN, MUTED, BRIGHT, RED, GREEN } from '@/components/DashboardWidgets';
import { riskScoreToSeverity } from '@/components/tables/DetectionsTable';
import { alertSeverityToLabel } from '@/components/tables/AlertsPanel';
import {
  Monitor, Server, Activity, Globe, Shield, Bell, Tag, Clock,
  Loader2, AlertTriangle, Search, Wifi, WifiOff, Download
} from 'lucide-react';
import { PcapDownloadButton } from './PcapDownloadButton';
import { ProtocolBreakdownChart } from './ProtocolBreakdownChart';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { useInspector } from '@/contexts/InspectorContext';

// ─── Shared field row (reused from InspectorContent pattern) ─────────────
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

// ─── Protocol row ────────────────────────────────────────────────────────
function ProtocolRow({ proto }: { proto: DeviceProtocolActivity }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-semibold" style={{ color: BRIGHT }}>
          {proto.protocol}
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
          {formatBytes(proto.totalBytes)}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[10px]" style={{ color: MUTED }}>
        <span>In: <span style={{ fontFamily: 'var(--font-mono)', color: CYAN }}>{formatBytes(proto.bytesIn)}</span></span>
        <span>Out: <span style={{ fontFamily: 'var(--font-mono)', color: GOLD }}>{formatBytes(proto.bytesOut)}</span></span>
        <span>Conns: <span style={{ fontFamily: 'var(--font-mono)' }}>{proto.connections.toLocaleString()}</span></span>
      </div>
    </div>
  );
}

// ─── Mini detection row (clickable for cross-entity navigation — Slice 12) ──
function MiniDetectionRow({ detection, onClick }: { detection: NormalizedDetection; onClick?: () => void }) {
  const severity = riskScoreToSeverity(detection.riskScore);
  return (
    <div
      className="py-2 transition-colors"
      style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)', cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={onClick ? `cross-nav-detection-${detection.id}` : undefined}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <SeverityBadge level={severity} />
        <span className="text-[12px] font-semibold truncate" style={{ color: BRIGHT }}>
          {detection.title}
        </span>
        {onClick && <span className="text-[9px] ml-auto" style={{ color: GOLD }}>→</span>}
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

// ─── Mini alert row (clickable for cross-entity navigation — Slice 12) ──────
function MiniAlertRow({ alert, onClick }: { alert: NormalizedAlert; onClick?: () => void }) {
  return (
    <div
      className="py-2 transition-colors"
      style={{ borderBottom: '1px solid oklch(1 0 0 / 4%)', cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={onClick ? `cross-nav-alert-${alert.id}` : undefined}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <SeverityBadge level={alert.severityLabel} />
        <span className="text-[12px] font-semibold truncate" style={{ color: BRIGHT }}>
          {alert.name}
        </span>
        {onClick && <span className="text-[9px] ml-auto" style={{ color: GOLD }}>→</span>}
      </div>
      <div className="flex items-center gap-3 text-[10px]" style={{ color: MUTED }}>
        <span>{alert.type}</span>
        <span>{alert.statName}</span>
        {alert.disabled && <span style={{ color: RED }}>(disabled)</span>}
      </div>
    </div>
  );
}

// ─── Loading state ───────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="device-detail-loading">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
      <p className="text-[12px]" style={{ color: MUTED }}>Loading device detail…</p>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────
function ErrorState({ error, message }: { error: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="device-detail-error">
      <AlertTriangle className="h-6 w-6" style={{ color: RED }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>{error}</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
    </div>
  );
}

// ─── Not-found state ─────────────────────────────────────────────────────
function NotFoundState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="device-detail-not-found">
      <Search className="h-6 w-6" style={{ color: MUTED }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>Device Not Found</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
    </div>
  );
}

// ─── Malformed state ─────────────────────────────────────────────────────
function MalformedState({ message, details }: { message: string; details: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="device-detail-malformed">
      <AlertTriangle className="h-6 w-6" style={{ color: GOLD }} />
      <p className="text-[12px] font-semibold" style={{ color: BRIGHT }}>Data Contract Violation</p>
      <p className="text-[11px] text-center px-4" style={{ color: MUTED }}>{message}</p>
      <pre className="text-[10px] mt-2 px-3 py-2 rounded-lg max-h-32 overflow-auto w-full" style={{ background: 'oklch(1 0 0 / 3%)', color: RED, fontFamily: 'var(--font-mono)' }}>
        {details}
      </pre>
    </div>
  );
}

// ─── Quiet state ─────────────────────────────────────────────────────────
function QuietState({ detail }: { detail: DeviceDetail }) {
  return (
    <div data-testid="device-detail-quiet">
      {/* Identity header */}
      <DeviceHeader device={detail.device} />

      {/* Identity fields */}
      <SectionHeader icon={<Server className="h-3.5 w-3.5" />} label="Identity" />
      <DeviceIdentityFields device={detail.device} />

      {/* Quiet message */}
      <div className="flex flex-col items-center py-8 gap-2">
        <WifiOff className="h-5 w-5" style={{ color: MUTED }} />
        <p className="text-[11px] text-center" style={{ color: MUTED }}>
          No activity observed for this device in the current time window.
        </p>
      </div>
    </div>
  );
}

// ─── Device header (shared between quiet and populated) ──────────────────
function DeviceHeader({ device }: { device: DeviceDetail['device'] }) {
  return (
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
  );
}

// ─── Device identity fields (shared between quiet and populated) ─────────
function DeviceIdentityFields({ device }: { device: DeviceDetail['device'] }) {
  return (
    <>
      <FieldRow label="ID" value={String(device.id)} mono />
      <FieldRow label="MAC" value={device.macaddr} mono />
      <FieldRow label="Role" value={device.role} />
      <FieldRow label="Vendor" value={device.vendor} />
      <FieldRow label="Class" value={device.deviceClass} />
      <FieldRow label="Software" value={device.software} />
      <FieldRow label="Analysis" value={device.analysis} />
    </>
  );
}

// ─── Populated state (with cross-entity navigation — Slice 12) ──────────
function PopulatedState({ detail }: { detail: DeviceDetail }) {
  const { window: tw } = useTimeWindow();
  const { selectDetectionEntity, selectAlertEntity } = useInspector();
  return (
    <div data-testid="device-detail-populated">
      {/* Identity header */}
      <DeviceHeader device={detail.device} />

      {/* Flags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {detail.device.critical && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: 'oklch(0.628 0.258 29.234 / 15%)', color: RED }}>
            Critical
          </span>
        )}
        {detail.device.onWatchlist && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: 'oklch(0.769 0.108 85.805 / 12%)', color: GOLD }}>
            Watchlist
          </span>
        )}
        {detail.device.isL3 && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase" style={{ background: 'oklch(1 0 0 / 5%)', color: MUTED }}>
            L3
          </span>
        )}
      </div>

      {/* Identity fields */}
      <SectionHeader icon={<Server className="h-3.5 w-3.5" />} label="Identity" />
      <DeviceIdentityFields device={detail.device} />

      {/* Activity summary */}
      <SectionHeader icon={<Wifi className="h-3.5 w-3.5" />} label="Activity Summary" />
      <FieldRow label="First Seen" value={detail.activitySummary.firstSeen} mono />
      <FieldRow label="Last Seen" value={detail.activitySummary.lastSeen} mono />
      <FieldRow label="Protocols" value={String(detail.activitySummary.totalProtocols)} mono />
      <FieldRow label="Connections" value={detail.activitySummary.totalConnections.toLocaleString()} mono />
      {detail.activitySummary.peakThroughputBps !== null && (
        <FieldRow label="Peak Throughput" value={formatBytes(detail.activitySummary.peakThroughputBps) + '/s'} mono />
      )}

      {/* Traffic */}
      <SectionHeader icon={<Activity className="h-3.5 w-3.5" />} label="Traffic" />
      <FieldRow label="Bytes In" value={formatBytes(detail.traffic.bytesIn)} mono />
      <FieldRow label="Bytes Out" value={formatBytes(detail.traffic.bytesOut)} mono />
      <FieldRow label="Total" value={formatBytes(detail.traffic.totalBytes)} mono />
      <FieldRow label="Pkts In" value={detail.traffic.pktsIn.toLocaleString()} mono />
      <FieldRow label="Pkts Out" value={detail.traffic.pktsOut.toLocaleString()} mono />

      {/* PCAP Download (Slice 10) */}
      {detail.device.ipaddr4 && (
        <>
          <SectionHeader icon={<Download className="h-3.5 w-3.5" />} label="Packet Capture" />
          <PcapDownloadButton
            deviceIp={detail.device.ipaddr4}
            fromMs={tw.fromMs}
            untilMs={tw.untilMs}
          />
        </>
      )}

      {/* Protocol breakdown (Slice 16 — donut chart) */}
      <SectionHeader icon={<Globe className="h-3.5 w-3.5" />} label={`Protocols (${detail.protocols.length})`} />
      <ProtocolBreakdownChart protocols={detail.protocols} />

      {/* Associated detections */}
      {detail.associatedDetections.length > 0 && (
        <>
          <SectionHeader icon={<Shield className="h-3.5 w-3.5" />} label={`Detections (${detail.associatedDetections.length})`} />
          {detail.associatedDetections.map((d) => (
            <MiniDetectionRow
              key={d.id}
              detection={d}
              onClick={() => selectDetectionEntity(d)}
            />
          ))}
        </>
      )}

      {/* Associated alerts */}
      {detail.associatedAlerts.length > 0 && (
        <>
          <SectionHeader icon={<Bell className="h-3.5 w-3.5" />} label={`Alerts (${detail.associatedAlerts.length})`} />
          {detail.associatedAlerts.map((a) => (
            <MiniAlertRow
              key={a.id}
              alert={a}
              onClick={() => selectAlertEntity(a)}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────
interface DeviceDetailPaneProps {
  selection: Extract<InspectorSelection, { kind: 'device' }>;
}

export function DeviceDetailPane({ selection }: DeviceDetailPaneProps) {
  const deviceId = selection.device.id;
  const state = useDeviceDetail(deviceId);

  switch (state.status) {
    case 'loading':
      return <LoadingState />;
    case 'quiet':
      return <QuietState detail={state.deviceDetail} />;
    case 'populated':
      return <PopulatedState detail={state.deviceDetail} />;
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
