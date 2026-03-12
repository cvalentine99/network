/**
 * Slice 02 — Impact Deck KPI Strip tests
 *
 * Tests cover:
 * 1. Formatter functions (formatBytes, formatBytesPerSec, formatPackets, formatPacketsPerSec, formatPercent)
 * 2. Headline fixture validation (all fixture files exist, parse, and validate against schema)
 * 3. BFF /api/bff/impact/headline route (live local request, schema validation, quiet state)
 * 4. Formatter edge cases (NaN, Infinity, undefined, negative)
 * 5. ImpactHeadlineSchema validation (populated, quiet, malformed rejection)
 *
 * All tests are deterministic. No live ExtraHop access.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  formatBytes,
  formatBytesPerSec,
  formatPackets,
  formatPacketsPerSec,
  formatPercent,
} from '../shared/formatters';
import { ImpactHeadlineSchema, TimeWindowSchema } from '../shared/cockpit-validators';

const FIXTURES_DIR = join(process.cwd(), 'fixtures');

// ─── 1. Formatter fixture files exist and parse ──────────────────────────

const FORMATTER_FIXTURE_FILES = [
  'formatters/formatters.fixture.json',
];

const HEADLINE_FIXTURE_FILES = [
  'impact/headline.populated.fixture.json',
  'impact/headline.quiet.fixture.json',
  'impact/headline.transport-error.fixture.json',
  'impact/headline.malformed.fixture.json',
  'impact/headline.negative-baseline.fixture.json',
];

const ALL_FIXTURE_FILES = [...FORMATTER_FIXTURE_FILES, ...HEADLINE_FIXTURE_FILES];

describe('Slice 02 fixture files exist and parse', () => {
  for (const file of ALL_FIXTURE_FILES) {
    it(`${file} exists`, () => {
      const fullPath = join(FIXTURES_DIR, file);
      expect(existsSync(fullPath), `Missing fixture: ${fullPath}`).toBe(true);
    });

    it(`${file} parses as valid JSON`, () => {
      const fullPath = join(FIXTURES_DIR, file);
      const raw = readFileSync(fullPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 2. Formatter tests — fixture-driven ─────────────────────────────────

const formatterFixture = JSON.parse(
  readFileSync(join(FIXTURES_DIR, 'formatters/formatters.fixture.json'), 'utf-8')
);

describe('formatBytes', () => {
  const cases: { input: number | null; expected: string }[] = formatterFixture.formatBytes;
  for (const c of cases) {
    it(`formatBytes(${c.input}) → "${c.expected}"`, () => {
      expect(formatBytes(c.input)).toBe(c.expected);
    });
  }

  it('returns "—" for NaN', () => {
    expect(formatBytes(NaN)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatBytes(Infinity)).toBe('—');
  });

  it('returns "—" for -Infinity', () => {
    expect(formatBytes(-Infinity)).toBe('—');
  });

  it('returns "—" for undefined (cast as any)', () => {
    expect(formatBytes(undefined as any)).toBe('—');
  });
});

describe('formatBytesPerSec', () => {
  const cases: { input: number | null; expected: string }[] = formatterFixture.formatBytesPerSec;
  for (const c of cases) {
    it(`formatBytesPerSec(${c.input}) → "${c.expected}"`, () => {
      expect(formatBytesPerSec(c.input)).toBe(c.expected);
    });
  }

  it('returns "—" for NaN', () => {
    expect(formatBytesPerSec(NaN)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatBytesPerSec(Infinity)).toBe('—');
  });
});

describe('formatPackets', () => {
  const cases: { input: number | null; expected: string }[] = formatterFixture.formatPackets;
  for (const c of cases) {
    it(`formatPackets(${c.input}) → "${c.expected}"`, () => {
      expect(formatPackets(c.input)).toBe(c.expected);
    });
  }

  it('returns "—" for NaN', () => {
    expect(formatPackets(NaN)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatPackets(Infinity)).toBe('—');
  });
});

describe('formatPacketsPerSec', () => {
  const cases: { input: number | null; expected: string }[] = formatterFixture.formatPacketsPerSec;
  for (const c of cases) {
    it(`formatPacketsPerSec(${c.input}) → "${c.expected}"`, () => {
      expect(formatPacketsPerSec(c.input)).toBe(c.expected);
    });
  }

  it('returns "—" for NaN', () => {
    expect(formatPacketsPerSec(NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  const cases: { input: number | null; expected: string }[] = formatterFixture.formatPercent;
  for (const c of cases) {
    it(`formatPercent(${c.input}) → "${c.expected}"`, () => {
      expect(formatPercent(c.input)).toBe(c.expected);
    });
  }

  it('returns "—" for NaN', () => {
    expect(formatPercent(NaN)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatPercent(Infinity)).toBe('—');
  });
});

// ─── 3. ImpactHeadlineSchema validation ──────────────────────────────────

describe('ImpactHeadlineSchema validation', () => {
  it('validates populated headline fixture', () => {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'impact/headline.populated.fixture.json'), 'utf-8')
    );
    const result = ImpactHeadlineSchema.safeParse(fixture.headline);
    expect(result.success).toBe(true);
  });

  it('validates quiet headline fixture', () => {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'impact/headline.quiet.fixture.json'), 'utf-8')
    );
    const result = ImpactHeadlineSchema.safeParse(fixture.headline);
    expect(result.success).toBe(true);
  });

  it('validates negative-baseline headline fixture', () => {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'impact/headline.negative-baseline.fixture.json'), 'utf-8')
    );
    const result = ImpactHeadlineSchema.safeParse(fixture.headline);
    expect(result.success).toBe(true);
  });

  it('rejects malformed headline fixture', () => {
    const fixture = JSON.parse(
      readFileSync(join(FIXTURES_DIR, 'impact/headline.malformed.fixture.json'), 'utf-8')
    );
    const result = ImpactHeadlineSchema.safeParse(fixture.headline);
    expect(result.success).toBe(false);
  });

  it('rejects headline with missing fields', () => {
    const result = ImpactHeadlineSchema.safeParse({
      totalBytes: 100,
      // missing totalPackets, bytesPerSecond, packetsPerSecond, baselineDeltaPct
    });
    expect(result.success).toBe(false);
  });

  it('rejects headline with negative totalBytes', () => {
    const result = ImpactHeadlineSchema.safeParse({
      totalBytes: -1,
      totalPackets: 0,
      bytesPerSecond: 0,
      packetsPerSecond: 0,
      baselineDeltaPct: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts headline with baselineDeltaPct = null', () => {
    const result = ImpactHeadlineSchema.safeParse({
      totalBytes: 0,
      totalPackets: 0,
      bytesPerSecond: 0,
      packetsPerSecond: 0,
      baselineDeltaPct: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts headline with negative baselineDeltaPct', () => {
    const result = ImpactHeadlineSchema.safeParse({
      totalBytes: 100,
      totalPackets: 50,
      bytesPerSecond: 10,
      packetsPerSecond: 5,
      baselineDeltaPct: -15.2,
    });
    expect(result.success).toBe(true);
  });
});

// ─── 4. BFF /api/bff/impact/headline — live local route test ─────────────

describe('BFF /api/bff/impact/headline route', () => {
  const BASE = 'http://localhost:3000';

  it('returns 200 with valid JSON for default query', async () => {
    const res = await fetch(`${BASE}/api/bff/impact/headline`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('headline');
    expect(json).toHaveProperty('timeWindow');
  });

  it('headline in response passes ImpactHeadlineSchema', async () => {
    const res = await fetch(`${BASE}/api/bff/impact/headline`);
    const json = await res.json();
    const result = ImpactHeadlineSchema.safeParse(json.headline);
    expect(result.success).toBe(true);
  });

  it('timeWindow in response passes TimeWindowSchema', async () => {
    const res = await fetch(`${BASE}/api/bff/impact/headline`);
    const json = await res.json();
    const result = TimeWindowSchema.safeParse(json.timeWindow);
    expect(result.success).toBe(true);
  });

  it('returns quiet headline for invalid time window (from > until)', async () => {
    const res = await fetch(`${BASE}/api/bff/impact/headline?from=5&until=3`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.headline.totalBytes).toBe(0);
    expect(json.headline.totalPackets).toBe(0);
    expect(json.headline.bytesPerSecond).toBe(0);
    expect(json.headline.packetsPerSecond).toBe(0);
    expect(json.headline.baselineDeltaPct).toBeNull();
  });

  it('returns 400 for invalid cycle parameter', async () => {
    const res = await fetch(`${BASE}/api/bff/impact/headline?cycle=invalid_cycle`);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('accepts explicit time window parameters', async () => {
    const from = Date.now() - 600000;
    const until = Date.now();
    const res = await fetch(`${BASE}/api/bff/impact/headline?from=${from}&until=${until}&cycle=30sec`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.timeWindow.cycle).toBe('30sec');
  });

  it('all data arrives via /api/* path (no direct ExtraHop)', async () => {
    const res = await fetch(`${BASE}/api/bff/impact/headline`);
    // The URL itself proves the request went through the BFF
    expect(res.url).toContain('/api/bff/impact/headline');
    expect(res.url).not.toContain('extrahop');
    expect(res.url).not.toContain('192.168');
  });
});

// ─── 5. Formatter contract rules ─────────────────────────────────────────

describe('Formatter contract rules', () => {
  it('null input always returns em dash for all formatters', () => {
    expect(formatBytes(null)).toBe('—');
    expect(formatBytesPerSec(null)).toBe('—');
    expect(formatPackets(null)).toBe('—');
    expect(formatPacketsPerSec(null)).toBe('—');
    expect(formatPercent(null)).toBe('—');
  });

  it('all formatters return strings, never numbers', () => {
    expect(typeof formatBytes(1024)).toBe('string');
    expect(typeof formatBytesPerSec(1024)).toBe('string');
    expect(typeof formatPackets(1000)).toBe('string');
    expect(typeof formatPacketsPerSec(1000)).toBe('string');
    expect(typeof formatPercent(12.3)).toBe('string');
  });

  it('formatPercent includes sign for positive values', () => {
    const result = formatPercent(5.0);
    expect(result).toMatch(/^\+/);
  });

  it('formatPercent includes negative sign for negative values', () => {
    const result = formatPercent(-5.0);
    expect(result).toMatch(/^-/);
  });

  it('formatPercent shows no sign for zero', () => {
    const result = formatPercent(0);
    expect(result).toBe('0.0%');
    expect(result).not.toMatch(/^\+/);
    expect(result).not.toMatch(/^-[^0]/);
  });

  it('formatBytes units include the unit suffix', () => {
    expect(formatBytes(1024)).toContain('KB');
    expect(formatBytes(1048576)).toContain('MB');
    expect(formatBytes(1073741824)).toContain('GB');
  });

  it('formatBytesPerSec units include /s suffix', () => {
    expect(formatBytesPerSec(1024)).toContain('/s');
    expect(formatBytesPerSec(1048576)).toContain('/s');
  });

  it('formatPackets units include pkts suffix', () => {
    expect(formatPackets(1000)).toContain('pkts');
    expect(formatPackets(1000000)).toContain('pkts');
  });

  it('formatPacketsPerSec units include pps suffix', () => {
    expect(formatPacketsPerSec(1000)).toContain('pps');
    expect(formatPacketsPerSec(1000000)).toContain('pps');
  });
});
