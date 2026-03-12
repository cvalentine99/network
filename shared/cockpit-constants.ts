/**
 * Obsidian Cockpit — Shared constants
 * Metric specs, sentinel values, severity mappings, cycle durations.
 */
import type { Severity, MetricCycle } from './cockpit-types';

// ─── Active Sentinel ──────────────────────────────────────────────────────
// ExtraHop uses 2147483647000 (max int32 * 1000) as "still active" for end_time.
// Map to isActive: true. Never display as a date.
export const ACTIVE_SENTINEL = 2147483647000;

// ─── Network vs Device spec differences ───────────────────────────────────
// CRITICAL: Network object uses NON-directional metric names.
// Device objects use DIRECTIONAL metric names. Mixing them = wrong data.
export const NETWORK_METRIC_SPECS = {
  bytes: [{ name: 'bytes' }],
  pkts: [{ name: 'pkts' }],
} as const;

export const DEVICE_METRIC_SPECS = {
  bytes: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
  pkts: [{ name: 'pkts_in' }, { name: 'pkts_out' }],
} as const;

// ─── Alert severity mapping (API int → 4-level system) ────────────
// ExtraHop alert severity: LOWER integer = HIGHER severity.
// Proven from live payloads: severity 1 = "Red" (most severe),
// severity 3 = "Orange", severity 5 = "Yellow" (least severe).
export function mapAlertSeverity(severity: number): Severity {
  if (severity <= 1) return 'critical';
  if (severity <= 3) return 'high';
  if (severity <= 5) return 'medium';
  return 'low';
}

// ─── Cycle → approximate bucket duration mapping ──────────────────────────
export const CYCLE_DURATION_MS: Record<MetricCycle, number> = {
  '1sec': 1000,
  '30sec': 30000,
  '5min': 300000,
  '1hr': 3600000,
  '24hr': 86400000,
  'auto': 30000,
};

// ─── Default time window presets ──────────────────────────────────────────
export const TIME_WINDOW_PRESETS = [
  { label: 'Last 5 minutes', value: -300_000 },
  { label: 'Last 30 minutes', value: -1_800_000 },
  { label: 'Last 1 hour', value: -3_600_000 },
  { label: 'Last 6 hours', value: -21_600_000 },
  { label: 'Last 24 hours', value: -86_400_000 },
  { label: 'Last 2 days', value: -172_800_000 },
  { label: 'Last 7 days', value: -604_800_000 },
] as const;

// ─── Detection risk score → severity mapping ─────────────────────────────
export function riskScoreToSeverity(riskScore: number): Severity {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}
