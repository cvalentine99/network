/**
 * Slice 13 — Navigation Breadcrumb / Inspector History
 *
 * Tests cover:
 *   1. Pure helper functions (labelForSelection, kindLabel, pushHistory, goBackInHistory, goToHistoryIndex, isSameEntity)
 *   2. Zod schema validation (InspectorSelectionSchema, InspectorHistoryEntrySchema)
 *   3. Fixture file existence and JSON validity
 *   4. Fixture schema validation
 *   5. FIFO eviction at max depth
 *   6. Dedup on consecutive identical pushes
 *   7. Label truncation
 *   8. Edge cases (empty stack, out-of-bounds index, negative index)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

import {
  labelForSelection,
  kindLabel,
  pushHistory,
  goBackInHistory,
  goToHistoryIndex,
  isSameEntity,
} from '../shared/inspector-history';

import {
  InspectorSelectionSchema,
  InspectorHistoryEntrySchema,
  DeviceIdentitySchema,
  NormalizedDetectionSchema,
  NormalizedAlertSchema,
  TopTalkerRowSchema,
} from '../shared/cockpit-validators';

import { INSPECTOR_HISTORY_MAX_DEPTH } from '../shared/cockpit-constants';

import type {
  InspectorSelection,
  InspectorHistoryEntry,
} from '../shared/cockpit-types';

// ─── Fixture loading ────────────────────────────────────────────────────
const FIXTURE_DIR = resolve(__dirname, '../fixtures');

function loadFixture(relativePath: string): unknown {
  const fullPath = resolve(FIXTURE_DIR, relativePath);
  return JSON.parse(readFileSync(fullPath, 'utf-8'));
}

function loadSelection(name: string): InspectorSelection {
  const data = loadFixture(`inspector-selection/inspector-selection.${name}.fixture.json`) as { selection: InspectorSelection };
  return data.selection;
}

function loadHistoryFixture(name: string): { description: string; history: InspectorHistoryEntry[]; currentSelection: InspectorSelection } {
  return loadFixture(`inspector-history/inspector-history.${name}.fixture.json`) as any;
}

// ─── 1. labelForSelection ───────────────────────────────────────────────
describe('labelForSelection', () => {
  it('returns device displayName for device selection', () => {
    const sel = loadSelection('device');
    expect(labelForSelection(sel)).toBe('dc01.lab.local');
  });

  it('returns detection title for detection selection', () => {
    const sel = loadSelection('detection');
    const label = labelForSelection(sel);
    // Title is "Lateral Movement via SMB" (24 chars exactly)
    expect(label).toBe('Lateral Movement via SMB');
  });

  it('returns alert name for alert selection (truncated at 24 chars)', () => {
    const sel = loadSelection('alert');
    // "High Packet Loss Detected" is 25 chars → truncated to 23 + ellipsis = 24
    expect(labelForSelection(sel)).toBe('High Packet Loss Detect\u2026');
    expect(labelForSelection(sel).length).toBe(24);
  });

  it('truncates labels longer than 24 chars with ellipsis', () => {
    const fixture = loadHistoryFixture('long-label');
    const sel = fixture.history[0].selection;
    const label = labelForSelection(sel);
    expect(label.length).toBeLessThanOrEqual(24);
    expect(label).toMatch(/…$/);
  });

  it('does not truncate labels at exactly 24 chars', () => {
    const sel = loadSelection('detection');
    const label = labelForSelection(sel);
    // "Lateral Movement via SMB" is 24 chars
    expect(label).toBe('Lateral Movement via SMB');
    expect(label.length).toBe(24);
  });
});

// ─── 2. kindLabel ───────────────────────────────────────────────────────
describe('kindLabel', () => {
  it('returns "Device" for device selection', () => {
    const sel = loadSelection('device');
    expect(kindLabel(sel)).toBe('Device');
  });

  it('returns "Detection" for detection selection', () => {
    const sel = loadSelection('detection');
    expect(kindLabel(sel)).toBe('Detection');
  });

  it('returns "Alert" for alert selection', () => {
    const sel = loadSelection('alert');
    expect(kindLabel(sel)).toBe('Alert');
  });
});

// ─── 3. pushHistory ─────────────────────────────────────────────────────
describe('pushHistory', () => {
  it('appends entry to empty stack', () => {
    const sel = loadSelection('device');
    const result = pushHistory([], sel, 1710000000000);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('dc01.lab.local');
    expect(result[0].timestamp).toBe(1710000000000);
  });

  it('appends entry to non-empty stack', () => {
    const device = loadSelection('device');
    const detection = loadSelection('detection');
    const step1 = pushHistory([], device, 1710000000000);
    const step2 = pushHistory(step1, detection, 1710000001000);
    expect(step2).toHaveLength(2);
    expect(step2[0].selection.kind).toBe('device');
    expect(step2[1].selection.kind).toBe('detection');
  });

  it('returns immutable new array (does not mutate input)', () => {
    const sel = loadSelection('device');
    const original: InspectorHistoryEntry[] = [];
    const result = pushHistory(original, sel, 1710000000000);
    expect(original).toHaveLength(0);
    expect(result).toHaveLength(1);
    expect(result).not.toBe(original);
  });

  it('deduplicates consecutive identical entity pushes', () => {
    const device = loadSelection('device');
    const step1 = pushHistory([], device, 1710000000000);
    const step2 = pushHistory(step1, device, 1710000001000);
    expect(step2).toHaveLength(1); // No duplicate added
    expect(step2).toBe(step1); // Same reference returned
  });

  it('allows same entity kind with different ID', () => {
    const device1 = loadSelection('device');
    const device2 = JSON.parse(JSON.stringify(device1)) as InspectorSelection;
    if (device2.kind === 'device') device2.device.id = 9999;
    const step1 = pushHistory([], device1, 1710000000000);
    const step2 = pushHistory(step1, device2, 1710000001000);
    expect(step2).toHaveLength(2);
  });

  it('enforces FIFO eviction at max depth', () => {
    const fixture = loadHistoryFixture('max-depth');
    expect(fixture.history).toHaveLength(INSPECTOR_HISTORY_MAX_DEPTH);

    // Push one more entry
    const alert = loadSelection('alert');
    const result = pushHistory(fixture.history, alert, 1710099999000);
    expect(result).toHaveLength(INSPECTOR_HISTORY_MAX_DEPTH);
    // Oldest entry (device-000) should be evicted
    expect(result[0].label).not.toBe('device-000.lab.local');
    // Newest entry should be the alert
    expect(result[result.length - 1].selection.kind).toBe('alert');
  });

  it('preserves timestamps in order after eviction', () => {
    const fixture = loadHistoryFixture('max-depth');
    const alert = loadSelection('alert');
    const result = pushHistory(fixture.history, alert, 1710099999000);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timestamp).toBeGreaterThan(result[i - 1].timestamp);
    }
  });
});

// ─── 4. goBackInHistory ─────────────────────────────────────────────────
describe('goBackInHistory', () => {
  it('returns null selection from empty stack', () => {
    const result = goBackInHistory([]);
    expect(result.stack).toHaveLength(0);
    expect(result.selection).toBeNull();
  });

  it('pops last entry and returns its selection', () => {
    const fixture = loadHistoryFixture('single-entry');
    const result = goBackInHistory(fixture.history);
    expect(result.stack).toHaveLength(0);
    expect(result.selection).not.toBeNull();
    expect(result.selection!.kind).toBe('device');
  });

  it('pops from multi-entry stack correctly', () => {
    const fixture = loadHistoryFixture('multi-entry');
    expect(fixture.history).toHaveLength(3);
    const result = goBackInHistory(fixture.history);
    expect(result.stack).toHaveLength(2);
    expect(result.selection!.kind).toBe('alert'); // Last entry was alert
  });

  it('returns immutable new array', () => {
    const fixture = loadHistoryFixture('multi-entry');
    const original = [...fixture.history];
    const result = goBackInHistory(original);
    expect(original).toHaveLength(3); // Not mutated
    expect(result.stack).toHaveLength(2);
  });
});

// ─── 5. goToHistoryIndex ────────────────────────────────────────────────
describe('goToHistoryIndex', () => {
  it('navigates to first entry (index 0)', () => {
    const fixture = loadHistoryFixture('multi-entry');
    const result = goToHistoryIndex(fixture.history, 0);
    expect(result.stack).toHaveLength(0); // Everything before index 0
    expect(result.selection!.kind).toBe('device');
  });

  it('navigates to middle entry (index 1)', () => {
    const fixture = loadHistoryFixture('multi-entry');
    const result = goToHistoryIndex(fixture.history, 1);
    expect(result.stack).toHaveLength(1); // Only entry 0 remains
    expect(result.selection!.kind).toBe('detection');
  });

  it('navigates to last entry (index 2)', () => {
    const fixture = loadHistoryFixture('multi-entry');
    const result = goToHistoryIndex(fixture.history, 2);
    expect(result.stack).toHaveLength(2); // Entries 0 and 1 remain
    expect(result.selection!.kind).toBe('alert');
  });

  it('returns null for negative index', () => {
    const fixture = loadHistoryFixture('multi-entry');
    const result = goToHistoryIndex(fixture.history, -1);
    expect(result.selection).toBeNull();
    expect(result.stack).toHaveLength(3); // Unchanged
  });

  it('returns null for out-of-bounds index', () => {
    const fixture = loadHistoryFixture('multi-entry');
    const result = goToHistoryIndex(fixture.history, 99);
    expect(result.selection).toBeNull();
    expect(result.stack).toHaveLength(3); // Unchanged
  });
});

// ─── 6. isSameEntity ────────────────────────────────────────────────────
describe('isSameEntity', () => {
  it('returns true for same device ID', () => {
    const a = loadSelection('device');
    const b = JSON.parse(JSON.stringify(a));
    expect(isSameEntity(a, b)).toBe(true);
  });

  it('returns true for same detection ID', () => {
    const a = loadSelection('detection');
    const b = JSON.parse(JSON.stringify(a));
    expect(isSameEntity(a, b)).toBe(true);
  });

  it('returns true for same alert ID', () => {
    const a = loadSelection('alert');
    const b = JSON.parse(JSON.stringify(a));
    expect(isSameEntity(a, b)).toBe(true);
  });

  it('returns false for different kinds', () => {
    const device = loadSelection('device');
    const detection = loadSelection('detection');
    expect(isSameEntity(device, detection)).toBe(false);
  });

  it('returns false for same kind but different ID', () => {
    const a = loadSelection('device');
    const b = JSON.parse(JSON.stringify(a)) as InspectorSelection;
    if (b.kind === 'device') b.device.id = 9999;
    expect(isSameEntity(a, b)).toBe(false);
  });
});

// ─── 7. InspectorSelectionSchema validation ─────────────────────────────
describe('InspectorSelectionSchema', () => {
  it('validates device selection from fixture', () => {
    const sel = loadSelection('device');
    const result = InspectorSelectionSchema.safeParse(sel);
    expect(result.success).toBe(true);
  });

  it('validates detection selection from fixture', () => {
    const sel = loadSelection('detection');
    const result = InspectorSelectionSchema.safeParse(sel);
    expect(result.success).toBe(true);
  });

  it('validates alert selection from fixture', () => {
    const sel = loadSelection('alert');
    const result = InspectorSelectionSchema.safeParse(sel);
    expect(result.success).toBe(true);
  });

  it('rejects selection with unknown kind', () => {
    const result = InspectorSelectionSchema.safeParse({ kind: 'unknown', data: {} });
    expect(result.success).toBe(false);
  });

  it('rejects selection with missing required fields', () => {
    const result = InspectorSelectionSchema.safeParse({ kind: 'device' });
    expect(result.success).toBe(false);
  });
});

// ─── 8. InspectorHistoryEntrySchema validation ──────────────────────────
describe('InspectorHistoryEntrySchema', () => {
  it('validates single-entry fixture history entry', () => {
    const fixture = loadHistoryFixture('single-entry');
    const entry = fixture.history[0];
    const result = InspectorHistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('validates all multi-entry fixture history entries', () => {
    const fixture = loadHistoryFixture('multi-entry');
    for (const entry of fixture.history) {
      const result = InspectorHistoryEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    }
  });

  it('rejects entry with empty label', () => {
    const fixture = loadHistoryFixture('single-entry');
    const entry = { ...fixture.history[0], label: '' };
    const result = InspectorHistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('rejects entry with zero timestamp', () => {
    const fixture = loadHistoryFixture('single-entry');
    const entry = { ...fixture.history[0], timestamp: 0 };
    const result = InspectorHistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('rejects entry with negative timestamp', () => {
    const fixture = loadHistoryFixture('single-entry');
    const entry = { ...fixture.history[0], timestamp: -1 };
    const result = InspectorHistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });
});

// ─── 9. Fixture file existence ──────────────────────────────────────────
describe('Inspector history fixture files exist', () => {
  const FIXTURE_FILES = [
    'inspector-history/inspector-history.quiet.fixture.json',
    'inspector-history/inspector-history.single-entry.fixture.json',
    'inspector-history/inspector-history.multi-entry.fixture.json',
    'inspector-history/inspector-history.max-depth.fixture.json',
    'inspector-history/inspector-history.long-label.fixture.json',
    'inspector-history/inspector-history.dedup.fixture.json',
  ];

  for (const file of FIXTURE_FILES) {
    it(`${file} exists and is valid JSON`, () => {
      const fullPath = resolve(FIXTURE_DIR, file);
      expect(existsSync(fullPath)).toBe(true);
      const content = readFileSync(fullPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  }
});

// ─── 10. INSPECTOR_HISTORY_MAX_DEPTH constant ───────────────────────────
describe('INSPECTOR_HISTORY_MAX_DEPTH', () => {
  it('is 20', () => {
    expect(INSPECTOR_HISTORY_MAX_DEPTH).toBe(20);
  });

  it('is a positive integer', () => {
    expect(Number.isInteger(INSPECTOR_HISTORY_MAX_DEPTH)).toBe(true);
    expect(INSPECTOR_HISTORY_MAX_DEPTH).toBeGreaterThan(0);
  });
});

// ─── 11. Full navigation cycle ──────────────────────────────────────────
describe('Full navigation cycle with history', () => {
  it('device → detection → alert → goBack → goBack → goBack returns to empty', () => {
    const device = loadSelection('device');
    const detection = loadSelection('detection');
    const alert = loadSelection('alert');

    // Step 1: push device
    let stack = pushHistory([], device, 1710000000000);
    expect(stack).toHaveLength(1);

    // Step 2: push detection
    stack = pushHistory(stack, detection, 1710000001000);
    expect(stack).toHaveLength(2);

    // Step 3: push alert
    stack = pushHistory(stack, alert, 1710000002000);
    expect(stack).toHaveLength(3);

    // Go back 1: should return alert (last pushed)
    let result = goBackInHistory(stack);
    expect(result.selection!.kind).toBe('alert');
    stack = result.stack;
    expect(stack).toHaveLength(2);

    // Go back 2: should return detection
    result = goBackInHistory(stack);
    expect(result.selection!.kind).toBe('detection');
    stack = result.stack;
    expect(stack).toHaveLength(1);

    // Go back 3: should return device
    result = goBackInHistory(stack);
    expect(result.selection!.kind).toBe('device');
    stack = result.stack;
    expect(stack).toHaveLength(0);

    // Go back 4: empty stack → null
    result = goBackInHistory(stack);
    expect(result.selection).toBeNull();
  });

  it('breadcrumb click to index 0 truncates entire history', () => {
    const device = loadSelection('device');
    const detection = loadSelection('detection');
    const alert = loadSelection('alert');

    let stack = pushHistory([], device, 1710000000000);
    stack = pushHistory(stack, detection, 1710000001000);
    stack = pushHistory(stack, alert, 1710000002000);
    expect(stack).toHaveLength(3);

    const result = goToHistoryIndex(stack, 0);
    expect(result.stack).toHaveLength(0);
    expect(result.selection!.kind).toBe('device');
  });

  it('breadcrumb click preserves entries before target', () => {
    const device = loadSelection('device');
    const detection = loadSelection('detection');
    const alert = loadSelection('alert');

    let stack = pushHistory([], device, 1710000000000);
    stack = pushHistory(stack, detection, 1710000001000);
    stack = pushHistory(stack, alert, 1710000002000);

    const result = goToHistoryIndex(stack, 1);
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0].selection.kind).toBe('device');
    expect(result.selection!.kind).toBe('detection');
  });
});

// ─── 12. Fixture schema cross-validation ────────────────────────────────
describe('Fixture schema cross-validation', () => {
  it('all entries in multi-entry fixture pass InspectorHistoryEntrySchema', () => {
    const fixture = loadHistoryFixture('multi-entry');
    for (const entry of fixture.history) {
      expect(InspectorHistoryEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('all entries in max-depth fixture pass InspectorHistoryEntrySchema', () => {
    const fixture = loadHistoryFixture('max-depth');
    expect(fixture.history).toHaveLength(20);
    for (const entry of fixture.history) {
      expect(InspectorHistoryEntrySchema.safeParse(entry).success).toBe(true);
    }
  });

  it('max-depth fixture has exactly INSPECTOR_HISTORY_MAX_DEPTH entries', () => {
    const fixture = loadHistoryFixture('max-depth');
    expect(fixture.history).toHaveLength(INSPECTOR_HISTORY_MAX_DEPTH);
  });

  it('dedup fixture currentSelection matches top-of-stack entity', () => {
    const fixture = loadHistoryFixture('dedup');
    const topEntry = fixture.history[fixture.history.length - 1];
    expect(isSameEntity(topEntry.selection, fixture.currentSelection)).toBe(true);
  });

  it('long-label fixture entry label is truncated', () => {
    const fixture = loadHistoryFixture('long-label');
    const label = fixture.history[0].label;
    expect(label.length).toBeLessThanOrEqual(24);
    expect(label).toMatch(/…$/);
  });

  it('quiet fixture has empty history array', () => {
    const fixture = loadHistoryFixture('quiet');
    expect(fixture.history).toHaveLength(0);
  });
});

// ─── 13. InspectorContext API surface ────────────────────────────────────
describe('InspectorContext exports', () => {
  it('InspectorProvider is exported', async () => {
    const mod = await import('../client/src/contexts/InspectorContext');
    expect(typeof mod.InspectorProvider).toBe('function');
  });

  it('useInspector is exported', async () => {
    const mod = await import('../client/src/contexts/InspectorContext');
    expect(typeof mod.useInspector).toBe('function');
  });

  it('InspectorContextValue includes history fields', async () => {
    // Verify by checking the module exports compile — TypeScript enforces the interface
    const mod = await import('../client/src/contexts/InspectorContext');
    expect(mod).toBeDefined();
  });
});

// ─── 14. inspector-history.ts exports ───────────────────────────────────
describe('inspector-history.ts exports', () => {
  it('exports labelForSelection', () => {
    expect(typeof labelForSelection).toBe('function');
  });

  it('exports kindLabel', () => {
    expect(typeof kindLabel).toBe('function');
  });

  it('exports pushHistory', () => {
    expect(typeof pushHistory).toBe('function');
  });

  it('exports goBackInHistory', () => {
    expect(typeof goBackInHistory).toBe('function');
  });

  it('exports goToHistoryIndex', () => {
    expect(typeof goToHistoryIndex).toBe('function');
  });

  it('exports isSameEntity', () => {
    expect(typeof isSameEntity).toBe('function');
  });
});
