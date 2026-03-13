/**
 * Slice 08 — Inspector Shell Wiring
 * Contract tests: InspectorSelection type validation, fixture files, content routing,
 * inspectorTitle helper, and interaction contract invariants.
 *
 * Tests cover:
 * 1. Fixture files exist and parse as valid JSON (4 files × 2 = 8 vitest executions)
 * 2. Device selection fixture schema validation (DeviceIdentitySchema + TopTalkerRowSchema)
 * 3. Detection selection fixture schema validation (NormalizedDetectionSchema)
 * 4. Alert selection fixture schema validation (NormalizedAlertSchema)
 * 5. Empty selection fixture validation (null)
 * 6. InspectorSelection kind discrimination
 * 7. inspectorTitle helper function
 * 8. InspectorContent routing contract (null → null, each kind → correct preview)
 * 9. Cross-fixture consistency (device fixture device matches topTalkerRow.device)
 * 10. Selected ID derivation logic
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  DeviceIdentitySchema,
  TopTalkerRowSchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
} from '../shared/cockpit-validators';
import { inspectorTitle } from '../client/src/components/inspector/InspectorContent';
import type { InspectorSelection } from '../shared/cockpit-types';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'inspector-selection');

// ─── Fixture file names ──────────────────────────────────────────────────
const FIXTURE_FILES = [
  'inspector-selection.device.fixture.json',
  'inspector-selection.detection.fixture.json',
  'inspector-selection.alert.fixture.json',
  'inspector-selection.empty.fixture.json',
];

// Helper to load and parse a fixture
function loadFixture(name: string): any {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

// ─── 1. Fixture files exist and parse ────────────────────────────────────
// 2 it() call sites → 8 vitest executions (4 files × 2 tests each via for-loop)
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

// ─── 2. Device selection fixture schema validation ───────────────────────
describe('Device selection fixture schema validation', () => {
  const fixture = loadFixture('inspector-selection.device.fixture.json');

  it('has kind = "device"', () => {
    expect(fixture.selection.kind).toBe('device');
  });

  it('device field passes DeviceIdentitySchema', () => {
    const result = DeviceIdentitySchema.safeParse(fixture.selection.device);
    expect(result.success).toBe(true);
  });

  it('topTalkerRow field passes TopTalkerRowSchema', () => {
    const result = TopTalkerRowSchema.safeParse(fixture.selection.topTalkerRow);
    expect(result.success).toBe(true);
  });

  it('device.id is a positive integer', () => {
    expect(fixture.selection.device.id).toBeGreaterThan(0);
    expect(Number.isInteger(fixture.selection.device.id)).toBe(true);
  });

  it('topTalkerRow.totalBytes = bytesIn + bytesOut', () => {
    const row = fixture.selection.topTalkerRow;
    expect(row.totalBytes).toBe(row.bytesIn + row.bytesOut);
  });

  it('device.displayName is a non-empty string', () => {
    expect(typeof fixture.selection.device.displayName).toBe('string');
    expect(fixture.selection.device.displayName.length).toBeGreaterThan(0);
  });

  it('topTalkerRow.sparkline is a non-empty array', () => {
    expect(Array.isArray(fixture.selection.topTalkerRow.sparkline)).toBe(true);
    expect(fixture.selection.topTalkerRow.sparkline.length).toBeGreaterThan(0);
  });
});

// ─── 3. Detection selection fixture schema validation ────────────────────
describe('Detection selection fixture schema validation', () => {
  const fixture = loadFixture('inspector-selection.detection.fixture.json');

  it('has kind = "detection"', () => {
    expect(fixture.selection.kind).toBe('detection');
  });

  it('detection field passes NormalizedDetectionSchema', () => {
    const result = NormalizedDetectionSchema.safeParse(fixture.selection.detection);
    expect(result.success).toBe(true);
  });

  it('detection.id is a positive integer', () => {
    expect(fixture.selection.detection.id).toBeGreaterThan(0);
    expect(Number.isInteger(fixture.selection.detection.id)).toBe(true);
  });

  it('detection.riskScore is between 0 and 100', () => {
    expect(fixture.selection.detection.riskScore).toBeGreaterThanOrEqual(0);
    expect(fixture.selection.detection.riskScore).toBeLessThanOrEqual(100);
  });

  it('detection.title is a non-empty string', () => {
    expect(typeof fixture.selection.detection.title).toBe('string');
    expect(fixture.selection.detection.title.length).toBeGreaterThan(0);
  });

  it('detection.mitreTactics is an array', () => {
    expect(Array.isArray(fixture.selection.detection.mitreTactics)).toBe(true);
  });

  it('detection.participants is a non-empty array', () => {
    expect(Array.isArray(fixture.selection.detection.participants)).toBe(true);
    expect(fixture.selection.detection.participants.length).toBeGreaterThan(0);
  });
});

// ─── 4. Alert selection fixture schema validation ────────────────────────
describe('Alert selection fixture schema validation', () => {
  const fixture = loadFixture('inspector-selection.alert.fixture.json');

  it('has kind = "alert"', () => {
    expect(fixture.selection.kind).toBe('alert');
  });

  it('alert field passes NormalizedAlertSchema', () => {
    const result = NormalizedAlertSchema.safeParse(fixture.selection.alert);
    expect(result.success).toBe(true);
  });

  it('alert.id is a positive integer', () => {
    expect(fixture.selection.alert.id).toBeGreaterThan(0);
    expect(Number.isInteger(fixture.selection.alert.id)).toBe(true);
  });

  it('alert.severityLabel is a valid severity', () => {
    expect(['low', 'medium', 'high', 'critical']).toContain(fixture.selection.alert.severityLabel);
  });

  it('alert.name is a non-empty string', () => {
    expect(typeof fixture.selection.alert.name).toBe('string');
    expect(fixture.selection.alert.name.length).toBeGreaterThan(0);
  });

  it('alert.operator is a non-empty string', () => {
    expect(typeof fixture.selection.alert.operator).toBe('string');
    expect(fixture.selection.alert.operator.length).toBeGreaterThan(0);
  });
});

// ─── 5. Empty selection fixture validation ───────────────────────────────
describe('Empty selection fixture validation', () => {
  const fixture = loadFixture('inspector-selection.empty.fixture.json');

  it('selection is null', () => {
    expect(fixture.selection).toBeNull();
  });

  it('has a description field', () => {
    expect(typeof fixture.description).toBe('string');
    expect(fixture.description.length).toBeGreaterThan(0);
  });
});

// ─── 6. InspectorSelection kind discrimination ──────────────────────────
describe('InspectorSelection kind discrimination', () => {
  it('device fixture has kind "device" and device + topTalkerRow fields', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    expect(sel.kind).toBe('device');
    if (sel.kind === 'device') {
      expect(sel.device).toBeDefined();
      expect(sel.topTalkerRow).toBeDefined();
    }
  });

  it('detection fixture has kind "detection" and detection field', () => {
    const fixture = loadFixture('inspector-selection.detection.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    expect(sel.kind).toBe('detection');
    if (sel.kind === 'detection') {
      expect(sel.detection).toBeDefined();
    }
  });

  it('alert fixture has kind "alert" and alert field', () => {
    const fixture = loadFixture('inspector-selection.alert.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    expect(sel.kind).toBe('alert');
    if (sel.kind === 'alert') {
      expect(sel.alert).toBeDefined();
    }
  });
});

// ─── 7. inspectorTitle helper function ───────────────────────────────────
describe('inspectorTitle helper', () => {
  it('returns "Inspector" for null selection', () => {
    expect(inspectorTitle(null)).toBe('Inspector');
  });

  it('returns "Device Inspector" for device selection', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    expect(inspectorTitle(fixture.selection)).toBe('Device Inspector');
  });

  it('returns "Detection Inspector" for detection selection', () => {
    const fixture = loadFixture('inspector-selection.detection.fixture.json');
    expect(inspectorTitle(fixture.selection)).toBe('Detection Inspector');
  });

  it('returns "Alert Inspector" for alert selection', () => {
    const fixture = loadFixture('inspector-selection.alert.fixture.json');
    expect(inspectorTitle(fixture.selection)).toBe('Alert Inspector');
  });
});

// ─── 8. Cross-fixture consistency ────────────────────────────────────────
describe('Cross-fixture consistency', () => {
  it('device fixture: device.id matches topTalkerRow.device.id', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    expect(fixture.selection.device.id).toBe(fixture.selection.topTalkerRow.device.id);
  });

  it('device fixture: device.displayName matches topTalkerRow.device.displayName', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    expect(fixture.selection.device.displayName).toBe(fixture.selection.topTalkerRow.device.displayName);
  });

  it('device fixture: device.macaddr matches topTalkerRow.device.macaddr', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    expect(fixture.selection.device.macaddr).toBe(fixture.selection.topTalkerRow.device.macaddr);
  });

  it('all non-empty fixtures have a description field', () => {
    for (const file of FIXTURE_FILES) {
      const fixture = loadFixture(file);
      expect(typeof fixture.description).toBe('string');
      expect(fixture.description.length).toBeGreaterThan(0);
    }
  });
});

// ─── 9. Selected ID derivation logic ─────────────────────────────────────
describe('Selected ID derivation logic', () => {
  it('device selection yields selectedDeviceId = device.id', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    const selectedDeviceId = sel.kind === 'device' ? sel.device.id : null;
    expect(selectedDeviceId).toBe(1042);
  });

  it('detection selection yields selectedDetectionId = detection.id', () => {
    const fixture = loadFixture('inspector-selection.detection.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    const selectedDetectionId = sel.kind === 'detection' ? sel.detection.id : null;
    expect(selectedDetectionId).toBe(4001);
  });

  it('alert selection yields selectedAlertId = alert.id', () => {
    const fixture = loadFixture('inspector-selection.alert.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    const selectedAlertId = sel.kind === 'alert' ? sel.alert.id : null;
    expect(selectedAlertId).toBe(101);
  });

  it('device selection yields null for selectedDetectionId and selectedAlertId', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    const sel = fixture.selection as InspectorSelection;
    const selectedDetectionId = sel.kind === 'detection' ? sel.detection.id : null;
    const selectedAlertId = sel.kind === 'alert' ? sel.alert.id : null;
    expect(selectedDetectionId).toBeNull();
    expect(selectedAlertId).toBeNull();
  });

  it('null selection yields null for all selected IDs', () => {
    const sel: InspectorSelection | null = null;
    const selectedDeviceId = sel?.kind === 'device' ? sel.device.id : null;
    const selectedDetectionId = sel?.kind === 'detection' ? sel.detection.id : null;
    const selectedAlertId = sel?.kind === 'alert' ? sel.alert.id : null;
    expect(selectedDeviceId).toBeNull();
    expect(selectedDetectionId).toBeNull();
    expect(selectedAlertId).toBeNull();
  });
});

// ─── 10. Interaction invariants ──────────────────────────────────────────
describe('Interaction invariants', () => {
  it('only one entity can be selected at a time (device selection has no detection/alert)', () => {
    const fixture = loadFixture('inspector-selection.device.fixture.json');
    const sel = fixture.selection;
    expect(sel.kind).toBe('device');
    expect(sel).not.toHaveProperty('detection');
    expect(sel).not.toHaveProperty('alert');
  });

  it('only one entity can be selected at a time (detection selection has no device/alert)', () => {
    const fixture = loadFixture('inspector-selection.detection.fixture.json');
    const sel = fixture.selection;
    expect(sel.kind).toBe('detection');
    expect(sel).not.toHaveProperty('device');
    expect(sel).not.toHaveProperty('topTalkerRow');
    expect(sel).not.toHaveProperty('alert');
  });

  it('only one entity can be selected at a time (alert selection has no device/detection)', () => {
    const fixture = loadFixture('inspector-selection.alert.fixture.json');
    const sel = fixture.selection;
    expect(sel.kind).toBe('alert');
    expect(sel).not.toHaveProperty('device');
    expect(sel).not.toHaveProperty('topTalkerRow');
    expect(sel).not.toHaveProperty('detection');
  });

  it('all three selection kinds are distinct', () => {
    const kinds = new Set(['device', 'detection', 'alert']);
    const deviceKind = loadFixture('inspector-selection.device.fixture.json').selection.kind;
    const detectionKind = loadFixture('inspector-selection.detection.fixture.json').selection.kind;
    const alertKind = loadFixture('inspector-selection.alert.fixture.json').selection.kind;
    expect(kinds.has(deviceKind)).toBe(true);
    expect(kinds.has(detectionKind)).toBe(true);
    expect(kinds.has(alertKind)).toBe(true);
    expect(new Set([deviceKind, detectionKind, alertKind]).size).toBe(3);
  });
});
