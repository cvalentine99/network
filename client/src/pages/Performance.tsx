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
  GREEN,
  RED,
  MUTED,
  BRIGHT,
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
import { Radio, Search, ChevronLeft, ChevronRight, ArrowUpDown, Clock } from "lucide-react";

const PAGE_SIZE = 50;

function riskToSeverity(risk: number | null): "critical" | "high" | "medium" | "low" {
  if (!risk) return "low";
  if (risk >= 80) return "critical";
  if (risk >= 60) return "high";
  if (risk >= 30) return "medium";
  return "low";
}

export default function Detections() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const queryInput = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    sortBy: "startTime" as string,
    sortDir: "desc" as const,
  }), [search, statusFilter, page]);

  const { data, isLoading } = trpc.detections.list.useQuery(queryInput);

  const detections = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatEpoch = (epoch: number | null) => {
    if (!epoch) return "--";
    return new Date(epoch).toLocaleString();
  };

  return (
    <div>
      <PageHeader
        title="Detections"
        subtitle="ExtraHop machine learning detections — security and performance anomalies"
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
                  placeholder="Search detections by title, type, or category..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 bg-transparent border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Results count + pagination */}
        <StaggerItem>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs" style={{ color: MUTED }}>
              {total.toLocaleString()} detection{total !== 1 ? "s" : ""} found
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

        {/* Detection Cards */}
        <StaggerItem>
          <GlassCard accent={false}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : detections.length > 0 ? (
              <div className="space-y-2">
                {detections.map((det) => (
                  <div
                    key={det.id}
                    className="flex items-start gap-4 p-4 rounded-lg transition-colors"
                    style={{
                      background: "oklch(1 0 0 / 2%)",
                      borderBottom: "1px solid oklch(1 0 0 / 4%)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 4%)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 2%)")}
                  >
                    <div className="pt-0.5 shrink-0">
                      <SeverityBadge level={riskToSeverity(det.riskScore)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: BRIGHT }}>
                        {det.title || det.type || "Unnamed Detection"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {det.type && (
                          <span
                            className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded"
                            style={{ background: `${CYAN}15`, color: CYAN }}
                          >
                            {det.type}
                          </span>
                        )}
                        {(() => {
                          const cats = det.categories as string[] | null;
                          return cats && Array.isArray(cats) && cats.length > 0 ? (
                            <span className="text-[11px]" style={{ color: GOLD }}>
                              {cats.join(", ")}
                            </span>
                          ) : null;
                        })()}
                        {det.status && (
                          <span
                            className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded"
                            style={{
                              background: det.status === "new" ? `${RED}15` : det.status === "closed" ? `${GREEN}15` : `${AMBER}15`,
                              color: det.status === "new" ? RED : det.status === "closed" ? GREEN : AMBER,
                            }}
                          >
                            {det.status}
                          </span>
                        )}
                        {det.riskScore != null && (
                          <span className="text-[11px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                            Risk: {det.riskScore}
                          </span>
                        )}
                      </div>
                      {det.description && (
                        <p className="text-[11px] mt-1.5 line-clamp-2" style={{ color: MUTED }}>
                          {det.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" style={{ color: MUTED }} />
                        <span className="text-[11px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          {formatEpoch(det.startTime)}
                        </span>
                      </div>
                      {det.endTime && (
                        <span className="text-[10px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          to {formatEpoch(det.endTime)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Radio className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  {total === 0
                    ? "No detections found. Populate the dim_detection table from your ExtraHop appliance."
                    : "No detections match your search criteria."}
                </p>
              </div>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
