/**
 * ActivityTimeline — Device protocol activity over time.
 *
 * Slice 31 — Renders a horizontal timeline showing when each protocol (stat_name)
 * was active for a given device. Each protocol gets its own row with time bars.
 *
 * CONTRACT:
 *   - Receives deviceId from parent (DeviceDetailPane)
 *   - Fetches activity rows via useDeviceActivity hook (BFF route)
 *   - Renders 4 states: loading, quiet, populated, error
 *   - No ExtraHop calls — all data comes via BFF
 *   - Time bars are proportional to the overall time range of all activity rows
 *   - Protocol names are displayed as-is from ExtraHop (e.g., "http_client", "dns_client")
 */
import { Loader2, Clock, AlertTriangle, Activity } from 'lucide-react';
import { useDeviceActivity, type ActivityRow } from '@/hooks/useDeviceActivity';
import { GOLD, CYAN, MUTED, BRIGHT, RED, GREEN, PURPLE, ORANGE, AMBER } from '@/components/DashboardWidgets';

// ─── Protocol color mapping ─────────────────────────────────────────────
const PROTOCOL_COLORS: Record<string, string> = {
  net: GOLD,
  http_client: CYAN,
  http_server: CYAN,
  dns_client: GREEN,
  dns_server: GREEN,
  ssl_client: PURPLE,
  ssl_server: PURPLE,
  smb_client: ORANGE,
  smb_server: ORANGE,
  ldap_client: AMBER,
  ldap_server: AMBER,
  kerberos_client: RED,
  kerberos_server: RED,
  tcp: GOLD,
  udp: CYAN,
  dhcp_client: GREEN,
  dhcp_server: GREEN,
};

function getProtocolColor(statName: string): string {
  return PROTOCOL_COLORS[statName] || MUTED;
}

/** Format a protocol stat_name for display (e.g., "http_client" → "HTTP Client") */
function formatProtocolName(statName: string): string {
  return statName
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Format epoch ms to a short time string */
function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Format epoch ms to a short date+time string */
function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Loading state ──────────────────────────────────────────────────────
function TimelineLoading() {
  return (
    <div className="flex items-center gap-2 py-4" data-testid="activity-timeline-loading">
      <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: GOLD }} />
      <span className="text-[11px]" style={{ color: MUTED }}>Loading activity timeline…</span>
    </div>
  );
}

// ─── Quiet state ────────────────────────────────────────────────────────
function TimelineQuiet() {
  return (
    <div className="flex flex-col items-center py-4 gap-1.5" data-testid="activity-timeline-quiet">
      <Clock className="h-4 w-4" style={{ color: MUTED }} />
      <span className="text-[11px] text-center" style={{ color: MUTED }}>
        No protocol activity recorded for this device.
      </span>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────
function TimelineError({ error, message }: { error: string; message: string }) {
  return (
    <div className="flex flex-col items-center py-4 gap-1.5" data-testid="activity-timeline-error">
      <AlertTriangle className="h-4 w-4" style={{ color: RED }} />
      <span className="text-[11px] font-semibold" style={{ color: BRIGHT }}>{error}</span>
      <span className="text-[10px] text-center" style={{ color: MUTED }}>{message}</span>
    </div>
  );
}

// ─── Timeline bar for a single protocol ─────────────────────────────────
interface ProtocolTimelineBarProps {
  statName: string;
  segments: Array<{ fromTime: number; untilTime: number }>;
  globalMin: number;
  globalMax: number;
}

function ProtocolTimelineBar({ statName, segments, globalMin, globalMax }: ProtocolTimelineBarProps) {
  const range = globalMax - globalMin;
  const color = getProtocolColor(statName);

  return (
    <div className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid oklch(1 0 0 / 3%)' }}>
      {/* Protocol label */}
      <div
        className="text-[10px] font-semibold uppercase tracking-wider shrink-0 w-20 truncate text-right"
        style={{ color, fontFamily: 'var(--font-mono)' }}
        title={formatProtocolName(statName)}
      >
        {statName}
      </div>

      {/* Timeline bar container */}
      <div
        className="flex-1 relative h-4 rounded-sm overflow-hidden"
        style={{ background: 'oklch(1 0 0 / 3%)' }}
      >
        {range > 0 && segments.map((seg, i) => {
          const left = ((seg.fromTime - globalMin) / range) * 100;
          const width = Math.max(((seg.untilTime - seg.fromTime) / range) * 100, 1); // min 1% width for visibility
          return (
            <div
              key={i}
              className="absolute top-0 h-full rounded-sm"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: color,
                opacity: 0.7,
              }}
              title={`${formatProtocolName(statName)}: ${formatDateTime(seg.fromTime)} → ${formatDateTime(seg.untilTime)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Populated state ────────────────────────────────────────────────────
function TimelinePopulated({ rows }: { rows: ActivityRow[] }) {
  // Group rows by stat_name
  const byProtocol = new Map<string, Array<{ fromTime: number; untilTime: number }>>();
  for (const row of rows) {
    const existing = byProtocol.get(row.statName) || [];
    existing.push({ fromTime: row.fromTime, untilTime: row.untilTime });
    byProtocol.set(row.statName, existing);
  }

  // Compute global time range
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const row of rows) {
    if (row.fromTime < globalMin) globalMin = row.fromTime;
    if (row.untilTime > globalMax) globalMax = row.untilTime;
  }

  // Sort protocols alphabetically
  const protocols = Array.from(byProtocol.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div data-testid="activity-timeline-populated">
      {/* Time axis labels */}
      <div className="flex items-center justify-between mb-1 pl-[88px]">
        <span className="text-[9px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
          {formatDateTime(globalMin)}
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
          {formatDateTime(globalMax)}
        </span>
      </div>

      {/* Protocol rows */}
      {protocols.map(([statName, segments]) => (
        <ProtocolTimelineBar
          key={statName}
          statName={statName}
          segments={segments}
          globalMin={globalMin}
          globalMax={globalMax}
        />
      ))}

      {/* Summary */}
      <div className="flex items-center justify-between mt-2 pt-1" style={{ borderTop: '1px solid oklch(1 0 0 / 5%)' }}>
        <span className="text-[10px]" style={{ color: MUTED }}>
          {protocols.length} protocol{protocols.length !== 1 ? 's' : ''} · {rows.length} record{rows.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] tabular-nums" style={{ color: MUTED, fontFamily: 'var(--font-mono)' }}>
          {formatTime(globalMin)} — {formatTime(globalMax)}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────
interface ActivityTimelineProps {
  deviceId: number;
}

export function ActivityTimeline({ deviceId }: ActivityTimelineProps) {
  const state = useDeviceActivity(deviceId);

  switch (state.status) {
    case 'loading':
      return <TimelineLoading />;
    case 'quiet':
      return <TimelineQuiet />;
    case 'populated':
      return <TimelinePopulated rows={state.rows} />;
    case 'error':
      return <TimelineError error={state.error} message={state.message} />;
    default:
      return null;
  }
}
