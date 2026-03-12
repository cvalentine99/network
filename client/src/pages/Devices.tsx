import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import {
  StaggerContainer,
  StaggerItem,
  GlassCard,
  PageHeader,
  GOLD,
  CYAN,
  GREEN,
  RED,
  MUTED,
  BRIGHT,
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
import { Server, Search, ArrowUpDown, ChevronLeft, ChevronRight, Eye, AlertTriangle } from "lucide-react";

type SortField = "displayName" | "ipaddr4" | "deviceClass" | "role" | "vendor" | "analysis" | "lastSeenTime";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export default function Devices() {
  const [search, setSearch] = useState("");
  const [deviceClassFilter, setDeviceClassFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("displayName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  // Debounced search
  const [debouncedSearch] = useState(() => search);

  const queryInput = useMemo(() => ({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    deviceClass: deviceClassFilter !== "all" ? deviceClassFilter : undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    sortBy: sortField,
    sortDir,
  }), [search, deviceClassFilter, roleFilter, sortField, sortDir, page]);

  const { data, isLoading } = trpc.devices.list.useQuery(queryInput);
  const { data: classCounts } = trpc.dashboard.devicesByClass.useQuery();
  const { data: roleCounts } = trpc.dashboard.devicesByRole.useQuery();

  const devices = data?.rows ?? [];
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

  const formatEpoch = (epoch: number | null) => {
    if (!epoch) return "--";
    return new Date(epoch).toLocaleString();
  };

  return (
    <div>
      <PageHeader
        title="Network Devices"
        subtitle="ExtraHop discovered devices — inventory, classification, and analysis levels"
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
                  placeholder="Search by name, IP, MAC, DNS, or vendor..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 bg-transparent border-border"
                />
              </div>
              <Select value={deviceClassFilter} onValueChange={(v) => { setDeviceClassFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Device Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classCounts?.map((c) => (
                    <SelectItem key={c.deviceClass} value={c.deviceClass}>
                      {c.deviceClass} ({c.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roleCounts?.map((r) => (
                    <SelectItem key={r.role} value={r.role}>
                      {r.role} ({r.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Results count */}
        <StaggerItem>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs" style={{ color: MUTED }}>
              {total.toLocaleString()} device{total !== 1 ? "s" : ""} found
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="h-7 px-2 bg-transparent"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs tabular-nums" style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}>
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-7 px-2 bg-transparent"
                >
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
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : devices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                      <SortHeader field="displayName" label="Device Name" />
                      <SortHeader field="ipaddr4" label="IPv4" />
                      <SortHeader field="deviceClass" label="Class" />
                      <SortHeader field="role" label="Role" />
                      <SortHeader field="vendor" label="Vendor" />
                      <SortHeader field="analysis" label="Analysis" />
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Flags
                      </th>
                      <SortHeader field="lastSeenTime" label="Last Seen" />
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => (
                      <tr
                        key={device.id}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 shrink-0" style={{ color: CYAN }} />
                            <div className="min-w-0">
                              <span className="text-[13px] font-medium block truncate" style={{ color: BRIGHT }}>
                                {device.displayName}
                              </span>
                              {device.macaddr && device.macaddr !== "00:00:00:00:00:00" && (
                                <span className="text-[10px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                                  {device.macaddr}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: CYAN }}
                        >
                          {device.ipaddr4 || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: "oklch(0.85 0.005 85)" }}>
                          {device.deviceClass || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: GOLD }}>
                          {device.role || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: MUTED }}>
                          {device.vendor || "--"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded"
                            style={{
                              background: device.analysis === "advanced" ? `${GREEN}15` : device.analysis === "standard" ? `${CYAN}15` : `${MUTED}10`,
                              color: device.analysis === "advanced" ? GREEN : device.analysis === "standard" ? CYAN : MUTED,
                            }}
                          >
                            {device.analysis}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {device.critical && (
                              <AlertTriangle className="w-3.5 h-3.5" style={{ color: RED }} aria-label="Critical" />
                            )}
                            {device.onWatchlist && (
                              <Eye className="w-3.5 h-3.5" style={{ color: GOLD }} aria-label="Watchlist" />
                            )}
                            {!device.critical && !device.onWatchlist && (
                              <span className="text-[11px]" style={{ color: MUTED }}>--</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ color: MUTED }}>
                          {formatEpoch(device.lastSeenTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Server className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  {total === 0
                    ? "No devices found. Populate the dim_device table from your ExtraHop appliance."
                    : "No devices match your search criteria."}
                </p>
              </div>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
