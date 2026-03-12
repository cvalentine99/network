// client/src/pages/ImpactDeck/ImpactDeck.tsx
import { useEffect, useState, useCallback } from 'react';
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  KPICard,
  PageHeader,
  SeverityBadge,
  GOLD, CYAN, GREEN, RED, ORANGE, MUTED, BRIGHT,
} from '@/components/DashboardWidgets';
import { Activity, Wifi, Package, Zap, AlertTriangle, Shield, Settings, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { bffGet, BffError } from '@/lib/api';
import { formatBytes, formatBytesPerSec, formatPackets, formatPercent } from '@/lib/formatters';
import GhostedTimeline from '@/components/charts/GhostedTimeline';
import TopTalkersTable from '@/components/tables/TopTalkersTable';
import DetectionsTable from '@/components/tables/DetectionsTable';
import type { ImpactOverviewPayload } from '../../../../shared/impact-types';

type BffStatus = {
  configured: boolean;
  connected: boolean;
  ehHost: string | null;
  appliance: {
    version: string;
    edition: string;
    platform: string;
    hostname: string;
  } | null;
};

type ErrorInfo = {
  message: string;
  configured?: boolean;
  detail?: string;
};

export default function ImpactDeck() {
  const [data, setData] = useState<ImpactOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const payload = await bffGet<ImpactOverviewPayload>('/api/bff/impact/overview');
      setData(payload);
    } catch (err: any) {
      let errorInfo: ErrorInfo;
      if (err instanceof BffError) {
        errorInfo = {
          message: err.body.error as string || err.message,
          configured: err.body.configured as boolean | undefined,
          detail: err.body.detail as string | undefined,
        };
      } else {
        errorInfo = { message: err.message || 'Failed to load Impact Deck' };
      }
      setError(errorInfo);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Not Configured State ─────────────────────────────────────────────
  if (error && error.configured === false) {
    return (
      <div>
        <PageHeader title="Impact Deck" subtitle="Network performance at a glance" />
        <GlassCard accent={false}>
          <div className="text-center py-16 px-8 max-w-lg mx-auto">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: 'oklch(0.75 0.15 85 / 10%)', border: '1px solid oklch(0.75 0.15 85 / 20%)' }}
            >
              <Settings className="w-8 h-8" style={{ color: GOLD }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: BRIGHT }}>
              ExtraHop Connection Required
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: MUTED }}>
              The Impact Deck connects directly to your ExtraHop EDA appliance to display live network performance data.
              Configure your connection to get started.
            </p>
            <div
              className="rounded-lg p-4 text-left mb-6"
              style={{ background: 'oklch(1 0 0 / 3%)', border: '1px solid oklch(1 0 0 / 8%)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                Required Environment Variables
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <code className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: 'oklch(1 0 0 / 6%)', color: CYAN, fontFamily: 'var(--font-mono)' }}>
                    EH_HOST
                  </code>
                  <span className="text-xs" style={{ color: MUTED }}>
                    Base URL of your ExtraHop EDA (e.g., https://192.168.50.157)
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <code className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: 'oklch(1 0 0 / 6%)', color: CYAN, fontFamily: 'var(--font-mono)' }}>
                    EH_API_KEY
                  </code>
                  <span className="text-xs" style={{ color: MUTED }}>
                    API key from ExtraHop Admin → API Access
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData()}
              className="gap-2"
              style={{ borderColor: 'oklch(0.75 0.15 85 / 30%)', color: GOLD }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── Connection Error State ───────────────────────────────────────────
  if (error) {
    return (
      <div>
        <PageHeader title="Impact Deck" subtitle="Network performance at a glance" />
        <GlassCard accent={false}>
          <div className="text-center py-12 px-8 max-w-lg mx-auto">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: RED }} />
            <h3 className="text-base font-semibold mb-2" style={{ color: RED }}>
              {error.message}
            </h3>
            {error.detail && (
              <p className="text-xs mb-4 font-mono" style={{ color: MUTED }}>
                {error.detail}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData()}
              className="gap-2"
              style={{ borderColor: 'oklch(1 0 0 / 15%)', color: MUTED }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── Main Dashboard ───────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <PageHeader
          title="Impact Deck"
          subtitle={
            data
              ? `${data.applianceEdition} Edition — v${data.applianceVersion} — ${data.captureName}`
              : 'Network performance at a glance'
          }
        />
        {data && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="gap-2 h-8"
            style={{ color: MUTED }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
      </div>

      <StaggerContainer className="space-y-6">
        {/* ── Headline KPIs ────────────────────────────────────────── */}
        <StaggerItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card gold-accent-top p-5">
                  <Skeleton className="h-3 w-20 mb-3" />
                  <Skeleton className="h-7 w-24 mb-2" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))
            ) : data ? (
              <>
                <KPICard
                  label="Total Bytes (1h)"
                  value={formatBytes(data.headline.totalBytes)}
                  icon={<Wifi className="w-5 h-5" style={{ color: GOLD }} />}
                />
                <KPICard
                  label="Total Packets (1h)"
                  value={formatPackets(data.headline.totalPackets)}
                  icon={<Package className="w-5 h-5" style={{ color: CYAN }} />}
                />
                <KPICard
                  label="Throughput"
                  value={formatBytesPerSec(data.headline.bytesPerSecond)}
                  change={formatPercent(data.headline.baselineDeltaPct)}
                  changeType={
                    data.headline.baselineDeltaPct == null ? 'neutral'
                    : data.headline.baselineDeltaPct > 0.1 ? 'up'
                    : data.headline.baselineDeltaPct < -0.1 ? 'down'
                    : 'neutral'
                  }
                  icon={<Zap className="w-5 h-5" style={{ color: GREEN }} />}
                />
                <KPICard
                  label="Packet Rate"
                  value={`${formatPackets(data.headline.packetsPerSecond)}/s`}
                  icon={<Activity className="w-5 h-5" style={{ color: ORANGE }} />}
                />
              </>
            ) : null}
          </div>
        </StaggerItem>

        {/* ── Network Timeseries ───────────────────────────────────── */}
        <StaggerItem>
          <GlassCard>
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: MUTED }}
            >
              Network Throughput — Last 5 Minutes (30s resolution)
            </h3>
            {loading ? (
              <Skeleton className="h-[260px] w-full rounded-lg" />
            ) : data ? (
              <GhostedTimeline points={data.timeseries} />
            ) : null}
          </GlassCard>
        </StaggerItem>

        {/* ── Top Talkers + Detections ─────────────────────────────── */}
        <StaggerItem>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Top Talkers — 2/3 width */}
            <div className="xl:col-span-2">
              <GlassCard>
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-4"
                  style={{ color: MUTED }}
                >
                  Top Talkers — Last Hour
                </h3>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : data ? (
                  <TopTalkersTable talkers={data.topTalkers} />
                ) : null}
              </GlassCard>
            </div>

            {/* Detections — 1/3 width */}
            <div>
              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: MUTED }}
                  >
                    Recent Detections
                  </h3>
                  {data && (
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: data.detections.length > 0 ? RED : GREEN, fontFamily: 'var(--font-mono)' }}
                    >
                      {data.detections.length}
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : data ? (
                  <DetectionsTable detections={data.detections} />
                ) : null}
              </GlassCard>
            </div>
          </div>
        </StaggerItem>

        {/* ── Alerts Summary ───────────────────────────────────────── */}
        {data && data.alerts.length > 0 && (
          <StaggerItem>
            <GlassCard>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: MUTED }}
              >
                Configured Alerts ({data.alerts.filter(a => !a.disabled).length} active)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.alerts
                  .filter(a => !a.disabled)
                  .slice(0, 9)
                  .map(alert => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg"
                      style={{ background: 'oklch(1 0 0 / 3%)', border: '1px solid oklch(1 0 0 / 6%)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge level={alert.severityLabel} />
                        <span className="text-[12px] font-medium truncate" style={{ color: BRIGHT }}>
                          {alert.name}
                        </span>
                      </div>
                      <p className="text-[10px] truncate" style={{ color: MUTED }}>
                        {alert.statName} {alert.fieldName} {alert.operator} {alert.operand}
                      </p>
                    </div>
                  ))}
              </div>
            </GlassCard>
          </StaggerItem>
        )}

        {/* ── Appliance Footer ─────────────────────────────────────── */}
        {data && (
          <StaggerItem>
            <div
              className="flex items-center justify-between px-4 py-3 rounded-lg text-[11px]"
              style={{ background: 'oklch(1 0 0 / 3%)', border: '1px solid oklch(1 0 0 / 6%)', color: MUTED }}
            >
              <span>EDA v{data.applianceVersion} — {data.applianceEdition} Edition</span>
              <span>{data.captureName}</span>
              <span>{data.licensedModules.length} licensed modules</span>
            </div>
          </StaggerItem>
        )}
      </StaggerContainer>
    </div>
  );
}
