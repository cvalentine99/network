/**
 * Slice 06 — Alerts Panel
 * Contract tests: BFF route, fixtures, schema validation, alertSeverityToLabel, state discrimination
 *
 * it() call sites and vitest execution counts are tracked precisely.
 * Dynamic expansion via for-loops is documented per describe block.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NormalizedAlertSchema } from '../shared/cockpit-validators';
import { alertSeverityToLabel } from '../client/src/components/tables/AlertsPanel';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'alerts');

// ─── Fixture file names ──────────────────────────────────────────────────
const FIXTURE_FILES = [
  'alerts.populated.fixture.json',
  'alerts.quiet.fixture.json',
  'alerts.transport-error.fixture.json',
  'alerts.malformed.fixture.json',
  'alerts.edge-case.fixture.json',
];

// ─── 1. Fixture files exist and parse ────────────────────────────────────
// 2 it() call sites → 10 vitest executions (5 files × 2 tests each via for-loop)
describe('Fixture files exist and parse', () => {
  for (const file of FIXTURE_FILES) {
    it(`${file} exists on disk`, () => {
      expect(existsSync(join(FIXTURE_DIR, file))).toBe(true);
    });
    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 2. Populated fixture schema validation ──────────────────────────────
// 8 it() call sites → 14 vitest executions (1 for-loop over 6 alerts = 6 + 8 static)
describe('Populated fixture schema validation', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'alerts.populated.fixture.json'), 'utf-8'));
  const alerts = raw.alerts;

  it('has an alerts array', () => {
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('contains exactly 6 alerts', () => {
    expect(alerts).toHaveLength(6);
  });

  for (const alert of alerts) {
    it(`alert "${alert.name}" (id=${alert.id}) passes NormalizedAlertSchema`, () => {
      const result = NormalizedAlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });
  }

  it('covers all 4 severity tiers', () => {
    const labels = new Set(alerts.map((a: any) => a.severityLabel));
    expect(labels).toEqual(new Set(['critical', 'high', 'medium', 'low']));
  });

  it('severity 0 maps to critical', () => {
    const s0 = alerts.find((a: any) => a.severity === 0);
    expect(s0).toBeDefined();
    expect(s0.severityLabel).toBe('critical');
  });

  it('severity 1 maps to critical', () => {
    const s1 = alerts.find((a: any) => a.severity === 1);
    expect(s1).toBeDefined();
    expect(s1.severityLabel).toBe('critical');
  });

  it('severity 2-3 maps to high', () => {
    const high = alerts.filter((a: any) => a.severityLabel === 'high');
    expect(high.length).toBe(2);
    expect(high.every((a: any) => a.severity >= 2 && a.severity <= 3)).toBe(true);
  });

  it('severity 7 maps to low (6+ = low)', () => {
    const s7 = alerts.find((a: any) => a.severity === 7);
    expect(s7).toBeDefined();
    expect(s7.severityLabel).toBe('low');
  });
});

// ─── 3. Quiet fixture ────────────────────────────────────────────────────
// 2 it() call sites → 2 vitest executions
describe('Quiet fixture', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'alerts.quiet.fixture.json'), 'utf-8'));

  it('has an alerts array', () => {
    expect(Array.isArray(raw.alerts)).toBe(true);
  });

  it('alerts array is empty', () => {
    expect(raw.alerts).toHaveLength(0);
  });
});

// ─── 4. Malformed fixture rejection ──────────────────────────────────────
// 3 it() call sites → 5 vitest executions (1 for-loop over 2 malformed alerts = 2 + 3 static)
describe('Malformed fixture rejection', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'alerts.malformed.fixture.json'), 'utf-8'));

  it('has an alerts array', () => {
    expect(Array.isArray(raw.alerts)).toBe(true);
  });

  it('contains 2 malformed entries', () => {
    expect(raw.alerts).toHaveLength(2);
  });

  for (const entry of raw.alerts) {
    it(`malformed entry id=${entry.id} fails NormalizedAlertSchema`, () => {
      const result = NormalizedAlertSchema.safeParse(entry);
      expect(result.success).toBe(false);
    });
  }
});

// ─── 5. Edge-case fixture ────────────────────────────────────────────────
// 7 it() call sites → 10 vitest executions (1 for-loop over 3 alerts = 3 + 7 static)
describe('Edge-case fixture', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'alerts.edge-case.fixture.json'), 'utf-8'));
  const alerts = raw.alerts;

  it('has 3 edge-case alerts', () => {
    expect(alerts).toHaveLength(3);
  });

  for (const alert of alerts) {
    it(`edge-case alert "${alert.name}" (id=${alert.id}) passes NormalizedAlertSchema`, () => {
      const result = NormalizedAlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });
  }

  it('alert 201 is disabled', () => {
    const a = alerts.find((a: any) => a.id === 201);
    expect(a.disabled).toBe(true);
  });

  it('alert 201 has null intervalLength and refireInterval', () => {
    const a = alerts.find((a: any) => a.id === 201);
    expect(a.intervalLength).toBeNull();
    expect(a.refireInterval).toBeNull();
  });

  it('alert 202 has string operand', () => {
    const a = alerts.find((a: any) => a.id === 202);
    expect(typeof a.operand).toBe('string');
    expect(a.operand).toBe('/admin.*');
  });

  it('alert 202 uses regex operator ~', () => {
    const a = alerts.find((a: any) => a.id === 202);
    expect(a.operator).toBe('~');
  });

  it('alert 203 has severity 6 (boundary for low)', () => {
    const a = alerts.find((a: any) => a.id === 203);
    expect(a.severity).toBe(6);
    expect(a.severityLabel).toBe('low');
  });
});

// ─── 6. Transport error fixture ──────────────────────────────────────────
// 2 it() call sites → 2 vitest executions
describe('Transport error fixture', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'alerts.transport-error.fixture.json'), 'utf-8'));

  it('has error field', () => {
    expect(raw.error).toBeDefined();
    expect(typeof raw.error).toBe('string');
  });

  it('has message field', () => {
    expect(raw.message).toBeDefined();
    expect(typeof raw.message).toBe('string');
  });
});

// ─── 7. alertSeverityToLabel mapping ─────────────────────────────────────
// 10 it() call sites → 10 vitest executions
describe('alertSeverityToLabel mapping', () => {
  it('severity 0 → critical', () => expect(alertSeverityToLabel(0)).toBe('critical'));
  it('severity 1 → critical', () => expect(alertSeverityToLabel(1)).toBe('critical'));
  it('severity 2 → high', () => expect(alertSeverityToLabel(2)).toBe('high'));
  it('severity 3 → high', () => expect(alertSeverityToLabel(3)).toBe('high'));
  it('severity 4 → medium', () => expect(alertSeverityToLabel(4)).toBe('medium'));
  it('severity 5 → medium', () => expect(alertSeverityToLabel(5)).toBe('medium'));
  it('severity 6 → low', () => expect(alertSeverityToLabel(6)).toBe('low'));
  it('severity 7 → low', () => expect(alertSeverityToLabel(7)).toBe('low'));
  it('severity 100 → low (any 6+ is low)', () => expect(alertSeverityToLabel(100)).toBe('low'));
  it('severity -1 → critical (negative treated as ≤1)', () => expect(alertSeverityToLabel(-1)).toBe('critical'));
});

// ─── 8. BFF route live local ─────────────────────────────────────────────
// 5 it() call sites → 5 vitest executions
describe('BFF route /api/bff/impact/alerts live local', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/alerts';

  it('returns HTTP 200', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(200);
  });

  it('returns JSON with alerts array', async () => {
    const res = await fetch(BASE);
    const body = await res.json();
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('returns timeWindow with required fields', async () => {
    const res = await fetch(BASE);
    const body = await res.json();
    expect(body.timeWindow).toBeDefined();
    expect(body.timeWindow.fromMs).toBeDefined();
    expect(body.timeWindow.untilMs).toBeDefined();
    expect(body.timeWindow.durationMs).toBeDefined();
    expect(body.timeWindow.cycle).toBeDefined();
  });

  it('returns 6 alerts in populated fixture mode', async () => {
    const res = await fetch(BASE);
    const body = await res.json();
    expect(body.alerts).toHaveLength(6);
  });

  it('returns empty alerts for invalid time window (from > until)', async () => {
    const res = await fetch(`${BASE}?from=9999999999999&until=1000000000000`);
    const body = await res.json();
    expect(body.alerts).toHaveLength(0);
  });
});

// ─── 9. Metric expression construction ───────────────────────────────────
// 4 it() call sites → 4 vitest executions
describe('Metric expression construction', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'alerts.populated.fixture.json'), 'utf-8'));
  const alerts = raw.alerts;

  it('alert 101 expression: statName fieldName operator operand (no fieldOp)', () => {
    const a = alerts.find((a: any) => a.id === 101);
    const expr = [a.statName, a.fieldName, a.fieldOp ? `(${a.fieldOp})` : null, a.operator, String(a.operand)]
      .filter(Boolean)
      .join(' ');
    expect(expr).toBe('extrahop.device.net pkts_dropped > 500');
  });

  it('alert 102 expression includes fieldOp in parens', () => {
    const a = alerts.find((a: any) => a.id === 102);
    const expr = [a.statName, a.fieldName, a.fieldOp ? `(${a.fieldOp})` : null, a.operator, String(a.operand)]
      .filter(Boolean)
      .join(' ');
    expect(expr).toBe('extrahop.device.dns_client rsp_time (mean) > 200');
  });

  it('alert 104 expression includes fieldOp and fieldName2', () => {
    const a = alerts.find((a: any) => a.id === 104);
    expect(a.fieldOp).toBe('count');
    expect(a.fieldName2).toBe('status_code');
  });

  it('alert 106 uses < operator', () => {
    const a = alerts.find((a: any) => a.id === 106);
    expect(a.operator).toBe('<');
    expect(a.operand).toBe(1024);
  });
});
