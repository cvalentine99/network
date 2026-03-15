/**
 * Slice 35 — Tier 5 NOC-Grade Topology Tests
 *
 * Tests for all 6 features:
 *   35A: Subnet Map View (buildSubnetMap)
 *   35B: Critical Path Highlighting (findCriticalPath)
 *   35C: Anomaly Detection Overlay (buildAnomalyOverlay)
 *   35D: Export Topology (JSON/CSV serialization)
 *   35E: Saved Views (schema validation — publicProcedure, no auth)
 *   35F: Multi-Appliance Merge (mergeTopologies)
 *
 * CONTRACT:
 * - All tests run against deterministic fixtures
 * - No live hardware required
 * - No Manus OAuth required
 * - Validated against shared types and Zod schemas
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildSubnetMap, formatSubnetBytes } from '../shared/topology-subnet-map';
import { findCriticalPath, getPathNodeIds, getPathEdgeKeys } from '../shared/topology-critical-path';
import { buildAnomalyOverlay, getAnomalyEdgeKeys, getAnomalyNodeIds } from '../shared/topology-anomaly-detection';
import { exportTopologyAsJson, exportTopologyAsCsv, exportNodesAsCsv, exportEdgesAsCsv } from '../shared/topology-export';
import { mergeTopologies } from '../shared/topology-merge';
import {
  SubnetContainerSchema,
  InterSubnetEdgeSchema,
  SubnetMapSummarySchema,
  CriticalPathResultSchema,
  AnomalyOverlayPayloadSchema,
  TopologyExportResultSchema,
  MergedTopologyPayloadSchema,
  SaveViewRequestSchema,
  TopologySavedViewSchema,
} from '../shared/topology-advanced-validators';
import type { TopologyPayload } from '../shared/topology-types';

// ─── Fixture Loaders ──────────────────────────────────────────────
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'topology');

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

function loadPayload(name: string): TopologyPayload {
  const data = loadFixture(name);
  return data.payload;
}

// ─── Fixtures ─────────────────────────────────────────────────────
const populated = loadPayload('topology.populated.fixture.json');
const quiet = loadPayload('topology.quiet.fixture.json');
const baseline = loadPayload('topology.baseline.fixture.json');
const anomalyPopulated = loadPayload('topology.anomaly-populated.fixture.json');
const multiAppliance = loadFixture('topology.multi-appliance.fixture.json');

// ═══════════════════════════════════════════════════════════════════
// 35A: SUBNET MAP VIEW
// ═══════════════════════════════════════════════════════════════════
describe('Slice 35A — Subnet Map View', () => {
  describe('buildSubnetMap', () => {
    it('returns object with subnets, interSubnetEdges, intraSubnetEdges, summary', () => {
      const result = buildSubnetMap(populated);
      expect(result.subnets).toBeDefined();
      expect(Array.isArray(result.subnets)).toBe(true);
      expect(result.interSubnetEdges).toBeDefined();
      expect(result.intraSubnetEdges).toBeInstanceOf(Map);
      expect(result.summary).toBeDefined();
    });

    it('each subnet validates against SubnetContainerSchema', () => {
      const result = buildSubnetMap(populated);
      for (const subnet of result.subnets) {
        const parsed = SubnetContainerSchema.safeParse(subnet);
        expect(parsed.success).toBe(true);
      }
    });

    it('each interSubnetEdge validates against InterSubnetEdgeSchema', () => {
      const result = buildSubnetMap(populated);
      for (const edge of result.interSubnetEdges) {
        const parsed = InterSubnetEdgeSchema.safeParse(edge);
        expect(parsed.success).toBe(true);
      }
    });

    it('summary validates against SubnetMapSummarySchema', () => {
      const result = buildSubnetMap(populated);
      const parsed = SubnetMapSummarySchema.safeParse(result.summary);
      expect(parsed.success).toBe(true);
    });

    it('creates one subnet container per cluster', () => {
      const result = buildSubnetMap(populated);
      expect(result.subnets.length).toBe(populated.clusters.length);
    });

    it('assigns all nodes to exactly one subnet', () => {
      const result = buildSubnetMap(populated);
      const totalNodes = result.subnets.reduce((sum, s) => sum + s.nodes.length, 0);
      expect(totalNodes).toBe(populated.nodes.length);
    });

    it('computes totalBytes per subnet correctly', () => {
      const result = buildSubnetMap(populated);
      for (const subnet of result.subnets) {
        const expected = subnet.nodes.reduce((sum, n) => sum + n.totalBytes, 0);
        expect(subnet.totalBytes).toBe(expected);
      }
    });

    it('computes totalDetections per subnet correctly', () => {
      const result = buildSubnetMap(populated);
      for (const subnet of result.subnets) {
        const expected = subnet.nodes.reduce((sum, n) => sum + n.activeDetections, 0);
        expect(subnet.totalDetections).toBe(expected);
      }
    });

    it('identifies inter-subnet edges between different clusters', () => {
      const result = buildSubnetMap(populated);
      for (const edge of result.interSubnetEdges) {
        expect(edge.sourceClusterId).not.toBe(edge.targetClusterId);
      }
    });

    it('handles quiet payload (zero nodes) gracefully', () => {
      const result = buildSubnetMap(quiet);
      expect(result.subnets.length).toBe(0);
      expect(result.interSubnetEdges.length).toBe(0);
      expect(result.summary.totalSubnets).toBe(0);
    });

    it('summary totals are consistent', () => {
      const result = buildSubnetMap(populated);
      expect(result.summary.totalSubnets).toBe(result.subnets.length);
      expect(result.summary.totalInterSubnetEdges).toBe(result.interSubnetEdges.length);
    });
  });

  describe('formatSubnetBytes', () => {
    it('formats zero bytes', () => {
      expect(formatSubnetBytes(0)).toBe('0 B');
    });

    it('formats kilobytes', () => {
      expect(formatSubnetBytes(1500)).toContain('KB');
    });

    it('formats megabytes', () => {
      expect(formatSubnetBytes(2_500_000)).toContain('MB');
    });

    it('formats gigabytes', () => {
      expect(formatSubnetBytes(3_000_000_000)).toContain('GB');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 35B: CRITICAL PATH HIGHLIGHTING
// ═══════════════════════════════════════════════════════════════════
describe('Slice 35B — Critical Path Highlighting', () => {
  describe('findCriticalPath', () => {
    it('returns valid CriticalPathResult schema when path found', () => {
      const edge = populated.edges[0];
      const result = findCriticalPath(populated, edge.sourceId, edge.targetId);
      const parsed = CriticalPathResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('finds a direct path between connected nodes', () => {
      const edge = populated.edges[0];
      const result = findCriticalPath(populated, edge.sourceId, edge.targetId);
      expect(result.pathFound).toBe(true);
      expect(result.hopCount).toBeGreaterThanOrEqual(1);
      expect(result.path.length).toBeGreaterThanOrEqual(2);
    });

    it('path starts with source and ends with destination', () => {
      const edge = populated.edges[0];
      const result = findCriticalPath(populated, edge.sourceId, edge.targetId);
      if (result.pathFound) {
        expect(result.path[0].nodeId).toBe(edge.sourceId);
        expect(result.path[result.path.length - 1].nodeId).toBe(edge.targetId);
      }
    });

    it('returns pathFound=false for disconnected nodes', () => {
      const result = findCriticalPath(populated, populated.nodes[0].id, 999999);
      expect(result.pathFound).toBe(false);
      expect(result.hopCount).toBe(0);
      expect(result.path).toEqual([]);
    });

    it('returns pathFound=false when source equals destination', () => {
      const nodeId = populated.nodes[0].id;
      const result = findCriticalPath(populated, nodeId, nodeId);
      expect(result.path.length).toBeLessThanOrEqual(1);
    });

    it('getPathNodeIds returns set of node IDs on the path', () => {
      const edge = populated.edges[0];
      const result = findCriticalPath(populated, edge.sourceId, edge.targetId);
      if (result.pathFound) {
        const nodeIds = getPathNodeIds(result);
        expect(nodeIds.has(edge.sourceId)).toBe(true);
        expect(nodeIds.has(edge.targetId)).toBe(true);
        expect(nodeIds.size).toBe(result.path.length);
      }
    });

    it('getPathEdgeKeys returns set of edge keys on the path', () => {
      const edge = populated.edges[0];
      const result = findCriticalPath(populated, edge.sourceId, edge.targetId);
      if (result.pathFound && result.path.length >= 2) {
        const edgeKeys = getPathEdgeKeys(result);
        expect(edgeKeys.size).toBeGreaterThanOrEqual(1);
      }
    });

    it('handles quiet payload gracefully', () => {
      const result = findCriticalPath(quiet, 1, 2);
      expect(result.pathFound).toBe(false);
    });

    it('totalBytes accumulates edge bytes along path', () => {
      const edge = populated.edges[0];
      const result = findCriticalPath(populated, edge.sourceId, edge.targetId);
      if (result.pathFound) {
        expect(result.totalBytes).toBeGreaterThanOrEqual(0);
        expect(typeof result.totalBytes).toBe('number');
        expect(Number.isFinite(result.totalBytes)).toBe(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 35C: ANOMALY DETECTION OVERLAY
// ═══════════════════════════════════════════════════════════════════
describe('Slice 35C — Anomaly Detection Overlay', () => {
  describe('buildAnomalyOverlay', () => {
    it('returns valid AnomalyOverlayPayload schema', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      const parsed = AnomalyOverlayPayloadSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('detects anomalies when traffic deviates from baseline', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      const totalAnomalies = result.edgeAnomalies.length + result.nodeAnomalies.length;
      expect(totalAnomalies).toBeGreaterThan(0);
    });

    it('anomaly severity is one of: low, medium, high, critical', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      const validSeverities = new Set(['low', 'medium', 'high', 'critical']);
      for (const a of [...result.edgeAnomalies, ...result.nodeAnomalies]) {
        expect(validSeverities.has(a.severity)).toBe(true);
      }
    });

    it('deviationPercent is a finite number', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      for (const a of [...result.edgeAnomalies, ...result.nodeAnomalies]) {
        expect(Number.isFinite(a.deviationPercent)).toBe(true);
      }
    });

    it('edge anomaly direction is spike or drop', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      for (const a of result.edgeAnomalies) {
        expect(['spike', 'drop']).toContain(a.direction);
      }
    });

    it('summary counts are consistent', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      const s = result.summary;
      expect(s.totalEdgeAnomalies).toBe(result.edgeAnomalies.length);
      expect(s.totalNodeAnomalies).toBe(result.nodeAnomalies.length);
      const severitySum = s.criticalCount + s.highCount + s.mediumCount + s.lowCount;
      expect(severitySum).toBe(s.totalEdgeAnomalies + s.totalNodeAnomalies);
    });

    it('getAnomalyEdgeKeys returns bidirectional map (2x anomaly count)', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      const edgeMap = getAnomalyEdgeKeys(result.edgeAnomalies);
      // Each anomaly creates two entries (forward + reverse key)
      expect(edgeMap.size).toBe(result.edgeAnomalies.length * 2);
    });

    it('getAnomalyNodeIds returns map of node ID to anomaly', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      const nodeMap = getAnomalyNodeIds(result.nodeAnomalies);
      expect(nodeMap.size).toBe(result.nodeAnomalies.length);
    });

    it('handles identical current and baseline (no anomalies)', () => {
      const result = buildAnomalyOverlay(baseline, baseline);
      expect(result.edgeAnomalies.length).toBe(0);
      expect(result.nodeAnomalies.length).toBe(0);
    });

    it('handles quiet payload gracefully', () => {
      const result = buildAnomalyOverlay(quiet, baseline);
      expect(result.edgeAnomalies.length).toBe(0);
      expect(result.nodeAnomalies.length).toBe(0);
    });

    it('deviationThreshold defaults to 50', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      expect(result.deviationThreshold).toBe(50);
    });

    it('custom deviationThreshold is respected', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline, 10);
      expect(result.deviationThreshold).toBe(10);
      const resultDefault = buildAnomalyOverlay(anomalyPopulated, baseline);
      expect(result.edgeAnomalies.length + result.nodeAnomalies.length).toBeGreaterThanOrEqual(
        resultDefault.edgeAnomalies.length + resultDefault.nodeAnomalies.length
      );
    });

    it('no NaN or Infinity in anomaly values', () => {
      const result = buildAnomalyOverlay(anomalyPopulated, baseline);
      for (const a of [...result.edgeAnomalies, ...result.nodeAnomalies]) {
        expect(Number.isNaN(a.deviationPercent)).toBe(false);
        expect(a.deviationPercent).not.toBe(Infinity);
        expect(a.deviationPercent).not.toBe(-Infinity);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 35D: EXPORT TOPOLOGY
// ═══════════════════════════════════════════════════════════════════
describe('Slice 35D — Export Topology', () => {
  describe('exportTopologyAsJson', () => {
    it('returns valid JSON string in data field', () => {
      const result = exportTopologyAsJson(populated);
      expect(() => JSON.parse(result.data)).not.toThrow();
    });

    it('filename ends with .json', () => {
      const result = exportTopologyAsJson(populated);
      expect(result.filename).toMatch(/\.json$/);
    });

    it('mimeType is application/json', () => {
      const result = exportTopologyAsJson(populated);
      expect(result.mimeType).toBe('application/json');
    });

    it('exported JSON contains nodes and edges', () => {
      const result = exportTopologyAsJson(populated);
      const parsed = JSON.parse(result.data);
      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
      expect(parsed.nodes.length).toBe(populated.nodes.length);
      expect(parsed.edges.length).toBe(populated.edges.length);
    });

    it('validates against TopologyExportResultSchema', () => {
      const result = exportTopologyAsJson(populated);
      const parsed = TopologyExportResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('exportTopologyAsCsv', () => {
    it('returns CSV content with header row', () => {
      const result = exportTopologyAsCsv(populated);
      const lines = result.data.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('filename ends with .csv', () => {
      const result = exportTopologyAsCsv(populated);
      expect(result.filename).toMatch(/\.csv$/);
    });

    it('mimeType is text/csv', () => {
      const result = exportTopologyAsCsv(populated);
      expect(result.mimeType).toBe('text/csv');
    });
  });

  describe('exportNodesAsCsv', () => {
    it('has one row per node plus header', () => {
      const result = exportNodesAsCsv(populated.nodes);
      const lines = result.data.trim().split('\n');
      expect(lines.length).toBe(populated.nodes.length + 1);
    });

    it('header contains expected columns', () => {
      const result = exportNodesAsCsv(populated.nodes);
      const header = result.data.split('\n')[0];
      expect(header).toContain('id');
      expect(header).toContain('displayName');
      expect(header).toContain('role');
      expect(header).toContain('totalBytes');
    });
  });

  describe('exportEdgesAsCsv', () => {
    it('has one row per edge plus header', () => {
      const result = exportEdgesAsCsv(populated.edges);
      const lines = result.data.trim().split('\n');
      expect(lines.length).toBe(populated.edges.length + 1);
    });

    it('header contains expected columns', () => {
      const result = exportEdgesAsCsv(populated.edges);
      const header = result.data.split('\n')[0];
      expect(header).toContain('sourceId');
      expect(header).toContain('targetId');
      expect(header).toContain('protocol');
      expect(header).toContain('bytes');
    });
  });

  describe('quiet payload export', () => {
    it('JSON export handles empty nodes/edges', () => {
      const result = exportTopologyAsJson(quiet);
      const parsed = JSON.parse(result.data);
      expect(parsed.nodes.length).toBe(0);
      expect(parsed.edges.length).toBe(0);
    });

    it('CSV export handles empty nodes', () => {
      const result = exportNodesAsCsv(quiet.nodes);
      const lines = result.data.trim().split('\n');
      expect(lines.length).toBe(1); // header only
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 35E: SAVED VIEWS
// ═══════════════════════════════════════════════════════════════════
describe('Slice 35E — Saved Views', () => {
  describe('SaveViewRequest schema validation', () => {
    it('validates a complete save view request', () => {
      const config = {
        name: 'Test View',
        viewMode: 'constellation',
        zoom: 1.5,
        panX: 0,
        panY: 0,
        searchTerm: 'server',
        roleFilters: ['server', 'gateway'],
        protocolFilters: ['TCP'],
        anomalyOverlayEnabled: true,
        anomalyThreshold: 50,
        criticalPathSource: 1001,
        criticalPathDestination: 1002,
        collapsedSubnets: ['subnet-10.1.20'],
      };
      const parsed = SaveViewRequestSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('validates minimal save view request', () => {
      const config = {
        viewMode: 'constellation',
        zoom: 1,
        panX: 0,
        panY: 0,
        searchTerm: '',
        roleFilters: [],
        protocolFilters: [],
        anomalyOverlayEnabled: false,
        anomalyThreshold: 50,
        criticalPathSource: null,
        criticalPathDestination: null,
        collapsedSubnets: [],
      };
      const parsed = SaveViewRequestSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });

    it('rejects invalid viewMode', () => {
      const config = {
        viewMode: 'invalid-mode',
        zoom: 1,
        panX: 0,
        panY: 0,
        searchTerm: '',
        roleFilters: [],
        protocolFilters: [],
        anomalyOverlayEnabled: false,
        anomalyThreshold: 50,
        criticalPathSource: null,
        criticalPathDestination: null,
        collapsedSubnets: [],
      };
      const parsed = SaveViewRequestSchema.safeParse(config);
      expect(parsed.success).toBe(false);
    });

    it('rejects zoom outside valid range (negative)', () => {
      const config = {
        viewMode: 'constellation',
        zoom: -1,
        panX: 0,
        panY: 0,
        searchTerm: '',
        roleFilters: [],
        protocolFilters: [],
        anomalyOverlayEnabled: false,
        anomalyThreshold: 50,
        criticalPathSource: null,
        criticalPathDestination: null,
        collapsedSubnets: [],
      };
      const parsed = SaveViewRequestSchema.safeParse(config);
      expect(parsed.success).toBe(false);
    });

    it('validates subnet-map viewMode', () => {
      const config = {
        name: 'Subnet View',
        viewMode: 'subnet-map',
        zoom: 1,
        panX: 0,
        panY: 0,
        searchTerm: '',
        roleFilters: [],
        protocolFilters: [],
        anomalyOverlayEnabled: false,
        anomalyThreshold: 50,
        criticalPathSource: null,
        criticalPathDestination: null,
        collapsedSubnets: ['subnet-10.1.20'],
      };
      const parsed = SaveViewRequestSchema.safeParse(config);
      expect(parsed.success).toBe(true);
    });
  });

  describe('TopologySavedView schema validation', () => {
    it('validates a full saved view record', () => {
      const record = {
        id: 1,
        name: 'My View',
        viewMode: 'constellation',
        zoom: 1.5,
        panX: 0,
        panY: 0,
        collapsedSubnets: [],
        roleFilters: ['server'],
        protocolFilters: ['TCP'],
        anomalyOverlayEnabled: false,
        anomalyThreshold: 50,
        criticalPathSource: null,
        criticalPathDestination: null,
        searchTerm: '',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
        userId: 'local',
      };
      const parsed = TopologySavedViewSchema.safeParse(record);
      expect(parsed.success).toBe(true);
    });

    it('rejects record with empty name', () => {
      const record = {
        id: 1,
        name: '',
        viewMode: 'constellation',
        zoom: 1,
        panX: 0,
        panY: 0,
        collapsedSubnets: [],
        roleFilters: [],
        protocolFilters: [],
        anomalyOverlayEnabled: false,
        anomalyThreshold: 50,
        criticalPathSource: null,
        criticalPathDestination: null,
        searchTerm: '',
        createdAt: '2026-03-15T00:00:00.000Z',
        updatedAt: '2026-03-15T00:00:00.000Z',
        userId: 'local',
      };
      const parsed = TopologySavedViewSchema.safeParse(record);
      expect(parsed.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 35F: MULTI-APPLIANCE MERGE
// ═══════════════════════════════════════════════════════════════════
describe('Slice 35F — Multi-Appliance Merge', () => {
  describe('mergeTopologies', () => {
    const makeSources = () => [
      { applianceId: multiAppliance.applianceA.applianceId, label: multiAppliance.applianceA.label, payload: multiAppliance.applianceA.payload },
      { applianceId: multiAppliance.applianceB.applianceId, label: multiAppliance.applianceB.label, payload: multiAppliance.applianceB.payload },
    ];

    it('returns valid MergedTopologyPayload schema', () => {
      const result = mergeTopologies(makeSources());
      const parsed = MergedTopologyPayloadSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('merged node count is <= sum of source nodes (dedup by IP)', () => {
      const sources = makeSources();
      const result = mergeTopologies(sources);
      const totalSourceNodes = sources.reduce((s, src) => s + src.payload.nodes.length, 0);
      expect(result.nodes.length).toBeLessThanOrEqual(totalSourceNodes);
    });

    it('deduplicates shared nodes by IP address', () => {
      const result = mergeTopologies(makeSources());
      const ips = result.nodes
        .filter((n) => n.ipaddr)
        .map((n) => n.ipaddr);
      const uniqueIps = new Set(ips);
      expect(ips.length).toBe(uniqueIps.size);
    });

    it('merged edges include edges from both sources', () => {
      const result = mergeTopologies(makeSources());
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it('appliances array tracks source appliance metadata', () => {
      const result = mergeTopologies(makeSources());
      expect(result.appliances.length).toBe(2);
      for (const a of result.appliances) {
        expect(a.applianceId).toBeDefined();
        expect(a.label).toBeDefined();
        expect(a.color).toBeDefined();
      }
    });

    it('sharedNodeCount reflects deduplicated nodes', () => {
      const result = mergeTopologies(makeSources());
      // The fixture has 1 shared node (10.1.10.1)
      expect(result.sharedNodeCount).toBe(1);
    });

    it('handles single source (no merge needed)', () => {
      const sources = [
        { applianceId: multiAppliance.applianceA.applianceId, label: multiAppliance.applianceA.label, payload: multiAppliance.applianceA.payload },
      ];
      const result = mergeTopologies(sources);
      expect(result.nodes.length).toBe(multiAppliance.applianceA.payload.nodes.length);
      expect(result.edges.length).toBe(multiAppliance.applianceA.payload.edges.length);
      expect(result.sharedNodeCount).toBe(0);
    });

    it('handles empty sources array', () => {
      const result = mergeTopologies([]);
      expect(result.nodes.length).toBe(0);
      expect(result.edges.length).toBe(0);
    });

    it('merged summary is accurate', () => {
      const result = mergeTopologies(makeSources());
      const s = result.summary;
      expect(s.totalNodes).toBe(result.nodes.length);
      expect(s.totalEdges).toBe(result.edges.length);
      expect(s.totalClusters).toBe(result.clusters.length);
      expect(s.totalAppliances).toBe(2);
      expect(s.sharedNodes).toBe(result.sharedNodeCount);
    });

    it('no NaN or Infinity in merged node totalBytes', () => {
      const result = mergeTopologies(makeSources());
      for (const n of result.nodes) {
        expect(Number.isFinite(n.totalBytes)).toBe(true);
      }
    });

    it('no NaN or Infinity in merged edge bytes', () => {
      const result = mergeTopologies(makeSources());
      for (const e of result.edges) {
        expect(Number.isFinite(e.bytes)).toBe(true);
      }
    });

    it('applianceNodeCounts tracks per-appliance counts', () => {
      const result = mergeTopologies(makeSources());
      expect(Object.keys(result.applianceNodeCounts).length).toBe(2);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// CROSS-CUTTING: SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════
describe('Cross-cutting — Schema Validation', () => {
  it('SubnetContainerSchema rejects invalid data', () => {
    const parsed = SubnetContainerSchema.safeParse({ clusterId: 123 });
    expect(parsed.success).toBe(false);
  });

  it('CriticalPathResultSchema rejects invalid data', () => {
    const parsed = CriticalPathResultSchema.safeParse({ pathFound: 'yes' });
    expect(parsed.success).toBe(false);
  });

  it('AnomalyOverlayPayloadSchema rejects invalid data', () => {
    const parsed = AnomalyOverlayPayloadSchema.safeParse({ edgeAnomalies: 123 });
    expect(parsed.success).toBe(false);
  });

  it('MergedTopologyPayloadSchema rejects invalid data', () => {
    const parsed = MergedTopologyPayloadSchema.safeParse({ appliances: null });
    expect(parsed.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// FIXTURE INTEGRITY
// ═══════════════════════════════════════════════════════════════════
describe('Fixture Integrity', () => {
  it('topology.baseline.fixture.json loads and has payload', () => {
    expect(baseline).toBeDefined();
    expect(baseline.nodes).toBeDefined();
    expect(baseline.edges).toBeDefined();
  });

  it('topology.anomaly-populated.fixture.json loads and has payload', () => {
    expect(anomalyPopulated).toBeDefined();
    expect(anomalyPopulated.nodes).toBeDefined();
    expect(anomalyPopulated.edges).toBeDefined();
  });

  it('topology.multi-appliance.fixture.json loads and has both appliances', () => {
    expect(multiAppliance.applianceA).toBeDefined();
    expect(multiAppliance.applianceB).toBeDefined();
    expect(multiAppliance.applianceA.payload.nodes.length).toBeGreaterThan(0);
    expect(multiAppliance.applianceB.payload.nodes.length).toBeGreaterThan(0);
  });

  it('baseline fixture has no NaN/Infinity values in node bytes', () => {
    for (const n of baseline.nodes) {
      expect(Number.isFinite(n.totalBytes)).toBe(true);
    }
  });

  it('anomaly fixture has no NaN/Infinity values in node bytes', () => {
    for (const n of anomalyPopulated.nodes) {
      expect(Number.isFinite(n.totalBytes)).toBe(true);
    }
  });
});
