/**
 * Slice 39 — Force-Directed Topology Graph Tests
 *
 * CONTRACT:
 * - All tests run against deterministic fixtures
 * - No live hardware required
 * - Tests validate data preparation, scaling, and simulation setup
 * - UI rendering tested via data contracts, not browser DOM
 *
 * Live integration: deferred by contract.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TopologyPayloadSchema } from '../shared/topology-validators';
import type { TopologyPayload, TopologyNode, TopologyEdge } from '../shared/topology-types';
import { TOPOLOGY_PERFORMANCE, ROLE_DISPLAY } from '../shared/topology-types';

// ─── Fixture Loaders ──────────────────────────────────────────────
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'topology');

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

function loadPayload(name: string): TopologyPayload {
  const data = loadFixture(name);
  return data.payload;
}

// ─── Scaling helpers (mirror ForceGraph logic) ────────────────────
function nodeRadius(bytes: number, maxBytes: number): number {
  if (maxBytes === 0) return TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN;
  const ratio = bytes / maxBytes;
  return (
    TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN +
    ratio * (TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX - TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN)
  );
}

function edgeWidth(bytes: number, maxBytes: number): number {
  if (maxBytes === 0) return TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN;
  const ratio = bytes / maxBytes;
  return (
    TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN +
    ratio * (TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX - TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN)
  );
}

// ─── Fixtures ─────────────────────────────────────────────────────
const populated = loadPayload('topology.populated.fixture.json');
const quiet = loadPayload('topology.quiet.fixture.json');
const largeScale = loadPayload('topology.large-scale.fixture.json');

// ═══════════════════════════════════════════════════════════════════
// FIXTURE SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Fixture Schema Validation', () => {
  it('populated fixture passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse(populated);
    expect(result.success).toBe(true);
  });

  it('quiet fixture passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse(quiet);
    expect(result.success).toBe(true);
  });

  it('large-scale fixture passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse(largeScale);
    expect(result.success).toBe(true);
  });

  it('populated fixture has expected node/edge counts', () => {
    expect(populated.nodes.length).toBe(15);
    expect(populated.edges.length).toBe(20);
    expect(populated.clusters.length).toBe(3);
  });

  it('large-scale fixture has expected node/edge counts', () => {
    expect(largeScale.nodes.length).toBe(200);
    expect(largeScale.edges.length).toBe(600);
    expect(largeScale.clusters.length).toBe(10);
  });

  it('quiet fixture has zero nodes', () => {
    expect(quiet.nodes.length).toBe(0);
    expect(quiet.edges.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// NODE RADIUS SCALING
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Node Radius Scaling', () => {
  it('returns NODE_SIZE_MIN for zero bytes', () => {
    expect(nodeRadius(0, 1000)).toBe(TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN);
  });

  it('returns NODE_SIZE_MAX for max bytes', () => {
    expect(nodeRadius(1000, 1000)).toBe(TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX);
  });

  it('returns NODE_SIZE_MIN when maxBytes is zero', () => {
    expect(nodeRadius(0, 0)).toBe(TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN);
  });

  it('scales linearly between min and max', () => {
    const half = nodeRadius(500, 1000);
    const expected =
      TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN +
      0.5 * (TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX - TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN);
    expect(half).toBeCloseTo(expected, 5);
  });

  it('all populated nodes produce valid radii', () => {
    const maxBytes = Math.max(...populated.nodes.map((n: TopologyNode) => n.totalBytes), 1);
    for (const node of populated.nodes) {
      const r = nodeRadius(node.totalBytes, maxBytes);
      expect(r).toBeGreaterThanOrEqual(TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN);
      expect(r).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX);
      expect(Number.isFinite(r)).toBe(true);
      expect(Number.isNaN(r)).toBe(false);
    }
  });

  it('all large-scale nodes produce valid radii without NaN/Infinity', () => {
    const maxBytes = Math.max(...largeScale.nodes.map((n: TopologyNode) => n.totalBytes), 1);
    for (const node of largeScale.nodes) {
      const r = nodeRadius(node.totalBytes, maxBytes);
      expect(Number.isFinite(r)).toBe(true);
      expect(Number.isNaN(r)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE WIDTH SCALING
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Edge Width Scaling', () => {
  it('returns EDGE_WIDTH_MIN for zero bytes', () => {
    expect(edgeWidth(0, 1000)).toBe(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN);
  });

  it('returns EDGE_WIDTH_MAX for max bytes', () => {
    expect(edgeWidth(1000, 1000)).toBe(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX);
  });

  it('returns EDGE_WIDTH_MIN when maxBytes is zero', () => {
    expect(edgeWidth(0, 0)).toBe(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN);
  });

  it('all populated edges produce valid widths', () => {
    const maxBytes = Math.max(...populated.edges.map((e: TopologyEdge) => e.bytes), 1);
    for (const edge of populated.edges) {
      const w = edgeWidth(edge.bytes, maxBytes);
      expect(w).toBeGreaterThanOrEqual(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN);
      expect(w).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX);
      expect(Number.isFinite(w)).toBe(true);
    }
  });

  it('all large-scale edges produce valid widths without NaN/Infinity', () => {
    const maxBytes = Math.max(...largeScale.edges.map((e: TopologyEdge) => e.bytes), 1);
    for (const edge of largeScale.edges) {
      const w = edgeWidth(edge.bytes, maxBytes);
      expect(Number.isFinite(w)).toBe(true);
      expect(Number.isNaN(w)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// CLUSTER CENTER COMPUTATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Cluster Center Computation', () => {
  it('computes unique cluster centers for each cluster', () => {
    const width = 1200;
    const height = 700;
    const cx = width / 2;
    const cy = height / 2;
    const ringRadius = Math.min(width, height) * 0.28;

    const centers = populated.clusters.map((c: any, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(populated.clusters.length, 1) - Math.PI / 2;
      return {
        id: c.id,
        x: cx + ringRadius * Math.cos(angle),
        y: cy + ringRadius * Math.sin(angle),
      };
    });

    // All centers should be unique
    const uniqueXY = new Set(centers.map((c: any) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`));
    expect(uniqueXY.size).toBe(populated.clusters.length);

    // All centers should be within the viewport
    for (const c of centers) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(width);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(height);
    }
  });

  it('handles single cluster without division by zero', () => {
    const singleCluster = [{ id: 'test', label: 'Test', groupBy: 'subnet' as const, nodeCount: 5 }];
    const angle = (2 * Math.PI * 0) / Math.max(singleCluster.length, 1) - Math.PI / 2;
    expect(Number.isFinite(angle)).toBe(true);
  });

  it('handles 10 clusters (large-scale) without overlap', () => {
    const width = 1200;
    const height = 700;
    const cx = width / 2;
    const cy = height / 2;
    const ringRadius = Math.min(width, height) * 0.28;

    const centers = largeScale.clusters.map((c: any, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(largeScale.clusters.length, 1) - Math.PI / 2;
      return {
        id: c.id,
        x: cx + ringRadius * Math.cos(angle),
        y: cy + ringRadius * Math.sin(angle),
      };
    });

    // Minimum distance between any two centers should be > 0
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const dist = Math.sqrt(
          (centers[i].x - centers[j].x) ** 2 + (centers[i].y - centers[j].y) ** 2
        );
        expect(dist).toBeGreaterThan(10);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SIMULATION DATA PREPARATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Simulation Data Preparation', () => {
  it('all nodes have a valid clusterId that maps to a cluster', () => {
    const clusterIds = new Set(populated.clusters.map((c: any) => c.id));
    for (const node of populated.nodes) {
      expect(clusterIds.has(node.clusterId)).toBe(true);
    }
  });

  it('all edge sourceId/targetId reference existing nodes', () => {
    const nodeIds = new Set(populated.nodes.map((n: TopologyNode) => n.id));
    for (const edge of populated.edges) {
      expect(nodeIds.has(edge.sourceId)).toBe(true);
      expect(nodeIds.has(edge.targetId)).toBe(true);
    }
  });

  it('large-scale: all edges reference valid nodes', () => {
    const nodeIds = new Set(largeScale.nodes.map((n: TopologyNode) => n.id));
    for (const edge of largeScale.edges) {
      expect(nodeIds.has(edge.sourceId)).toBe(true);
      expect(nodeIds.has(edge.targetId)).toBe(true);
    }
  });

  it('all node roles have ROLE_DISPLAY metadata', () => {
    for (const node of populated.nodes) {
      expect(ROLE_DISPLAY[node.role]).toBeDefined();
      expect(ROLE_DISPLAY[node.role].color).toBeTruthy();
      expect(ROLE_DISPLAY[node.role].label).toBeTruthy();
    }
  });

  it('no NaN/Infinity values in node totalBytes', () => {
    for (const node of [...populated.nodes, ...largeScale.nodes]) {
      expect(Number.isFinite(node.totalBytes)).toBe(true);
      expect(node.totalBytes).toBeGreaterThanOrEqual(0);
    }
  });

  it('no NaN/Infinity values in edge bytes', () => {
    for (const edge of [...populated.edges, ...largeScale.edges]) {
      expect(Number.isFinite(edge.bytes)).toBe(true);
      expect(edge.bytes).toBeGreaterThanOrEqual(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// QUIET STATE HANDLING
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Quiet State Handling', () => {
  it('quiet fixture has zero nodes and zero edges', () => {
    expect(quiet.nodes.length).toBe(0);
    expect(quiet.edges.length).toBe(0);
  });

  it('quiet fixture summary reports zero', () => {
    expect(quiet.summary.totalNodes).toBe(0);
    expect(quiet.summary.totalEdges).toBe(0);
  });

  it('nodeRadius with zero maxBytes returns minimum', () => {
    expect(nodeRadius(0, 0)).toBe(TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN);
  });

  it('edgeWidth with zero maxBytes returns minimum', () => {
    expect(edgeWidth(0, 0)).toBe(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ERROR/MALFORMED FIXTURE VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Error/Malformed Fixture Validation', () => {
  it('error fixture has intent=error', () => {
    const errorFixture = loadFixture('topology.error.fixture.json');
    expect(errorFixture.intent).toBe('error');
    expect(errorFixture.payload).toBeNull();
    expect(errorFixture.error).toBeTruthy();
  });

  it('transport-error fixture has intent=transport-error', () => {
    const transportError = loadFixture('topology.transport-error.fixture.json');
    expect(transportError.intent).toBe('transport-error');
    expect(transportError.payload).toBeNull();
    expect(transportError.error).toBeTruthy();
  });

  it('malformed fixture has intent=malformed', () => {
    const malformed = loadFixture('topology.malformed.fixture.json');
    expect(malformed.intent).toBe('malformed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE BUDGET
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — Performance Budget', () => {
  it('populated fixture is within MAX_NODES budget', () => {
    expect(populated.nodes.length).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.MAX_NODES);
  });

  it('large-scale fixture is at MAX_NODES boundary', () => {
    expect(largeScale.nodes.length).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.MAX_NODES);
  });

  it('summary.truncated is false when under budget', () => {
    expect(populated.summary.truncated).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FORMAT BYTES HELPER
// ═══════════════════════════════════════════════════════════════════

describe('Slice 39 — formatBytes helper', () => {
  function formatBytes(b: number): string {
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
    if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
    return `${b} B`;
  }

  it('formats bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(1500000)).toBe('1.5 MB');
    expect(formatBytes(1500000000)).toBe('1.5 GB');
  });

  it('handles edge case values', () => {
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1000)).toBe('1.0 KB');
    expect(formatBytes(1000000)).toBe('1.0 MB');
    expect(formatBytes(1000000000)).toBe('1.0 GB');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SLICE 40 — NODE TOOLTIP DATA CONTRACT
// ═══════════════════════════════════════════════════════════════════

describe('Slice 40 — Node Tooltip Data Contract', () => {
  it('every populated node has displayName for tooltip', () => {
    for (const node of populated.nodes) {
      expect(typeof node.displayName).toBe('string');
      expect(node.displayName.length).toBeGreaterThan(0);
    }
  });

  it('every populated node has ipaddr or null for tooltip', () => {
    for (const node of populated.nodes) {
      expect(
        node.ipaddr === null || node.ipaddr === undefined || typeof node.ipaddr === 'string'
      ).toBe(true);
    }
  });

  it('every populated node has numeric totalBytes for tooltip traffic display', () => {
    for (const node of populated.nodes) {
      expect(typeof node.totalBytes).toBe('number');
      expect(Number.isFinite(node.totalBytes)).toBe(true);
      expect(node.totalBytes).toBeGreaterThanOrEqual(0);
    }
  });

  it('every populated node has numeric activeDetections for tooltip', () => {
    for (const node of populated.nodes) {
      expect(typeof node.activeDetections).toBe('number');
      expect(Number.isFinite(node.activeDetections)).toBe(true);
      expect(node.activeDetections).toBeGreaterThanOrEqual(0);
    }
  });

  it('every populated node has numeric activeAlerts for tooltip', () => {
    for (const node of populated.nodes) {
      expect(typeof node.activeAlerts).toBe('number');
      expect(Number.isFinite(node.activeAlerts)).toBe(true);
      expect(node.activeAlerts).toBeGreaterThanOrEqual(0);
    }
  });

  it('every populated node has a role that maps to ROLE_DISPLAY for tooltip', () => {
    for (const node of populated.nodes) {
      const meta = ROLE_DISPLAY[node.role];
      expect(meta).toBeDefined();
      expect(typeof meta.label).toBe('string');
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });

  it('every populated node has a clusterId that maps to a cluster label for tooltip', () => {
    const clusterLabels = new Map(populated.clusters.map((c: any) => [c.id, c.label]));
    for (const node of populated.nodes) {
      expect(clusterLabels.has(node.clusterId)).toBe(true);
      const label = clusterLabels.get(node.clusterId);
      expect(typeof label).toBe('string');
      expect(label!.length).toBeGreaterThan(0);
    }
  });

  it('large-scale nodes all have valid tooltip fields (no NaN/undefined)', () => {
    for (const node of largeScale.nodes) {
      expect(typeof node.displayName).toBe('string');
      expect(Number.isFinite(node.totalBytes)).toBe(true);
      expect(Number.isFinite(node.activeDetections)).toBe(true);
      expect(Number.isFinite(node.activeAlerts)).toBe(true);
    }
  });

  it('quiet fixture produces no tooltip data (zero nodes)', () => {
    expect(quiet.nodes.length).toBe(0);
    // ForceGraph should render no node tooltips in quiet state
  });
});

// ═══════════════════════════════════════════════════════════════════
// SLICE 40 — EDGE LABEL DATA CONTRACT
// ═══════════════════════════════════════════════════════════════════

describe('Slice 40 — Edge Label Data Contract', () => {
  it('every populated edge has a protocol string for label', () => {
    for (const edge of populated.edges) {
      expect(typeof edge.protocol).toBe('string');
      expect(edge.protocol.length).toBeGreaterThan(0);
    }
  });

  it('every populated edge has numeric bytes for traffic display', () => {
    for (const edge of populated.edges) {
      expect(typeof edge.bytes).toBe('number');
      expect(Number.isFinite(edge.bytes)).toBe(true);
      expect(edge.bytes).toBeGreaterThanOrEqual(0);
    }
  });

  it('every populated edge has boolean hasDetection for status indicator', () => {
    for (const edge of populated.edges) {
      expect(typeof edge.hasDetection).toBe('boolean');
    }
  });

  it('every populated edge sourceId/targetId maps to a node displayName for label', () => {
    const nodeNames = new Map(populated.nodes.map((n: TopologyNode) => [n.id, n.displayName]));
    for (const edge of populated.edges) {
      expect(nodeNames.has(edge.sourceId)).toBe(true);
      expect(nodeNames.has(edge.targetId)).toBe(true);
      expect(typeof nodeNames.get(edge.sourceId)).toBe('string');
      expect(typeof nodeNames.get(edge.targetId)).toBe('string');
    }
  });

  it('large-scale edges all have valid label fields (no NaN/undefined)', () => {
    for (const edge of largeScale.edges) {
      expect(typeof edge.protocol).toBe('string');
      expect(Number.isFinite(edge.bytes)).toBe(true);
      expect(typeof edge.hasDetection).toBe('boolean');
    }
  });

  it('quiet fixture produces no edge labels (zero edges)', () => {
    expect(quiet.edges.length).toBe(0);
    // ForceGraph should render no edge labels in quiet state
  });

  it('formatBytes produces readable traffic labels for edge tooltip', () => {
    function formatBytes(b: number): string {
      if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
      if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
      if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
      return `${b} B`;
    }

    // Verify all edge bytes produce readable strings
    for (const edge of populated.edges) {
      const label = formatBytes(edge.bytes);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      expect(label).toMatch(/^\d+(\.\d+)?\s+(B|KB|MB|GB)$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SLICE 40 — CONSTELLATION VIEW DEAD CODE REMOVAL
// ═══════════════════════════════════════════════════════════════════

describe('Slice 40 — ConstellationView Dead Code Removal', () => {
  it('Topology.tsx no longer contains ConstellationView function', () => {
    const topologySource = readFileSync(
      join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'),
      'utf-8'
    );
    // The function definition should not exist
    expect(topologySource).not.toMatch(/function ConstellationView\s*\(/);
  });

  it('Topology.tsx no longer contains computeLayout function', () => {
    const topologySource = readFileSync(
      join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'),
      'utf-8'
    );
    expect(topologySource).not.toMatch(/function computeLayout\s*\(/);
  });

  it('Topology.tsx no longer contains NodePos interface', () => {
    const topologySource = readFileSync(
      join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'),
      'utf-8'
    );
    expect(topologySource).not.toMatch(/interface NodePos\s*\{/);
  });

  it('ForceGraph.tsx exists and contains ForceGraph component', () => {
    const forceGraphSource = readFileSync(
      join(process.cwd(), 'client', 'src', 'components', 'ForceGraph.tsx'),
      'utf-8'
    );
    expect(forceGraphSource).toContain('const ForceGraph');
    expect(forceGraphSource).toContain('export default ForceGraph');
  });

  it('ForceGraph.tsx contains tooltip rendering logic', () => {
    const forceGraphSource = readFileSync(
      join(process.cwd(), 'client', 'src', 'components', 'ForceGraph.tsx'),
      'utf-8'
    );
    expect(forceGraphSource).toContain('topology-tooltip');
    expect(forceGraphSource).toContain('NodeTooltipData');
    expect(forceGraphSource).toContain('EdgeTooltipData');
  });

  it('ForceGraph.tsx contains edge hover hit area for labels', () => {
    const forceGraphSource = readFileSync(
      join(process.cwd(), 'client', 'src', 'components', 'ForceGraph.tsx'),
      'utf-8'
    );
    expect(forceGraphSource).toContain('edge-hit-');
    expect(forceGraphSource).toContain('handleEdgeMouseEnter');
  });

  it('Topology.tsx imports ForceGraph', () => {
    const topologySource = readFileSync(
      join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'),
      'utf-8'
    );
    expect(topologySource).toContain("ForceGraph");
    expect(topologySource).toContain("@/components/ForceGraph");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SLICE 41 — LAYOUT PERSISTENCE TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Slice 41 — Layout Persistence Logic', () => {
  // ─── SavedPosition serialization contract ──────────────────────
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

  it('serializes and deserializes positions round-trip', () => {
    const positions = new Map<number, SavedPosition>();
    positions.set(1, { x: 100.5, y: 200.3 });
    positions.set(42, { x: -50, y: 300 });
    positions.set(999, { x: 0, y: 0 });

    const serialized = serializePositions(positions);
    const restored = deserializePositions(serialized);

    expect(restored.size).toBe(3);
    expect(restored.get(1)).toEqual({ x: 100.5, y: 200.3 });
    expect(restored.get(42)).toEqual({ x: -50, y: 300 });
    expect(restored.get(999)).toEqual({ x: 0, y: 0 });
  });

  it('handles empty positions map', () => {
    const positions = new Map<number, SavedPosition>();
    const serialized = serializePositions(positions);
    expect(serialized).toBe('{}');
    const restored = deserializePositions(serialized);
    expect(restored.size).toBe(0);
  });

  it('rejects NaN values during deserialization', () => {
    const raw = JSON.stringify({ '1': { x: NaN, y: 100 }, '2': { x: 200, y: 300 } });
    // NaN is serialized as null in JSON, so x becomes null which fails typeof check
    const restored = deserializePositions(raw);
    expect(restored.has(1)).toBe(false);
    expect(restored.get(2)).toEqual({ x: 200, y: 300 });
  });

  it('rejects Infinity values during deserialization', () => {
    const raw = JSON.stringify({ '1': { x: Infinity, y: 100 } });
    // Infinity is serialized as null in JSON
    const restored = deserializePositions(raw);
    expect(restored.has(1)).toBe(false);
  });

  it('rejects malformed entries during deserialization', () => {
    const raw = JSON.stringify({
      '1': { x: 100, y: 200 },
      'abc': { x: 300, y: 400 },
      '3': { x: 'not-a-number', y: 500 },
      '4': null,
      '5': { x: 100 },
    });
    const restored = deserializePositions(raw);
    expect(restored.size).toBe(1);
    expect(restored.get(1)).toEqual({ x: 100, y: 200 });
  });

  it('handles invalid JSON gracefully', () => {
    expect(() => deserializePositions('not-json')).toThrow();
    // In the component, this is wrapped in try/catch returning empty Map
  });

  it('preserves positions for all populated fixture nodes', () => {
    const positions = new Map<number, SavedPosition>();
    populated.nodes.forEach((n: TopologyNode, i: number) => {
      positions.set(n.id, { x: i * 50, y: i * 30 });
    });

    const serialized = serializePositions(positions);
    const restored = deserializePositions(serialized);

    expect(restored.size).toBe(populated.nodes.length);
    populated.nodes.forEach((n: TopologyNode, i: number) => {
      expect(restored.get(n.id)).toEqual({ x: i * 50, y: i * 30 });
    });
  });

  it('handles large-scale fixture node positions', () => {
    const positions = new Map<number, SavedPosition>();
    largeScale.nodes.forEach((n: TopologyNode) => {
      positions.set(n.id, { x: Math.random() * 5120, y: Math.random() * 1440 });
    });

    const serialized = serializePositions(positions);
    const restored = deserializePositions(serialized);

    expect(restored.size).toBe(largeScale.nodes.length);
  });

  it('quiet fixture produces zero saved positions', () => {
    const positions = new Map<number, SavedPosition>();
    quiet.nodes.forEach((n: TopologyNode) => {
      positions.set(n.id, { x: 0, y: 0 });
    });

    const serialized = serializePositions(positions);
    const restored = deserializePositions(serialized);

    // quiet fixture has 0 nodes
    expect(restored.size).toBe(quiet.nodes.length);
  });
});

describe('Slice 41 — ForceGraph Source Code Contract', () => {
  const forceGraphSource = readFileSync(
    join(process.cwd(), 'client', 'src', 'components', 'ForceGraph.tsx'),
    'utf-8'
  );
  const topologySource = readFileSync(
    join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'),
    'utf-8'
  );

  it('ForceGraph defines LAYOUT_STORAGE_KEY constant', () => {
    expect(forceGraphSource).toContain("LAYOUT_STORAGE_KEY = 'topology-node-positions'");
  });

  it('ForceGraph exports resetLayout in ForceGraphHandle', () => {
    expect(forceGraphSource).toContain('resetLayout: () => void');
  });

  it('ForceGraph exports hasCustomLayout in ForceGraphHandle', () => {
    expect(forceGraphSource).toContain('hasCustomLayout: boolean');
  });

  it('ForceGraph calls localStorage.setItem on drag end', () => {
    expect(forceGraphSource).toContain('localStorage.setItem(LAYOUT_STORAGE_KEY');
  });

  it('ForceGraph calls localStorage.getItem on load', () => {
    expect(forceGraphSource).toContain('localStorage.getItem(LAYOUT_STORAGE_KEY)');
  });

  it('ForceGraph calls localStorage.removeItem on reset', () => {
    expect(forceGraphSource).toContain('localStorage.removeItem(LAYOUT_STORAGE_KEY)');
  });

  it('ForceGraph pins restored nodes with fx/fy', () => {
    expect(forceGraphSource).toContain('fx: existing ? existing.fx : (saved ? saved.x : undefined)');
    expect(forceGraphSource).toContain('fy: existing ? existing.fy : (saved ? saved.y : undefined)');
  });

  it('ForceGraph pins dragged nodes on drag end (fx = d.x)', () => {
    expect(forceGraphSource).toContain('d.fx = d.x');
    expect(forceGraphSource).toContain('d.fy = d.y');
  });

  it('ForceGraph validates Number.isFinite before saving', () => {
    expect(forceGraphSource).toContain('Number.isFinite(d.x)');
    expect(forceGraphSource).toContain('Number.isFinite(d.y)');
  });

  it('ForceGraph resetLayout unpins all nodes', () => {
    expect(forceGraphSource).toContain('n.fx = null');
    expect(forceGraphSource).toContain('n.fy = null');
  });

  it('Topology.tsx has Reset Layout button with data-testid', () => {
    expect(topologySource).toContain('data-testid="reset-layout"');
  });

  it('Topology.tsx calls forceGraphRef.current?.resetLayout()', () => {
    expect(topologySource).toContain('forceGraphRef.current?.resetLayout()');
  });

  it('Topology.tsx imports RotateCcw icon for reset button', () => {
    expect(topologySource).toContain('RotateCcw');
  });

  it('ForceGraph deserialization rejects NaN and Infinity', () => {
    expect(forceGraphSource).toContain('Number.isFinite(v.x)');
    expect(forceGraphSource).toContain('Number.isFinite(v.y)');
  });
});


// ═══════════════════════════════════════════════════════════════════════
// Slice 42 — Saved Views Positions, Lock All, JSON Export/Import
// ═══════════════════════════════════════════════════════════════════════

describe('Slice 42 — Saved Views Position Integration', () => {
  const schemaSource = readFileSync(join(process.cwd(), 'drizzle', 'schema.ts'), 'utf-8');
  const dbSource = readFileSync(join(process.cwd(), 'server', 'db.ts'), 'utf-8');
  const routersSource = readFileSync(join(process.cwd(), 'server', 'routers.ts'), 'utf-8');
  const topologySource = readFileSync(join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'), 'utf-8');
  const forceGraphSource = readFileSync(join(process.cwd(), 'client', 'src', 'components', 'ForceGraph.tsx'), 'utf-8');

  // ─── DB Schema ─────────────────────────────────────────────────
  it('schema has node_positions JSON column on saved_topology_views', () => {
    expect(schemaSource).toContain('nodePositions');
    expect(schemaSource).toContain('node_positions');
  });

  // ─── DB helpers ────────────────────────────────────────────────
  it('createSavedTopologyView accepts nodePositions parameter', () => {
    expect(dbSource).toContain('nodePositions?: Record<string, { x: number; y: number }> | null');
  });

  it('updateSavedTopologyView accepts nodePositions parameter', () => {
    // Should appear twice — once in create, once in update
    const matches = dbSource.match(/nodePositions\?: Record<string, \{ x: number; y: number \}> \| null/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('createSavedTopologyView persists nodePositions to DB', () => {
    expect(dbSource).toContain('nodePositions: input.nodePositions ?? null');
  });

  // ─── tRPC router ──────────────────────────────────────────────
  it('savedViews.create schema includes nodePositions with Zod validation', () => {
    expect(routersSource).toContain('nodePositions: z.record(z.string(), z.object({ x: z.number().finite(), y: z.number().finite() }))');
  });

  it('savedViews.update schema includes nodePositions with Zod validation', () => {
    // Both create and update should have the nodePositions Zod schema
    const matches = routersSource.match(/nodePositions: z\.record/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  // ─── ForceGraph handle ────────────────────────────────────────
  it('ForceGraphHandle exposes getNodePositions method', () => {
    expect(forceGraphSource).toContain('getNodePositions: () => Record<string, { x: number; y: number }>');
  });

  it('ForceGraphHandle exposes applyNodePositions method', () => {
    expect(forceGraphSource).toContain('applyNodePositions: (positions: Record<string, { x: number; y: number }>) => void');
  });

  it('getNodePositions rejects NaN/Infinity values', () => {
    expect(forceGraphSource).toContain('Number.isFinite(n.x) && Number.isFinite(n.y)');
  });

  it('applyNodePositions validates each position entry', () => {
    expect(forceGraphSource).toContain('Number.isFinite(v.x) && Number.isFinite(v.y)');
  });

  // ─── Topology integration ─────────────────────────────────────
  it('SavedViewsPanel currentState includes nodePositions', () => {
    expect(topologySource).toContain('nodePositions: forceGraphRef.current?.getNodePositions() ?? null');
  });

  it('handleLoadView restores nodePositions via applyNodePositions', () => {
    expect(topologySource).toContain('forceGraphRef.current?.applyNodePositions(view.nodePositions)');
  });

  it('SavedViewsPanel passes nodePositions to createMutation', () => {
    expect(topologySource).toContain('nodePositions: currentState.nodePositions');
  });
});

describe('Slice 42 — Lock All Toggle', () => {
  const forceGraphSource = readFileSync(join(process.cwd(), 'client', 'src', 'components', 'ForceGraph.tsx'), 'utf-8');
  const topologySource = readFileSync(join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'), 'utf-8');

  // ─── ForceGraph handle ────────────────────────────────────────
  it('ForceGraphHandle exposes isLocked boolean', () => {
    expect(forceGraphSource).toContain('isLocked: boolean');
  });

  it('ForceGraphHandle exposes toggleLock method', () => {
    expect(forceGraphSource).toContain('toggleLock: () => void');
  });

  it('isLocked state is initialized to false', () => {
    expect(forceGraphSource).toContain('const [isLocked, setIsLocked] = useState(false)');
  });

  it('toggleLock pins all nodes when locking', () => {
    expect(forceGraphSource).toContain('n.fx = n.x');
    expect(forceGraphSource).toContain('n.fy = n.y');
  });

  it('toggleLock stops simulation when locking', () => {
    expect(forceGraphSource).toContain("simulationRef.current?.stop()");
  });

  it('toggleLock restarts simulation when unlocking', () => {
    expect(forceGraphSource).toContain("simulationRef.current?.alpha(0.3).restart()");
  });

  it('drag handlers check isLockedRef before allowing drag', () => {
    expect(forceGraphSource).toContain('if (isLockedRef.current) return;');
    // Should appear in all three handlers: start, drag, end
    const matches = forceGraphSource.match(/if \(isLockedRef\.current\) return;/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  it('resetLayout also resets isLocked to false', () => {
    expect(forceGraphSource).toContain('setIsLocked(false)');
  });

  // ─── Topology toolbar ─────────────────────────────────────────
  it('Topology.tsx has Lock/Unlock icons imported', () => {
    expect(topologySource).toContain('Lock,');
    expect(topologySource).toContain('Unlock,');
  });

  it('Topology.tsx has toggle-lock button with data-testid', () => {
    expect(topologySource).toContain('data-testid="toggle-lock"');
  });

  it('Topology.tsx calls forceGraphRef.current?.toggleLock()', () => {
    expect(topologySource).toContain('forceGraphRef.current?.toggleLock()');
  });

  it('Lock button has amber highlight when locked', () => {
    expect(topologySource).toContain('bg-amber-500/20 text-amber-400');
  });
});

describe('Slice 42 — JSON Layout Export/Import', () => {
  const topologySource = readFileSync(join(process.cwd(), 'client', 'src', 'pages', 'Topology.tsx'), 'utf-8');

  // ─── Export ────────────────────────────────────────────────────
  it('ExportMenu accepts getNodePositions prop', () => {
    expect(topologySource).toContain('getNodePositions?: () => Record<string, { x: number; y: number }>');
  });

  it('ExportMenu accepts applyNodePositions prop', () => {
    expect(topologySource).toContain('applyNodePositions?: (positions: Record<string, { x: number; y: number }>) => void');
  });

  it('Export layout uses format version string', () => {
    expect(topologySource).toContain("_format: 'network-performance-topology-layout-v1'");
  });

  it('Export layout includes nodeCount and positions', () => {
    expect(topologySource).toContain('nodeCount: count');
    expect(topologySource).toContain('positions,');
  });

  it('Export layout button has data-testid', () => {
    expect(topologySource).toContain('data-testid="export-layout-json"');
  });

  it('Export layout produces a .json file download', () => {
    expect(topologySource).toContain('topology-layout-');
    expect(topologySource).toContain('.json');
  });

  // ─── Import ────────────────────────────────────────────────────
  it('Import layout button has data-testid', () => {
    expect(topologySource).toContain('data-testid="import-layout-json"');
  });

  it('Import validates format version string', () => {
    expect(topologySource).toContain("raw._format !== 'network-performance-topology-layout-v1'");
  });

  it('Import validates positions object exists', () => {
    expect(topologySource).toContain("!raw.positions || typeof raw.positions !== 'object'");
  });

  it('Import validates each position has finite x and y', () => {
    expect(topologySource).toContain('Number.isFinite(pos.x) && Number.isFinite(pos.y)');
  });

  it('Import rejects files with zero valid positions', () => {
    expect(topologySource).toContain("'No valid positions in layout file'");
  });

  it('Import calls applyNodePositions with clean data', () => {
    expect(topologySource).toContain('applyNodePositions(clean)');
  });

  it('Hidden file input accepts only JSON files', () => {
    expect(topologySource).toContain('accept=".json,application/json"');
  });

  it('File input resets after import to allow re-import', () => {
    expect(topologySource).toContain("e.target.value = ''");
  });

  // ─── Topology passes props to ExportMenu ──────────────────────
  it('ExportMenu call site passes getNodePositions', () => {
    expect(topologySource).toContain('getNodePositions={() => forceGraphRef.current?.getNodePositions()');
  });

  it('ExportMenu call site passes applyNodePositions', () => {
    expect(topologySource).toContain('applyNodePositions={(pos) => forceGraphRef.current?.applyNodePositions(pos)}');
  });
});
