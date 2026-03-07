import { trpc } from "@/lib/trpc";
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  KPICard,
  PageHeader,
  SeverityBadge,
  GOLD,
  CYAN,
  GREEN,
  RED,
  MUTED,
  BRIGHT,
} from "@/components/DashboardWidgets";
import {
  Activity,
  Server,
  AlertTriangle,
  Network,
  Wifi,
  HardDrive,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: overview, isLoading } = trpc.network.overview.useQuery();

  return (
    <div>
      <PageHeader
        title="Network Operations Center"
        subtitle="Real-time network performance monitoring and analytics"
      />

      <StaggerContainer className="space-y-6">
        {/* KPI Row */}
        <StaggerItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card gold-accent-top p-5">
                  <Skeleton className="h-3 w-20 mb-3" />
                  <Skeleton className="h-7 w-16 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : overview ? (
              <>
                <KPICard
                  label="Total Devices"
                  value={overview.totalDevices.toLocaleString()}
                  icon={<Server className="w-5 h-5" style={{ color: GOLD }} />}
                />
                <KPICard
                  label="Active Alerts"
                  value={overview.activeAlerts.toLocaleString()}
                  icon={<AlertTriangle className="w-5 h-5" style={{ color: RED }} />}
                />
                <KPICard
                  label="Interfaces Up"
                  value={overview.interfacesUp.toLocaleString()}
                  icon={<Network className="w-5 h-5" style={{ color: GREEN }} />}
                />
                <KPICard
                  label="Interfaces Down"
                  value={overview.interfacesDown.toLocaleString()}
                  icon={<Wifi className="w-5 h-5" style={{ color: RED }} />}
                />
                <KPICard
                  label="Avg Latency"
                  value={overview.avgLatency != null ? `${overview.avgLatency.toFixed(1)} ms` : "--"}
                  icon={<Activity className="w-5 h-5" style={{ color: CYAN }} />}
                />
                <KPICard
                  label="Avg Throughput"
                  value={overview.avgThroughput != null ? formatThroughput(overview.avgThroughput) : "--"}
                  icon={<HardDrive className="w-5 h-5" style={{ color: GOLD }} />}
                />
              </>
            ) : (
              <div className="col-span-full">
                <GlassCard accent={false}>
                  <div className="text-center py-8">
                    <Server className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                    <p className="text-sm" style={{ color: MUTED }}>
                      No data available. Connect your database and populate network data to begin monitoring.
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Alert Summary + Recent Alerts */}
        <StaggerItem>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Alert Severity Breakdown */}
            <GlassCard>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: MUTED }}
              >
                Alert Severity Breakdown
              </h3>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : overview && overview.alertsBySeverity ? (
                <div className="space-y-3">
                  {(["critical", "high", "medium", "low"] as const).map((level) => {
                    const count = overview.alertsBySeverity[level] ?? 0;
                    const total = Object.values(overview.alertsBySeverity).reduce<number>(
                      (a, b) => a + (b as number),
                      0
                    );
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <SeverityBadge level={level} />
                        <div className="flex-1">
                          <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{ background: "oklch(1 0 0 / 5%)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background:
                                  level === "critical"
                                    ? RED
                                    : level === "high"
                                    ? "oklch(0.705 0.213 47.604)"
                                    : level === "medium"
                                    ? "oklch(0.769 0.188 70.08)"
                                    : GREEN,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm" style={{ color: MUTED }}>
                  No alert data available
                </p>
              )}
            </GlassCard>

            {/* Recent Alerts */}
            <GlassCard>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: MUTED }}
              >
                Recent Alerts
              </h3>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : overview && overview.recentAlerts && overview.recentAlerts.length > 0 ? (
                <div className="space-y-2">
                  {overview.recentAlerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                      style={{ background: "oklch(1 0 0 / 2%)" }}
                    >
                      <SeverityBadge level={alert.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: BRIGHT }}>
                          {alert.message}
                        </p>
                        <p className="text-[10px]" style={{ color: MUTED }}>
                          {alert.deviceName} — {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: MUTED }}>
                  No recent alerts
                </p>
              )}
            </GlassCard>
          </div>
        </StaggerItem>

        {/* Device Status Summary */}
        <StaggerItem>
          <GlassCard>
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: MUTED }}
            >
              Device Status Overview
            </h3>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : overview && overview.devicesByStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(overview.devicesByStatus).map(([status, count]) => (
                  <div
                    key={status}
                    className="p-3 rounded-lg"
                    style={{
                      background:
                        status === "online"
                          ? `${GREEN}08`
                          : status === "offline"
                          ? `${RED}08`
                          : status === "warning"
                          ? "oklch(0.769 0.188 70.08 / 8%)"
                          : `${MUTED}08`,
                      border: `1px solid ${
                        status === "online"
                          ? `${GREEN}20`
                          : status === "offline"
                          ? `${RED}20`
                          : status === "warning"
                          ? "oklch(0.769 0.188 70.08 / 20%)"
                          : `${MUTED}20`
                      }`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`status-dot ${
                          status === "online"
                            ? "status-connected"
                            : status === "offline"
                            ? "status-disconnected"
                            : "status-pending"
                        }`}
                      />
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          color:
                            status === "online"
                              ? GREEN
                              : status === "offline"
                              ? RED
                              : status === "warning"
                              ? "oklch(0.769 0.188 70.08)"
                              : MUTED,
                        }}
                      >
                        {status}
                      </span>
                    </div>
                    <p
                      className="text-xl font-bold tabular-nums"
                      style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}
                    >
                      {(count as number).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: MUTED }}>
                No device data available
              </p>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}

function formatThroughput(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(1)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(1)} Kbps`;
  return `${bps} bps`;
}
