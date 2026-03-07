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
import { Network, Search, ArrowUpDown } from "lucide-react";

type SortField = "name" | "deviceName" | "status" | "speed";
type SortDir = "asc" | "desc";

export default function Interfaces() {
  const { data: interfaces, isLoading } = trpc.network.interfaces.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    if (!interfaces) return [];
    let result = [...interfaces];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (iface) =>
          iface.name.toLowerCase().includes(q) ||
          (iface.deviceName && iface.deviceName.toLowerCase().includes(q)) ||
          (iface.interfaceType && iface.interfaceType.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((iface) => iface.status === statusFilter);
    }

    result.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      if (sortField === "speed") {
        aVal = a.speed ?? 0;
        bVal = b.speed ?? 0;
        return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }

      aVal = (a[sortField] ?? "").toString().toLowerCase();
      bVal = (b[sortField] ?? "").toString().toLowerCase();
      const cmp = (aVal as string).localeCompare(bVal as string);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [interfaces, search, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
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
        title="Network Interfaces"
        subtitle="Interface status, throughput, and utilization across all devices"
      />

      <StaggerContainer className="space-y-4">
        <StaggerItem>
          <GlassCard accent={false} className="!p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: MUTED }}
                />
                <Input
                  placeholder="Search interfaces by name, device, or type..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-transparent border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-transparent border-border">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="up">Up</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>
        </StaggerItem>

        <StaggerItem>
          <GlassCard accent={false}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                      <SortHeader field="name" label="Interface" />
                      <SortHeader field="deviceName" label="Device" />
                      <SortHeader field="status" label="Status" />
                      <SortHeader field="speed" label="Speed" />
                      <th
                        className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        Type
                      </th>
                      <th
                        className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        In Traffic
                      </th>
                      <th
                        className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        Out Traffic
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((iface) => (
                      <tr
                        key={iface.id}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Network className="w-4 h-4" style={{ color: CYAN }} />
                            <span className="text-[13px] font-medium" style={{ color: BRIGHT }}>
                              {iface.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: "oklch(0.85 0.005 85)" }}>
                          {iface.deviceName || "--"}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`status-dot ${
                                iface.status === "up"
                                  ? "status-connected"
                                  : iface.status === "down"
                                  ? "status-disconnected"
                                  : "status-pending"
                              }`}
                            />
                            <span
                              className="text-[13px] capitalize"
                              style={{
                                color:
                                  iface.status === "up"
                                    ? GREEN
                                    : iface.status === "down"
                                    ? RED
                                    : GOLD,
                              }}
                            >
                              {iface.status}
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: BRIGHT }}
                        >
                          {iface.speed ? formatSpeed(iface.speed) : "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: MUTED }}>
                          {iface.interfaceType || "--"}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: GREEN }}
                        >
                          {iface.inTraffic != null ? formatTraffic(iface.inTraffic) : "--"}
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: CYAN }}
                        >
                          {iface.outTraffic != null ? formatTraffic(iface.outTraffic) : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Network className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  {interfaces && interfaces.length === 0
                    ? "No interfaces found. Add interface data to your database to begin monitoring."
                    : "No interfaces match your search criteria."}
                </p>
              </div>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}

function formatSpeed(bps: number): string {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(0)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(0)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

function formatTraffic(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} KB`;
  return `${bytes} B`;
}
