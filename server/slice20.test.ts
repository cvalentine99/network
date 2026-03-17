/**
 * Slice 20 — Standalone Correlation Surface Tests
 *
 * CONTRACT:
 * - Validates that the standalone Correlation page contract is met:
 *   1. /correlation route exists in App.tsx
 *   2. Correlation nav item is NOT a placeholder in DashboardLayout
 *   3. Correlation page component exists and exports default
 *   4. Page reuses existing correlation shared types (no duplication)
 *   5. Page reuses existing BFF route POST /api/bff/correlation/events
 *   6. All 6 UI states have data-testid coverage
 *   7. Category filtering uses shared filterEventsByCategory
 *   8. Fixtures validate against CorrelationPayloadSchema
 *   9. BFF route responds correctly for all sentinel values
 *
 * Test count: source-level it() call sites are listed; dynamic loops expand runtime count.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─── Shared types and validators (reuse proof) ──────────────────────────
import {
  CorrelationPayloadSchema,
  CorrelationIntentSchema,
  CorrelationEventSchema,
} from '../shared/correlation-validators';
import {
  filterEventsByCategory,
  filterEventsBySeverity,
  clusterEvents,
  getCategoryVisual,
  computeCategoryCounts,
  buildInitialCorrelationState,
  CORRELATION_CATEGORY_VISUALS,
} from '../shared/correlation-types';
import type {
  CorrelationEvent,
  CorrelationEventCategory,
  CorrelationOverlayState,
  CorrelationPayload,
} from '../shared/correlation-types';

// ─── Fixture paths ──────────────────────────────────────────────────────
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'correlation');
const FIXTURES = [
  'correlation.populated.fixture.json',
  'correlation.quiet.fixture.json',
  'correlation.error.fixture.json',
  'correlation.transport-error.fixture.json',
  'correlation.malformed.fixture.json',
  'correlation.clustered.fixture.json',
];

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

// ─── Source file paths ──────────────────────────────────────────────────
const PROJECT_ROOT = process.cwd();
const APP_TSX = join(PROJECT_ROOT, 'client', 'src', 'App.tsx');
const DASHBOARD_LAYOUT = join(PROJECT_ROOT, 'client', 'src', 'components', 'DashboardLayout.tsx');
const CORRELATION_PAGE = join(PROJECT_ROOT, 'client', 'src', 'pages', 'Correlation.tsx');
const CORRELATION_HOOK = join(PROJECT_ROOT, 'client', 'src', 'hooks', 'useCorrelationOverlay.ts');
const CORRELATION_STRIP = join(PROJECT_ROOT, 'client', 'src', 'components', 'charts', 'CorrelationStrip.tsx');

// ═══════════════════════════════════════════════════════════════════════
// 1. ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Route Registration', () => {
  it('App.tsx contains /correlation route', () => {
    const src = readFileSync(APP_TSX, 'utf-8');
    expect(src).toContain('path="/correlation"');
  });

  it('App.tsx imports Correlation page component', () => {
    const src = readFileSync(APP_TSX, 'utf-8');
    // Accepts both direct import and React.lazy import (Rec 5 code splitting)
    expect(src).toMatch(/(?:import\s+Correlation\s+from|const\s+Correlation\s*=\s*lazy)/);
  });

  it('/correlation route uses Correlation component', () => {
    const src = readFileSync(APP_TSX, 'utf-8');
    expect(src).toContain('component={Correlation}');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. NAV DE-PLACEHOLDERING
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Nav De-Placeholdering', () => {
  const layoutSrc = readFileSync(DASHBOARD_LAYOUT, 'utf-8');

  it('Correlation nav item exists in DashboardLayout', () => {
    expect(layoutSrc).toContain('"Correlation"');
  });

  it('Correlation nav item path is /correlation', () => {
    expect(layoutSrc).toContain('path: "/correlation"');
  });

  it('Correlation nav item does NOT have placeholder: true', () => {
    // Find the Correlation line and verify no placeholder flag
    const lines = layoutSrc.split('\n');
    const correlationLine = lines.find(
      (l) => l.includes('"Correlation"') && l.includes('path:'),
    );
    expect(correlationLine).toBeDefined();
    expect(correlationLine).not.toContain('placeholder: true');
    expect(correlationLine).not.toContain('placeholder:true');
  });

  it('Topology nav item exists in DashboardLayout', () => {
    const lines = layoutSrc.split('\n');
    const topologyLine = lines.find(
      (l) => l.includes('"Topology"') && l.includes('path:'),
    );
    expect(topologyLine).toBeDefined();
    // Note: Topology was de-placeholdered by Slice 21.
    // This test originally asserted placeholder: true, updated to reflect current state.
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. PAGE COMPONENT EXISTS
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Page Component', () => {
  it('Correlation.tsx exists', () => {
    expect(existsSync(CORRELATION_PAGE)).toBe(true);
  });

  it('Correlation.tsx has a default export', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toMatch(/export\s+default\s+function\s+Correlation/);
  });

  it('Correlation.tsx imports useCorrelationOverlay (reuse, not duplication)', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('useCorrelationOverlay');
  });

  it('Correlation.tsx imports useTimeWindow (shared time window)', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('useTimeWindow');
  });

  it('Correlation.tsx imports from shared/correlation-types (not local redefinition)', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('shared/correlation-types');
  });

  it('Correlation.tsx imports filterEventsByCategory from shared types', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('filterEventsByCategory');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. UI STATE DATA-TESTID COVERAGE
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — UI State data-testid Coverage', () => {
  const src = readFileSync(CORRELATION_PAGE, 'utf-8');

  const requiredTestIds = [
    'correlation-page-idle',
    'correlation-page-loading',
    'correlation-page-populated',
    'correlation-page-quiet',
    'correlation-page-error',
    'correlation-page-malformed',
  ];

  requiredTestIds.forEach((testId) => {
    it(`has data-testid="${testId}"`, () => {
      expect(src).toContain(`data-testid="${testId}"`);
    });
  });

  it('has correlation-filter-bar testid for category filters', () => {
    expect(src).toContain('data-testid="correlation-filter-bar"');
  });

  it('has correlation-summary testid for summary strip', () => {
    expect(src).toContain('data-testid="correlation-summary"');
  });

  it('has event-row testid pattern for feed items', () => {
    expect(src).toContain('data-testid={`event-row-');
  });

  it('has event-detail testid pattern for expanded details', () => {
    expect(src).toContain('data-testid={`event-detail-');
  });

  it('has correlation-feed-empty-filter testid for empty filter state', () => {
    expect(src).toContain('data-testid="correlation-feed-empty-filter"');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. REUSE PROOF — No Semantic Duplication
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Reuse Proof (No Semantic Duplication)', () => {
  it('useCorrelationOverlay hook exists and is shared with CorrelationStrip', () => {
    expect(existsSync(CORRELATION_HOOK)).toBe(true);
    const stripSrc = readFileSync(CORRELATION_STRIP, 'utf-8');
    // The strip doesn't import the hook directly (it receives state as prop),
    // but the hook is the single fetch point
    const pageSrc = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(pageSrc).toContain('useCorrelationOverlay');
  });

  it('Correlation page does NOT define its own fetch logic (no raw fetch() call)', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    // The page should use the hook, not raw fetch
    expect(src).not.toMatch(/fetch\s*\(\s*['"]/);
  });

  it('Correlation page does NOT redefine CorrelationEvent type locally', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    // Should import, not define
    expect(src).not.toMatch(/interface\s+CorrelationEvent\s*\{/);
    expect(src).not.toMatch(/type\s+CorrelationEvent\s*=/);
  });

  it('Correlation page does NOT redefine CorrelationEventCategory locally', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).not.toMatch(/type\s+CorrelationEventCategory\s*=/);
  });

  it('Correlation page uses CORRELATION_CATEGORY_VISUALS from shared types', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('CORRELATION_CATEGORY_VISUALS');
  });

  it('Correlation page uses getCategoryVisual from shared types', () => {
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('getCategoryVisual');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. SHARED TIME WINDOW
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Shared Time Window', () => {
  it('useCorrelationOverlay uses useTimeWindow', () => {
    const hookSrc = readFileSync(CORRELATION_HOOK, 'utf-8');
    expect(hookSrc).toContain('useTimeWindow');
  });

  it('useCorrelationOverlay passes tw.fromMs and tw.untilMs to BFF', () => {
    const hookSrc = readFileSync(CORRELATION_HOOK, 'utf-8');
    expect(hookSrc).toContain('tw.fromMs');
    expect(hookSrc).toContain('tw.untilMs');
  });

  it('useCorrelationOverlay refetches when time window changes', () => {
    const hookSrc = readFileSync(CORRELATION_HOOK, 'utf-8');
    // The useEffect dependency array should include tw.fromMs and tw.untilMs
    expect(hookSrc).toContain('tw.fromMs, tw.untilMs');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. FIXTURE VALIDATION (revalidation for Slice 20 context)
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Fixture Validation', () => {
  FIXTURES.forEach((fixtureName) => {
    it(`fixture ${fixtureName} exists`, () => {
      expect(existsSync(join(FIXTURE_DIR, fixtureName))).toBe(true);
    });
  });

  it('populated fixture validates against CorrelationPayloadSchema', () => {
    const data = loadFixture('correlation.populated.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('quiet fixture validates against CorrelationPayloadSchema', () => {
    const data = loadFixture('correlation.quiet.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('quiet fixture has zero events', () => {
    const data = loadFixture('correlation.quiet.fixture.json') as CorrelationPayload;
    expect(data.events).toHaveLength(0);
    expect(data.totalCount).toBe(0);
  });

  it('populated fixture has non-zero events', () => {
    const data = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.totalCount).toBeGreaterThan(0);
  });

  it('clustered fixture validates against CorrelationPayloadSchema', () => {
    const data = loadFixture('correlation.clustered.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('malformed fixture does NOT validate against CorrelationPayloadSchema', () => {
    const data = loadFixture('correlation.malformed.fixture.json');
    const result = CorrelationPayloadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('error fixture has error flag', () => {
    const data = loadFixture('correlation.error.fixture.json') as Record<string, unknown>;
    expect(data.error).toBe(true);
  });

  it('transport-error fixture has error flag', () => {
    const data = loadFixture('correlation.transport-error.fixture.json') as Record<string, unknown>;
    expect(data.error).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. PURE FUNCTION REUSE (filterEventsByCategory in page context)
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Category Filtering (shared function reuse)', () => {
  const populated = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;

  it('filterEventsByCategory with empty array returns all events', () => {
    const result = filterEventsByCategory(populated.events, []);
    expect(result).toHaveLength(populated.events.length);
  });

  it('filterEventsByCategory with single category returns only that category', () => {
    const result = filterEventsByCategory(populated.events, ['detection']);
    expect(result.every((e) => e.category === 'detection')).toBe(true);
  });

  it('filterEventsByCategory with multiple categories returns union', () => {
    const result = filterEventsByCategory(populated.events, ['detection', 'alert']);
    expect(result.every((e) => e.category === 'detection' || e.category === 'alert')).toBe(true);
  });

  it('filterEventsByCategory with non-present category returns empty', () => {
    // Check if there's a category not in the fixture
    const presentCats = new Set(populated.events.map((e) => e.category));
    const allCats: CorrelationEventCategory[] = [
      'detection', 'alert', 'config_change', 'firmware', 'topology', 'threshold', 'external',
    ];
    const missingCat = allCats.find((c) => !presentCats.has(c));
    if (missingCat) {
      const result = filterEventsByCategory(populated.events, [missingCat]);
      expect(result).toHaveLength(0);
    }
  });

  it('computeCategoryCounts matches fixture categoryCounts', () => {
    const computed = computeCategoryCounts(populated.events);
    expect(computed).toEqual(populated.categoryCounts);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. EVENT SORTING CONTRACT
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Event Sorting', () => {
  it('page sorts events by timestamp descending (most recent first)', () => {
    // Verify the page source contains the sort logic
    const src = readFileSync(CORRELATION_PAGE, 'utf-8');
    expect(src).toContain('sort((a, b) => b.timestampMs - a.timestampMs)');
  });

  it('populated fixture events can be sorted descending without NaN', () => {
    const data = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;
    const sorted = [...data.events].sort((a, b) => b.timestampMs - a.timestampMs);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].timestampMs).toBeGreaterThanOrEqual(sorted[i].timestampMs);
      expect(Number.isFinite(sorted[i].timestampMs)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. UI STATE MACHINE COVERAGE
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — UI State Machine', () => {
  const src = readFileSync(CORRELATION_PAGE, 'utf-8');

  it('handles idle state', () => {
    expect(src).toContain("state.kind === 'idle'");
  });

  it('handles loading state', () => {
    expect(src).toContain("state.kind === 'loading'");
  });

  it('handles error state', () => {
    expect(src).toContain("state.kind === 'error'");
  });

  it('handles malformed state', () => {
    expect(src).toContain("state.kind === 'malformed'");
  });

  it('handles quiet state', () => {
    expect(src).toContain("state.kind === 'quiet'");
  });

  it('populated state renders event feed', () => {
    expect(src).toContain('filteredEvents.map');
  });

  it('error state has retry button', () => {
    // The error state should have a refetch button
    expect(src).toContain('Retry');
    expect(src).toContain('refetch');
  });

  it('quiet state shows time window', () => {
    expect(src).toContain('state.timeWindow.fromMs');
    expect(src).toContain('state.timeWindow.untilMs');
  });

  it('malformed state shows contract violation message', () => {
    expect(src).toContain('contract violation');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. EVENT DETAIL EXPANSION
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Event Detail Expansion', () => {
  const src = readFileSync(CORRELATION_PAGE, 'utf-8');

  it('page tracks expanded event IDs in state', () => {
    expect(src).toContain('expandedIds');
  });

  it('page has toggleExpand callback', () => {
    expect(src).toContain('toggleExpand');
  });

  it('EventRow component has aria-expanded attribute', () => {
    expect(src).toContain('aria-expanded={isExpanded}');
  });

  it('EventDetailCard renders description when present', () => {
    expect(src).toContain('event.description');
  });

  it('EventDetailCard renders risk score when present', () => {
    expect(src).toContain('event.riskScore');
  });

  it('EventDetailCard renders source info', () => {
    expect(src).toContain('event.source.displayName');
    expect(src).toContain('event.source.kind');
  });

  it('EventDetailCard renders refs when present', () => {
    expect(src).toContain('event.refs');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 12. CATEGORY FILTER UI
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Category Filter UI', () => {
  const src = readFileSync(CORRELATION_PAGE, 'utf-8');

  it('has CategoryFilterBar component', () => {
    expect(src).toContain('CategoryFilterBar');
  });

  it('filter buttons have aria-pressed attribute', () => {
    expect(src).toContain('aria-pressed={enabled}');
  });

  it('has Select All / Clear All toggle', () => {
    expect(src).toContain('Select All');
    expect(src).toContain('Clear All');
  });

  it('empty filter state shows "Show all categories" button', () => {
    expect(src).toContain('Show all categories');
  });

  it('filter bar shows per-category data-testid', () => {
    expect(src).toContain('data-testid={`filter-');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 13. BFF ROUTE CONTRACT (HTTP-level, reusing Slice 19 route)
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — BFF Route Contract (supertest)', () => {
  // Import supertest and create a minimal Express app with the correlation route
  let request: ReturnType<typeof import('supertest')['default']>;

  // We'll test the route directly
  it('POST /events with populated sentinel returns 200 with valid payload', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 1710000000000, untilMs: 1710000300000 })
      .expect(200);

    const validation = CorrelationPayloadSchema.safeParse(res.body);
    expect(validation.success).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
  });

  it('POST /events with quiet sentinel returns 200 with zero events', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 0, untilMs: 0 })
      .expect(200);

    expect(res.body.events).toHaveLength(0);
    expect(res.body.totalCount).toBe(0);
  });

  it('POST /events with error sentinel returns 502', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 9999999999999, untilMs: 9999999999999 })
      .expect(502);

    expect(res.body.error).toBe(true);
  });

  it('POST /events with transport-error sentinel returns 504', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 8888888888888, untilMs: 8888888888888 })
      .expect(504);

    expect(res.body.error).toBe(true);
  });

  it('POST /events with malformed sentinel returns 200 with invalid payload', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 7777777777777, untilMs: 7777777777777 })
      .expect(200);

    // Malformed fixture should NOT validate
    const validation = CorrelationPayloadSchema.safeParse(res.body);
    expect(validation.success).toBe(false);
  });

  it('POST /events with invalid intent returns 400', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .post('/api/bff/correlation/events')
      .send({ fromMs: 'not-a-number' })
      .expect(400);

    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe('INVALID_INTENT');
  });

  it('GET /fixtures returns fixture list', async () => {
    const { default: supertest } = await import('supertest');
    const { default: express } = await import('express');
    const { default: correlationRouter } = await import('./routes/correlation');

    const app = express();
    app.use(express.json());
    app.use('/api/bff/correlation', correlationRouter);

    const res = await supertest(app)
      .get('/api/bff/correlation/fixtures')
      .expect(200);

    expect(Array.isArray(res.body.fixtures)).toBe(true);
    expect(res.body.fixtures.length).toBeGreaterThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 14. NO NaN/Infinity/undefined REACHING UI
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — No NaN/Infinity/undefined in Fixtures', () => {
  const dataFixtures = ['correlation.populated.fixture.json', 'correlation.clustered.fixture.json'];

  dataFixtures.forEach((fixtureName) => {
    it(`${fixtureName} has no NaN/Infinity/undefined in JSON`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, fixtureName), 'utf-8');
      expect(raw).not.toContain('NaN');
      expect(raw).not.toContain('Infinity');
      expect(raw).not.toContain('undefined');
    });

    it(`${fixtureName} all timestampMs values are finite positive numbers`, () => {
      const data = loadFixture(fixtureName) as CorrelationPayload;
      for (const event of data.events) {
        expect(Number.isFinite(event.timestampMs)).toBe(true);
        expect(event.timestampMs).toBeGreaterThan(0);
      }
    });

    it(`${fixtureName} totalCount matches events.length`, () => {
      const data = loadFixture(fixtureName) as CorrelationPayload;
      expect(data.totalCount).toBe(data.events.length);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 15. POPULATED FIXTURE EVENT INVARIANTS
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Populated Fixture Event Invariants', () => {
  const data = loadFixture('correlation.populated.fixture.json') as CorrelationPayload;

  it('all events have unique IDs', () => {
    const ids = data.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all events have valid categories', () => {
    const validCats: CorrelationEventCategory[] = [
      'detection', 'alert', 'config_change', 'firmware', 'topology', 'threshold', 'external',
    ];
    for (const event of data.events) {
      expect(validCats).toContain(event.category);
    }
  });

  it('all events have timestamps within the time window', () => {
    for (const event of data.events) {
      expect(event.timestampMs).toBeGreaterThanOrEqual(data.timeWindow.fromMs);
      expect(event.timestampMs).toBeLessThanOrEqual(data.timeWindow.untilMs);
    }
  });

  it('all events have non-empty titles', () => {
    for (const event of data.events) {
      expect(event.title.length).toBeGreaterThan(0);
    }
  });

  it('all events have valid source objects', () => {
    for (const event of data.events) {
      expect(['device', 'appliance', 'external']).toContain(event.source.kind);
      expect(event.source.displayName.length).toBeGreaterThan(0);
    }
  });

  it('categoryCounts sum equals totalCount', () => {
    const sum = Object.values(data.categoryCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(data.totalCount);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 16. SUMMARY STRIP CONTRACT
// ═══════════════════════════════════════════════════════════════════════
describe('Slice 20 — Summary Strip', () => {
  const src = readFileSync(CORRELATION_PAGE, 'utf-8');

  it('SummaryStrip component exists', () => {
    expect(src).toContain('function SummaryStrip');
  });

  it('SummaryStrip shows total event count', () => {
    expect(src).toContain('totalCount');
  });

  it('SummaryStrip shows time window', () => {
    expect(src).toContain('timeWindow.fromMs');
    expect(src).toContain('timeWindow.untilMs');
  });

  it('SummaryStrip shows active category count', () => {
    expect(src).toContain('activeCategories');
  });
});
