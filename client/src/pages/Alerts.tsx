import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  PageHeader,
  SeverityBadge,
  GOLD,
  CYAN,
  MUTED,
  BRIGHT,
  RED,
  GREEN,
  ORANGE,
  AMBER,
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
import { Button } from "@/components/ui/button";
import { AlertTriangle, Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

type SortField = "name" | "severity" | "type" | "statName";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

function severityToLabel(sev: number): "critical" | "high" | "medium" | "low" {
  if (sev >= 6) return "critical";
  if (sev >= 4) return "high";
  if (sev >= 2) return "medium";
  return "low";
}

export default function Alerts() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const queryInput = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    severity: severityFilter !== "all" ? parseInt(severityFilter) : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    sortBy: sortField,
    sortDir,
  }), [search, severityFilter, typeFilter, sortField, sortDir, page]);

  const { data, isLoading } = trpc.alerts.list.useQuery(queryInput);

  const alerts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors"
      style={{ color: sortField === field ? GOLD : MUTED }}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </div>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Alert Configurations"
        subtitle="ExtraHop alert definitions — threshold rules, severity levels, and monitoring targets"
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
                  placeholder="Search alerts by name or stat name..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 bg-transparent border-border"
                />
              </div>
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {[7, 6, 5, 4, 3, 2, 1, 0].map((s) => (
                    <SelectItem key={s} value={s.toString()}>
                      Level {s} ({severityToLabel(s)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="threshold">Threshold</SelectItem>
                  <SelectItem value="trend">Trend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Results count + pagination */}
        <StaggerItem>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs" style={{ color: MUTED }}>
              {total.toLocaleString()} alert{total !== 1 ? "s" : ""} found
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-7 px-2 bg-transparent">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs tabular-nums" style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}>
                  {page + 1} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="h-7 px-2 bg-transparent">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Table */}
        <StaggerItem>
          <GlassCard accent={false}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : alerts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                      <SortHeader field="severity" label="Severity" />
                      <SortHeader field="name" label="Alert Name" />
                      <SortHeader field="type" label="Type" />
                      <SortHeader field="statName" label="Stat Name" />
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Operator
                      </th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Operand
                      </th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Interval
                      </th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((alert) => (
                      <tr
                        key={alert.id}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-2.5 px-3">
                          <SeverityBadge level={severityToLabel(alert.severity)} />
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[13px] font-medium" style={{ color: BRIGHT }}>
                            {alert.name}
                          </span>
                          {alert.description && (
                            <p className="text-[10px] mt-0.5 truncate max-w-xs" style={{ color: MUTED }}>
                              {alert.description}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded"
                            style={{
                              background: alert.type === "threshold" ? `${CYAN}15` : `${GOLD}15`,
                              color: alert.type === "threshold" ? CYAN : GOLD,
                            }}
                          >
                            {alert.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: CYAN }}>
                          {alert.statName}
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          {alert.operator}
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}>
                          {alert.operand} {alert.units !== "none" ? alert.units : ""}
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          {alert.intervalLength}s
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`status-dot ${alert.disabled ? "status-disconnected" : "status-connected"}`} />
                            <span className="text-[13px]" style={{ color: alert.disabled ? RED : GREEN }}>
                              {alert.disabled ? "Disabled" : "Active"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  {total === 0
                    ? "No alerts configured. Populate the dim_alert table from your ExtraHop appliance."
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
