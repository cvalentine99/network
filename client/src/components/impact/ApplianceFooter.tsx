/**
 * Appliance Status Footer — Slice 07
 *
 * Renders a compact footer bar at the bottom of the Impact Deck answering:
 * "Is my sensor healthy?"
 *
 * Displays: hostname, firmware version, edition, capture status, license status,
 * connection status indicator, management IP, licensed modules, BFF uptime.
 *
 * CONTRACT:
 * - Consumes ApplianceStatus from shared/cockpit-types.ts only
 * - Handles 5 UI states: loading, quiet, populated, error, malformed
 * - Never contacts ExtraHop directly — data arrives via props
 * - connectionStatus drives the primary status indicator color
 * - captureStatus and licenseStatus drive secondary indicators
 */
import { GlassCard, MUTED, BRIGHT, GOLD, GREEN, RED, AMBER } from '@/components/DashboardWidgets';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import type { ApplianceStatus } from '../../../../shared/cockpit-types';
import type { ApplianceStatusState } from '@/hooks/useApplianceStatus';
import {
  Server,
  Wifi,
  WifiOff,
  Shield,
  ShieldAlert,
  ShieldOff,
  Radio,
  Clock,
  Cpu,
} from 'lucide-react';

// ─── Pure helpers ────────────────────────────────────────────────────────

/**
 * Format uptime seconds into a human-readable string.
 * e.g. 3661 → "1h 1m", 86400 → "1d 0h", 45 → "45s"
 */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

/**
 * Map connectionStatus to a color and label.
 */
export function connectionStatusDisplay(status: ApplianceStatus['connectionStatus']): {
  color: string;
  label: string;
  icon: 'connected' | 'disconnected';
} {
  switch (status) {
    case 'connected':
      return { color: GREEN, label: 'Connected', icon: 'connected' };
    case 'not_configured':
      return { color: MUTED, label: 'Not Configured', icon: 'disconnected' };
    case 'error':
      return { color: RED, label: 'Connection Error', icon: 'disconnected' };
    default:
      return { color: MUTED, label: 'Unknown', icon: 'disconnected' };
  }
}

/**
 * Map captureStatus to a color and label.
 */
export function captureStatusDisplay(status: ApplianceStatus['captureStatus']): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'active':
      return { color: GREEN, label: 'Capturing' };
    case 'inactive':
      return { color: RED, label: 'Inactive' };
    case 'unknown':
      return { color: MUTED, label: 'Unknown' };
    default:
      return { color: MUTED, label: 'Unknown' };
  }
}

/**
 * Map licenseStatus to a color and label.
 */
export function licenseStatusDisplay(status: ApplianceStatus['licenseStatus']): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'valid':
      return { color: GREEN, label: 'Valid' };
    case 'expired':
      return { color: RED, label: 'Expired' };
    case 'unknown':
      return { color: MUTED, label: 'Unknown' };
    default:
      return { color: MUTED, label: 'Unknown' };
  }
}

// ─── Status Indicator Dot ────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  );
}

// ─── Footer Item ─────────────────────────────────────────────────────────

function FooterItem({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: color || MUTED }}>{icon}</span>
      <div className="flex flex-col">
        <span
          className="text-[9px] font-semibold uppercase tracking-wider"
          style={{ color: MUTED }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-medium tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: color || BRIGHT }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────

