/**
 * Protocol Breakdown Chart — Shared types and normalization (Slice 16)
 *
 * CONTRACT:
 *   - Transforms DeviceProtocolActivity[] into chart-ready data
 *   - Pure functions only: same input → same output
 *   - No side effects, no DOM access, no network calls
 *   - Handles empty arrays (quiet state), single-protocol, and multi-protocol
 *   - Guards against NaN/Infinity/negative values reaching the chart
 *   - Sorts by totalBytes descending for visual hierarchy
 */
import type { DeviceProtocolActivity } from './cockpit-types';

// ─── Chart-ready protocol entry ─────────────────────────────────────────
export interface ProtocolChartEntry {
  /** Protocol name (e.g. "SMB", "DNS") */
  protocol: string;
  /** Total bytes for this protocol */
  totalBytes: number;
  /** Bytes received */
  bytesIn: number;
  /** Bytes sent */
  bytesOut: number;
  /** Connection count */
  connections: number;
  /** Percentage of total traffic (0-100, 2 decimal places) */
  pct: number;
  /** Assigned color from the palette */
  color: string;
}

// ─── Chart summary ──────────────────────────────────────────────────────
export interface ProtocolChartData {
  /** Chart-ready entries sorted by totalBytes descending */
  entries: ProtocolChartEntry[];
  /** Sum of all protocol totalBytes */
  grandTotal: number;
  /** Number of protocols */
  protocolCount: number;
  /** Whether the data is empty (quiet state) */
  isEmpty: boolean;
}

// ─── Color palette for protocol chart ───────────────────────────────────
/**
 * 8-color palette designed for dark backgrounds.
 * Colors cycle if more than 8 protocols exist.
 * OKLCH values chosen for perceptual distinctness.
 */
export const PROTOCOL_CHART_COLORS: readonly string[] = [
  'oklch(0.769 0.108 85.805)',  // gold (primary accent)
  'oklch(0.75 0.15 195)',       // cyan
  'oklch(0.723 0.219 149.579)', // green
  'oklch(0.628 0.258 29.234)',  // red
  'oklch(0.7 0.12 280)',        // purple
  'oklch(0.75 0.15 55)',        // orange
  'oklch(0.65 0.15 330)',       // pink
  'oklch(0.7 0.08 220)',        // steel blue
] as const;

/** Maximum number of individual protocol slices before grouping into "Other" */
export const PROTOCOL_CHART_MAX_SLICES = 7;

// ─── Normalization function ─────────────────────────────────────────────
/**
 * Transform raw DeviceProtocolActivity[] into chart-ready ProtocolChartData.
 *
 * Rules:
 * 1. Filter out entries with non-finite or negative totalBytes
 * 2. Sort by totalBytes descending
 * 3. If more than PROTOCOL_CHART_MAX_SLICES, group tail into "Other"
 * 4. Calculate percentage of grand total for each entry
 * 5. Assign colors from palette (cycling if needed)
 * 6. Empty input → isEmpty: true, entries: [], grandTotal: 0
 */
export function normalizeProtocolChart(
  protocols: DeviceProtocolActivity[]
): ProtocolChartData {
  // 1. Filter invalid entries
  const valid = protocols.filter(
    (p) =>
      Number.isFinite(p.totalBytes) &&
      p.totalBytes >= 0 &&
      Number.isFinite(p.bytesIn) &&
      p.bytesIn >= 0 &&
      Number.isFinite(p.bytesOut) &&
      p.bytesOut >= 0 &&
      Number.isFinite(p.connections) &&
      p.connections >= 0 &&
      typeof p.protocol === 'string' &&
      p.protocol.length > 0
  );

  if (valid.length === 0) {
    return { entries: [], grandTotal: 0, protocolCount: 0, isEmpty: true };
  }

  // 2. Sort by totalBytes descending
  const sorted = [...valid].sort((a, b) => b.totalBytes - a.totalBytes);

  // 3. Group tail into "Other" if needed
  let grouped: Array<{
    protocol: string;
    totalBytes: number;
    bytesIn: number;
    bytesOut: number;
    connections: number;
  }>;

  if (sorted.length > PROTOCOL_CHART_MAX_SLICES) {
    const top = sorted.slice(0, PROTOCOL_CHART_MAX_SLICES - 1);
    const tail = sorted.slice(PROTOCOL_CHART_MAX_SLICES - 1);
    const other = {
      protocol: 'Other',
      totalBytes: tail.reduce((sum, p) => sum + p.totalBytes, 0),
      bytesIn: tail.reduce((sum, p) => sum + p.bytesIn, 0),
      bytesOut: tail.reduce((sum, p) => sum + p.bytesOut, 0),
      connections: tail.reduce((sum, p) => sum + p.connections, 0),
    };
    grouped = [...top, other];
  } else {
    grouped = sorted.map((p) => ({
      protocol: p.protocol,
      totalBytes: p.totalBytes,
      bytesIn: p.bytesIn,
      bytesOut: p.bytesOut,
      connections: p.connections,
    }));
  }

  // 4. Calculate grand total
  const grandTotal = grouped.reduce((sum, p) => sum + p.totalBytes, 0);

  // 5. Build chart entries with percentage and color
  const entries: ProtocolChartEntry[] = grouped.map((p, i) => ({
    protocol: p.protocol,
    totalBytes: p.totalBytes,
    bytesIn: p.bytesIn,
    bytesOut: p.bytesOut,
    connections: p.connections,
    pct: grandTotal > 0 ? Math.round((p.totalBytes / grandTotal) * 10000) / 100 : 0,
    color: PROTOCOL_CHART_COLORS[i % PROTOCOL_CHART_COLORS.length],
  }));

  return {
    entries,
    grandTotal,
    protocolCount: valid.length,
    isEmpty: false,
  };
}
