import { trpc } from "@/lib/trpc";
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  PageHeader,
  KPICard,
  GOLD,
  CYAN,
  GREEN,
  RED,
  MUTED,
  BRIGHT,
} from "@/components/DashboardWidgets";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Gauge, Timer, Zap, TrendingUp, TrendingDown } from "lucide-react";

export default function Performance() {
  const { data: metrics, isLoading } = trpc.network.performanceMetrics.useQuery();

  return (
    <div>
      <PageHeader
        title="Performance Metrics"
        subtitle="Network latency, throughput, packet loss, and uptime statistics"
      />

      <StaggerContainer className="space-y-6">
        {/* KPI Summary */}
        <StaggerItem>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card gold-accent-top p-5">
                  <Skeleton className="h-3 w-20 mb-3" />
                  <Skeleton className="h-7 w-16 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : metrics ? (
              <>
                <KPICard
                  label="Avg Latency"
                  value={metrics.avgLatency != null ? `${metrics.avgLatency.toFixed(1)} ms` : "--"}
                  icon={<Timer className="w-5 h-5" style={{ color: CYAN }} />}
                />
                <KPICard
                  label="Avg Throughput"
                  value={metrics.avgThroughput != null ? formatThroughput(metrics.avgThroughput) : "--"}
                  icon={<Gauge className="w-5 h-5" style={{ color: GOLD }} />}
                />
                <KPICard
                  label="Packet Loss"
                  value={metrics.avgPacketLoss != null ? `${metrics.avgPacketLoss.toFixed(2)}%` : "--"}
                  icon={<Zap className="w-5 h-5" style={{ color: RED }} />}
                />
                <KPICard
                  label="Avg Uptime"
                  value={metrics.avgUptime != null ? `${metrics.avgUptime.toFixed(2)}%` : "--"}
                  icon={<Activity className="w-5 h-5" style={{ color: GREEN }} />}
                />
              </>
            ) : (
              <div className="col-span-full">
                <GlassCard accent={false}>
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                    <p className="text-sm" style={{ color: MUTED }}>
                      No performance data available. Connect your database and populate metrics to begin.
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Per-Device Performance Table */}
        <StaggerItem>
          <GlassCard>
            <h3
              className="text-xs font-bold uppercase tracking-wider mb-4"
              style={{ color: MUTED }}
            >
              Device Performance Breakdown
            </h3>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : metrics && metrics.deviceMetrics && metrics.deviceMetrics.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                      {["Device", "Latency", "Throughput", "Packet Loss", "Uptime", "Jitter"].map((h) => (
                        <th
                          key={h}
                          className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                          style={{ color: MUTED }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.deviceMetrics.map((dm: any) => (
                      <tr
                        key={dm.deviceId}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td className="py-2.5 px-3 text-[13px] font-medium" style={{ color: BRIGHT }}>
                          {dm.deviceName}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: CYAN }}
                        >
                          {dm.latency != null ? `${dm.latency.toFixed(1)} ms` : "--"}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: GOLD }}
                        >
                          {dm.throughput != null ? formatThroughput(dm.throughput) : "--"}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: dm.packetLoss > 1 ? RED : GREEN,
                          }}
                        >
                          {dm.packetLoss != null ? `${dm.packetLoss.toFixed(2)}%` : "--"}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: dm.uptime >= 99 ? GREEN : dm.uptime >= 95 ? GOLD : RED,
                          }}
                        >
                          {dm.uptime != null ? `${dm.uptime.toFixed(2)}%` : "--"}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: MUTED }}
                        >
                          {dm.jitter != null ? `${dm.jitter.toFixed(1)} ms` : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm" style={{ color: MUTED }}>
                No per-device performance data available
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
