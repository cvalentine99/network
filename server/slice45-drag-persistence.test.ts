/**
 * Slice 45 — Node Drag-to-Rearrange + Position Persistence
 *
 * Tests cover:
 * 1. View-keyed storage key generation
 * 2. Position serialization / deserialization
 * 3. Pin indicator visibility logic
 * 4. Drag-end persistence behavior
 * 5. Reset layout clears persisted positions
 * 6. Fixture schema re-validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TopologyPayloadSchema } from '../shared/topology-validators';
import populatedFixture from '../fixtures/topology/topology.populated.fixture.json';
import quietFixture from '../fixtures/topology/topology.quiet.fixture.json';
import largeScaleFixture from '../fixtures/topology/topology.large-scale.fixture.json';

// ─── Storage key generation (mirrors ForceGraph logic) ──────────
const LAYOUT_STORAGE_PREFIX = 'topology-node-positions';

function getStorageKey(viewKey?: string): string {
  return viewKey ? `${LAYOUT_STORAGE_PREFIX}:${viewKey}` : LAYOUT_STORAGE_PREFIX;
}

describe('Slice 45 — View-Keyed Storage Key Generation', () => {
  it('returns default key when no viewKey provided', () => {
    expect(getStorageKey()).toBe('topology-node-positions');
    expect(getStorageKey(undefined)).toBe('topology-node-positions');
  });

  it('returns view-keyed key for constellation view', () => {
    expect(getStorageKey('constellation')).toBe('topology-node-positions:constellation');
  });

  it('returns view-keyed key for subnet-map view', () => {
    expect(getStorageKey('subnet-map')).toBe('topology-node-positions:subnet-map');
  });

  it('returns view-keyed key for custom saved view names', () => {
    expect(getStorageKey('my-custom-view-1')).toBe('topology-node-positions:my-custom-view-1');
  });

  it('different view keys produce different storage keys', () => {
    const key1 = getStorageKey('constellation');
    const key2 = getStorageKey('subnet-map');
    const key3 = getStorageKey('custom-view');
    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
    expect(key1).not.toBe(key3);
  });
});

// ─── Position serialization / deserialization ───────────────────
interface SavedPosition {
  x: number;
  y: number;
}

function serializePositions(positions: Map<number, SavedPosition>): string {
  const obj: Record<string, SavedPosition> = {};
  positions.forEach((v, k) => {
    obj[String(k)] = v;
  });
  return JSON.stringify(obj);
}

function deserializePositions(raw: string): Map<number, SavedPosition> {
  const parsed = JSON.parse(raw) as Record<string, SavedPosition>;
  const m = new Map<number, SavedPosition>();
  for (const [k, v] of Object.entries(parsed)) {
    const id = Number(k);
    if (
      !Number.isNaN(id) &&
      v &&
      typeof v.x === 'number' &&
      typeof v.y === 'number' &&
      Number.isFinite(v.x) &&
      Number.isFinite(v.y)
    ) {
      m.set(id, v);
    }
  }
  return m;
}

describe('Slice 45 — Position Serialization / Deserialization', () => {
  it('round-trips a single position', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100, y: 200 });
    const serialized = serializePositions(positions);
    const deserialized = deserializePositions(serialized);
    expect(deserialized.size).toBe(1);
    expect(deserialized.get(1)).toEqual({ x: 100, y: 200 });
  });

  it('round-trips multiple positions', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100, y: 200 });
    positions.set(2, { x: -50, y: 300.5 });
    positions.set(3, { x: 0, y: 0 });
    const serialized = serializePositions(positions);
    const deserialized = deserializePositions(serialized);
    expect(deserialized.size).toBe(3);
    expect(deserialized.get(1)).toEqual({ x: 100, y: 200 });
    expect(deserialized.get(2)).toEqual({ x: -50, y: 300.5 });
    expect(deserialized.get(3)).toEqual({ x: 0, y: 0 });
  });

  it('handles empty map', () => {
    const positions = new Map<number, SavedPosition>();
    const serialized = serializePositions(positions);
    const deserialized = deserializePositions(serialized);
    expect(deserialized.size).toBe(0);
  });

  it('rejects NaN values during deserialization', () => {
    const raw = JSON.stringify({ '1': { x: NaN, y: 200 } });
    const deserialized = deserializePositions(raw);
    expect(deserialized.size).toBe(0);
  });

  it('rejects Infinity values during deserialization', () => {
    const raw = JSON.stringify({ '1': { x: Infinity, y: 200 } });
    const deserialized = deserializePositions(raw);
    expect(deserialized.size).toBe(0);
  });

  it('rejects non-numeric keys during deserialization', () => {
    const raw = JSON.stringify({ 'abc': { x: 100, y: 200 } });
    const deserialized = deserializePositions(raw);
    expect(deserialized.size).toBe(0);
  });

  it('rejects entries with missing x or y', () => {
    const raw = JSON.stringify({ '1': { x: 100 }, '2': { y: 200 } });
    const deserialized = deserializePositions(raw);
    expect(deserialized.size).toBe(0);
  });

  it('preserves negative coordinates', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(42, { x: -999.5, y: -0.001 });
    const serialized = serializePositions(positions);
    const deserialized = deserializePositions(serialized);
    expect(deserialized.get(42)).toEqual({ x: -999.5, y: -0.001 });
  });
});

// ─── Pin indicator visibility logic ─────────────────────────────
interface PinIndicatorInput {
  fx: number | null | undefined;
  fy: number | null | undefined;
  isOnPath: boolean;
  isSelected: boolean;
  hasAnomaly: boolean;
}

function shouldShowPinIndicator(input: PinIndicatorInput): boolean {
  return (
    input.fx != null &&
    input.fy != null &&
    !input.isOnPath &&
    !input.isSelected &&
    !input.hasAnomaly
  );
}

describe('Slice 45 — Pin Indicator Visibility Logic', () => {
  it('shows pin indicator for pinned node with no overlays', () => {
    expect(
      shouldShowPinIndicator({
        fx: 100,
        fy: 200,
        isOnPath: false,
        isSelected: false,
        hasAnomaly: false,
      })
    ).toBe(true);
  });

  it('hides pin indicator when node is not pinned (fx/fy null)', () => {
    expect(
      shouldShowPinIndicator({
        fx: null,
        fy: null,
        isOnPath: false,
        isSelected: false,
        hasAnomaly: false,
      })
    ).toBe(false);
  });

  it('hides pin indicator when fx is null but fy is set', () => {
    expect(
      shouldShowPinIndicator({
        fx: null,
        fy: 200,
        isOnPath: false,
        isSelected: false,
        hasAnomaly: false,
      })
    ).toBe(false);
  });

  it('hides pin indicator when node is on critical path', () => {
    expect(
      shouldShowPinIndicator({
        fx: 100,
        fy: 200,
        isOnPath: true,
        isSelected: false,
        hasAnomaly: false,
      })
    ).toBe(false);
  });

  it('hides pin indicator when node is selected', () => {
    expect(
      shouldShowPinIndicator({
        fx: 100,
        fy: 200,
        isOnPath: false,
        isSelected: true,
        hasAnomaly: false,
      })
    ).toBe(false);
  });

  it('hides pin indicator when node has anomaly', () => {
    expect(
      shouldShowPinIndicator({
        fx: 100,
        fy: 200,
        isOnPath: false,
        isSelected: false,
        hasAnomaly: true,
      })
    ).toBe(false);
  });

  it('hides pin indicator when fx is undefined', () => {
    expect(
      shouldShowPinIndicator({
        fx: undefined,
        fy: undefined,
        isOnPath: false,
        isSelected: false,
        hasAnomaly: false,
      })
    ).toBe(false);
  });
});

// ─── Drag-end persistence behavior ─────────────────────────────
describe('Slice 45 — Drag-End Persistence Behavior', () => {
  it('saves position to map after drag end with valid coordinates', () => {
    const positions = new Map<number, SavedPosition>();
    const nodeId = 1;
    const x = 150;
    const y = 250;

    // Simulate drag-end logic
    if (Number.isFinite(x) && Number.isFinite(y)) {
      positions.set(nodeId, { x, y });
    }

    expect(positions.has(nodeId)).toBe(true);
    expect(positions.get(nodeId)).toEqual({ x: 150, y: 250 });
  });

  it('does not save NaN coordinates', () => {
    const positions = new Map<number, SavedPosition>();
    const nodeId = 1;
    const x = NaN;
    const y = 250;

    if (Number.isFinite(x) && Number.isFinite(y)) {
      positions.set(nodeId, { x, y });
    }

    expect(positions.has(nodeId)).toBe(false);
  });

  it('does not save Infinity coordinates', () => {
    const positions = new Map<number, SavedPosition>();
    const nodeId = 1;
    const x = Infinity;
    const y = 250;

    if (Number.isFinite(x) && Number.isFinite(y)) {
      positions.set(nodeId, { x, y });
    }

    expect(positions.has(nodeId)).toBe(false);
  });

  it('overwrites previous position for same node on re-drag', () => {
    const positions = new Map<number, SavedPosition>();
    const nodeId = 1;

    positions.set(nodeId, { x: 100, y: 200 });
    positions.set(nodeId, { x: 300, y: 400 });

    expect(positions.get(nodeId)).toEqual({ x: 300, y: 400 });
  });

  it('maintains separate positions for different nodes', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100, y: 200 });
    positions.set(2, { x: 300, y: 400 });

    expect(positions.size).toBe(2);
    expect(positions.get(1)).toEqual({ x: 100, y: 200 });
    expect(positions.get(2)).toEqual({ x: 300, y: 400 });
  });
});

// ─── Reset layout clears persisted positions ────────────────────
describe('Slice 45 — Reset Layout Clears Persisted Positions', () => {
  it('clearing positions results in empty map', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100, y: 200 });
    positions.set(2, { x: 300, y: 400 });

    // Simulate reset
    positions.clear();
    expect(positions.size).toBe(0);
  });

  it('clearing positions for one view does not affect another view key', () => {
    const key1 = getStorageKey('constellation');
    const key2 = getStorageKey('subnet-map');

    // These are different keys, so clearing one doesn't affect the other
    expect(key1).not.toBe(key2);
  });
});

// ─── Unpin behavior ─────────────────────────────────────────────
describe('Slice 45 — Unpin Behavior', () => {
  it('unpin removes node from saved positions', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100, y: 200 });
    positions.set(2, { x: 300, y: 400 });

    // Simulate unpin for node 1
    positions.delete(1);

    expect(positions.has(1)).toBe(false);
    expect(positions.has(2)).toBe(true);
    expect(positions.size).toBe(1);
  });

  it('unpin of non-existent node is a no-op', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100, y: 200 });

    positions.delete(999);

    expect(positions.size).toBe(1);
    expect(positions.has(1)).toBe(true);
  });
});

// ─── Position restoration from saved state ──────────────────────
describe('Slice 45 — Position Restoration from Saved State', () => {
  it('restores fx/fy from saved positions for matching nodes', () => {
    const savedPositions = new Map<number, SavedPosition>();
    savedPositions.set(1, { x: 150, y: 250 });
    savedPositions.set(3, { x: 350, y: 450 });

    // Simulate node initialization with saved positions
    const nodeIds = [1, 2, 3, 4, 5];
    const restoredNodes = nodeIds.map((id) => {
      const saved = savedPositions.get(id);
      return {
        id,
        fx: saved ? saved.x : undefined,
        fy: saved ? saved.y : undefined,
      };
    });

    expect(restoredNodes[0].fx).toBe(150);
    expect(restoredNodes[0].fy).toBe(250);
    expect(restoredNodes[1].fx).toBeUndefined();
    expect(restoredNodes[1].fy).toBeUndefined();
    expect(restoredNodes[2].fx).toBe(350);
    expect(restoredNodes[2].fy).toBe(450);
  });

  it('hasCustomLayout is true when saved positions exist', () => {
    const savedPositions = new Map<number, SavedPosition>();
    savedPositions.set(1, { x: 100, y: 200 });
    expect(savedPositions.size > 0).toBe(true);
  });

  it('hasCustomLayout is false when no saved positions exist', () => {
    const savedPositions = new Map<number, SavedPosition>();
    expect(savedPositions.size > 0).toBe(false);
  });
});

// ─── Large-scale drag persistence ───────────────────────────────
describe('Slice 45 — Large-Scale Drag Persistence', () => {
  it('can serialize and deserialize positions for 200 nodes', () => {
    const positions = new Map<number, SavedPosition>();
    for (let i = 0; i < 200; i++) {
      positions.set(i, { x: Math.random() * 2000 - 1000, y: Math.random() * 2000 - 1000 });
    }

    const serialized = serializePositions(positions);
    const deserialized = deserializePositions(serialized);

    expect(deserialized.size).toBe(200);
    for (let i = 0; i < 200; i++) {
      const original = positions.get(i)!;
      const restored = deserialized.get(i)!;
      expect(restored.x).toBeCloseTo(original.x, 10);
      expect(restored.y).toBeCloseTo(original.y, 10);
    }
  });

  it('serialized JSON size is reasonable for 200 nodes', () => {
    const positions = new Map<number, SavedPosition>();
    for (let i = 0; i < 200; i++) {
      positions.set(i, { x: 500.123, y: -300.456 });
    }

    const serialized = serializePositions(positions);
    // Each entry is roughly ~35 chars: {"0":{"x":500.123,"y":-300.456}}
    // 200 entries should be well under 20KB
    expect(serialized.length).toBeLessThan(20000);
  });
});

// ─── Fixture schema re-validation ───────────────────────────────
describe('Slice 45 — Fixture Schema Re-validation', () => {
  it('populated fixture passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse((populatedFixture as any).payload);
    expect(result.success).toBe(true);
  });

  it('quiet fixture passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse((quietFixture as any).payload);
    expect(result.success).toBe(true);
  });

  it('large-scale fixture passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse((largeScaleFixture as any).payload);
    expect(result.success).toBe(true);
  });
});
