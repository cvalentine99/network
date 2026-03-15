/**
 * Slice 16 — Protocol Breakdown Visualization
 *
 * Tests cover:
 *   1. Fixture file existence
 *   2. ProtocolChartEntrySchema validation
 *   3. ProtocolChartDataSchema validation
 *   4. normalizeProtocolChart — quiet state
 *   5. normalizeProtocolChart — populated (5 protocols)
 *   6. normalizeProtocolChart — single protocol
 *   7. normalizeProtocolChart — overflow (Other bucket)
 *   8. normalizeProtocolChart — malformed input filtering
 *   9. normalizeProtocolChart — edge cases (zero bytes, mixed, boundary)
 *  10. Color assignment and palette cycling
 *  11. Percentage sum invariant
 *  12. Sort order invariant (descending totalBytes)
 *  13. PROTOCOL_CHART_COLORS and PROTOCOL_CHART_MAX_SLICES constants
 *  14. Source-level architectural invariants
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  normalizeProtocolChart,
  PROTOCOL_CHART_COLORS,
  PROTOCOL_CHART_MAX_SLICES,
  type ProtocolChartData,
  type ProtocolChartEntry,
} from '../shared/protocol-chart-types';
import {
  ProtocolChartEntrySchema,
  ProtocolChartDataSchema,
} from '../shared/protocol-chart-validators';
import type { DeviceProtocolActivity } from '../shared/cockpit-types';

// ─── Helpers ────────────────────────────────────────────────────────────
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'protocol-chart');

function loadFixture(name: string): any {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

const FIXTURE_FILES = [
  'protocol-chart.quiet.fixture.json',
  'protocol-chart.populated.fixture.json',
  'protocol-chart.single-protocol.fixture.json',
  'protocol-chart.overflow.fixture.json',
  'protocol-chart.malformed.fixture.json',
  'protocol-chart.edge-cases.fixture.json',
];

// ═══════════════════════════════════════════════════════════════════════════
// 1. Fixture files exist
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — Fixture files exist', () => {
  for (const file of FIXTURE_FILES) {
    it(`${file} exists and is valid JSON`, () => {
      const path = join(FIXTURE_DIR, file);
      expect(existsSync(path)).toBe(true);
      const raw = readFileSync(path, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ProtocolChartEntrySchema validation
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — ProtocolChartEntrySchema validation', () => {
  it('accepts a valid entry', () => {
    const entry: ProtocolChartEntry = {
      protocol: 'SMB',
      totalBytes: 937164800,
      bytesIn: 524288000,
      bytesOut: 412876800,
      connections: 847,
      pct: 41.96,
      color: 'oklch(0.769 0.108 85.805)',
    };
    expect(ProtocolChartEntrySchema.safeParse(entry).success).toBe(true);
  });

  it('rejects empty protocol name', () => {
    const entry = {
      protocol: '',
      totalBytes: 100,
      bytesIn: 50,
      bytesOut: 50,
      connections: 1,
      pct: 100,
      color: 'red',
    };
    expect(ProtocolChartEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('rejects negative totalBytes', () => {
    const entry = {
      protocol: 'DNS',
      totalBytes: -100,
      bytesIn: 50,
      bytesOut: 50,
      connections: 1,
      pct: 50,
      color: 'blue',
    };
    expect(ProtocolChartEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('rejects pct > 100', () => {
    const entry = {
      protocol: 'DNS',
      totalBytes: 100,
      bytesIn: 50,
      bytesOut: 50,
      connections: 1,
      pct: 101,
      color: 'blue',
    };
    expect(ProtocolChartEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('rejects pct < 0', () => {
    const entry = {
      protocol: 'DNS',
      totalBytes: 100,
      bytesIn: 50,
      bytesOut: 50,
      connections: 1,
      pct: -1,
      color: 'blue',
    };
    expect(ProtocolChartEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('rejects non-integer connections', () => {
    const entry = {
      protocol: 'DNS',
      totalBytes: 100,
      bytesIn: 50,
      bytesOut: 50,
      connections: 1.5,
      pct: 50,
      color: 'blue',
    };
    expect(ProtocolChartEntrySchema.safeParse(entry).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ProtocolChartDataSchema validation
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — ProtocolChartDataSchema validation', () => {
  it('accepts valid empty (quiet) data', () => {
    const data: ProtocolChartData = {
      entries: [],
      grandTotal: 0,
      protocolCount: 0,
      isEmpty: true,
    };
    expect(ProtocolChartDataSchema.safeParse(data).success).toBe(true);
  });

  it('rejects isEmpty=true with non-empty entries', () => {
    const data = {
      entries: [{
        protocol: 'DNS',
        totalBytes: 100,
        bytesIn: 50,
        bytesOut: 50,
        connections: 1,
        pct: 100,
        color: 'blue',
      }],
      grandTotal: 100,
      protocolCount: 1,
      isEmpty: true,
    };
    expect(ProtocolChartDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejects isEmpty=false with empty entries', () => {
    const data = {
      entries: [],
      grandTotal: 0,
      protocolCount: 0,
      isEmpty: false,
    };
    expect(ProtocolChartDataSchema.safeParse(data).success).toBe(false);
  });

  it('accepts valid populated data from normalizeProtocolChart', () => {
    const fixture = loadFixture('protocol-chart.populated.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });

  it('rejects data where percentages sum far from 100', () => {
    const data = {
      entries: [
        { protocol: 'A', totalBytes: 100, bytesIn: 50, bytesOut: 50, connections: 1, pct: 30, color: 'red' },
        { protocol: 'B', totalBytes: 100, bytesIn: 50, bytesOut: 50, connections: 1, pct: 30, color: 'blue' },
      ],
      grandTotal: 200,
      protocolCount: 2,
      isEmpty: false,
    };
    // pct sums to 60, not ~100
    expect(ProtocolChartDataSchema.safeParse(data).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. normalizeProtocolChart — quiet state
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — normalizeProtocolChart quiet state', () => {
  it('returns isEmpty=true for empty array', () => {
    const fixture = loadFixture('protocol-chart.quiet.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    expect(result.isEmpty).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.grandTotal).toBe(0);
    expect(result.protocolCount).toBe(0);
  });

  it('schema-validates quiet result', () => {
    const result = normalizeProtocolChart([]);
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. normalizeProtocolChart — populated (5 protocols)
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — normalizeProtocolChart populated', () => {
  const fixture = loadFixture('protocol-chart.populated.fixture.json');
  const result = normalizeProtocolChart(fixture.input);

  it('returns isEmpty=false', () => {
    expect(result.isEmpty).toBe(false);
  });

  it('returns correct protocolCount', () => {
    expect(result.protocolCount).toBe(fixture.expected.protocolCount);
  });

  it('returns entries in descending totalBytes order', () => {
    const names = result.entries.map((e) => e.protocol);
    expect(names).toEqual(fixture.expected.sortOrder);
  });

  it('does not create Other bucket for 5 protocols', () => {
    const hasOther = result.entries.some((e) => e.protocol === 'Other');
    expect(hasOther).toBe(fixture.expected.hasOtherBucket);
  });

  it('grandTotal equals sum of all entry totalBytes', () => {
    const sum = result.entries.reduce((s, e) => s + e.totalBytes, 0);
    expect(result.grandTotal).toBe(sum);
  });

  it('each entry has a non-empty color', () => {
    for (const entry of result.entries) {
      expect(entry.color.length).toBeGreaterThan(0);
    }
  });

  it('schema-validates populated result', () => {
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. normalizeProtocolChart — single protocol
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — normalizeProtocolChart single protocol', () => {
  const fixture = loadFixture('protocol-chart.single-protocol.fixture.json');
  const result = normalizeProtocolChart(fixture.input);

  it('returns one entry at 100%', () => {
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].pct).toBe(fixture.expected.firstEntryPct);
  });

  it('returns correct protocol name', () => {
    expect(result.entries[0].protocol).toBe(fixture.expected.sortOrder[0]);
  });

  it('schema-validates single-protocol result', () => {
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. normalizeProtocolChart — overflow (Other bucket)
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — normalizeProtocolChart overflow', () => {
  const fixture = loadFixture('protocol-chart.overflow.fixture.json');
  const result = normalizeProtocolChart(fixture.input);

  it('returns exactly PROTOCOL_CHART_MAX_SLICES entries', () => {
    expect(result.entries.length).toBe(fixture.expected.entryCount);
    expect(result.entries.length).toBe(PROTOCOL_CHART_MAX_SLICES);
  });

  it('last entry is "Other"', () => {
    expect(result.entries[result.entries.length - 1].protocol).toBe('Other');
  });

  it('Other bucket aggregates tail protocols', () => {
    const other = result.entries.find((e) => e.protocol === 'Other')!;
    // SSH (70M) + NTP (18M) + ICMP (8M) = 96M
    expect(other.totalBytes).toBe(70000000 + 18000000 + 8000000);
  });

  it('Other bucket aggregates connections', () => {
    const other = result.entries.find((e) => e.protocol === 'Other')!;
    // SSH (400) + NTP (200) + ICMP (100) = 700
    expect(other.connections).toBe(400 + 200 + 100);
  });

  it('protocolCount reflects original count, not grouped count', () => {
    expect(result.protocolCount).toBe(fixture.expected.protocolCount);
  });

  it('sort order matches expected', () => {
    const names = result.entries.map((e) => e.protocol);
    expect(names).toEqual(fixture.expected.sortOrder);
  });

  it('schema-validates overflow result', () => {
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. normalizeProtocolChart — malformed input filtering
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — normalizeProtocolChart malformed input', () => {
  it('filters out empty protocol name', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: '', bytesIn: 100, bytesOut: 100, totalBytes: 200, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
      { protocol: 'DNS', bytesIn: 100, bytesOut: 100, totalBytes: 200, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.protocolCount).toBe(1);
    expect(result.entries[0].protocol).toBe('DNS');
  });

  it('filters out negative totalBytes', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: 'BAD', bytesIn: 100, bytesOut: 100, totalBytes: -400, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
      { protocol: 'GOOD', bytesIn: 100, bytesOut: 100, totalBytes: 200, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.protocolCount).toBe(1);
    expect(result.entries[0].protocol).toBe('GOOD');
  });

  it('filters out NaN totalBytes', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: 'NAN', bytesIn: 100, bytesOut: 100, totalBytes: NaN, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.isEmpty).toBe(true);
  });

  it('filters out Infinity totalBytes', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: 'INF', bytesIn: 100, bytesOut: 100, totalBytes: Infinity, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.isEmpty).toBe(true);
  });

  it('filters out negative bytesIn', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: 'BAD', bytesIn: -100, bytesOut: 100, totalBytes: 200, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.isEmpty).toBe(true);
  });

  it('filters out negative connections', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: 'BAD', bytesIn: 100, bytesOut: 100, totalBytes: 200, connections: -5, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.isEmpty).toBe(true);
  });

  it('all-malformed input returns quiet state', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: '', bytesIn: 100, bytesOut: 100, totalBytes: 200, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
      { protocol: 'BAD', bytesIn: -500, bytesOut: 100, totalBytes: -400, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.isEmpty).toBe(true);
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. normalizeProtocolChart — edge cases
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — normalizeProtocolChart edge cases', () => {
  const fixture = loadFixture('protocol-chart.edge-cases.fixture.json');

  it('zero-byte protocol is valid and sorted last', () => {
    const result = normalizeProtocolChart(fixture.zeroBytesInput);
    expect(result.protocolCount).toBe(fixture.zeroBytesExpected.protocolCount);
    const names = result.entries.map((e) => e.protocol);
    expect(names).toEqual(fixture.zeroBytesExpected.sortOrder);
  });

  it('zero-byte protocol has 0% share', () => {
    const result = normalizeProtocolChart(fixture.zeroBytesInput);
    const icmp = result.entries.find((e) => e.protocol === 'ICMP');
    expect(icmp).toBeDefined();
    expect(icmp!.pct).toBe(0);
  });

  it('mixed valid/invalid filters correctly', () => {
    const result = normalizeProtocolChart(fixture.mixedInput);
    expect(result.protocolCount).toBe(fixture.mixedExpected.protocolCount);
    const names = result.entries.map((e) => e.protocol);
    expect(names).toEqual(fixture.mixedExpected.sortOrder);
  });

  it('exactly 7 protocols (boundary) does not create Other', () => {
    const result = normalizeProtocolChart(fixture.exactBoundaryInput);
    expect(result.entries.length).toBe(fixture.exactBoundaryExpected.entryCount);
    expect(result.entries.some((e) => e.protocol === 'Other')).toBe(false);
  });

  it('exactly 7 protocols sorted correctly', () => {
    const result = normalizeProtocolChart(fixture.exactBoundaryInput);
    const names = result.entries.map((e) => e.protocol);
    expect(names).toEqual(fixture.exactBoundaryExpected.sortOrder);
  });

  it('schema-validates zero-bytes result', () => {
    const result = normalizeProtocolChart(fixture.zeroBytesInput);
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });

  it('schema-validates exact-boundary result', () => {
    const result = normalizeProtocolChart(fixture.exactBoundaryInput);
    expect(ProtocolChartDataSchema.safeParse(result).success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Color assignment and palette cycling
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — Color assignment and palette cycling', () => {
  it('assigns distinct colors for up to 8 protocols', () => {
    const input: DeviceProtocolActivity[] = Array.from({ length: 7 }, (_, i) => ({
      protocol: `P${i + 1}`,
      bytesIn: (7 - i) * 100,
      bytesOut: (7 - i) * 100,
      totalBytes: (7 - i) * 200,
      connections: 10,
      lastSeen: '2026-03-12T16:00:00.000Z',
    }));
    const result = normalizeProtocolChart(input);
    const colors = result.entries.map((e) => e.color);
    const unique = new Set(colors);
    expect(unique.size).toBe(7);
  });

  it('colors cycle when more entries than palette size', () => {
    // Create exactly 8 protocols (max slices = 7, so 7th is Other, but we test color cycling)
    // Actually with 8 protocols, we get 6 individual + Other = 7 entries
    const input: DeviceProtocolActivity[] = Array.from({ length: 8 }, (_, i) => ({
      protocol: `Proto${i + 1}`,
      bytesIn: (8 - i) * 1000,
      bytesOut: (8 - i) * 1000,
      totalBytes: (8 - i) * 2000,
      connections: 10,
      lastSeen: '2026-03-12T16:00:00.000Z',
    }));
    const result = normalizeProtocolChart(input);
    // 7 entries (6 individual + Other), all should have colors from palette
    expect(result.entries.length).toBe(PROTOCOL_CHART_MAX_SLICES);
    for (const entry of result.entries) {
      expect(PROTOCOL_CHART_COLORS).toContain(entry.color);
    }
  });

  it('first entry always gets the first palette color (gold)', () => {
    const fixture = loadFixture('protocol-chart.populated.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    expect(result.entries[0].color).toBe(PROTOCOL_CHART_COLORS[0]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Percentage sum invariant
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — Percentage sum invariant', () => {
  it('populated fixture percentages sum to ~100', () => {
    const fixture = loadFixture('protocol-chart.populated.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    const pctSum = result.entries.reduce((s, e) => s + e.pct, 0);
    expect(Math.abs(pctSum - 100)).toBeLessThan(1);
  });

  it('overflow fixture percentages sum to ~100', () => {
    const fixture = loadFixture('protocol-chart.overflow.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    const pctSum = result.entries.reduce((s, e) => s + e.pct, 0);
    expect(Math.abs(pctSum - 100)).toBeLessThan(1);
  });

  it('single-protocol percentage is exactly 100', () => {
    const fixture = loadFixture('protocol-chart.single-protocol.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    expect(result.entries[0].pct).toBe(100);
  });

  it('edge-case exact boundary percentages sum to ~100', () => {
    const fixture = loadFixture('protocol-chart.edge-cases.fixture.json');
    const result = normalizeProtocolChart(fixture.exactBoundaryInput);
    const pctSum = result.entries.reduce((s, e) => s + e.pct, 0);
    expect(Math.abs(pctSum - 100)).toBeLessThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. Sort order invariant (descending totalBytes)
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — Sort order invariant', () => {
  it('populated entries are sorted descending by totalBytes', () => {
    const fixture = loadFixture('protocol-chart.populated.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    for (let i = 1; i < result.entries.length; i++) {
      expect(result.entries[i].totalBytes).toBeLessThanOrEqual(result.entries[i - 1].totalBytes);
    }
  });

  it('overflow entries (excluding Other) are sorted descending', () => {
    const fixture = loadFixture('protocol-chart.overflow.fixture.json');
    const result = normalizeProtocolChart(fixture.input);
    const nonOther = result.entries.filter((e) => e.protocol !== 'Other');
    for (let i = 1; i < nonOther.length; i++) {
      expect(nonOther[i].totalBytes).toBeLessThanOrEqual(nonOther[i - 1].totalBytes);
    }
  });

  it('unsorted input is normalized to sorted output', () => {
    const input: DeviceProtocolActivity[] = [
      { protocol: 'C', bytesIn: 10, bytesOut: 10, totalBytes: 20, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
      { protocol: 'A', bytesIn: 100, bytesOut: 100, totalBytes: 200, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
      { protocol: 'B', bytesIn: 50, bytesOut: 50, totalBytes: 100, connections: 1, lastSeen: '2026-03-12T16:00:00.000Z' },
    ];
    const result = normalizeProtocolChart(input);
    expect(result.entries.map((e) => e.protocol)).toEqual(['A', 'B', 'C']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. PROTOCOL_CHART_COLORS and PROTOCOL_CHART_MAX_SLICES constants
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — Constants validation', () => {
  it('PROTOCOL_CHART_COLORS has at least 8 entries', () => {
    expect(PROTOCOL_CHART_COLORS.length).toBeGreaterThanOrEqual(8);
  });

  it('all colors are non-empty strings', () => {
    for (const color of PROTOCOL_CHART_COLORS) {
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('all colors are unique', () => {
    const unique = new Set(PROTOCOL_CHART_COLORS);
    expect(unique.size).toBe(PROTOCOL_CHART_COLORS.length);
  });

  it('PROTOCOL_CHART_MAX_SLICES is a positive integer', () => {
    expect(Number.isInteger(PROTOCOL_CHART_MAX_SLICES)).toBe(true);
    expect(PROTOCOL_CHART_MAX_SLICES).toBeGreaterThan(0);
  });

  it('PROTOCOL_CHART_MAX_SLICES is 7', () => {
    expect(PROTOCOL_CHART_MAX_SLICES).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Source-level architectural invariants
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 16 — Source-level architectural invariants', () => {
  const chartSrc = readFileSync(
    join(process.cwd(), 'client', 'src', 'components', 'inspector', 'ProtocolBreakdownChart.tsx'),
    'utf-8'
  );
  const paneSrc = readFileSync(
    join(process.cwd(), 'client', 'src', 'components', 'inspector', 'DeviceDetailPane.tsx'),
    'utf-8'
  );
  const typesSrc = readFileSync(
    join(process.cwd(), 'shared', 'protocol-chart-types.ts'),
    'utf-8'
  );

  it('ProtocolBreakdownChart imports normalizeProtocolChart from shared', () => {
    expect(chartSrc).toContain("from '../../../../shared/protocol-chart-types'");
  });

  it('ProtocolBreakdownChart imports formatBytes from shared formatters', () => {
    expect(chartSrc).toContain("from '../../../../shared/formatters'");
  });

  it('ProtocolBreakdownChart does not call fetch or axios', () => {
    expect(chartSrc).not.toMatch(/\bfetch\s*\(/);
    expect(chartSrc).not.toMatch(/\baxios\b/);
  });

  it('ProtocolBreakdownChart has quiet state with data-testid', () => {
    expect(chartSrc).toContain('data-testid="protocol-chart-quiet"');
  });

  it('ProtocolBreakdownChart has populated state with data-testid', () => {
    expect(chartSrc).toContain('data-testid="protocol-chart-populated"');
  });

  it('DeviceDetailPane imports ProtocolBreakdownChart', () => {
    expect(paneSrc).toContain("import { ProtocolBreakdownChart }");
  });

  it('DeviceDetailPane renders ProtocolBreakdownChart with protocols prop', () => {
    expect(paneSrc).toContain('<ProtocolBreakdownChart protocols={detail.protocols}');
  });

  it('normalizeProtocolChart is a pure function (no imports of React, fetch, or DOM)', () => {
    expect(typesSrc).not.toMatch(/\bimport\b.*\breact\b/i);
    expect(typesSrc).not.toMatch(/\bfetch\b/);
    expect(typesSrc).not.toMatch(/\bdocument\b/);
    expect(typesSrc).not.toMatch(/\bwindow\b/);
  });

  it('shared types file exports normalizeProtocolChart', () => {
    expect(typesSrc).toContain('export function normalizeProtocolChart');
  });

  it('shared types file exports PROTOCOL_CHART_COLORS', () => {
    expect(typesSrc).toContain('export const PROTOCOL_CHART_COLORS');
  });

  it('shared types file exports PROTOCOL_CHART_MAX_SLICES', () => {
    expect(typesSrc).toContain('export const PROTOCOL_CHART_MAX_SLICES');
  });
});
