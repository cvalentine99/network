import { trpc } from "@/lib/trpc";
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
  PURPLE,
} from "@/components/DashboardWidgets";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, HardDrive, Wifi } from "lucide-react";

export default function Appliances() {
  const { data: appliances, isLoading } = trpc.appliances.list.useQuery();

  return (
    <div>
      <PageHeader
        title="Appliances"
        subtitle="ExtraHop appliance inventory — sensors, consoles, and management nodes"
      />

      <StaggerContainer className="space-y-4">
        <StaggerItem>
          <GlassCard accent={false}>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : appliances && appliances.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {appliances.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-lg p-4 transition-colors"
                    style={{
                      background: "oklch(1 0 0 / 3%)",
                      border: "1px solid oklch(1 0 0 / 6%)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${GOLD}40`)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "oklch(1 0 0 / 6%)")}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 shrink-0" style={{ color: PURPLE }} />
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: BRIGHT }}>
                            {app.hostname || `Appliance ${app.id}`}
                          </p>
                          {app.displayName && app.displayName !== app.hostname && (
                            <p className="text-[11px]" style={{ color: MUTED }}>
                              {app.displayName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`status-dot ${app.connectionType === "online" ? "status-connected" : "status-pending"}`} />
                        <span className="text-[11px]" style={{ color: app.connectionType === "online" ? GREEN : MUTED }}>
                          {app.connectionType || "unknown"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span style={{ color: MUTED }}>Platform: </span>
                        <span style={{ color: BRIGHT }}>{app.platform || "--"}</span>
                      </div>
                      <div>
                        <span style={{ color: MUTED }}>Firmware: </span>
                        <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: CYAN }}>
                          {app.firmwareVersion || "--"}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: MUTED }}>UUID: </span>
                        <span className="tabular-nums text-[10px]" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                          {app.uuid}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: MUTED }}>Status: </span>
                        <span style={{ color: BRIGHT }}>
                          {app.statusMessage || "--"}
                        </span>
                      </div>
                      {app.nickname && (
                        <div className="col-span-2">
                          <span style={{ color: MUTED }}>Label: </span>
                          <span style={{ color: GOLD }}>{app.nickname}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-3 pt-2" style={{ borderTop: "1px solid oklch(1 0 0 / 6%)" }}>
                      {app.totalCapacity && (
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" style={{ color: MUTED }} />
                          <span className="text-[10px] tabular-nums" style={{ fontFamily: "var(--font-mono)", color: MUTED }}>
                            {(app.totalCapacity / 1_000_000_000).toFixed(0)} GB
                          </span>
                        </div>
                      )}
                      {app.licenseStatus && (
                        <div className="flex items-center gap-1">
                          <Wifi className="w-3 h-3" style={{ color: MUTED }} />
                          <span className="text-[10px]" style={{ color: MUTED }}>
                            License: {app.licenseStatus}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Cpu className="w-8 h-8 mx-auto mb-3" style={{ color: MUTED }} />
                <p className="text-sm" style={{ color: MUTED }}>
                  No appliances found. Populate the dim_appliance table from your ExtraHop system.
                </p>
              </div>
            )}
          </GlassCard>
        </StaggerItem>
      </StaggerContainer>
    </div>
  );
}
