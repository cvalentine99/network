/**
 * Slice 05 — Detections Panel Tests
 *
 * CONTRACT:
 * - All fixtures exist and parse as valid JSON
 * - Populated fixture passes NormalizedDetectionSchema for every detection
 * - Quiet fixture is an empty array
 * - Malformed fixture fails NormalizedDetectionSchema
 * - Edge-case fixture passes with zero risk score, empty MITRE arrays, null resolution
 * - riskScoreToSeverity maps correctly at all boundary values
 * - formatRelativeTime returns correct relative strings
 * - BFF route at /api/bff/impact/detections returns validated data
 * - BFF route returns quiet state for invalid time window
 *
 * Test count methodology:
 * - Each it() call site is counted as 1
 * - for loops over fixture arrays expand to N vitest-reported tests
 * - Both numbers are reported in the truth receipt
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { NormalizedDetectionSchema } from '../shared/cockpit-validators';

// ─── Import pure functions from DetectionsTable ─────────────────────────────
// These are exported pure functions, testable without DOM
import { riskScoreToSeverity, formatRelativeTime } from '../client/src/components/tables/DetectionsTable';

const FIXTURES_DIR = join(process.cwd(), 'fixtures', 'detections');

const FIXTURE_FILES = [
  'detections.populated.fixture.json',
  'detections.quiet.fixture.json',
  'detections.transport-error.fixture.json',
  'detections.malformed.fixture.json',
  'detections.edge-case.fixture.json',
];

// ─── Fixture Existence & Parse ──────────────────────────────────────────────
describe('Slice 05 — Fixture files exist and parse', () => {
  for (const file of FIXTURE_FILES) {
    it(`${file} exists`, () => {
      const fullPath = join(FIXTURES_DIR, file);
      expect(existsSync(fullPath)).toBe(true);
    });

    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(FIXTURES_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── Populated Fixture Schema Validation ────────────────────────────────────
describe('Slice 05 — Populated fixture schema validation', () => {
  const raw = readFileSync(join(FIXTURES_DIR, 'detections.populated.fixture.json'), 'utf-8');
  const fixture = JSON.parse(raw);
  const detections = fixture.detections as any[];

  it('has exactly 6 detections', () => {
    expect(detections.length).toBe(6);
  });

  for (const detection of detections) {
    it(`detection id=${detection.id} passes NormalizedDetectionSchema`, () => {
      const result = NormalizedDetectionSchema.safeParse(detection);
      expect(result.success).toBe(true);
    });
  }

  it('covers all 4 severity tiers', () => {
    const severities = detections.map(d => riskScoreToSeverity(d.riskScore));
    expect(severities).toContain('critical');
    expect(severities).toContain('high');
    expect(severities).toContain('medium');
    expect(severities).toContain('low');
  });

  it('has at least one detection with MITRE tactics', () => {
    const withTactics = detections.filter(d => d.mitreTactics.length > 0);
    expect(withTactics.length).toBeGreaterThan(0);
  });

  it('has at least one detection with MITRE techniques', () => {
    const withTechniques = detections.filter(d => d.mitreTechniques.length > 0);
    expect(withTechniques.length).toBeGreaterThan(0);
  });

  it('has at least one detection with empty MITRE arrays (DHCP anomaly)', () => {
    const noMitre = detections.filter(d => d.mitreTactics.length === 0 && d.mitreTechniques.length === 0);
    expect(noMitre.length).toBeGreaterThan(0);
  });

  it('all riskScores are non-negative numbers', () => {
    for (const d of detections) {
      expect(typeof d.riskScore).toBe('number');
      expect(d.riskScore).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Quiet Fixture ──────────────────────────────────────────────────────────
describe('Slice 05 — Quiet fixture', () => {
  const raw = readFileSync(join(FIXTURES_DIR, 'detections.quiet.fixture.json'), 'utf-8');
  const fixture = JSON.parse(raw);

  it('has detections as an empty array', () => {
    expect(fixture.detections).toEqual([]);
  });

  it('passes z.array(NormalizedDetectionSchema) validation', () => {
    const result = z.array(NormalizedDetectionSchema).safeParse(fixture.detections);
    expect(result.success).toBe(true);
  });
});

// ─── Malformed Fixture ──────────────────────────────────────────────────────
describe('Slice 05 — Malformed fixture rejection', () => {
  const raw = readFileSync(join(FIXTURES_DIR, 'detections.malformed.fixture.json'), 'utf-8');
  const fixture = JSON.parse(raw);

  it('has detections array', () => {
    expect(Array.isArray(fixture.detections)).toBe(true);
  });

  it('fails z.array(NormalizedDetectionSchema) validation', () => {
    const result = z.array(NormalizedDetectionSchema).safeParse(fixture.detections);
    expect(result.success).toBe(false);
  });

  for (const detection of fixture.detections) {
    it(`malformed detection id=${detection.id} fails NormalizedDetectionSchema individually`, () => {
      const result = NormalizedDetectionSchema.safeParse(detection);
      expect(result.success).toBe(false);
    });
  }
});

// ─── Edge-Case Fixture ──────────────────────────────────────────────────────
describe('Slice 05 — Edge-case fixture', () => {
  const raw = readFileSync(join(FIXTURES_DIR, 'detections.edge-case.fixture.json'), 'utf-8');
  const fixture = JSON.parse(raw);

  it('has exactly 1 detection', () => {
    expect(fixture.detections.length).toBe(1);
  });

  it('passes NormalizedDetectionSchema', () => {
    const result = NormalizedDetectionSchema.safeParse(fixture.detections[0]);
    expect(result.success).toBe(true);
  });

  it('has riskScore of 0', () => {
    expect(fixture.detections[0].riskScore).toBe(0);
  });

  it('has empty mitreTactics array', () => {
    expect(fixture.detections[0].mitreTactics).toEqual([]);
  });

  it('has empty mitreTechniques array', () => {
    expect(fixture.detections[0].mitreTechniques).toEqual([]);
  });

  it('has null resolution', () => {
    expect(fixture.detections[0].resolution).toBeNull();
  });

  it('has ipaddr-only participant (no object_id)', () => {
    const participant = fixture.detections[0].participants[0];
    expect(participant.object_type).toBe('ipaddr');
    expect(participant.ipaddr).toBeDefined();
    expect(participant.object_id).toBeUndefined();
  });
});

// ─── Transport Error Fixture ────────────────────────────────────────────────
describe('Slice 05 — Transport error fixture', () => {
  const raw = readFileSync(join(FIXTURES_DIR, 'detections.transport-error.fixture.json'), 'utf-8');
  const fixture = JSON.parse(raw);

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
  });
});

// ─── riskScoreToSeverity ────────────────────────────────────────────────────
describe('Slice 05 — riskScoreToSeverity mapping', () => {
  it('returns critical for score 80', () => {
    expect(riskScoreToSeverity(80)).toBe('critical');
  });

  it('returns critical for score 99', () => {
    expect(riskScoreToSeverity(99)).toBe('critical');
  });

  it('returns critical for score 100', () => {
    expect(riskScoreToSeverity(100)).toBe('critical');
  });

  it('returns high for score 60', () => {
    expect(riskScoreToSeverity(60)).toBe('high');
  });

  it('returns high for score 79', () => {
    expect(riskScoreToSeverity(79)).toBe('high');
  });

  it('returns medium for score 30', () => {
    expect(riskScoreToSeverity(30)).toBe('medium');
  });

  it('returns medium for score 59', () => {
    expect(riskScoreToSeverity(59)).toBe('medium');
  });

  it('returns low for score 29', () => {
    expect(riskScoreToSeverity(29)).toBe('low');
  });

  it('returns low for score 0', () => {
    expect(riskScoreToSeverity(0)).toBe('low');
  });

  it('returns low for score 1', () => {
    expect(riskScoreToSeverity(1)).toBe('low');
  });
});

// ─── formatRelativeTime ─────────────────────────────────────────────────────
describe('Slice 05 — formatRelativeTime', () => {
  it('returns "just now" for future timestamps', () => {
    const future = Date.now() + 60000;
    expect(formatRelativeTime(future)).toBe('just now');
  });

  it('returns seconds for < 60s ago', () => {
    const thirtySecsAgo = Date.now() - 30000;
    const result = formatRelativeTime(thirtySecsAgo);
    expect(result).toMatch(/^\d+s ago$/);
  });

  it('returns minutes for < 60min ago', () => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const result = formatRelativeTime(fiveMinAgo);
    expect(result).toMatch(/^\d+m ago$/);
  });

  it('returns hours for < 24h ago', () => {
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    const result = formatRelativeTime(threeHoursAgo);
    expect(result).toMatch(/^\d+h ago$/);
  });

  it('returns days for < 30d ago', () => {
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const result = formatRelativeTime(fiveDaysAgo);
    expect(result).toMatch(/^\d+d ago$/);
  });

  it('returns months for >= 30d ago', () => {
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const result = formatRelativeTime(sixtyDaysAgo);
    expect(result).toMatch(/^\d+mo ago$/);
  });
});

// ─── BFF Route Live Local Tests ─────────────────────────────────────────────
describe('Slice 05 — BFF /api/bff/impact/detections live local', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/detections';

  it('returns 200 with detections array and timeWindow', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.detections)).toBe(true);
    expect(body.timeWindow).toBeDefined();
    expect(typeof body.timeWindow.fromMs).toBe('number');
    expect(typeof body.timeWindow.untilMs).toBe('number');
  });

  it('returns 6 detections for default time window', async () => {
    const res = await fetch(BASE);
    const body = await res.json();
    expect(body.detections.length).toBe(6);
  });

  it('each detection passes NormalizedDetectionSchema', async () => {
    const res = await fetch(BASE);
    const body = await res.json();
    for (const d of body.detections) {
      const result = NormalizedDetectionSchema.safeParse(d);
      expect(result.success).toBe(true);
    }
  });

  it('returns empty detections for invalid time window (from > until)', async () => {
    const res = await fetch(`${BASE}?from=100&until=50`);
    const body = await res.json();
    expect(body.detections).toEqual([]);
  });

  it('returns 400 for invalid cycle value', async () => {
    const res = await fetch(`${BASE}?cycle=invalid`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
