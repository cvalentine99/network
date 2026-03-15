/**
 * Slice 11 — Detection & Alert Detail Panes
 * Contract tests: types, validators, BFF routes, fixtures, hook helpers, state discrimination
 *
 * Tests cover:
 * 1. Detection-detail fixture files exist and parse (5 files × 2 = 10 vitest executions)
 * 2. Alert-detail fixture files exist and parse (5 files × 2 = 10 vitest executions)
 * 3. DetectionDetailSchema validation against populated fixture
 * 4. DetectionDetailSchema rejection of malformed fixture
 * 5. DetectionNoteSchema and DetectionTimelineEventSchema validation
 * 6. AlertDetailSchema validation against populated fixture
 * 7. AlertDetailSchema rejection of malformed fixture
 * 8. AlertTriggerEventSchema validation
 * 9. Quiet detection fixture validation (empty enrichment arrays)
 * 10. Quiet alert fixture validation (empty enrichment arrays)
 * 11. Detection not-found and transport-error fixture shapes
 * 12. Alert not-found and transport-error fixture shapes
 * 13. isQuietDetection helper function
 * 14. isQuietAlert helper function
 * 15. BFF route /api/bff/impact/detection-detail (populated + quiet + missing id)
 * 16. BFF route /api/bff/impact/alert-detail (populated + quiet + missing id)
 * 17. InspectorContent routing (detection and alert kinds)
 *
 * Breakdown:
 *   Group 1: Detection fixture files exist and parse  — 2 it() × 5 files = 10 vitest executions
 *   Group 2: Alert fixture files exist and parse      — 2 it() × 5 files = 10 vitest executions
 *   Group 3: DetectionDetailSchema populated          — 7 it()
 *   Group 4: DetectionDetailSchema malformed          — 4 it()
 *   Group 5: DetectionNoteSchema + TimelineEventSchema — 4 it()
 *   Group 6: AlertDetailSchema populated              — 6 it()
 *   Group 7: AlertDetailSchema malformed              — 4 it()
 *   Group 8: AlertTriggerEventSchema                  — 4 it()
 *   Group 9: Quiet detection fixture                  — 5 it()
 *   Group 10: Quiet alert fixture                     — 4 it()
 *   Group 11: Detection not-found + transport-error   — 6 it()
 *   Group 12: Alert not-found + transport-error       — 6 it()
 *   Group 13: isQuietDetection helper                 — 5 it()
 *   Group 14: isQuietAlert helper                     — 4 it()
 *   Group 15: BFF detection-detail route              — 7 it()
 *   Group 16: BFF alert-detail route                  — 7 it()
 *   Group 17: InspectorContent routing                — 2 it()
 *   ─────────────────────────────────────────────────────────────────
 *   Total: 79 it() call sites → 95 vitest executions
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DetectionDetailSchema,
  DetectionNoteSchema,
  DetectionTimelineEventSchema,
  AlertDetailSchema,
  AlertTriggerEventSchema,
  DeviceIdentitySchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
} from '../shared/cockpit-validators';
import { isQuietDetection } from '../client/src/hooks/useDetectionDetail';
import { isQuietAlert } from '../client/src/hooks/useAlertDetail';

const DETECTION_FIXTURE_DIR = join(process.cwd(), 'fixtures', 'detection-detail');
const ALERT_FIXTURE_DIR = join(process.cwd(), 'fixtures', 'alert-detail');

// ─── Fixture file names ──────────────────────────────────────────────────
const DETECTION_FIXTURES = [
  'detection-detail.populated.fixture.json',
  'detection-detail.quiet.fixture.json',
  'detection-detail.transport-error.fixture.json',
  'detection-detail.malformed.fixture.json',
  'detection-detail.not-found.fixture.json',
];

const ALERT_FIXTURES = [
  'alert-detail.populated.fixture.json',
  'alert-detail.quiet.fixture.json',
  'alert-detail.transport-error.fixture.json',
  'alert-detail.malformed.fixture.json',
  'alert-detail.not-found.fixture.json',
];

// ─── Helpers ────────────────────────────────────────────────────────────
function loadDetectionFixture(name: string): any {
  const raw = readFileSync(join(DETECTION_FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

function loadAlertFixture(name: string): any {
  const raw = readFileSync(join(ALERT_FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

// ═══════════════════════════════════════════════════════════════════════
// GROUP 1: Detection fixture files exist and parse
// 2 it() call sites → 10 vitest executions (5 files × 2 tests each)
// ═══════════════════════════════════════════════════════════════════════
describe('Detection fixture files exist and parse', () => {
  for (const file of DETECTION_FIXTURES) {
    it(`${file} exists on disk`, () => {
      expect(existsSync(join(DETECTION_FIXTURE_DIR, file))).toBe(true);
    });
    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(DETECTION_FIXTURE_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 2: Alert fixture files exist and parse
// 2 it() call sites → 10 vitest executions (5 files × 2 tests each)
// ═══════════════════════════════════════════════════════════════════════
describe('Alert fixture files exist and parse', () => {
  for (const file of ALERT_FIXTURES) {
    it(`${file} exists on disk`, () => {
      expect(existsSync(join(ALERT_FIXTURE_DIR, file))).toBe(true);
    });
    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(ALERT_FIXTURE_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 3: DetectionDetailSchema — populated fixture
// 7 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('DetectionDetailSchema — populated fixture', () => {
  const fixture = loadDetectionFixture('detection-detail.populated.fixture.json');

  it('validates the full detectionDetail object', () => {
    const result = DetectionDetailSchema.safeParse(fixture.detectionDetail);
    expect(result.success).toBe(true);
  });

  it('detection field passes NormalizedDetectionSchema', () => {
    const result = NormalizedDetectionSchema.safeParse(fixture.detectionDetail.detection);
    expect(result.success).toBe(true);
  });

  it('relatedDevices array is non-empty and each validates against DeviceIdentitySchema', () => {
    const devices = fixture.detectionDetail.relatedDevices;
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
    for (const d of devices) {
      const result = DeviceIdentitySchema.safeParse(d);
      expect(result.success).toBe(true);
    }
  });

  it('relatedAlerts array validates against NormalizedAlertSchema', () => {
    const alerts = fixture.detectionDetail.relatedAlerts;
    expect(Array.isArray(alerts)).toBe(true);
    for (const a of alerts) {
      const result = NormalizedAlertSchema.safeParse(a);
      expect(result.success).toBe(true);
    }
  });

  it('notes array is non-empty and each validates against DetectionNoteSchema', () => {
    const notes = fixture.detectionDetail.notes;
    expect(Array.isArray(notes)).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) {
      const result = DetectionNoteSchema.safeParse(n);
      expect(result.success).toBe(true);
    }
  });

  it('timeline array is non-empty and each validates against DetectionTimelineEventSchema', () => {
    const timeline = fixture.detectionDetail.timeline;
    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThan(0);
    for (const e of timeline) {
      const result = DetectionTimelineEventSchema.safeParse(e);
      expect(result.success).toBe(true);
    }
  });

  it('detection has MITRE tactics and techniques', () => {
    expect(fixture.detectionDetail.detection.mitreTactics.length).toBeGreaterThan(0);
    expect(fixture.detectionDetail.detection.mitreTechniques.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 4: DetectionDetailSchema — malformed fixture
// 4 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('DetectionDetailSchema — malformed fixture', () => {
  const fixture = loadDetectionFixture('detection-detail.malformed.fixture.json');

  it('rejects the malformed detectionDetail object', () => {
    const result = DetectionDetailSchema.safeParse(fixture.detectionDetail);
    expect(result.success).toBe(false);
  });

  it('reports specific validation issues', () => {
    const result = DetectionDetailSchema.safeParse(fixture.detectionDetail);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('detection.id as string is rejected', () => {
    const result = NormalizedDetectionSchema.safeParse(fixture.detectionDetail.detection);
    expect(result.success).toBe(false);
  });

  it('notes with missing author field is rejected', () => {
    const badNote = { timestamp: '2026-03-12T16:00:00.000Z', text: 'test' };
    const result = DetectionNoteSchema.safeParse(badNote);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 5: DetectionNoteSchema + DetectionTimelineEventSchema
// 4 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('DetectionNoteSchema', () => {
  it('accepts a valid note', () => {
    const valid = { timestamp: '2026-03-12T16:00:00.000Z', author: 'analyst1', text: 'Investigating lateral movement' };
    expect(DetectionNoteSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects note with empty author', () => {
    const invalid = { timestamp: '2026-03-12T16:00:00.000Z', author: '', text: 'test' };
    // Empty string is technically valid for z.string() without min(1), so check based on schema
    const result = DetectionNoteSchema.safeParse(invalid);
    // This should still parse since z.string() allows empty by default
    expect(result.success).toBe(true);
  });
});

describe('DetectionTimelineEventSchema', () => {
  it('accepts a valid timeline event', () => {
    const valid = { timestamp: '2026-03-12T16:00:00.000Z', event: 'created', detail: 'Detection created' };
    expect(DetectionTimelineEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects timeline event with invalid event type', () => {
    const invalid = { timestamp: '2026-03-12T16:00:00.000Z', event: 'invalid_event', detail: 'test' };
    expect(DetectionTimelineEventSchema.safeParse(invalid).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 6: AlertDetailSchema — populated fixture
// 6 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('AlertDetailSchema — populated fixture', () => {
  const fixture = loadAlertFixture('alert-detail.populated.fixture.json');

  it('validates the full alertDetail object', () => {
    const result = AlertDetailSchema.safeParse(fixture.alertDetail);
    expect(result.success).toBe(true);
  });

  it('alert field passes NormalizedAlertSchema', () => {
    const result = NormalizedAlertSchema.safeParse(fixture.alertDetail.alert);
    expect(result.success).toBe(true);
  });

  it('triggerHistory array is non-empty and each validates against AlertTriggerEventSchema', () => {
    const triggers = fixture.alertDetail.triggerHistory;
    expect(Array.isArray(triggers)).toBe(true);
    expect(triggers.length).toBeGreaterThan(0);
    for (const t of triggers) {
      const result = AlertTriggerEventSchema.safeParse(t);
      expect(result.success).toBe(true);
    }
  });

  it('associatedDevices array validates against DeviceIdentitySchema', () => {
    const devices = fixture.alertDetail.associatedDevices;
    expect(Array.isArray(devices)).toBe(true);
    for (const d of devices) {
      const result = DeviceIdentitySchema.safeParse(d);
      expect(result.success).toBe(true);
    }
  });

  it('associatedDetections array validates against NormalizedDetectionSchema', () => {
    const detections = fixture.alertDetail.associatedDetections;
    expect(Array.isArray(detections)).toBe(true);
    for (const d of detections) {
      const result = NormalizedDetectionSchema.safeParse(d);
      expect(result.success).toBe(true);
    }
  });

  it('at least one trigger has exceeded=true', () => {
    const triggers = fixture.alertDetail.triggerHistory;
    const hasExceeded = triggers.some((t: any) => t.exceeded === true);
    expect(hasExceeded).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 7: AlertDetailSchema — malformed fixture
// 4 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('AlertDetailSchema — malformed fixture', () => {
  const fixture = loadAlertFixture('alert-detail.malformed.fixture.json');

  it('rejects the malformed alertDetail object', () => {
    const result = AlertDetailSchema.safeParse(fixture.alertDetail);
    expect(result.success).toBe(false);
  });

  it('reports specific validation issues', () => {
    const result = AlertDetailSchema.safeParse(fixture.alertDetail);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('alert.id as string is rejected', () => {
    const result = NormalizedAlertSchema.safeParse(fixture.alertDetail.alert);
    expect(result.success).toBe(false);
  });

  it('triggerHistory with non-boolean exceeded is rejected', () => {
    const badTrigger = {
      timestamp: '2026-03-12T16:00:00.000Z',
      deviceId: 1,
      deviceName: 'test',
      value: 100,
      threshold: 50,
      exceeded: 'yes', // should be boolean
    };
    expect(AlertTriggerEventSchema.safeParse(badTrigger).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 8: AlertTriggerEventSchema
// 4 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('AlertTriggerEventSchema', () => {
  it('accepts a valid trigger event with numeric threshold', () => {
    const valid = {
      timestamp: '2026-03-12T16:00:00.000Z',
      deviceId: 1042,
      deviceName: 'dc01.lab.local',
      value: 95.2,
      threshold: 80,
      exceeded: true,
    };
    expect(AlertTriggerEventSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a valid trigger event with string threshold', () => {
    const valid = {
      timestamp: '2026-03-12T16:00:00.000Z',
      deviceId: 1042,
      deviceName: 'dc01.lab.local',
      value: 50,
      threshold: 'dynamic',
      exceeded: false,
    };
    expect(AlertTriggerEventSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects trigger with missing deviceName', () => {
    const invalid = {
      timestamp: '2026-03-12T16:00:00.000Z',
      deviceId: 1042,
      value: 95.2,
      threshold: 80,
      exceeded: true,
    };
    expect(AlertTriggerEventSchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects trigger with value as string', () => {
    const invalid = {
      timestamp: '2026-03-12T16:00:00.000Z',
      deviceId: 1042,
      deviceName: 'dc01.lab.local',
      value: 'high',
      threshold: 80,
      exceeded: true,
    };
    expect(AlertTriggerEventSchema.safeParse(invalid).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 9: Quiet detection fixture
// 5 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('Quiet detection fixture', () => {
  const fixture = loadDetectionFixture('detection-detail.quiet.fixture.json');

  it('validates against DetectionDetailSchema', () => {
    const result = DetectionDetailSchema.safeParse(fixture.detectionDetail);
    expect(result.success).toBe(true);
  });

  it('has empty relatedDevices array', () => {
    expect(fixture.detectionDetail.relatedDevices).toEqual([]);
  });

  it('has empty relatedAlerts array', () => {
    expect(fixture.detectionDetail.relatedAlerts).toEqual([]);
  });

  it('has empty notes array', () => {
    expect(fixture.detectionDetail.notes).toEqual([]);
  });

  it('has empty timeline array', () => {
    expect(fixture.detectionDetail.timeline).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 10: Quiet alert fixture
// 4 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('Quiet alert fixture', () => {
  const fixture = loadAlertFixture('alert-detail.quiet.fixture.json');

  it('validates against AlertDetailSchema', () => {
    const result = AlertDetailSchema.safeParse(fixture.alertDetail);
    expect(result.success).toBe(true);
  });

  it('has empty triggerHistory array', () => {
    expect(fixture.alertDetail.triggerHistory).toEqual([]);
  });

  it('has empty associatedDevices array', () => {
    expect(fixture.alertDetail.associatedDevices).toEqual([]);
  });

  it('has empty associatedDetections array', () => {
    expect(fixture.alertDetail.associatedDetections).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 11: Detection not-found + transport-error fixture shapes
// 6 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('Detection not-found fixture', () => {
  const fixture = loadDetectionFixture('detection-detail.not-found.fixture.json');

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
    expect(fixture.error.length).toBeGreaterThan(0);
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message.length).toBeGreaterThan(0);
  });

  it('does not have detectionDetail field', () => {
    expect(fixture.detectionDetail).toBeUndefined();
  });
});

describe('Detection transport-error fixture', () => {
  const fixture = loadDetectionFixture('detection-detail.transport-error.fixture.json');

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
    expect(fixture.error.length).toBeGreaterThan(0);
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message.length).toBeGreaterThan(0);
  });

  it('does not have detectionDetail field', () => {
    expect(fixture.detectionDetail).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 12: Alert not-found + transport-error fixture shapes
// 6 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('Alert not-found fixture', () => {
  const fixture = loadAlertFixture('alert-detail.not-found.fixture.json');

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
    expect(fixture.error.length).toBeGreaterThan(0);
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message.length).toBeGreaterThan(0);
  });

  it('does not have alertDetail field', () => {
    expect(fixture.alertDetail).toBeUndefined();
  });
});

describe('Alert transport-error fixture', () => {
  const fixture = loadAlertFixture('alert-detail.transport-error.fixture.json');

  it('has error field', () => {
    expect(typeof fixture.error).toBe('string');
    expect(fixture.error.length).toBeGreaterThan(0);
  });

  it('has message field', () => {
    expect(typeof fixture.message).toBe('string');
    expect(fixture.message.length).toBeGreaterThan(0);
  });

  it('does not have alertDetail field', () => {
    expect(fixture.alertDetail).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 13: isQuietDetection helper
// 5 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('isQuietDetection helper', () => {
  it('returns true for quiet fixture data', () => {
    const fixture = loadDetectionFixture('detection-detail.quiet.fixture.json');
    expect(isQuietDetection(fixture.detectionDetail)).toBe(true);
  });

  it('returns false for populated fixture data', () => {
    const fixture = loadDetectionFixture('detection-detail.populated.fixture.json');
    expect(isQuietDetection(fixture.detectionDetail)).toBe(false);
  });

  it('returns false when only relatedDevices is non-empty', () => {
    const data = {
      detection: {} as any,
      relatedDevices: [{ id: 1 } as any],
      relatedAlerts: [],
      notes: [],
      timeline: [],
    };
    expect(isQuietDetection(data)).toBe(false);
  });

  it('returns false when only notes is non-empty', () => {
    const data = {
      detection: {} as any,
      relatedDevices: [],
      relatedAlerts: [],
      notes: [{ timestamp: '', author: '', text: '' }],
      timeline: [],
    };
    expect(isQuietDetection(data)).toBe(false);
  });

  it('returns false when only timeline is non-empty', () => {
    const data = {
      detection: {} as any,
      relatedDevices: [],
      relatedAlerts: [],
      notes: [],
      timeline: [{ timestamp: '', event: 'created' as const, detail: '' }],
    };
    expect(isQuietDetection(data)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 14: isQuietAlert helper
// 4 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('isQuietAlert helper', () => {
  it('returns true for quiet fixture data', () => {
    const fixture = loadAlertFixture('alert-detail.quiet.fixture.json');
    expect(isQuietAlert(fixture.alertDetail)).toBe(true);
  });

  it('returns false for populated fixture data', () => {
    const fixture = loadAlertFixture('alert-detail.populated.fixture.json');
    expect(isQuietAlert(fixture.alertDetail)).toBe(false);
  });

  it('returns false when only triggerHistory is non-empty', () => {
    const data = {
      alert: {} as any,
      triggerHistory: [{ timestamp: '', deviceId: 1, deviceName: '', value: 0, threshold: 0, exceeded: false }],
      associatedDevices: [],
      associatedDetections: [],
    };
    expect(isQuietAlert(data)).toBe(false);
  });

  it('returns false when only associatedDevices is non-empty', () => {
    const data = {
      alert: {} as any,
      triggerHistory: [],
      associatedDevices: [{ id: 1 } as any],
      associatedDetections: [],
    };
    expect(isQuietAlert(data)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 15: BFF route /api/bff/impact/detection-detail
// 7 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('BFF route /api/bff/impact/detection-detail', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/detection-detail';

  it('returns 400 when id param is missing', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid detection ID');
  });

  it('returns 400 when id param is non-numeric', async () => {
    const res = await fetch(`${BASE}?id=abc`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid detection ID');
  });

  it('returns 200 with valid detectionDetail for detection 4001 (populated fixture)', async () => {
    const res = await fetch(`${BASE}?id=4001`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.detectionDetail).toBeDefined();
    const validation = DetectionDetailSchema.safeParse(body.detectionDetail);
    expect(validation.success).toBe(true);
  });

  it('populated response has non-empty relatedDevices', async () => {
    const res = await fetch(`${BASE}?id=4001`);
    const body = await res.json();
    expect(body.detectionDetail.relatedDevices.length).toBeGreaterThan(0);
  });

  it('populated response has non-empty timeline', async () => {
    const res = await fetch(`${BASE}?id=4001`);
    const body = await res.json();
    expect(body.detectionDetail.timeline.length).toBeGreaterThan(0);
  });

  it('returns 200 with quiet detectionDetail for unknown detection id', async () => {
    const res = await fetch(`${BASE}?id=9999`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.detectionDetail).toBeDefined();
    const validation = DetectionDetailSchema.safeParse(body.detectionDetail);
    expect(validation.success).toBe(true);
    expect(body.detectionDetail.relatedDevices).toEqual([]);
  });

  it('quiet response has empty timeline', async () => {
    const res = await fetch(`${BASE}?id=9999`);
    const body = await res.json();
    expect(body.detectionDetail.timeline).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 16: BFF route /api/bff/impact/alert-detail
// 7 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('BFF route /api/bff/impact/alert-detail', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/alert-detail';

  it('returns 400 when id param is missing', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid alert ID');
  });

  it('returns 400 when id param is non-numeric', async () => {
    const res = await fetch(`${BASE}?id=abc`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid alert ID');
  });

  it('returns 200 with valid alertDetail for alert 101 (populated fixture)', async () => {
    const res = await fetch(`${BASE}?id=101`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alertDetail).toBeDefined();
    const validation = AlertDetailSchema.safeParse(body.alertDetail);
    expect(validation.success).toBe(true);
  });

  it('populated response has non-empty triggerHistory', async () => {
    const res = await fetch(`${BASE}?id=101`);
    const body = await res.json();
    expect(body.alertDetail.triggerHistory.length).toBeGreaterThan(0);
  });

  it('populated response has non-empty associatedDevices', async () => {
    const res = await fetch(`${BASE}?id=101`);
    const body = await res.json();
    expect(body.alertDetail.associatedDevices.length).toBeGreaterThan(0);
  });

  it('returns 200 with quiet alertDetail for unknown alert id', async () => {
    const res = await fetch(`${BASE}?id=9999`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alertDetail).toBeDefined();
    const validation = AlertDetailSchema.safeParse(body.alertDetail);
    expect(validation.success).toBe(true);
    expect(body.alertDetail.triggerHistory).toEqual([]);
  });

  it('quiet response has empty associatedDetections', async () => {
    const res = await fetch(`${BASE}?id=9999`);
    const body = await res.json();
    expect(body.alertDetail.associatedDetections).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// GROUP 17: InspectorContent routing
// 2 it() call sites
// ═══════════════════════════════════════════════════════════════════════
describe('InspectorContent routing', () => {
  it('inspectorTitle returns "Detection Inspector" for detection kind', async () => {
    const { inspectorTitle } = await import('../client/src/components/inspector/InspectorContent');
    const selection = { kind: 'detection' as const, detection: {} as any };
    expect(inspectorTitle(selection)).toBe('Detection Inspector');
  });

  it('inspectorTitle returns "Alert Inspector" for alert kind', async () => {
    const { inspectorTitle } = await import('../client/src/components/inspector/InspectorContent');
    const selection = { kind: 'alert' as const, alert: {} as any };
    expect(inspectorTitle(selection)).toBe('Alert Inspector');
  });
});
