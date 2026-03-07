import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen" style={{ background: "oklch(0.05 0 0)" }}>
      {/* Sidebar skeleton */}
      <div
        className="w-[260px] p-4 space-y-6"
        style={{
          background: "oklch(0.08 0.005 260)",
          borderRight: "1px solid oklch(1 0 0 / 8%)",
        }}
      >
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-md bg-muted" />
          <Skeleton className="h-4 w-24 bg-muted" />
        </div>
        <div className="space-y-2 px-2">
          <Skeleton className="h-10 w-full rounded-lg bg-muted" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted" />
          <Skeleton className="h-10 w-full rounded-lg bg-muted" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-[180px] w-full rounded-xl bg-muted" />
        <div className="grid gap-4 grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 grid-cols-2">
          <Skeleton className="h-48 rounded-xl bg-muted" />
          <Skeleton className="h-48 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
