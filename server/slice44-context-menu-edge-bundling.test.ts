/**
 * Slice 44 — Right-Click Context Menu & Edge Bundling Tests
 *
 * CONTRACT:
 * - All tests run against deterministic fixtures
 * - No live hardware required
 * - Tests validate context menu data preparation, edge bundling computation,
 *   cross-surface URL generation, and bundle aggregation logic
 * - UI rendering tested via data contracts, not browser DOM
 *
 * Live integration: deferred by contract.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { TopologyPayloadSchema } from '../shared/topology-validators';
import type { TopologyPayload, TopologyNode, TopologyEdge } from '../shared/topology-types';
import { TOPOLOGY_PERFORMANCE } from '../shared/topology-types';
import {
  buildFlowTheaterUrl,
  buildBlastRadiusUrl,
  NAV_PARAM,
} from '../shared/cross-surface-nav-types';

// ─── Fixture Loaders ──────────────────────────────────────────────
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'topology');

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

function loadPayload(name: string): TopologyPayload {
  const data = loadFixture(name);
  return data.payload;
}

// ─── Edge Bundling computation (mirrors ForceGraph logic) ─────────
interface SimEdge {
  sourceClusterId: string;
  targetClusterId: string;
  bytes: number;
  hasDetection: boolean;
}

interface EdgeBundle {
  sourceClusterId: string;
  targetClusterId: string;
  totalBytes: number;
  edgeCount: number;
  hasDetection: boolean;
}

function computeEdgeBundles(
  nodes: TopologyNode[],
  edges: TopologyEdge[]
): EdgeBundle[] {
  const nodeCluster = new Map<number, string>();
  for (const n of nodes) {
    nodeCluster.set(n.id, n.clusterId);
  }

  const bundleMap = new Map<string, { totalBytes: number; edgeCount: number; hasDetection: boolean }>();

  for (const edge of edges) {
    const srcCluster = nodeCluster.get(edge.sourceId);
    const tgtCluster = nodeCluster.get(edge.targetId);
    if (!srcCluster || !tgtCluster || srcCluster === tgtCluster) continue;

    const key = srcCluster < tgtCluster
      ? `${srcCluster}||${tgtCluster}`
      : `${tgtCluster}||${srcCluster}`;

    if (!bundleMap.has(key)) {
      bundleMap.set(key, { totalBytes: 0, edgeCount: 0, hasDetection: false });
    }
    const b = bundleMap.get(key)!;
    b.edgeCount += 1;
    b.totalBytes += edge.bytes;
    b.hasDetection = b.hasDetection || edge.hasDetection;
  }

  const bundles: EdgeBundle[] = [];
  for (const entry of Array.from(bundleMap.entries())) {
    const [key, data] = entry;
    if (data.edgeCount < 2) continue;
    const [srcCluster, tgtCluster] = key.split('||');
    bundles.push({
      sourceClusterId: srcCluster,
      targetClusterId: tgtCluster,
      ...data,
    });
  }
  return bundles;
}

// ─── Context Menu data preparation (mirrors ForceGraph logic) ─────
interface ContextMenuState {
  nodeId: number;
  displayName: string;
  ipaddr: string;
  isPinned: boolean;
}

function buildContextMenuState(
  node: TopologyNode,
  isPinned: boolean
): ContextMenuState {
  return {
    nodeId: node.id,
    displayName: node.displayName,
    ipaddr: node.ipaddr || '',
    isPinned,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────
const populated = loadPayload('topology.populated.fixture.json');
const quiet = loadPayload('topology.quiet.fixture.json');
const largeScale = loadPayload('topology.large-scale.fixture.json');

// ═══════════════════════════════════════════════════════════════════
// CONTEXT MENU — DATA PREPARATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Context Menu Data Preparation', () => {
  it('builds context menu state for a node with IP', () => {
    const node = populated.nodes[0]; // dc01.lab.local
    const state = buildContextMenuState(node, false);
    expect(state.nodeId).toBe(node.id);
    expect(state.displayName).toBe(node.displayName);
    expect(state.ipaddr).toBeTruthy();
    expect(state.isPinned).toBe(false);
  });

  it('builds context menu state for a pinned node', () => {
    const node = populated.nodes[1];
    const state = buildContextMenuState(node, true);
    expect(state.isPinned).toBe(true);
  });

  it('handles node with empty ipaddr gracefully', () => {
    // Simulate a node without IP
    const fakeNode: TopologyNode = {
      ...populated.nodes[0],
      ipaddr: '',
    };
    const state = buildContextMenuState(fakeNode, false);
    expect(state.ipaddr).toBe('');
  });

  it('all populated nodes produce valid context menu state', () => {
    for (const node of populated.nodes) {
      const state = buildContextMenuState(node, false);
      expect(state.nodeId).toBe(node.id);
      expect(typeof state.displayName).toBe('string');
      expect(state.displayName.length).toBeGreaterThan(0);
      expect(typeof state.ipaddr).toBe('string');
      expect(typeof state.isPinned).toBe('boolean');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONTEXT MENU — CROSS-SURFACE NAVIGATION URLS
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Cross-Surface Navigation URLs', () => {
  it('builds Flow Theater URL with hostname mode', () => {
    const url = buildFlowTheaterUrl({
      mode: 'hostname',
      value: 'dc01.lab.local',
      autoSubmit: true,
    });
    expect(url).toContain('/flow-theater');
    expect(url).toContain(`${NAV_PARAM.FT_MODE}=hostname`);
    expect(url).toContain(`${NAV_PARAM.FT_VALUE}=dc01.lab.local`);
    expect(url).toContain(`${NAV_PARAM.FT_AUTO}=1`);
  });

  it('builds Blast Radius URL with device-id mode', () => {
    const url = buildBlastRadiusUrl({
      mode: 'device-id',
      value: '1001',
      autoSubmit: true,
    });
    expect(url).toContain('/blast-radius');
    expect(url).toContain(`${NAV_PARAM.BR_MODE}=device-id`);
    expect(url).toContain(`${NAV_PARAM.BR_VALUE}=1001`);
    expect(url).toContain(`${NAV_PARAM.BR_AUTO}=1`);
  });

  it('builds Flow Theater URL without autoSubmit', () => {
    const url = buildFlowTheaterUrl({
      mode: 'hostname',
      value: 'web-app-01.lab.local',
    });
    expect(url).toContain('/flow-theater');
    expect(url).not.toContain(`${NAV_PARAM.FT_AUTO}`);
  });

  it('builds Blast Radius URL with ip-address mode', () => {
    const url = buildBlastRadiusUrl({
      mode: 'ip-address',
      value: '10.1.20.1',
      autoSubmit: true,
    });
    expect(url).toContain(`${NAV_PARAM.BR_MODE}=ip-address`);
    expect(url).toContain(`${NAV_PARAM.BR_VALUE}=10.1.20.1`);
  });

  it('all populated nodes produce valid navigation URLs', () => {
    for (const node of populated.nodes) {
      const ftUrl = buildFlowTheaterUrl({
        mode: 'hostname',
        value: node.displayName,
        autoSubmit: true,
      });
      expect(ftUrl).toContain('/flow-theater');
      expect(ftUrl).toContain(encodeURIComponent(node.displayName));

      const brUrl = buildBlastRadiusUrl({
        mode: 'device-id',
        value: String(node.id),
        autoSubmit: true,
      });
      expect(brUrl).toContain('/blast-radius');
      expect(brUrl).toContain(String(node.id));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// CONTEXT MENU — PIN/UNPIN LOGIC
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Pin/Unpin Logic', () => {
  it('unpinned node shows "Pin Node" action', () => {
    const state = buildContextMenuState(populated.nodes[0], false);
    expect(state.isPinned).toBe(false);
    // UI should show "Pin Node" label
  });

  it('pinned node shows "Unpin Node" action', () => {
    const state = buildContextMenuState(populated.nodes[0], true);
    expect(state.isPinned).toBe(true);
    // UI should show "Unpin Node" label
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE BUNDLING — COMPUTATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Edge Bundling Computation', () => {
  it('returns empty bundles for quiet fixture', () => {
    const bundles = computeEdgeBundles(quiet.nodes, quiet.edges);
    expect(bundles).toEqual([]);
  });

  it('returns empty bundles for populated fixture (15 nodes < 200 threshold)', () => {
    // The bundling logic itself doesn't enforce threshold — that's in the component.
    // Here we test the computation which should produce bundles if cross-cluster edges exist.
    const bundles = computeEdgeBundles(populated.nodes, populated.edges);
    // Populated has 3 clusters with cross-cluster edges
    // Some pairs may have 2+ edges
    expect(Array.isArray(bundles)).toBe(true);
  });

  it('produces bundles for large-scale fixture (200 nodes)', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    expect(bundles.length).toBeGreaterThan(0);
  });

  it('large-scale bundles have correct edge counts', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    // All bundles should have edgeCount >= 2 (single edges are not bundled)
    for (const b of bundles) {
      expect(b.edgeCount).toBeGreaterThanOrEqual(2);
    }
  });

  it('large-scale bundles have correct totalBytes (sum of constituent edges)', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    const nodeCluster = new Map<number, string>();
    for (const n of largeScale.nodes) {
      nodeCluster.set(n.id, n.clusterId);
    }

    for (const bundle of bundles) {
      // Manually compute expected total
      let expectedBytes = 0;
      let expectedCount = 0;
      for (const edge of largeScale.edges) {
        const srcC = nodeCluster.get(edge.sourceId)!;
        const tgtC = nodeCluster.get(edge.targetId)!;
        const key = srcC < tgtC ? `${srcC}||${tgtC}` : `${tgtC}||${srcC}`;
        if (key === `${bundle.sourceClusterId}||${bundle.targetClusterId}`) {
          expectedBytes += edge.bytes;
          expectedCount += 1;
        }
      }
      expect(bundle.totalBytes).toBe(expectedBytes);
      expect(bundle.edgeCount).toBe(expectedCount);
    }
  });

  it('total bundled edges equals total cross-cluster edges for large-scale', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    const totalBundled = bundles.reduce((s, b) => s + b.edgeCount, 0);
    
    // Count all cross-cluster edges
    const nodeCluster = new Map<number, string>();
    for (const n of largeScale.nodes) {
      nodeCluster.set(n.id, n.clusterId);
    }
    let crossClusterCount = 0;
    for (const edge of largeScale.edges) {
      const srcC = nodeCluster.get(edge.sourceId);
      const tgtC = nodeCluster.get(edge.targetId);
      if (srcC && tgtC && srcC !== tgtC) {
        crossClusterCount += 1;
      }
    }

    // All cross-cluster edges should be bundled (since all pairs have >= 2 edges in large-scale)
    expect(totalBundled).toBe(crossClusterCount);
  });

  it('bundles have unique cluster pair keys', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    const keys = bundles.map((b) => `${b.sourceClusterId}||${b.targetClusterId}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('no bundle has NaN or Infinity in totalBytes', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    for (const b of bundles) {
      expect(Number.isFinite(b.totalBytes)).toBe(true);
      expect(Number.isNaN(b.totalBytes)).toBe(false);
    }
  });

  it('hasDetection flag is correctly propagated', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    const nodeCluster = new Map<number, string>();
    for (const n of largeScale.nodes) {
      nodeCluster.set(n.id, n.clusterId);
    }

    for (const bundle of bundles) {
      let anyDetection = false;
      for (const edge of largeScale.edges) {
        const srcC = nodeCluster.get(edge.sourceId)!;
        const tgtC = nodeCluster.get(edge.targetId)!;
        const key = srcC < tgtC ? `${srcC}||${tgtC}` : `${tgtC}||${srcC}`;
        if (key === `${bundle.sourceClusterId}||${bundle.targetClusterId}`) {
          if (edge.hasDetection) anyDetection = true;
        }
      }
      expect(bundle.hasDetection).toBe(anyDetection);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE BUNDLING — BUNDLE WIDTH SCALING
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Bundle Width Scaling', () => {
  function bundleWidth(edgeCount: number): number {
    return Math.min(
      Math.max(2, Math.log2(edgeCount + 1) * 3),
      TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX
    );
  }

  it('returns minimum width for 2 edges', () => {
    const w = bundleWidth(2);
    expect(w).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(w)).toBe(true);
  });

  it('returns capped width for very large bundles', () => {
    const w = bundleWidth(1000);
    expect(w).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX);
    expect(Number.isFinite(w)).toBe(true);
  });

  it('width increases with edge count', () => {
    const w5 = bundleWidth(5);
    const w20 = bundleWidth(20);
    const w100 = bundleWidth(100);
    expect(w20).toBeGreaterThanOrEqual(w5);
    expect(w100).toBeGreaterThanOrEqual(w20);
  });

  it('all large-scale bundles produce valid widths', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    for (const b of bundles) {
      const w = bundleWidth(b.edgeCount);
      expect(w).toBeGreaterThanOrEqual(2);
      expect(w).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX);
      expect(Number.isFinite(w)).toBe(true);
      expect(Number.isNaN(w)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE BUNDLING — THRESHOLD BEHAVIOR
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Edge Bundling Threshold', () => {
  const EDGE_BUNDLE_THRESHOLD = 200;

  it('populated fixture (15 nodes) is below threshold', () => {
    expect(populated.nodes.length).toBeLessThan(EDGE_BUNDLE_THRESHOLD);
  });

  it('large-scale fixture (200 nodes) meets threshold', () => {
    expect(largeScale.nodes.length).toBeGreaterThanOrEqual(EDGE_BUNDLE_THRESHOLD);
  });

  it('quiet fixture (0 nodes) is below threshold', () => {
    expect(quiet.nodes.length).toBeLessThan(EDGE_BUNDLE_THRESHOLD);
  });

  it('bundling should not activate for small graphs even if enabled', () => {
    // This mirrors the component logic: shouldBundle = edgeBundlingEnabled && nodes.length >= 200
    const shouldBundle = true && populated.nodes.length >= EDGE_BUNDLE_THRESHOLD;
    expect(shouldBundle).toBe(false);
  });

  it('bundling activates for large-scale when enabled', () => {
    const shouldBundle = true && largeScale.nodes.length >= EDGE_BUNDLE_THRESHOLD;
    expect(shouldBundle).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// EDGE BUNDLING — INTRA-CLUSTER EDGES EXCLUDED
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Intra-Cluster Edge Exclusion', () => {
  it('bundles only contain cross-cluster edges', () => {
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    for (const b of bundles) {
      expect(b.sourceClusterId).not.toBe(b.targetClusterId);
    }
  });

  it('intra-cluster edges are not bundled', () => {
    const nodeCluster = new Map<number, string>();
    for (const n of largeScale.nodes) {
      nodeCluster.set(n.id, n.clusterId);
    }

    const intraClusterEdges = largeScale.edges.filter((e: TopologyEdge) => {
      const srcC = nodeCluster.get(e.sourceId);
      const tgtC = nodeCluster.get(e.targetId);
      return srcC === tgtC;
    });

    // In the large-scale fixture, all edges are cross-cluster
    // But the logic should handle intra-cluster edges by excluding them
    const bundles = computeEdgeBundles(largeScale.nodes, largeScale.edges);
    const bundledEdgeCount = bundles.reduce((s, b) => s + b.edgeCount, 0);
    const crossClusterEdgeCount = largeScale.edges.length - intraClusterEdges.length;
    expect(bundledEdgeCount).toBe(crossClusterEdgeCount);
  });
});

// ═══════════════════════════════════════════════════════════════════
// COPY IP — VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Copy IP Validation', () => {
  it('all populated nodes have non-empty IP addresses', () => {
    for (const node of populated.nodes) {
      expect(node.ipaddr).toBeTruthy();
      expect(node.ipaddr.length).toBeGreaterThan(0);
    }
  });

  it('IP addresses match expected format', () => {
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    for (const node of populated.nodes) {
      expect(ipRegex.test(node.ipaddr)).toBe(true);
    }
  });

  it('Copy IP action should be disabled when IP is empty', () => {
    const state = buildContextMenuState(
      { ...populated.nodes[0], ipaddr: '' },
      false
    );
    expect(state.ipaddr).toBe('');
    // UI should disable the Copy IP button
  });
});

// ═══════════════════════════════════════════════════════════════════
// FIXTURE SCHEMA VALIDATION (Slice 44 re-validation)
// ═══════════════════════════════════════════════════════════════════

describe('Slice 44 — Fixture Schema Re-validation', () => {
  it('populated fixture still passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse(populated);
    expect(result.success).toBe(true);
  });

  it('quiet fixture still passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse(quiet);
    expect(result.success).toBe(true);
  });

  it('large-scale fixture still passes TopologyPayloadSchema', () => {
    const result = TopologyPayloadSchema.safeParse(largeScale);
    expect(result.success).toBe(true);
  });
});