function FooterSkeleton() {
  return (
    <div
      className="rounded-lg p-3 animate-pulse"
      style={{
        background: 'oklch(0.1 0.005 260 / 40%)',
        border: '1px solid oklch(1 0 0 / 6%)',
      }}
      data-testid="appliance-footer-loading"
    >
      <div className="flex items-center gap-6">
        <div className="h-3 w-24 rounded bg-white/5" />
        <div className="h-3 w-32 rounded bg-white/5" />
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-3 w-28 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

interface ApplianceFooterProps {
  state: ApplianceStatusState;
}

export function ApplianceFooter({ state }: ApplianceFooterProps) {
  // Loading state
  if (state.status === 'loading') {
    return <FooterSkeleton />;
  }

  // Error state (transport failure)
  if (state.status === 'error') {
    return (
      <div data-testid="appliance-footer-error">
        <ErrorState
          type="transport"
          title="Appliance status unavailable"
          message={state.message}
        />
      </div>
    );
  }

  // Malformed data rejection state
  if (state.status === 'malformed') {
    return (
      <div data-testid="appliance-footer-malformed">
        <ErrorState
          type="contract"
          title="Appliance status rejected"
          message={state.message}
        />
      </div>
    );
  }

  // Quiet state (not configured)
  if (state.status === 'quiet') {
    return (
      <div data-testid="appliance-footer-quiet">
        <div
          className="rounded-lg p-3 flex items-center gap-3"
          style={{
            background: 'oklch(0.1 0.005 260 / 40%)',
            border: '1px solid oklch(1 0 0 / 6%)',
          }}
        >
          <StatusDot color={MUTED} />
          <span className="text-[11px] font-medium" style={{ color: MUTED }}>
            Appliance not configured — configure appliance connection settings to enable sensor monitoring
          </span>
        </div>
      </div>
    );
  }

  // Populated state
  const s = state.applianceStatus;
  const conn = connectionStatusDisplay(s.connectionStatus);
  const capture = captureStatusDisplay(s.captureStatus);
  const license = licenseStatusDisplay(s.licenseStatus);

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'oklch(0.1 0.005 260 / 40%)',
        border: '1px solid oklch(1 0 0 / 6%)',
      }}
      data-testid="appliance-footer-populated"
    >
      {/* Top row: connection status + hostname + version */}
      <div className="flex items-center gap-2 mb-2">
        <StatusDot color={conn.color} />
        {conn.icon === 'connected' ? (
          <Wifi className="w-3 h-3" style={{ color: conn.color }} />
        ) : (
          <WifiOff className="w-3 h-3" style={{ color: conn.color }} />
        )}
        <span
          className="text-[11px] font-semibold"
          style={{ color: conn.color }}
        >
          {conn.label}
        </span>
        {s.hostname && (
          <>
            <span className="text-[11px]" style={{ color: MUTED }}>·</span>
            <span
              className="text-[11px] font-mono font-medium"
              style={{ color: BRIGHT }}
            >
              {s.displayHost || s.hostname}
            </span>
          </>
        )}
        {s.version && (
          <>
            <span className="text-[11px]" style={{ color: MUTED }}>·</span>
            <span
              className="text-[10px] font-mono"
              style={{ color: MUTED }}
            >
              v{s.version}
            </span>
          </>
        )}
        {s.edition && (
          <>
            <span className="text-[11px]" style={{ color: MUTED }}>·</span>
            <span
              className="text-[10px]"
              style={{ color: GOLD }}
            >
              {s.edition}
            </span>
          </>
        )}
      </div>

      {/* Bottom row: detailed status items */}
      <div className="flex items-center gap-5 flex-wrap">
        <FooterItem
          label="Capture"
          value={capture.label}
          icon={
            <Radio className="w-3 h-3" />
          }
          color={capture.color}
        />

        {s.captureInterface && (
          <FooterItem
            label="Interface"
            value={s.captureInterface}
            icon={<Cpu className="w-3 h-3" />}
          />
        )}

        <FooterItem
          label="License"
          value={license.label}
          icon={
            s.licenseStatus === 'valid' ? (
              <Shield className="w-3 h-3" />
            ) : s.licenseStatus === 'expired' ? (
              <ShieldAlert className="w-3 h-3" />
            ) : (
              <ShieldOff className="w-3 h-3" />
            )
          }
          color={license.color}
        />

        {s.licensedModules.length > 0 && (
          <FooterItem
            label="Modules"
            value={s.licensedModules.join(', ')}
            icon={<Server className="w-3 h-3" />}
            color={GOLD}
          />
        )}

        {s.mgmtIpaddr && (
          <FooterItem
            label="Mgmt IP"
            value={s.mgmtIpaddr}
            icon={<Server className="w-3 h-3" />}
          />
        )}

        <FooterItem
          label="BFF Uptime"
          value={formatUptime(s.uptimeSeconds)}
          icon={<Clock className="w-3 h-3" />}
        />
      </div>
    </div>
  );
}
