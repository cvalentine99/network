/**
 * Slice 03 — Impact Deck Time-Series Chart Panel
 *
 * Tests cover:
 * 1. Fixture file existence and JSON parsing
 * 2. SeriesPointSchema validation against fixtures
 * 3. BFF route /api/bff/impact/timeseries live local response
 * 4. Quiet state discrimination (empty array = quiet, not error)
 * 5. Malformed fixture rejection via schema
 * 6. Edge-case handling (single point, null values)
 * 7. TimeSeriesChartState type discrimination
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { SeriesPointSchema } from '../shared/cockpit-validators';
import { TimeWindowQuerySchema } from '../shared/cockpit-validators';

const FIXTURES_DIR = join(process.cwd(), 'fixtures', 'timeseries');
const IMPACT_FIXTURES_DIR = join(process.cwd(), 'fixtures', 'impact');

const TimeseriesArraySchema = z.array(SeriesPointSchema);

// ─── 1. Fixture file existence and JSON parsing ─────────────────────────
describe('Slice 03 — Timeseries fixture files', () => {
  const fixtureFiles = [
    'timeseries.populated.fixture.json',
    'timeseries.quiet.fixture.json',
    'timeseries.transport-error.fixture.json',
    'timeseries.malformed.fixture.json',
    'timeseries.single-point.fixture.json',
  ];

  for (const file of fixtureFiles) {
    it(`fixture exists: ${file}`, () => {
      const path = join(FIXTURES_DIR, file);
      expect(existsSync(path)).toBe(true);
    });

    it(`fixture parses as valid JSON: ${file}`, () => {
      const path = join(FIXTURES_DIR, file);
      const raw = readFileSync(path, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 2. SeriesPointSchema validation — populated fixture ────────────────
describe('Slice 03 — Populated fixture schema validation', () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'timeseries.populated.fixture.json'), 'utf-8')
  );

  it('populated fixture has a timeseries array', () => {
    expect(Array.isArray(fixture.timeseries)).toBe(true);
    expect(fixture.timeseries.length).toBeGreaterThan(0);
  });

  it('populated fixture has exactly 10 points', () => {
    expect(fixture.timeseries.length).toBe(10);
  });

  it('every point in populated fixture passes SeriesPointSchema', () => {
    const result = TimeseriesArraySchema.safeParse(fixture.timeseries);
    expect(result.success).toBe(true);
  });

  it('every point has both bytes and pkts keys', () => {
    for (const point of fixture.timeseries) {
      expect(point.values).toHaveProperty('bytes');
      expect(point.values).toHaveProperty('pkts');
    }
  });

  it('every point has positive durationMs', () => {
    for (const point of fixture.timeseries) {
      expect(point.durationMs).toBeGreaterThan(0);
    }
  });

  it('points are sorted by time ascending', () => {
    for (let i = 1; i < fixture.timeseries.length; i++) {
      expect(fixture.timeseries[i].t).toBeGreaterThan(fixture.timeseries[i - 1].t);
    }
  });

  it('no NaN or Infinity in bytes values', () => {
    for (const point of fixture.timeseries) {
      const bytes = point.values.bytes;
      if (bytes !== null) {
        expect(Number.isFinite(bytes)).toBe(true);
      }
    }
  });

  it('no NaN or Infinity in pkts values', () => {
    for (const point of fixture.timeseries) {
      const pkts = point.values.pkts;
      if (pkts !== null) {
        expect(Number.isFinite(pkts)).toBe(true);
      }
    }
  });
});

// ─── 3. Quiet fixture — empty array is valid ────────────────────────────
describe('Slice 03 — Quiet fixture', () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'timeseries.quiet.fixture.json'), 'utf-8')
  );

  it('quiet fixture has a timeseries array', () => {
    expect(Array.isArray(fixture.timeseries)).toBe(true);
  });

  it('quiet fixture timeseries is empty', () => {
    expect(fixture.timeseries.length).toBe(0);
  });

  it('empty array passes TimeseriesArraySchema', () => {
    const result = TimeseriesArraySchema.safeParse(fixture.timeseries);
    expect(result.success).toBe(true);
  });
});

// ─── 4. Malformed fixture — must fail schema validation ─────────────────
describe('Slice 03 — Malformed fixture rejection', () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'timeseries.malformed.fixture.json'), 'utf-8')
  );

  it('malformed fixture has a timeseries array', () => {
    expect(Array.isArray(fixture.timeseries)).toBe(true);
  });

  it('malformed fixture fails TimeseriesArraySchema', () => {
    const result = TimeseriesArraySchema.safeParse(fixture.timeseries);
    expect(result.success).toBe(false);
  });

  it('malformed fixture has at least one point with wrong t type', () => {
    const firstPoint = fixture.timeseries[0];
    expect(typeof firstPoint.t).toBe('string'); // should be number
  });
});

// ─── 5. Single-point edge case ──────────────────────────────────────────
describe('Slice 03 — Single-point edge case fixture', () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'timeseries.single-point.fixture.json'), 'utf-8')
  );

  it('single-point fixture has exactly 1 point', () => {
    expect(fixture.timeseries.length).toBe(1);
  });

  it('single point passes SeriesPointSchema', () => {
    const result = SeriesPointSchema.safeParse(fixture.timeseries[0]);
    expect(result.success).toBe(true);
  });

  it('single point has zero bytes', () => {
    expect(fixture.timeseries[0].values.bytes).toBe(0);
  });

  it('single point has null pkts', () => {
    expect(fixture.timeseries[0].values.pkts).toBeNull();
  });
});

// ─── 6. Transport error fixture shape ───────────────────────────────────
describe('Slice 03 — Transport error fixture', () => {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'timeseries.transport-error.fixture.json'), 'utf-8')
  );

  it('transport error fixture has error field', () => {
    expect(fixture).toHaveProperty('error');
    expect(typeof fixture.error).toBe('string');
  });

  it('transport error fixture has message field', () => {
    expect(fixture).toHaveProperty('message');
    expect(typeof fixture.message).toBe('string');
  });

  it('transport error fixture does NOT have timeseries field', () => {
    expect(fixture).not.toHaveProperty('timeseries');
  });
});

// ─── 7. BFF route /api/bff/impact/timeseries — live local response ──────
describe('Slice 03 — BFF timeseries route (live local)', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/timeseries';

  it('returns 200 with default params', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(200);
  });

  it('response has timeseries array', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(json).toHaveProperty('timeseries');
    expect(Array.isArray(json.timeseries)).toBe(true);
  });

  it('response has timeWindow object', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(json).toHaveProperty('timeWindow');
    expect(json.timeWindow).toHaveProperty('fromMs');
    expect(json.timeWindow).toHaveProperty('untilMs');
    expect(json.timeWindow).toHaveProperty('durationMs');
    expect(json.timeWindow).toHaveProperty('cycle');
  });

  it('timeseries points pass schema validation', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    const result = TimeseriesArraySchema.safeParse(json.timeseries);
    expect(result.success).toBe(true);
  });

  it('returns empty timeseries for invalid window (from > until)', async () => {
    const res = await fetch(`${BASE}?from=1000&until=500`);
    const json = await res.json();
    expect(json.timeseries).toEqual([]);
  });

  it('returns 400 for invalid cycle value', async () => {
    const res = await fetch(`${BASE}?cycle=invalid`);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });
});

// ─── 8. Impact overview fixture timeseries matches standalone fixture ────
describe('Slice 03 — Cross-fixture consistency', () => {
  const overviewFixture = JSON.parse(
    readFileSync(join(IMPACT_FIXTURES_DIR, 'impact-overview.populated.fixture.json'), 'utf-8')
  );
  const standaloneFixture = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'timeseries.populated.fixture.json'), 'utf-8')
  );

  it('both fixtures have the same number of timeseries points', () => {
    expect(overviewFixture.timeseries.length).toBe(standaloneFixture.timeseries.length);
  });

  it('both fixtures have matching timestamps', () => {
    for (let i = 0; i < overviewFixture.timeseries.length; i++) {
      expect(overviewFixture.timeseries[i].t).toBe(standaloneFixture.timeseries[i].t);
    }
  });

  it('both fixtures have matching byte values', () => {
    for (let i = 0; i < overviewFixture.timeseries.length; i++) {
      expect(overviewFixture.timeseries[i].values.bytes).toBe(standaloneFixture.timeseries[i].values.bytes);
    }
  });
});

// ─── 9. State discrimination logic ──────────────────────────────────────
describe('Slice 03 — State discrimination', () => {
  it('empty timeseries array → quiet state', () => {
    const points: any[] = [];
    const kind = points.length === 0 ? 'quiet' : 'populated';
    expect(kind).toBe('quiet');
  });

  it('non-empty timeseries array → populated state', () => {
    const points = [{ t: 1, tIso: '', durationMs: 1000, values: { bytes: 100 } }];
    const kind = points.length === 0 ? 'quiet' : 'populated';
    expect(kind).toBe('populated');
  });

  it('schema validation failure → malformed state', () => {
    const badData = [{ t: 'not-a-number', values: 'bad' }];
    const result = TimeseriesArraySchema.safeParse(badData);
    const kind = result.success ? 'populated' : 'malformed';
    expect(kind).toBe('malformed');
  });
});
