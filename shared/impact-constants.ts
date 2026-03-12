// shared/impact-constants.ts
import type { Severity } from './impact-types';

// ─── Active Sentinel ──────────────────────────────────────────────────────
export const ACTIVE_SENTINEL = 2147483647000;

// ─── Network vs Device spec differences ───────────────────────────────────
export const NETWORK_METRIC_SPECS = {
  bytes: [{ name: 'bytes' }],
  pkts: [{ name: 'pkts' }],
} as const;

export const DEVICE_METRIC_SPECS = {
  bytes: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
  pkts: [{ name: 'pkts_in' }, { name: 'pkts_out' }],
} as const;

// ─── Alert severity mapping (API int → 4-level system) ────────────
export function mapAlertSeverity(severity: number): Severity {
  if (severity <= 1) return 'critical';
  if (severity <= 3) return 'high';
  if (severity <= 5) return 'medium';
  return 'low';
}

// ─── Risk score → severity ───────────────────────────────────────────────
export function riskScoreToSeverity(riskScore: number): Severity {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}

// ─── Cycle → approximate bucket duration mapping ──────────────────────────
export const CYCLE_DURATION_MS: Record<string, number> = {
  '1sec': 1000,
  '30sec': 30000,
  '5min': 300000,
  '1hr': 3600000,
  '24hr': 86400000,
};
