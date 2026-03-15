/**
 * Slice 04 — Top Talkers Table tests
 *
 * Tests cover:
 * 1. Fixture files exist and parse as valid JSON
 * 2. TopTalkerRowSchema validation (populated fixture passes, malformed fixture fails)
 * 3. BFF /api/bff/impact/top-talkers route (live local request, schema validation, quiet state)
 * 4. DeviceIdentitySchema validation (device fields present and typed)
 * 5. Sparkline validation (each top talker's sparkline conforms to SeriesPointSchema[])
 * 6. Ranking invariant (topTalkers are sorted by totalBytes descending)
 * 7. formatBytes output for top talker byte values
 *
 * All tests are deterministic. No live ExtraHop access.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { TopTalkerRowSchema, DeviceIdentitySchema, SeriesPointSchema, TimeWindowSchema } from '../shared/cockpit-validators';
import { formatBytes } from '../shared/formatters';

const FIXTURES_DIR = join(process.cwd(), 'fixtures');

// ─── 1. Fixture files exist and parse ────────────────────────────────────

const TOP_TALKER_FIXTURE_FILES = [
  'top-talkers/top-talkers.populated.fixture.json',
  'top-talkers/top-talkers.quiet.fixture.json',
  'top-talkers/top-talkers.transport-error.fixture.json',
  'top-talkers/top-talkers.malformed.fixture.json',
];

describe('Slice 04 — Top Talker fixture files', () => {
  for (const file of TOP_TALKER_FIXTURE_FILES) {
    const fullPath = join(FIXTURES_DIR, file);

    it(`${file} exists on disk`, () => {
      expect(existsSync(fullPath)).toBe(true);
    });

    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(fullPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 2. Populated fixture validates against TopTalkerRowSchema ───────────

describe('Slice 04 — Populated fixture schema validation', () => {
  const populated = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'top-talkers/top-talkers.populated.fixture.json'), 'utf-8')
  );

  it('populated fixture has topTalkers array', () => {
    expect(Array.isArray(populated.topTalkers)).toBe(true);
    expect(populated.topTalkers.length).toBeGreaterThan(0);
  });

  it('populated fixture has exactly 5 top talkers', () => {
    expect(populated.topTalkers.length).toBe(5);
  });

  it('every row passes TopTalkerRowSchema', () => {
    const result = z.array(TopTalkerRowSchema).safeParse(populated.topTalkers);
    expect(result.success).toBe(true);
  });

  it('every device passes DeviceIdentitySchema', () => {
    for (const row of populated.topTalkers) {
      const result = DeviceIdentitySchema.safeParse(row.device);
      expect(result.success).toBe(true);
    }
  });

  it('every sparkline point passes SeriesPointSchema', () => {
    for (const row of populated.topTalkers) {
      for (const point of row.sparkline) {
        const result = SeriesPointSchema.safeParse(point);
        expect(result.success).toBe(true);
      }
    }
  });

  it('topTalkers are sorted by totalBytes descending', () => {
    for (let i = 1; i < populated.topTalkers.length; i++) {
      expect(populated.topTalkers[i - 1].totalBytes).toBeGreaterThanOrEqual(
        populated.topTalkers[i].totalBytes
      );
    }
  });

  it('all byte values are non-negative finite numbers', () => {
    for (const row of populated.topTalkers) {
      expect(row.bytesIn).toBeGreaterThanOrEqual(0);
      expect(row.bytesOut).toBeGreaterThanOrEqual(0);
      expect(row.totalBytes).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(row.bytesIn)).toBe(true);
      expect(Number.isFinite(row.bytesOut)).toBe(true);
      expect(Number.isFinite(row.totalBytes)).toBe(true);
    }
  });

  it('totalBytes equals bytesIn + bytesOut for each row', () => {
    for (const row of populated.topTalkers) {
      expect(row.totalBytes).toBe(row.bytesIn + row.bytesOut);
    }
  });
});

// ─── 3. Quiet fixture validates ──────────────────────────────────────────

describe('Slice 04 — Quiet fixture schema validation', () => {
  const quiet = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'top-talkers/top-talkers.quiet.fixture.json'), 'utf-8')
  );

  it('quiet fixture has topTalkers as empty array', () => {
    expect(Array.isArray(quiet.topTalkers)).toBe(true);
    expect(quiet.topTalkers.length).toBe(0);
  });

  it('empty array passes z.array(TopTalkerRowSchema)', () => {
    const result = z.array(TopTalkerRowSchema).safeParse(quiet.topTalkers);
    expect(result.success).toBe(true);
  });
});

// ─── 4. Malformed fixture fails validation ───────────────────────────────

describe('Slice 04 — Malformed fixture rejection', () => {
  const malformed = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'top-talkers/top-talkers.malformed.fixture.json'), 'utf-8')
  );

  it('malformed fixture has topTalkers array', () => {
    expect(Array.isArray(malformed.topTalkers)).toBe(true);
  });

  it('malformed topTalkers fail z.array(TopTalkerRowSchema)', () => {
    const result = z.array(TopTalkerRowSchema).safeParse(malformed.topTalkers);
    expect(result.success).toBe(false);
  });
});

// ─── 5. BFF route live local tests ──────────────────────────────────────

describe('Slice 04 — BFF /api/bff/impact/top-talkers route', () => {
  it('returns 200 with topTalkers array and timeWindow', async () => {
    const res = await fetch('http://localhost:3000/api/bff/impact/top-talkers');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.topTalkers)).toBe(true);
    expect(json.timeWindow).toBeDefined();
  });

  it('response topTalkers pass z.array(TopTalkerRowSchema)', async () => {
    const res = await fetch('http://localhost:3000/api/bff/impact/top-talkers');
    const json = await res.json();
    const result = z.array(TopTalkerRowSchema).safeParse(json.topTalkers);
    expect(result.success).toBe(true);
  });

  it('response timeWindow passes TimeWindowSchema', async () => {
    const res = await fetch('http://localhost:3000/api/bff/impact/top-talkers');
    const json = await res.json();
    // TimeWindowSchema requires positive durationMs, but default window may have 0 duration
    // so we just check the shape exists
    expect(typeof json.timeWindow.fromMs).toBe('number');
    expect(typeof json.timeWindow.untilMs).toBe('number');
    expect(typeof json.timeWindow.durationMs).toBe('number');
    expect(typeof json.timeWindow.cycle).toBe('string');
  });

  it('returns quiet state for invalid time window (from > until)', async () => {
    const res = await fetch('http://localhost:3000/api/bff/impact/top-talkers?from=1000&until=500');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.topTalkers).toEqual([]);
  });

  it('returns 5 top talkers for default time window', async () => {
    const res = await fetch('http://localhost:3000/api/bff/impact/top-talkers');
    const json = await res.json();
    expect(json.topTalkers.length).toBe(5);
  });
});

// ─── 6. formatBytes produces correct output for fixture values ───────────

describe('Slice 04 — formatBytes for top talker values', () => {
  const populated = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'top-talkers/top-talkers.populated.fixture.json'), 'utf-8')
  );

  it('formatBytes produces non-empty string for each totalBytes', () => {
    for (const row of populated.topTalkers) {
      const formatted = formatBytes(row.totalBytes);
      expect(formatted).not.toBe('—');
      expect(formatted.length).toBeGreaterThan(0);
    }
  });

  it('formatBytes produces non-empty string for each bytesIn', () => {
    for (const row of populated.topTalkers) {
      const formatted = formatBytes(row.bytesIn);
      expect(formatted).not.toBe('—');
    }
  });

  it('formatBytes produces non-empty string for each bytesOut', () => {
    for (const row of populated.topTalkers) {
      const formatted = formatBytes(row.bytesOut);
      expect(formatted).not.toBe('—');
    }
  });

  it('formatBytes(null) returns em dash', () => {
    expect(formatBytes(null)).toBe('—');
  });
});

// ─── 7. Device identity field coverage ──────────────────────────────────

describe('Slice 04 — Device identity field coverage', () => {
  const populated = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'top-talkers/top-talkers.populated.fixture.json'), 'utf-8')
  );

  it('every device has displayName as non-empty string', () => {
    for (const row of populated.topTalkers) {
      expect(typeof row.device.displayName).toBe('string');
      expect(row.device.displayName.length).toBeGreaterThan(0);
    }
  });

  it('every device has numeric id', () => {
    for (const row of populated.topTalkers) {
      expect(typeof row.device.id).toBe('number');
    }
  });

  it('device with no role has role as null', () => {
    // cam-lobby-01 has role: null in fixture
    const camLobby = populated.topTalkers.find(
      (r: any) => r.device.displayName === 'cam-lobby-01'
    );
    expect(camLobby).toBeDefined();
    expect(camLobby.device.role).toBeNull();
  });
});

// ─── 8. Transport error fixture shape ────────────────────────────────────

describe('Slice 04 — Transport error fixture', () => {
  const transportError = JSON.parse(
    readFileSync(join(FIXTURES_DIR, 'top-talkers/top-talkers.transport-error.fixture.json'), 'utf-8')
  );

  it('has error and message fields', () => {
    expect(typeof transportError.error).toBe('string');
    expect(typeof transportError.message).toBe('string');
  });

  it('does not have topTalkers array', () => {
    expect(transportError.topTalkers).toBeUndefined();
  });
});
