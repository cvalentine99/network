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
import { Server, Search, ArrowUpDown } from "lucide-react";

type SortField = "name" | "ipAddress" | "status" | "deviceType";
type SortDir = "asc" | "desc";

export default function Devices() {
  const { data: devices, isLoading } = trpc.network.devices.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    if (!devices) return [];
    let result = [...devices];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.ipAddress.toLowerCase().includes(q) ||
          (d.deviceType && d.deviceType.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }

    result.sort((a, b) => {
      const aVal = (a[sortField] ?? "").toString().toLowerCase();
      const bVal = (b[sortField] ?? "").toString().toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [devices, search, statusFilter, sortField, sortDir]);

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
        title="Network Devices"
        subtitle="Inventory and status of all monitored network devices"
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
                  placeholder="Search devices by name, IP, or type..."
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
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </GlassCard>
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
            ) : filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                      <SortHeader field="name" label="Device Name" />
                      <SortHeader field="ipAddress" label="IP Address" />
                      <SortHeader field="status" label="Status" />
                      <SortHeader field="deviceType" label="Type" />
                      <th
                        className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        Location
                      </th>
                      <th
                        className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: MUTED }}
                      >
                        Last Seen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((device) => (
                      <tr
                        key={device.id}
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
                            <Server className="w-4 h-4" style={{ color: CYAN }} />
                            <span className="text-[13px] font-medium" style={{ color: BRIGHT }}>
                              {device.name}
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-2.5 px-3 text-[13px] tabular-nums"
                          style={{ fontFamily: "var(--font-mono)", color: CYAN }}
                        >
                          {device.ipAddress}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`status-dot ${
                                device.status === "online"
                                  ? "status-connected"
                                  : device.status === "offline"
                                  ? "status-disconnected"
                                  : "status-pending"
                              }`}
                            />
                            <span
                              className="text-[13px] capitalize"
                              style={{
                                color:
                                  device.status === "online"
                                    ? GREEN
                                    : device.status === "offline"
                                    ? RED
                                    : GOLD,
                              }}
                            >
                              {device.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: "oklch(0.85 0.005 85)" }}>
                          {device.deviceType || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: MUTED }}>
                          {device.location || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ color: MUTED }}>
                          {device.lastSeen
                            ? new Date(device.lastSeen).toLocaleString()
                            : "--"}
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
                  {devices && devices.length === 0
                    ? "No devices found. Add devices to your database to begin monitoring."
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
