/**
 * CrossSurfaceNavButton — Slice 23
 *
 * Reusable button/link for cross-surface navigation.
 * Renders a compact, styled button that navigates to another surface
 * with pre-filled query parameters.
 *
 * CONTRACT:
 * - Uses wouter's useLocation for navigation (no full page reload)
 * - Displays target surface name and entity context
 * - Consistent styling across all surfaces
 * - data-testid for testing: `cross-nav-{sourceSurface}-to-{targetSurface}`
 */

import { useLocation } from 'wouter';
import { ExternalLink } from 'lucide-react';
import type { CrossSurfaceLink } from '../../../shared/cross-surface-nav-types';

const GOLD = 'oklch(0.769 0.108 85.805)';
const MUTED = 'oklch(0.6 0.01 260)';

interface CrossSurfaceNavButtonProps {
  link: CrossSurfaceLink;
  /** Optional: compact mode for inline use in tables */
  compact?: boolean;
  /** Optional: custom className */
  className?: string;
}

export default function CrossSurfaceNavButton({
  link,
  compact = false,
  className = '',
}: CrossSurfaceNavButtonProps) {
  const [, setLocation] = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(link.href);
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors hover:bg-white/[0.06] ${className}`}
        style={{ color: GOLD, border: `1px solid ${GOLD}30` }}
        data-testid={`cross-nav-${link.sourceSurface}-to-${link.targetSurface}`}
        title={link.label}
      >
        <ExternalLink style={{ width: 10, height: 10 }} />
        <span className="truncate max-w-[120px]">{link.label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/[0.06] ${className}`}
      style={{
        color: GOLD,
        border: `1px solid ${GOLD}25`,
        background: `${GOLD}08`,
      }}
      data-testid={`cross-nav-${link.sourceSurface}-to-${link.targetSurface}`}
    >
      <ExternalLink style={{ width: 14, height: 14 }} />
      <span>{link.label}</span>
    </button>
  );
}
