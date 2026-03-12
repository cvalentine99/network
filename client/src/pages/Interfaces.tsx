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
import { Skeleton } from "@/components/ui/skeleton";
import { Network, Search, ArrowUpDown } from "lucide-react";

type SortField = "name" | "description" | "idle";
type SortDir = "asc" | "desc";

export default function Networks() {
  const { data: networks, isLoading } = trpc.networks.list.useQuery();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    if (!networks) return [];
    let result = [...networks];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          (n.description && n.description.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortField === "idle") {
        const aVal = a.idle ? 1 : 0;
        const bVal = b.idle ? 1 : 0;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const aVal = (a[sortField] ?? "").toString().toLowerCase();
      const bVal = (b[sortField] ?? "").toString().toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [networks, search, sortField, sortDir]);

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
        title="Networks"
        subtitle="ExtraHop discovered networks — VLANs, localities, and activity status"
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
                  placeholder="Search networks by name or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-transparent border-border"
                />
              </div>
            </div>
          </GlassCard>
        </StaggerItem>

        {/* Results count */}
        <StaggerItem>
          <div className="flex items-center justify-between px-1">
            <p className="text-xs" style={{ color: MUTED }}>
              {filtered.length.toLocaleString()} network{filtered.length !== 1 ? "s" : ""} found
            </p>
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
            ) : filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                      <SortHeader field="name" label="Network Name" />
                      <SortHeader field="description" label="Description" />
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Appliance UUID
                      </th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Node ID
                      </th>
                      <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                        Last Modified
                      </th>
                      <SortHeader field="idle" label="Status" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((net) => (
                      <tr
                        key={net.id}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 3%)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Network className="w-4 h-4 shrink-0" style={{ color: CYAN }} />
                            <span className="text-[13px] font-medium" style={{ color: BRIGHT }}>
                              {net.name || `Network ${net.id}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[13px]" style={{ color: MUTED }}>
                          {net.description || "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          {net.applianceUuid}
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: GOLD }}>
                          {net.nodeId ?? "--"}
                        </td>
                        <td className="py-2.5 px-3 text-[13px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          {net.modTime ? new Date(net.modTime).toLocaleString() : "--"}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`status-dot ${net.idle ? "status-disconnected" : "status-connected"}`} />
                            <span className="text-[13px]" style={{ color: net.idle ? RED : GREEN }}>
                              {net.idle ? "Idle" : "Active"}
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
                <Network className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  {networks && networks.length === 0
                    ? "No networks found. Populate the dim_network table from your ExtraHop appliance."
                    : "No networks match your search criteria."}
                </p>
              </div>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
