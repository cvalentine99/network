/**
 * Slice 19 — Correlation Overlay: Comprehensive Test Suite
 *
 * CONTRACT:
 * - Tests shared types, Zod validators, pure functions, fixtures, and BFF route
 * - Every fixture is validated against the schema
 * - Malformed fixture is proven to FAIL validation
 * - Pure functions (clusterEvents, filterEventsByCategory, filterEventsBySeverity,
 *   computeCategoryCounts, getCategoryVisual, buildInitialCorrelationState) are tested
 * - BFF route is tested via supertest against a standalone Express app
 * - No live hardware required
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import express from 'express';
import request from 'supertest';

// ─── Shared types ─────────────────────────────────────────────────────────
import {
  CORRELATION_CATEGORY_VISUALS,
  getCategoryVisual,
  filterEventsByCategory,
  filterEventsBySeverity,
  clusterEvents,
  computeCategoryCounts,
  buildInitialCorrelationState,
} from '../shared/correlation-types';
import type {
  CorrelationEvent,
  CorrelationEventCategory,
  CorrelationPayload,
  CorrelationOverlayState,
} from '../shared/correlation-types';

// ─── Validators ───────────────────────────────────────────────────────────
import {
  CorrelationEventCategorySchema,
  SeveritySchema,
  CorrelationEventSchema,
  CorrelationPayloadSchema,
  CorrelationIntentSchema,
  CorrelationEventClusterSchema,
  CorrelationEventSourceSchema,
  CorrelationEventRefSchema,
} from '../shared/correlation-validators';

// ─── BFF route ────────────────────────────────────────────────────────────
import correlationRouter from './routes/correlation';

// ─── Fixture paths ────────────────────────────────────────────────────────
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'correlation');
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. ENUM SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — Enum schemas', () => {
  describe('CorrelationEventCategorySchema', () => {
    const validCategories = [
      'detection', 'alert', 'config_change', 'firmware',
      'topology', 'threshold', 'external',
    ];
    it.each(validCategories)('accepts "%s"', (cat) => {
      expect(CorrelationEventCategorySchema.safeParse(cat).success).toBe(true);
    });
    it.each(['invalid', '', 'DETECTION', 'Detection', 'unknown', null, undefined, 42])(
      'rejects %j',
      (val) => {
        expect(CorrelationEventCategorySchema.safeParse(val).success).toBe(false);
      },
    );
  });

  describe('SeveritySchema', () => {
    it.each(['low', 'medium', 'high', 'critical'])('accepts "%s"', (sev) => {
      expect(SeveritySchema.safeParse(sev).success).toBe(true);
    });
    it.each(['info', 'warning', 'CRITICAL', '', null, 0])('rejects %j', (val) => {
      expect(SeveritySchema.safeParse(val).success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. SUB-SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — Sub-schemas', () => {
  describe('CorrelationEventSourceSchema', () => {
    it('accepts valid device source', () => {
      expect(CorrelationEventSourceSchema.safeParse({
        kind: 'device', displayName: 'dc01.lab.local', id: 1042,
      }).success).toBe(true);
    });
    it('accepts valid appliance source', () => {
      expect(CorrelationEventSourceSchema.safeParse({
        kind: 'appliance', displayName: 'eda01', id: 1,
      }).success).toBe(true);
    });
    it('accepts external source with null id', () => {
      expect(CorrelationEventSourceSchema.safeParse({
        kind: 'external', displayName: 'NOC Scheduler', id: null,
      }).success).toBe(true);
    });
    it('rejects empty displayName', () => {
      expect(CorrelationEventSourceSchema.safeParse({
        kind: 'device', displayName: '', id: 1,
      }).success).toBe(false);
    });
    it('rejects invalid kind', () => {
      expect(CorrelationEventSourceSchema.safeParse({
        kind: 'unknown', displayName: 'test', id: 1,
      }).success).toBe(false);
    });
  });

  describe('CorrelationEventRefSchema', () => {
    it('accepts string id ref', () => {
      expect(CorrelationEventRefSchema.safeParse({
        kind: 'detection', id: 'det-4401', label: 'Detection #4401',
      }).success).toBe(true);
    });
    it('accepts numeric id ref', () => {
      expect(CorrelationEventRefSchema.safeParse({
        kind: 'device', id: 1042, label: 'dc01.lab.local',
      }).success).toBe(true);
    });
    it('rejects empty string id', () => {
      expect(CorrelationEventRefSchema.safeParse({
        kind: 'detection', id: '', label: 'test',
      }).success).toBe(false);
    });
    it('rejects empty label', () => {
      expect(CorrelationEventRefSchema.safeParse({
        kind: 'detection', id: 'det-1', label: '',
      }).success).toBe(false);
    });
    it('rejects invalid kind', () => {
      expect(CorrelationEventRefSchema.safeParse({
        kind: 'invalid', id: 'x', label: 'test',
      }).success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. CORRELATION EVENT SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — CorrelationEventSchema', () => {
  const validEvent: CorrelationEvent = {
    id: 'det-4401',
    category: 'detection',
    title: 'Lateral Movement via SMB',
    description: 'Test description',
    timestampMs: 1710000060000,
    timestampIso: '2024-03-09T16:01:00.000Z',
    durationMs: 45000,
    severity: 'critical',
    riskScore: 92,
    source: { kind: 'device', displayName: 'dc01.lab.local', id: 1042 },
    refs: [{ kind: 'detection', id: 'det-4401', label: 'Detection #4401' }],
  };

  it('accepts a valid event', () => {
    expect(CorrelationEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('accepts null severity', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, severity: null }).success).toBe(true);
  });

  it('accepts null riskScore', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, riskScore: null }).success).toBe(true);
  });

  it('accepts null description', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, description: null }).success).toBe(true);
  });

  it('accepts zero durationMs (point-in-time event)', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, durationMs: 0 }).success).toBe(true);
  });

  it('accepts empty refs array', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, refs: [] }).success).toBe(true);
  });

  it('rejects empty id', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, id: '' }).success).toBe(false);
  });

  it('rejects empty title', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, title: '' }).success).toBe(false);
  });

  it('rejects negative timestampMs', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, timestampMs: -1 }).success).toBe(false);
  });

  it('rejects NaN timestampMs', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, timestampMs: NaN }).success).toBe(false);
  });

  it('rejects Infinity timestampMs', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, timestampMs: Infinity }).success).toBe(false);
  });

  it('rejects negative durationMs', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, durationMs: -500 }).success).toBe(false);
  });

  it('rejects riskScore > 100', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, riskScore: 150 }).success).toBe(false);
  });

  it('rejects riskScore < 0', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, riskScore: -1 }).success).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, category: 'invalid' }).success).toBe(false);
  });

  it('rejects invalid severity', () => {
    expect(CorrelationEventSchema.safeParse({ ...validEvent, severity: 'unknown' }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. CORRELATION INTENT SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — CorrelationIntentSchema', () => {
  it('accepts valid intent with no filters', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000000000,
      untilMs: 1710000300000,
    }).success).toBe(true);
  });

  it('accepts intent with category filter', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000000000,
      untilMs: 1710000300000,
      categories: ['detection', 'alert'],
    }).success).toBe(true);
  });

  it('accepts intent with minSeverity', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000000000,
      untilMs: 1710000300000,
      minSeverity: 'high',
    }).success).toBe(true);
  });

  it('accepts equal fromMs and untilMs', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000000000,
      untilMs: 1710000000000,
    }).success).toBe(true);
  });

  it('rejects fromMs > untilMs', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000300000,
      untilMs: 1710000000000,
    }).success).toBe(false);
  });

  it('rejects negative fromMs', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: -1,
      untilMs: 1710000300000,
    }).success).toBe(false);
  });

  it('rejects invalid category in filter', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000000000,
      untilMs: 1710000300000,
      categories: ['invalid_cat'],
    }).success).toBe(false);
  });

  it('rejects invalid minSeverity', () => {
    expect(CorrelationIntentSchema.safeParse({
      fromMs: 1710000000000,
      untilMs: 1710000300000,
      minSeverity: 'unknown',
    }).success).toBe(false);
  });

  it('rejects missing fromMs', () => {
    expect(CorrelationIntentSchema.safeParse({
      untilMs: 1710000300000,
    }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. CORRELATION PAYLOAD SCHEMA TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — CorrelationPayloadSchema', () => {
  it('accepts the populated fixture', () => {
    const fixture = loadFixture('correlation.populated.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts the quiet fixture', () => {
    const fixture = loadFixture('correlation.quiet.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('accepts the clustered fixture', () => {
    const fixture = loadFixture('correlation.clustered.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  it('rejects the malformed fixture', () => {
    const fixture = loadFixture('correlation.malformed.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });

  it('rejects mismatched totalCount', () => {
    const fixture = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;
    const bad = { ...fixture, totalCount: 999 };
    const result = CorrelationPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects mismatched categoryCounts', () => {
    const fixture = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;
    const bad = {
      ...fixture,
      categoryCounts: { ...fixture.categoryCounts, detection: 99 },
    };
    const result = CorrelationPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects inverted time window', () => {
    const fixture = loadFixture('correlation.quiet.fixture.json') as CorrelationPayload;
    const bad = {
      ...fixture,
      timeWindow: { fromMs: 1710000300000, untilMs: 1710000000000 },
    };
    const result = CorrelationPayloadSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. FIXTURE VALIDATION — ALL FILES
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — Fixture file validation', () => {
  const fixtureFiles = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));

  it('has at least 6 fixture files', () => {
    expect(fixtureFiles.length).toBeGreaterThanOrEqual(6);
  });

  const payloadFixtures = fixtureFiles.filter(
    (f) => !f.includes('error') && !f.includes('transport') && !f.includes('malformed'),
  );

  it.each(payloadFixtures)('valid payload fixture: %s', (filename) => {
    const fixture = loadFixture(filename);
    const result = CorrelationPayloadSchema.safeParse(fixture);
    expect(result.success).toBe(true);
  });

  const errorFixtures = fixtureFiles.filter(
    (f) => f.includes('error') || f.includes('transport'),
  );

  it.each(errorFixtures)('error fixture has error/message/code: %s', (filename) => {
    const fixture = loadFixture(filename) as Record<string, unknown>;
    expect(fixture).toHaveProperty('error', true);
    expect(typeof fixture.message).toBe('string');
    expect(typeof fixture.code).toBe('string');
  });

  it('malformed fixture fails CorrelationPayloadSchema', () => {
    const fixture = loadFixture('correlation.malformed.fixture.json');
    expect(CorrelationPayloadSchema.safeParse(fixture).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. PURE FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — Pure functions', () => {
  const fixture = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;

  describe('getCategoryVisual', () => {
    it.each([
      'detection', 'alert', 'config_change', 'firmware',
      'topology', 'threshold', 'external',
    ] as CorrelationEventCategory[])('returns visual for "%s"', (cat) => {
      const visual = getCategoryVisual(cat);
      expect(visual.category).toBe(cat);
      expect(visual.color).toBeTruthy();
      expect(visual.label).toBeTruthy();
      expect(visual.iconHint).toBeTruthy();
    });

    it('falls back to external for unknown category', () => {
      const visual = getCategoryVisual('nonexistent' as CorrelationEventCategory);
      expect(visual.category).toBe('external');
    });
  });

  describe('CORRELATION_CATEGORY_VISUALS', () => {
    it('has 7 entries', () => {
      expect(CORRELATION_CATEGORY_VISUALS).toHaveLength(7);
    });

    it('all entries have unique categories', () => {
      const cats = CORRELATION_CATEGORY_VISUALS.map((v) => v.category);
      expect(new Set(cats).size).toBe(cats.length);
    });

    it('all entries have non-empty color, label, iconHint', () => {
      for (const v of CORRELATION_CATEGORY_VISUALS) {
        expect(v.color.length).toBeGreaterThan(0);
        expect(v.label.length).toBeGreaterThan(0);
        expect(v.iconHint.length).toBeGreaterThan(0);
      }
    });
  });

  describe('filterEventsByCategory', () => {
    it('returns all events when categories is empty', () => {
      const result = filterEventsByCategory(fixture.events, []);
      expect(result).toHaveLength(fixture.events.length);
    });

    it('filters to detection events only', () => {
      const result = filterEventsByCategory(fixture.events, ['detection']);
      expect(result.every((e) => e.category === 'detection')).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('filters to multiple categories', () => {
      const result = filterEventsByCategory(fixture.events, ['detection', 'alert']);
      expect(result.every((e) => ['detection', 'alert'].includes(e.category))).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('returns empty for non-matching category', () => {
      // Remove all events of a category that doesn't exist in fixture
      const result = filterEventsByCategory([], ['detection']);
      expect(result).toHaveLength(0);
    });
  });

  describe('filterEventsBySeverity', () => {
    it('filters to critical only', () => {
      const result = filterEventsBySeverity(fixture.events, 'critical');
      expect(result.every((e) => e.severity === 'critical')).toBe(true);
    });

    it('filters to high and above', () => {
      const result = filterEventsBySeverity(fixture.events, 'high');
      expect(result.every((e) => e.severity === 'high' || e.severity === 'critical')).toBe(true);
    });

    it('filters to medium and above', () => {
      const result = filterEventsBySeverity(fixture.events, 'medium');
      expect(
        result.every(
          (e) => e.severity === 'medium' || e.severity === 'high' || e.severity === 'critical',
        ),
      ).toBe(true);
    });

    it('excludes events with null severity', () => {
      const result = filterEventsBySeverity(fixture.events, 'low');
      expect(result.every((e) => e.severity !== null)).toBe(true);
    });

    it('returns empty for empty input', () => {
      expect(filterEventsBySeverity([], 'low')).toHaveLength(0);
    });
  });

  describe('computeCategoryCounts', () => {
    it('matches fixture categoryCounts', () => {
      const computed = computeCategoryCounts(fixture.events);
      expect(computed).toEqual(fixture.categoryCounts);
    });

    it('returns all zeros for empty array', () => {
      const computed = computeCategoryCounts([]);
      expect(Object.values(computed).every((v) => v === 0)).toBe(true);
    });

    it('counts correctly for single-category events', () => {
      const detections = fixture.events.filter((e) => e.category === 'detection');
      const computed = computeCategoryCounts(detections);
      expect(computed.detection).toBe(detections.length);
      expect(computed.alert).toBe(0);
    });
  });

  describe('buildInitialCorrelationState', () => {
    it('returns idle state', () => {
      const state = buildInitialCorrelationState();
      expect(state.kind).toBe('idle');
    });
  });

  describe('clusterEvents', () => {
    it('returns empty array for empty input', () => {
      expect(clusterEvents([], 5000)).toHaveLength(0);
    });

    it('creates single cluster for events within bucket', () => {
      const events = fixture.events.slice(0, 2); // first two events are 30s apart
      const clusters = clusterEvents(events, 60000); // 60s bucket
      expect(clusters).toHaveLength(1);
      expect(clusters[0].count).toBe(2);
      expect(clusters[0].events).toHaveLength(2);
    });

    it('creates separate clusters for distant events', () => {
      const clusters = clusterEvents(fixture.events, 1000); // 1s bucket
      // Events are 30s apart, so each should be its own cluster
      expect(clusters.length).toBe(fixture.events.length);
    });

    it('cluster has correct maxSeverity', () => {
      const clusters = clusterEvents(fixture.events, 300000); // one big bucket
      expect(clusters).toHaveLength(1);
      expect(clusters[0].maxSeverity).toBe('critical');
    });

    it('cluster has correct dominantCategory', () => {
      const clusters = clusterEvents(fixture.events, 300000);
      expect(clusters).toHaveLength(1);
      // detection appears 2x, all others 1x
      expect(clusters[0].dominantCategory).toBe('detection');
    });

    it('cluster timestampMs is midpoint', () => {
      const twoEvents: CorrelationEvent[] = [
        { ...fixture.events[0], timestampMs: 1000 },
        { ...fixture.events[1], timestampMs: 3000 },
      ];
      const clusters = clusterEvents(twoEvents, 5000);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].timestampMs).toBe(2000);
    });

    it('cluster validates against CorrelationEventClusterSchema', () => {
      const clusters = clusterEvents(fixture.events, 300000);
      for (const cluster of clusters) {
        const result = CorrelationEventClusterSchema.safeParse(cluster);
        expect(result.success).toBe(true);
      }
    });

    it('preserves all events across clusters', () => {
      const clusters = clusterEvents(fixture.events, 30000);
      const totalEvents = clusters.reduce((sum, c) => sum + c.count, 0);
      expect(totalEvents).toBe(fixture.events.length);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. CLUSTERED FIXTURE TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — Clustered fixture analysis', () => {
  const fixture = loadFixture('correlation.clustered.fixture.json') as CorrelationPayload;

  it('has 5 events', () => {
    expect(fixture.events).toHaveLength(5);
    expect(fixture.totalCount).toBe(5);
  });

  it('first 3 events are within 5s of each other (clusterable)', () => {
    const first3 = fixture.events.slice(0, 3);
    const range = Math.max(...first3.map((e) => e.timestampMs)) - Math.min(...first3.map((e) => e.timestampMs));
    expect(range).toBeLessThanOrEqual(5000);
  });

  it('last 2 events are within 5s of each other (clusterable)', () => {
    const last2 = fixture.events.slice(3, 5);
    const range = Math.max(...last2.map((e) => e.timestampMs)) - Math.min(...last2.map((e) => e.timestampMs));
    expect(range).toBeLessThanOrEqual(5000);
  });

  it('clusters into 2 groups with 10s bucket', () => {
    const clusters = clusterEvents(fixture.events, 10000);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(3);
    expect(clusters[1].count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. POPULATED FIXTURE INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — Populated fixture invariants', () => {
  const fixture = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;

  it('all events are within the time window', () => {
    for (const e of fixture.events) {
      expect(e.timestampMs).toBeGreaterThanOrEqual(fixture.timeWindow.fromMs);
      expect(e.timestampMs).toBeLessThanOrEqual(fixture.timeWindow.untilMs);
    }
  });

  it('all events have valid ISO timestamps', () => {
    for (const e of fixture.events) {
      const parsed = new Date(e.timestampIso);
      expect(parsed.getTime()).toBe(e.timestampMs);
    }
  });

  it('covers all 7 categories', () => {
    const cats = new Set(fixture.events.map((e) => e.category));
    expect(cats.size).toBe(7);
  });

  it('has at least one event with riskScore', () => {
    expect(fixture.events.some((e) => e.riskScore !== null)).toBe(true);
  });

  it('has at least one event with null severity', () => {
    expect(fixture.events.some((e) => e.severity === null)).toBe(true);
  });

  it('has at least one point-in-time event (durationMs=0)', () => {
    expect(fixture.events.some((e) => e.durationMs === 0)).toBe(true);
  });

  it('has at least one ranged event (durationMs>0)', () => {
    expect(fixture.events.some((e) => e.durationMs > 0)).toBe(true);
  });

  it('no NaN or Infinity in any numeric field', () => {
    for (const e of fixture.events) {
      expect(Number.isFinite(e.timestampMs)).toBe(true);
      expect(Number.isFinite(e.durationMs)).toBe(true);
      if (e.riskScore !== null) {
        expect(Number.isFinite(e.riskScore)).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. BFF ROUTE TESTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — BFF route: POST /api/bff/correlation/events', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/bff/correlation', correlationRouter);

  it('returns 200 with populated payload for valid intent', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 1710000000000, untilMs: 1710000300000 })
      .expect(200);
    expect(res.body.totalCount).toBe(8);
    expect(res.body.events).toHaveLength(8);
    expect(CorrelationPayloadSchema.safeParse(res.body).success).toBe(true);
  });

  it('returns 200 with quiet payload for sentinel (0,0)', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 0, untilMs: 0 })
      .expect(200);
    expect(res.body.totalCount).toBe(0);
    expect(res.body.events).toHaveLength(0);
  });

  it('returns 502 for error sentinel', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 9999999999999, untilMs: 9999999999999 })
      .expect(502);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('UPSTREAM_UNREACHABLE');
  });

  it('returns 504 for transport-error sentinel', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 8888888888888, untilMs: 8888888888888 })
      .expect(504);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('GATEWAY_TIMEOUT');
  });

  it('returns 200 with malformed data for malformed sentinel', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 7777777777777, untilMs: 7777777777777 })
      .expect(200);
    // The malformed fixture should fail schema validation
    expect(CorrelationPayloadSchema.safeParse(res.body).success).toBe(false);
  });

  it('returns 200 with clustered fixture when categories filter is provided', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({
        fromMs: 1710000000000,
        untilMs: 1710000300000,
        categories: ['detection', 'alert', 'config_change'],
      })
      .expect(200);
    expect(res.body.totalCount).toBe(5);
  });

  it('returns 400 for invalid intent (negative fromMs)', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: -1, untilMs: 1710000300000 })
      .expect(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('INVALID_INTENT');
  });

  it('returns 400 for invalid intent (missing untilMs)', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 1710000000000 })
      .expect(400);
    expect(res.body.error).toBe(true);
  });

  it('returns 400 for invalid intent (fromMs > untilMs)', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 1710000300000, untilMs: 1710000000000 })
      .expect(400);
    expect(res.body.error).toBe(true);
  });

  it('returns 400 for empty body', async () => {
    const res = await request(app)
      .post('/api/bff/correlation/events')
      .send({})
      .expect(400);
    expect(res.body.error).toBe(true);
  });
});

describe('Slice 19 — BFF route: GET /api/bff/correlation/fixtures', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/bff/correlation', correlationRouter);

  it('returns fixture list', async () => {
    const res = await request(app)
      .get('/api/bff/correlation/fixtures')
      .expect(200);
    expect(res.body.fixtures).toBeInstanceOf(Array);
    expect(res.body.fixtures.length).toBeGreaterThanOrEqual(6);
    expect(res.body.fixtures.every((f: string) => f.endsWith('.fixture.json'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. STATE MACHINE INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════
describe('Slice 19 — CorrelationOverlayState invariants', () => {
  it('idle state has kind "idle"', () => {
    const state: CorrelationOverlayState = { kind: 'idle' };
    expect(state.kind).toBe('idle');
  });

  it('loading state has kind "loading"', () => {
    const state: CorrelationOverlayState = { kind: 'loading' };
    expect(state.kind).toBe('loading');
  });

  it('quiet state has timeWindow', () => {
    const state: CorrelationOverlayState = {
      kind: 'quiet',
      timeWindow: { fromMs: 0, untilMs: 0 },
    };
    expect(state.kind).toBe('quiet');
    expect(state.timeWindow).toBeDefined();
  });

  it('populated state has payload', () => {
    const fixture = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;
    const state: CorrelationOverlayState = { kind: 'populated', payload: fixture };
    expect(state.kind).toBe('populated');
    expect(state.payload.events.length).toBeGreaterThan(0);
  });

  it('error state has message', () => {
    const state: CorrelationOverlayState = { kind: 'error', message: 'test error' };
    expect(state.kind).toBe('error');
    expect(state.message).toBe('test error');
  });

  it('malformed state has message', () => {
    const state: CorrelationOverlayState = { kind: 'malformed', message: 'bad data' };
    expect(state.kind).toBe('malformed');
    expect(state.message).toBe('bad data');
  });
});
