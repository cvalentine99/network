// server/bff/lib/normalize.ts
import type { SeriesPoint, MetricSpec } from '../../../shared/impact-types';
import { epochToIso } from './timeWindow';

/**
 * RULE 1: values[] are positional — NEVER guess by name.
 *
 * The ExtraHop /metrics response returns stats[].values as a positional array.
 * Positions correspond 1:1 to the metric_specs[] you sent in the request.
 */
export function bindMetricValues(
  stats: Array<{ time: number; duration: number; values: (number | null)[] }>,
  metricSpecs: MetricSpec[]
): SeriesPoint[] {
  if (!stats || !Array.isArray(stats)) return [];

  return stats.map((bucket) => {
    const values: Record<string, number | null> = {};
    for (let i = 0; i < metricSpecs.length; i++) {
      const specName = metricSpecs[i].name;
      const rawValue = i < bucket.values.length ? bucket.values[i] : null;
      values[specName] = (rawValue != null && !Number.isNaN(rawValue))
        ? rawValue
        : null;
    }
    return {
      t: bucket.time,
      tIso: epochToIso(bucket.time),
      durationMs: bucket.duration,
      values,
    };
  });
}

/**
 * RULE 2: Bucket totals are NOT rates — divide by duration.
 * rate = value / (durationMs / 1000)
 */
export function computeRate(value: number | null, durationMs: number): number | null {
  if (value == null || durationMs <= 0) return null;
  return value / (durationMs / 1000);
}

export function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

export function baselineDeltaPercent(live: number | null, baseline: number | null): number | null {
  if (live == null || baseline == null || baseline === 0) return null;
  return (live - baseline) / baseline;
}

/**
 * Normalize totalbyobject results into per-device aggregates.
 * Used for Top Talkers ranking.
 */
export function normalizeTotalByObject(
  rawResponse: any,
  metricSpecs: MetricSpec[]
): Array<{ oid: number; values: Record<string, number> }> {
  const statsArray = rawResponse?.stats || rawResponse?.data?.stats || [];

  return statsArray.map((stat: any) => {
    const values: Record<string, number> = {};
    for (let i = 0; i < metricSpecs.length; i++) {
      const name = metricSpecs[i].name;
      values[name] = stat.values?.[i] ?? 0;
    }
    return { oid: stat.oid, values };
  });
}
