/**
 * Obsidian Cockpit — Pure display formatters (Slice 02)
 *
 * All functions are pure: same input → same output, always.
 * No side effects. No network calls. No DOM access.
 *
 * CONTRACT RULES:
 * 1. null input → "—" (em dash). Never "0", never "N/A", never empty string.
 * 2. NaN/Infinity input → "—". Defensive; should never reach here if normalization is correct.
 * 3. Negative values are valid for baselineDeltaPct. All other metrics must be >= 0.
 * 4. Output is always a string. Never a number. Never undefined.
 * 5. Units are always included in the output string.
 */

const EM_DASH = '—';

/**
 * Guard: returns true if the value is a finite number (not null, not NaN, not Infinity).
 */
function isDisplayable(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

/**
 * Format a byte count into a human-readable string with appropriate unit.
 *
 * Examples:
 *   0 → "0 B"
 *   1023 → "1,023 B"
 *   1024 → "1.00 KB"
 *   1048576 → "1.00 MB"
 *   1073741824 → "1.00 GB"
 *   8547321600 → "7.96 GB"
 *   null → "—"
 */
export function formatBytes(bytes: number | null): string {
  if (!isDisplayable(bytes)) return EM_DASH;
  if (bytes < 0) return EM_DASH; // bytes cannot be negative

  if (bytes < 1024) return `${bytes.toLocaleString('en-US')} B`;

  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unitIndex = -1;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format a bytes-per-second rate into a human-readable string.
 * Uses the same unit scaling as formatBytes but appends "/s".
 *
 * Examples:
 *   0 → "0 B/s"
 *   28491072 → "27.17 MB/s"
 *   null → "—"
 */
export function formatBytesPerSec(bps: number | null): string {
  if (!isDisplayable(bps)) return EM_DASH;
  if (bps < 0) return EM_DASH;

  if (bps < 1024) return `${bps.toLocaleString('en-US')} B/s`;

  const units = ['KB/s', 'MB/s', 'GB/s', 'TB/s'];
  let value = bps;
  let unitIndex = -1;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format a packet count into a human-readable string.
 * Uses K/M/B suffixes for large numbers.
 *
 * Examples:
 *   0 → "0 pkts"
 *   999 → "999 pkts"
 *   1000 → "1.00K pkts"
 *   12450000 → "12.45M pkts"
 *   null → "—"
 */
export function formatPackets(packets: number | null): string {
  if (!isDisplayable(packets)) return EM_DASH;
  if (packets < 0) return EM_DASH;

  if (packets < 1000) return `${packets.toLocaleString('en-US')} pkts`;
  if (packets < 1_000_000) return `${(packets / 1000).toFixed(2)}K pkts`;
  if (packets < 1_000_000_000) return `${(packets / 1_000_000).toFixed(2)}M pkts`;
  return `${(packets / 1_000_000_000).toFixed(2)}B pkts`;
}

/**
 * Format a packets-per-second rate.
 *
 * Examples:
 *   0 → "0 pps"
 *   41500 → "41.50K pps"
 *   null → "—"
 */
export function formatPacketsPerSec(pps: number | null): string {
  if (!isDisplayable(pps)) return EM_DASH;
  if (pps < 0) return EM_DASH;

  if (pps < 1000) return `${pps.toLocaleString('en-US')} pps`;
  if (pps < 1_000_000) return `${(pps / 1000).toFixed(2)}K pps`;
  if (pps < 1_000_000_000) return `${(pps / 1_000_000).toFixed(2)}M pps`;
  return `${(pps / 1_000_000_000).toFixed(2)}B pps`;
}

/**
 * Format a percentage value (baseline delta).
 * Negative = below baseline, positive = above baseline, null = no baseline.
 *
 * Examples:
 *   12.3 → "+12.3%"
 *   -5.7 → "-5.7%"
 *   0 → "0.0%"
 *   null → "—"
 */
export function formatPercent(pct: number | null): string {
  if (!isDisplayable(pct)) return EM_DASH;

  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}
