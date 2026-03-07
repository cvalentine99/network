import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  PageHeader,
  SeverityBadge,
  MUTED,
  BRIGHT,
  CYAN,
} from "@/components/DashboardWidgets";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Search, Clock } from "lucide-react";

export default function Alerts() {
  const { data: alerts, isLoading } = trpc.network.alerts.useQuery();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (!alerts) return [];
    let result = [...alerts];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.message.toLowerCase().includes(q) ||
          (a.deviceName && a.deviceName.toLowerCase().includes(q)) ||
          (a.source && a.source.toLowerCase().includes(q))
      );
    }

    if (severityFilter !== "all") {
      result = result.filter((a) => a.severity === severityFilter);
    }

    return result;
  }, [alerts, search, severityFilter]);

  return (
    <div>
      <PageHeader
        title="Network Alerts"
        subtitle="Active alerts and notifications across all monitored infrastructure"
      />

      <StaggerContainer className="space-y-4">
        {/* Filters */}
        <StaggerItem>
          <GlassCard accent={false} className="!p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: MUTED }}
                />
                <Input
                  placeholder="Search alerts by message, device, or source..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-transparent border-border"
                />
              </div>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Filter by severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Alert List */}
        <StaggerItem>
          <GlassCard accent={false}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="space-y-2">
                {filtered.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-4 p-4 rounded-lg transition-colors"
                    style={{
                      background: "oklch(1 0 0 / 2%)",
                      borderBottom: "1px solid oklch(1 0 0 / 4%)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "oklch(1 0 0 / 4%)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "oklch(1 0 0 / 2%)")
                    }
                  >
                    <div className="pt-0.5">
                      <SeverityBadge level={alert.severity as "critical" | "high" | "medium" | "low"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: BRIGHT }}>
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-4 mt-1.5">
                        {alert.deviceName && (
                          <span className="text-[11px]" style={{ color: CYAN }}>
                            {alert.deviceName}
                          </span>
                        )}
                        {alert.source && (
                          <span className="text-[11px]" style={{ color: MUTED }}>
                            Source: {alert.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Clock className="w-3 h-3" style={{ color: MUTED }} />
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ fontFamily: "var(--font-mono)", color: MUTED }}
                      >
                        {new Date(alert.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  {alerts && alerts.length === 0
                    ? "No alerts found. Alerts will appear here when network issues are detected."
                    : "No alerts match your search criteria."}
                </p>
              </div>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
