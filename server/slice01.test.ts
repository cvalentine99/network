/**
 * Slice 01 — Metrics Normalization Core
 * Tests for: resolveTimeWindow, bindMetricValues, computeRate, buildMetricSeries, computeActualCoverage
 *
 * All tests are deterministic. No network calls. No DOM. No side effects.
 * Fixtures are loaded from fixtures/normalization/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  resolveTimeWindow,
  bindMetricValues,
  computeRate,
  buildMetricSeries,
  computeActualCoverage,
} from '../shared/normalize';
import type { RawStatRow } from '../shared/normalize';
import type { MetricSpec, MetricSeries, SeriesPoint } from '../shared/cockpit-types';
import { SeriesPointSchema } from '../shared/cockpit-validators';

// ─── Fixture loader ──────────────────────────────────────────────────────
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'normalization');

function loadFixture<T = unknown>(name: string): T {
  const path = join(FIXTURE_DIR, name);
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

// ─── 0. Fixture files exist ──────────────────────────────────────────────
describe('Slice 01 fixture files exist and parse as valid JSON', () => {
  const fixtureFiles = [
    'bind-values.populated.fixture.json',
    'bind-values.nulls.fixture.json',
    'bind-values.key1-override.fixture.json',
    'compute-rate.fixture.json',
    'build-series.populated.fixture.json',
    'build-series.quiet.fixture.json',
    'build-series.poison-values.fixture.json',
    'coverage.fixture.json',
    'resolve-time-window.fixture.json',
  ];

  for (const file of fixtureFiles) {
    it(`${file} exists`, () => {
      expect(existsSync(join(FIXTURE_DIR, file))).toBe(true);
    });

    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 1. resolveTimeWindow ────────────────────────────────────────────────
describe('resolveTimeWindow', () => {
  const fixture = loadFixture<{
    anchor: number;
    cases: Array<{
      label: string;
      from: number;
      until?: number;
      cycle?: string;
      expectedFromMs: number;
      expectedUntilMs: number;
      expectedDurationMs: number;
      expectedCycle: string;
    }>;
  }>('resolve-time-window.fixture.json');

  for (const tc of fixture.cases) {
    it(tc.label, () => {
      const result = resolveTimeWindow(
        tc.from,
        tc.until,
        tc.cycle as any,
        fixture.anchor
      );
      expect(result.fromMs).toBe(tc.expectedFromMs);
      expect(result.untilMs).toBe(tc.expectedUntilMs);
      expect(result.durationMs).toBe(tc.expectedDurationMs);
      expect(result.cycle).toBe(tc.expectedCycle);
    });
  }

  it('never returns NaN in any field', () => {
    const result = resolveTimeWindow(-300000, undefined, 'auto', 1741795500000);
    expect(Number.isFinite(result.fromMs)).toBe(true);
    expect(Number.isFinite(result.untilMs)).toBe(true);
    expect(Number.isFinite(result.durationMs)).toBe(true);
  });

  it('returns a valid TimeWindow shape', () => {
    const result = resolveTimeWindow(-300000, undefined, 'auto', 1741795500000);
    expect(result).toHaveProperty('fromMs');
    expect(result).toHaveProperty('untilMs');
    expect(result).toHaveProperty('durationMs');
    expect(result).toHaveProperty('cycle');
    expect(typeof result.fromMs).toBe('number');
    expect(typeof result.untilMs).toBe('number');
    expect(typeof result.durationMs).toBe('number');
    expect(typeof result.cycle).toBe('string');
  });
});

// ─── 2. bindMetricValues ─────────────────────────────────────────────────
describe('bindMetricValues', () => {
  it('positionally binds all populated values', () => {
    const f = loadFixture<{
      specs: MetricSpec[];
      values: number[];
      expected: Record<string, number | null>;
    }>('bind-values.populated.fixture.json');
    const result = bindMetricValues(f.specs, f.values);
    expect(result).toEqual(f.expected);
  });

  it('preserves null in values[] as null in output', () => {
    const f = loadFixture<any>('bind-values.nulls.fixture.json');
    const result = bindMetricValues(f.specs, f.values_with_nulls);
    expect(result).toEqual(f.expected_with_nulls);
  });

  it('fills missing positions (short values array) with null', () => {
    const f = loadFixture<any>('bind-values.nulls.fixture.json');
    const result = bindMetricValues(f.specs, f.values_short);
    expect(result).toEqual(f.expected_short);
  });

  it('drops extra values beyond specs length', () => {
    const f = loadFixture<any>('bind-values.nulls.fixture.json');
    const result = bindMetricValues(f.specs, f.values_extra);
    expect(result).toEqual(f.expected_extra);
  });

  it('uses key1 as output key when present in spec', () => {
    const f = loadFixture<{
      specs: MetricSpec[];
      values: number[];
      expected: Record<string, number | null>;
    }>('bind-values.key1-override.fixture.json');
    const result = bindMetricValues(f.specs, f.values);
    expect(result).toEqual(f.expected);
  });

  it('sanitizes NaN to null', () => {
    const specs: MetricSpec[] = [{ name: 'bytes' }];
    const result = bindMetricValues(specs, [NaN]);
    expect(result.bytes).toBeNull();
  });

  it('sanitizes Infinity to null', () => {
    const specs: MetricSpec[] = [{ name: 'bytes' }];
    const result = bindMetricValues(specs, [Infinity]);
    expect(result.bytes).toBeNull();
  });

  it('sanitizes -Infinity to null', () => {
    const specs: MetricSpec[] = [{ name: 'bytes' }];
    const result = bindMetricValues(specs, [-Infinity]);
    expect(result.bytes).toBeNull();
  });

  it('sanitizes undefined to null', () => {
    const specs: MetricSpec[] = [{ name: 'bytes' }];
    const result = bindMetricValues(specs, [undefined]);
    expect(result.bytes).toBeNull();
  });

  it('handles empty specs and empty values', () => {
    const result = bindMetricValues([], []);
    expect(result).toEqual({});
  });

  it('handles empty specs with non-empty values', () => {
    const result = bindMetricValues([], [100, 200]);
    expect(result).toEqual({});
  });
});

// ─── 3. computeRate ──────────────────────────────────────────────────────
describe('computeRate', () => {
  const fixture = loadFixture<{
    cases: Array<{
      label: string;
      total: number | null;
      durationMs: number;
      expectedRate: number | null;
    }>;
  }>('compute-rate.fixture.json');

  for (const tc of fixture.cases) {
    it(tc.label, () => {
      const result = computeRate(tc.total, tc.durationMs);
      if (tc.expectedRate === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toBeCloseTo(tc.expectedRate, 5);
      }
    });
  }

  it('never returns NaN', () => {
    const result = computeRate(NaN, 30000);
    // NaN input is not null, but Number.isFinite(NaN) is false → should return null
    // Actually NaN == null is false, so it goes to the division path.
    // But NaN / 30 = NaN, which is caught by the isFinite check.
    expect(result).toBeNull();
  });

  it('never returns Infinity', () => {
    const result = computeRate(Infinity, 30000);
    expect(result).toBeNull();
  });

  it('returns 0 for zero total with valid duration', () => {
    const result = computeRate(0, 30000);
    expect(result).toBe(0);
  });
});

// ─── 4. buildMetricSeries ────────────────────────────────────────────────
describe('buildMetricSeries', () => {
  it('builds a populated series from fixture', () => {
    const f = loadFixture<any>('build-series.populated.fixture.json');
    const result = buildMetricSeries(
      f.objectType,
      f.objectId,
      f.cycle,
      f.fromMs,
      f.untilMs,
      f.specs,
      f.stats as RawStatRow[]
    );
    expect(result.points.length).toBe(f.expectedPointCount);
    expect(result.objectType).toBe(f.objectType);
    expect(result.objectId).toBe(f.objectId);
    expect(result.cycle).toBe(f.cycle);
    expect(result.fromMs).toBe(f.fromMs);
    expect(result.untilMs).toBe(f.untilMs);
    expect(result.points[0].values).toEqual(f.expectedFirstValues);
    expect(result.points[result.points.length - 1].values).toEqual(f.expectedLastValues);
  });

  it('returns empty points array for empty stats (quiet state)', () => {
    const f = loadFixture<any>('build-series.quiet.fixture.json');
    const result = buildMetricSeries(
      f.objectType,
      f.objectId,
      f.cycle,
      f.fromMs,
      f.untilMs,
      f.specs,
      f.stats as RawStatRow[]
    );
    expect(result.points.length).toBe(0);
    expect(result.objectType).toBe(f.objectType);
  });

  it('sanitizes NaN/Infinity/undefined in values to null', () => {
    // This test uses programmatic input since JSON cannot represent NaN/Infinity
    const specs: MetricSpec[] = [{ name: 'bytes_in' }, { name: 'bytes_out' }];
    const stats: RawStatRow[] = [
      { time: 1741795200000, duration: 1000, values: [NaN, 100] },
      { time: 1741795201000, duration: 1000, values: [200, Infinity] },
      { time: 1741795202000, duration: 1000, values: [undefined, 300] },
    ];
    const result = buildMetricSeries('device', 42, '1sec', 1741795200000, 1741795203000, specs, stats);

    expect(result.points[0].values).toEqual({ bytes_in: null, bytes_out: 100 });
    expect(result.points[1].values).toEqual({ bytes_in: 200, bytes_out: null });
    expect(result.points[2].values).toEqual({ bytes_in: null, bytes_out: 300 });
  });

  it('sorts points by time ascending regardless of input order', () => {
    const specs: MetricSpec[] = [{ name: 'bytes' }];
    const stats: RawStatRow[] = [
      { time: 1741795260000, duration: 30000, values: [300] },
      { time: 1741795200000, duration: 30000, values: [100] },
      { time: 1741795230000, duration: 30000, values: [200] },
    ];
    const result = buildMetricSeries('network', 1, '30sec', 1741795200000, 1741795290000, specs, stats);
    expect(result.points[0].t).toBe(1741795200000);
    expect(result.points[1].t).toBe(1741795230000);
    expect(result.points[2].t).toBe(1741795260000);
  });

  it('every output point has a valid tIso string', () => {
    const specs: MetricSpec[] = [{ name: 'bytes' }];
    const stats: RawStatRow[] = [
      { time: 1741795200000, duration: 30000, values: [100] },
    ];
    const result = buildMetricSeries('network', 1, '30sec', 1741795200000, 1741795230000, specs, stats);
    for (const point of result.points) {
      expect(typeof point.tIso).toBe('string');
      expect(new Date(point.tIso).getTime()).toBe(point.t);
    }
  });

  it('every output point passes SeriesPointSchema', () => {
    const f = loadFixture<any>('build-series.populated.fixture.json');
    const result = buildMetricSeries(
      f.objectType,
      f.objectId,
      f.cycle,
      f.fromMs,
      f.untilMs,
      f.specs,
      f.stats as RawStatRow[]
    );
    for (const point of result.points) {
      const validated = SeriesPointSchema.safeParse(point);
      if (!validated.success) {
        throw new Error(`SeriesPointSchema failed: ${JSON.stringify(validated.error.issues)}`);
      }
      expect(validated.success).toBe(true);
    }
  });

  it('no NaN or Infinity in any output value across all points', () => {
    const specs: MetricSpec[] = [{ name: 'a' }, { name: 'b' }];
    const stats: RawStatRow[] = [
      { time: 1741795200000, duration: 1000, values: [NaN, Infinity] },
      { time: 1741795201000, duration: 1000, values: [-Infinity, undefined] },
      { time: 1741795202000, duration: 1000, values: [100, 200] },
    ];
    const result = buildMetricSeries('device', 1, '1sec', 1741795200000, 1741795203000, specs, stats);
    for (const point of result.points) {
      for (const [key, val] of Object.entries(point.values)) {
        if (val !== null) {
          expect(Number.isFinite(val)).toBe(true);
        }
      }
    }
  });
});

// ─── 5. computeActualCoverage ────────────────────────────────────────────
describe('computeActualCoverage', () => {
  const fixture = loadFixture<{
    cases: Array<{
      label: string;
      fromMs: number;
      untilMs: number;
      points: Array<{ t: number; durationMs: number }>;
      expectedCoverage: number;
    }>;
  }>('coverage.fixture.json');

  for (const tc of fixture.cases) {
    it(tc.label, () => {
      // Build a minimal MetricSeries for the coverage function
      const series: MetricSeries = {
        objectType: 'network',
        objectId: 1,
        cycle: '30sec',
        fromMs: tc.fromMs,
        untilMs: tc.untilMs,
        points: tc.points.map((p) => ({
          t: p.t,
          tIso: new Date(p.t).toISOString(),
          durationMs: p.durationMs,
          values: {},
        })),
      };
      const result = computeActualCoverage(series);
      expect(result).toBeCloseTo(tc.expectedCoverage, 5);
    });
  }

  it('returns 0 for a series with negative window', () => {
    const series: MetricSeries = {
      objectType: 'network',
      objectId: 1,
      cycle: '30sec',
      fromMs: 1741795500000,
      untilMs: 1741795200000,
      points: [{ t: 1741795200000, tIso: '', durationMs: 30000, values: {} }],
    };
    expect(computeActualCoverage(series)).toBe(0);
  });

  it('clamps coverage to 1.0 for overlapping buckets', () => {
    // 60sec window, but 3 × 30sec buckets all within window = 90sec / 60sec = 1.5 → clamped to 1.0
    const series: MetricSeries = {
      objectType: 'network',
      objectId: 1,
      cycle: '30sec',
      fromMs: 1741795200000,
      untilMs: 1741795260000,
      points: [
        { t: 1741795200000, tIso: '', durationMs: 30000, values: {} },
        { t: 1741795210000, tIso: '', durationMs: 30000, values: {} },
        { t: 1741795230000, tIso: '', durationMs: 30000, values: {} },
      ],
    };
    expect(computeActualCoverage(series)).toBe(1.0);
  });

  it('integrates with buildMetricSeries output', () => {
    const f = loadFixture<any>('build-series.populated.fixture.json');
    const series = buildMetricSeries(
      f.objectType,
      f.objectId,
      f.cycle,
      f.fromMs,
      f.untilMs,
      f.specs,
      f.stats as RawStatRow[]
    );
    const coverage = computeActualCoverage(series);
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThanOrEqual(1.0);
    expect(Number.isFinite(coverage)).toBe(true);
  });

  it('quiet series from buildMetricSeries has 0 coverage', () => {
    const f = loadFixture<any>('build-series.quiet.fixture.json');
    const series = buildMetricSeries(
      f.objectType,
      f.objectId,
      f.cycle,
      f.fromMs,
      f.untilMs,
      f.specs,
      f.stats as RawStatRow[]
    );
    expect(computeActualCoverage(series)).toBe(0);
  });
});
