/**
 * LoadingSkeleton — Loading state component.
 *
 * Shows pulsing placeholder bars while data is being fetched.
 * Every panel must show this state while waiting for data — not a blank void.
 */
import { MUTED } from '@/components/DashboardWidgets';

interface LoadingSkeletonProps {
  /** Number of skeleton rows to show */
  rows?: number;
  /** Optional label shown above the skeleton */
  label?: string;
}

export function LoadingSkeleton({ rows = 4, label }: LoadingSkeletonProps) {
  return (
    <div className="flex flex-col gap-3 py-6 px-4">
      {label && (
        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: MUTED }}>
          {label}
        </p>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <div
            className="h-3 rounded animate-pulse"
            style={{
              width: `${40 + Math.random() * 50}%`,
              background: 'oklch(1 0 0 / 6%)',
            }}
          />
          <div
            className="h-3 rounded animate-pulse"
            style={{
              width: `${20 + Math.random() * 30}%`,
              background: 'oklch(1 0 0 / 4%)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * KPICardSkeleton — Loading state for a single KPI card.
 */
export function KPICardSkeleton() {
  return (
    <div
      className="glass-card gold-accent-top p-5"
    >
      <div className="flex flex-col gap-2">
        <div
          className="h-2.5 w-20 rounded animate-pulse"
          style={{ background: 'oklch(1 0 0 / 8%)' }}
        />
        <div
          className="h-6 w-28 rounded animate-pulse mt-1"
          style={{ background: 'oklch(1 0 0 / 6%)' }}
        />
        <div
          className="h-2 w-16 rounded animate-pulse mt-1"
          style={{ background: 'oklch(1 0 0 / 4%)' }}
        />
      </div>
    </div>
  );
}
