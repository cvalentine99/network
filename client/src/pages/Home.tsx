import { trpc } from "@/lib/trpc";
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  KPICard,
  PageHeader,
  GOLD,
  CYAN,
  GREEN,
  RED,
  MUTED,
  BRIGHT,
  ORANGE,
  AMBER,
  PURPLE,
} from "@/components/DashboardWidgets";
import {
  Server,
  AlertTriangle,
  Shield,
  Network,
  MonitorDot,
  Eye,
  Cpu,
  Radio,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: alertsBySeverity, isLoading: alertsLoading } = trpc.dashboard.alertsBySeverity.useQuery();
  const { data: devicesByClass, isLoading: classLoading } = trpc.dashboard.devicesByClass.useQuery();
  const { data: devicesByRole, isLoading: roleLoading } = trpc.dashboard.devicesByRole.useQuery();

  const isLoading = statsLoading || alertsLoading || classLoading || roleLoading;

  // Map ExtraHop severity numbers to labels: 0-7 scale
  const severityLabel = (sev: number): string => {
    if (sev >= 6) return "critical";
    if (sev >= 4) return "high";
    if (sev >= 2) return "medium";
    return "low";
  };

  const severityColor = (sev: number): string => {
    if (sev >= 6) return RED;
    if (sev >= 4) return ORANGE;
    if (sev >= 2) return AMBER;
    return GREEN;
  };

  return (
    <div>
      <PageHeader
        title="Network Operations Center"
        subtitle="ExtraHop network performance monitoring — real-time device, alert, and detection analytics"
      />

      <StaggerContainer className="space-y-6">
        {/* KPI Row */}
        <StaggerItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="glass-card gold-accent-top p-5">
                  <Skeleton className="h-3 w-20 mb-3" />
                  <Skeleton className="h-7 w-16 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : stats ? (
              <>
                <KPICard
                  label="Total Devices"
                  value={stats.totalDevices.toLocaleString()}
                  icon={<Server className="w-5 h-5" style={{ color: GOLD }} />}
                />
                <KPICard
                  label="Active Devices"
                  value={stats.activeDevices.toLocaleString()}
                  icon={<MonitorDot className="w-5 h-5" style={{ color: GREEN }} />}
                />
                <KPICard
                  label="Critical Devices"
                  value={stats.criticalDevices.toLocaleString()}
                  icon={<AlertTriangle className="w-5 h-5" style={{ color: RED }} />}
                />
                <KPICard
                  label="Watchlist"
                  value={stats.watchlistDevices.toLocaleString()}
                  icon={<Eye className="w-5 h-5" style={{ color: CYAN }} />}
                />
                <KPICard
                  label="Alerts"
                  value={stats.totalAlerts.toLocaleString()}
                  icon={<Shield className="w-5 h-5" style={{ color: ORANGE }} />}
                />
                <KPICard
                  label="Appliances"
                  value={stats.totalAppliances.toLocaleString()}
                  icon={<Cpu className="w-5 h-5" style={{ color: PURPLE }} />}
                />
                <KPICard
                  label="Networks"
                  value={stats.totalNetworks.toLocaleString()}
                  icon={<Network className="w-5 h-5" style={{ color: CYAN }} />}
                />
                <KPICard
                  label="Detections"
                  value={stats.totalDetections.toLocaleString()}
                  icon={<Radio className="w-5 h-5" style={{ color: RED }} />}
                />
              </>
            ) : (
              <div className="col-span-full">
                <GlassCard accent={false}>
                  <div className="text-center py-8">
                    <Server className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                    <p className="text-sm" style={{ color: MUTED }}>
                      No data available. Connect your ExtraHop appliance and populate the database to begin monitoring.
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Alert Severity + Device Class Breakdown */}
        <StaggerItem>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Alert Severity Breakdown */}
            <GlassCard>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: MUTED }}
              >
                Alert Severity Distribution
              </h3>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : alertsBySeverity && alertsBySeverity.length > 0 ? (
                <div className="space-y-3">
                  {alertsBySeverity.map((item) => {
                    const total = alertsBySeverity.reduce((a, b) => a + b.count, 0);
                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                    return (
                      <div key={item.severity} className="flex items-center gap-3">
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wider w-16"
                          style={{ color: severityColor(item.severity) }}
                        >
                          {severityLabel(item.severity)}
                        </span>
                        <div
                          className="flex-1 h-2 rounded-full overflow-hidden"
                          style={{ background: "oklch(1 0 0 / 5%)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: severityColor(item.severity),
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-bold tabular-nums w-10 text-right"
                          style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}
                        >
                          {item.count}
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

            {/* Device Class Breakdown */}
            <GlassCard>
              <h3
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: MUTED }}
              >
                Device Class Distribution
              </h3>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : devicesByClass && devicesByClass.length > 0 ? (
                <div className="space-y-3">
                  {devicesByClass.slice(0, 8).map((item, idx) => {
                    const total = devicesByClass.reduce((a, b) => a + b.count, 0);
                    const pct = total > 0 ? (item.count / total) * 100 : 0;
                    const colors = [GOLD, CYAN, GREEN, PURPLE, ORANGE, AMBER, RED, MUTED];
                    return (
                      <div key={item.deviceClass} className="flex items-center gap-3">
                        <span
                          className="text-[11px] font-semibold uppercase tracking-wider w-20 truncate"
                          style={{ color: colors[idx % colors.length] }}
                        >
                          {item.deviceClass || "unknown"}
                        </span>
                        <div
                          className="flex-1 h-2 rounded-full overflow-hidden"
                          style={{ background: "oklch(1 0 0 / 5%)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: colors[idx % colors.length],
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-bold tabular-nums w-10 text-right"
                          style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}
                        >
                          {item.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm" style={{ color: MUTED }}>
                  No device data available
                </p>
              )}
            </GlassCard>
          </div>
        </StaggerItem>

        {/* Device Role Breakdown */}
        <StaggerItem>
          <GlassCard>
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: MUTED }}
            >
              Device Role Overview
            </h3>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : devicesByRole && devicesByRole.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                {devicesByRole.slice(0, 12).map((item) => (
                  <div
                    key={item.role}
                    className="p-3 rounded-lg"
                    style={{
                      background: "oklch(1 0 0 / 3%)",
                      border: "1px solid oklch(1 0 0 / 6%)",
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider mb-1 truncate"
                      style={{ color: CYAN }}
                    >
                      {item.role || "unclassified"}
                    </p>
                    <p
                      className="text-xl font-bold tabular-nums"
                      style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}
                    >
                      {item.count.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: MUTED }}>
                No device role data available
              </p>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
