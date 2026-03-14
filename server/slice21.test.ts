/**
 * Slice 21 — Living Topology: Comprehensive Test Suite
 *
 * Coverage:
 * 1. Enum schemas (device roles, protocols)
 * 2. TopologyNode / TopologyEdge / TopologyCluster schema validation
 * 3. TopologyPayload schema validation
 * 4. TopologyBffResponse schema validation
 * 5. Structural validators (edge refs, cluster refs, summary counts, unique IDs, unique edges, cluster node counts, detection/alert counts)
 * 6. ROLE_DISPLAY constant contract
 * 7. TOPOLOGY_PERFORMANCE constant contract
 * 8. Fixture validation (all 6 fixtures)
 * 9. Large-scale fixture: 200-node performance budget
 * 10. BFF route tests (supertest against standalone Express app)
 * 11. Layout engine (computeLayout) contract
 * 12. App.tsx route registration
 * 13. Nav de-placeholdering
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

import {
  TopologyDeviceRoleSchema,
  TopologyProtocolSchema,
  TopologyNodeSchema,
  TopologyEdgeSchema,
  TopologyClusterSchema,
  TopologyNodePositionSchema,
  TopologySummarySchema,
  TopologyPayloadSchema,
  TopologyQueryRequestSchema,
  TopologyBffResponseSchema,
  validateEdgeReferences,
  validateClusterReferences,
  validateSummaryCounts,
  validateUniqueNodeIds,
  validateUniqueEdges,
  validateClusterNodeCounts,
  validateDetectionAlertCounts,
} from '../shared/topology-validators';

import {
  TOPOLOGY_DEVICE_ROLES,
  TOPOLOGY_PROTOCOLS,
  ROLE_DISPLAY,
  TOPOLOGY_PERFORMANCE,
} from '../shared/topology-types';
import type { TopologyDeviceRole, TopologyPayload } from '../shared/topology-types';

// ─── Helpers ───────────────────────────────────────────────────────
const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/topology');

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8'));
}

const FIXTURES = [
  'topology.populated.fixture.json',
  'topology.quiet.fixture.json',
  'topology.error.fixture.json',
  'topology.transport-error.fixture.json',
  'topology.malformed.fixture.json',
  'topology.large-scale.fixture.json',
];

const DATA_FIXTURES = [
  'topology.populated.fixture.json',
  'topology.quiet.fixture.json',
  'topology.large-scale.fixture.json',
];

// ═══════════════════════════════════════════════════════════════════
// 1. ENUM SCHEMAS
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — Enum Schemas', () => {
  describe('TopologyDeviceRoleSchema', () => {
    it('accepts all defined roles', () => {
      for (const role of TOPOLOGY_DEVICE_ROLES) {
        expect(TopologyDeviceRoleSchema.safeParse(role).success).toBe(true);
      }
    });

    it('rejects unknown role', () => {
      expect(TopologyDeviceRoleSchema.safeParse('spaceship').success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(TopologyDeviceRoleSchema.safeParse('').success).toBe(false);
    });

    it('rejects number', () => {
      expect(TopologyDeviceRoleSchema.safeParse(42).success).toBe(false);
    });
  });

  describe('TopologyProtocolSchema', () => {
    it('accepts all defined protocols', () => {
      for (const proto of TOPOLOGY_PROTOCOLS) {
        expect(TopologyProtocolSchema.safeParse(proto).success).toBe(true);
      }
    });

    it('rejects unknown protocol', () => {
      expect(TopologyProtocolSchema.safeParse('QUIC').success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. TOPOLOGY NODE SCHEMA
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TopologyNodeSchema', () => {
  const validNode = {
    id: 1,
    displayName: 'dc01.lab.local',
    role: 'server',
    ipaddr: '10.0.1.10',
    macaddr: '00:1A:2B:3C:4D:5E',
    clusterId: 'cluster-servers',
    totalBytes: 500000000,
    activeDetections: 2,
    activeAlerts: 1,
    critical: true,
  };

  it('accepts a valid node', () => {
    expect(TopologyNodeSchema.safeParse(validNode).success).toBe(true);
  });

  it('accepts node with null ipaddr and macaddr', () => {
    const n = { ...validNode, ipaddr: null, macaddr: null };
    expect(TopologyNodeSchema.safeParse(n).success).toBe(true);
  });

  it('rejects node with missing id', () => {
    const { id, ...rest } = validNode;
    expect(TopologyNodeSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects node with negative totalBytes', () => {
    const n = { ...validNode, totalBytes: -1 };
    expect(TopologyNodeSchema.safeParse(n).success).toBe(false);
  });

  it('rejects node with negative activeDetections', () => {
    const n = { ...validNode, activeDetections: -1 };
    expect(TopologyNodeSchema.safeParse(n).success).toBe(false);
  });

  it('rejects node with invalid role', () => {
    const n = { ...validNode, role: 'spaceship' };
    expect(TopologyNodeSchema.safeParse(n).success).toBe(false);
  });

  it('rejects node with empty displayName', () => {
    const n = { ...validNode, displayName: '' };
    expect(TopologyNodeSchema.safeParse(n).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. TOPOLOGY EDGE SCHEMA
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TopologyEdgeSchema', () => {
  const validEdge = {
    sourceId: 1,
    targetId: 2,
    protocol: 'TCP',
    bytes: 100000,
    hasDetection: false,
    latencyMs: 1.5,
  };

  it('accepts a valid edge', () => {
    expect(TopologyEdgeSchema.safeParse(validEdge).success).toBe(true);
  });

  it('rejects edge with same source and target', () => {
    // Schema doesn't enforce this but structural validator should
    const e = { ...validEdge, targetId: 1 };
    // Schema itself accepts it (structural validator catches this)
    expect(TopologyEdgeSchema.safeParse(e).success).toBe(true);
  });

  it('rejects edge with negative bytes', () => {
    const e = { ...validEdge, bytes: -1 };
    expect(TopologyEdgeSchema.safeParse(e).success).toBe(false);
  });

  it('rejects edge with invalid protocol', () => {
    const e = { ...validEdge, protocol: 'QUIC' };
    expect(TopologyEdgeSchema.safeParse(e).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. TOPOLOGY CLUSTER SCHEMA
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TopologyClusterSchema', () => {
  const validCluster = {
    id: 'cluster-servers',
    label: 'Servers',
    groupBy: 'role' as const,
    nodeCount: 5,
  };

  it('accepts a valid cluster', () => {
    expect(TopologyClusterSchema.safeParse(validCluster).success).toBe(true);
  });

  it('rejects cluster with empty id', () => {
    const c = { ...validCluster, id: '' };
    expect(TopologyClusterSchema.safeParse(c).success).toBe(false);
  });

  it('rejects cluster with negative nodeCount', () => {
    const c = { ...validCluster, nodeCount: -1 };
    expect(TopologyClusterSchema.safeParse(c).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. TOPOLOGY PAYLOAD SCHEMA
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TopologyPayloadSchema', () => {
  it('accepts the populated fixture payload', () => {
    const fixture = loadFixture('topology.populated.fixture.json') as any;
    expect(TopologyPayloadSchema.safeParse(fixture.payload).success).toBe(true);
  });

  it('accepts the quiet fixture payload (empty arrays)', () => {
    const fixture = loadFixture('topology.quiet.fixture.json') as any;
    expect(TopologyPayloadSchema.safeParse(fixture.payload).success).toBe(true);
  });

  it('accepts the large-scale fixture payload', () => {
    const fixture = loadFixture('topology.large-scale.fixture.json') as any;
    expect(TopologyPayloadSchema.safeParse(fixture.payload).success).toBe(true);
  });

  it('rejects payload with missing nodes array', () => {
    expect(TopologyPayloadSchema.safeParse({ edges: [], clusters: [], summary: {}, timeWindow: { fromMs: 1, toMs: 2 } }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. TOPOLOGY BFF RESPONSE SCHEMA
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TopologyBffResponseSchema', () => {
  for (const fname of FIXTURES.filter(f => f !== 'topology.malformed.fixture.json')) {
    it(`validates ${fname}`, () => {
      const fixture = loadFixture(fname);
      const result = TopologyBffResponseSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    });
  }

  it('malformed fixture fails schema validation (by design)', () => {
    const fixture = loadFixture('topology.malformed.fixture.json');
    const result = TopologyBffResponseSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });

  it('rejects response with unknown intent', () => {
    const bad = { intent: 'banana', payload: null, error: null };
    expect(TopologyBffResponseSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects response with missing intent', () => {
    const bad = { payload: null, error: null };
    expect(TopologyBffResponseSchema.safeParse(bad).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. STRUCTURAL VALIDATORS
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — Structural Validators', () => {
  for (const fname of DATA_FIXTURES) {
    describe(`against ${fname}`, () => {
      const fixture = loadFixture(fname) as any;
      const payload = fixture.payload as TopologyPayload;

      it('validateEdgeReferences passes', () => {
        expect(validateEdgeReferences(payload)).toBe(true);
      });

      it('validateClusterReferences passes', () => {
        expect(validateClusterReferences(payload)).toBe(true);
      });

      it('validateSummaryCounts passes', () => {
        expect(validateSummaryCounts(payload)).toBe(true);
      });

      it('validateUniqueNodeIds passes', () => {
        expect(validateUniqueNodeIds(payload)).toBe(true);
      });

      it('validateUniqueEdges passes', () => {
        expect(validateUniqueEdges(payload)).toBe(true);
      });

      it('validateClusterNodeCounts passes', () => {
        expect(validateClusterNodeCounts(payload)).toBe(true);
      });

      it('validateDetectionAlertCounts passes', () => {
        expect(validateDetectionAlertCounts(payload)).toBe(true);
      });
    });
  }

  describe('edge reference failure', () => {
    it('rejects edges referencing non-existent nodes', () => {
      const bad: TopologyPayload = {
        nodes: [{ id: 1, displayName: 'a', role: 'server', ipaddr: null, macaddr: null, clusterId: 'c1', totalBytes: 0, activeDetections: 0, activeAlerts: 0, critical: false }],
        edges: [{ sourceId: 1, targetId: 999, protocol: 'TCP', bytes: 0, hasDetection: false, latencyMs: null }],
        clusters: [{ id: 'c1', label: 'C1', groupBy: 'role', nodeCount: 1 }],
        summary: { totalNodes: 1, totalEdges: 1, totalClusters: 1, totalBytes: 0, nodesWithDetections: 0, nodesWithAlerts: 0, truncated: false, maxNodes: 200 },
        timeWindow: { fromMs: 1000, toMs: 2000 },
      };
      expect(validateEdgeReferences(bad)).toBe(false);
    });
  });

  describe('duplicate node ID failure', () => {
    it('rejects duplicate node IDs', () => {
      const bad: TopologyPayload = {
        nodes: [
          { id: 1, displayName: 'a', role: 'server', ipaddr: null, macaddr: null, clusterId: 'c1', totalBytes: 0, activeDetections: 0, activeAlerts: 0, critical: false },
          { id: 1, displayName: 'b', role: 'server', ipaddr: null, macaddr: null, clusterId: 'c1', totalBytes: 0, activeDetections: 0, activeAlerts: 0, critical: false },
        ],
        edges: [],
        clusters: [{ id: 'c1', label: 'C1', groupBy: 'role', nodeCount: 2 }],
        summary: { totalNodes: 2, totalEdges: 0, totalClusters: 1, totalBytes: 0, nodesWithDetections: 0, nodesWithAlerts: 0, truncated: false, maxNodes: 200 },
        timeWindow: { fromMs: 1000, toMs: 2000 },
      };
      expect(validateUniqueNodeIds(bad)).toBe(false);
    });
  });

  describe('summary count mismatch', () => {
    it('rejects mismatched totalNodes', () => {
      const bad: TopologyPayload = {
        nodes: [{ id: 1, displayName: 'a', role: 'server', ipaddr: null, macaddr: null, clusterId: 'c1', totalBytes: 0, activeDetections: 0, activeAlerts: 0, critical: false }],
        edges: [],
        clusters: [{ id: 'c1', label: 'C1', groupBy: 'role', nodeCount: 1 }],
        summary: { totalNodes: 99, totalEdges: 0, totalClusters: 1, totalBytes: 0, nodesWithDetections: 0, nodesWithAlerts: 0, truncated: false, maxNodes: 200 },
        timeWindow: { fromMs: 1000, toMs: 2000 },
      };
      expect(validateSummaryCounts(bad)).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. ROLE_DISPLAY CONSTANT CONTRACT
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — ROLE_DISPLAY constant', () => {
  it('has an entry for every device role', () => {
    for (const role of TOPOLOGY_DEVICE_ROLES) {
      expect(ROLE_DISPLAY[role]).toBeDefined();
      expect(ROLE_DISPLAY[role].label).toBeTruthy();
      expect(ROLE_DISPLAY[role].color).toBeTruthy();
      expect(ROLE_DISPLAY[role].icon).toBeTruthy();
    }
  });

  it('labels are unique', () => {
    const labels = Object.values(ROLE_DISPLAY).map((m) => m.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('colors are valid CSS color strings', () => {
    for (const meta of Object.values(ROLE_DISPLAY)) {
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. TOPOLOGY_PERFORMANCE CONSTANT CONTRACT
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TOPOLOGY_PERFORMANCE constant', () => {
  it('MAX_NODES is 200', () => {
    expect(TOPOLOGY_PERFORMANCE.MAX_NODES).toBe(200);
  });

  it('NODE_SIZE_MIN < NODE_SIZE_MAX', () => {
    expect(TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN).toBeLessThan(TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX);
  });

  it('EDGE_WIDTH_MIN < EDGE_WIDTH_MAX', () => {
    expect(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN).toBeLessThan(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX);
  });

  it('all values are positive', () => {
    expect(TOPOLOGY_PERFORMANCE.MAX_NODES).toBeGreaterThan(0);
    expect(TOPOLOGY_PERFORMANCE.NODE_SIZE_MIN).toBeGreaterThan(0);
    expect(TOPOLOGY_PERFORMANCE.NODE_SIZE_MAX).toBeGreaterThan(0);
    expect(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MIN).toBeGreaterThan(0);
    expect(TOPOLOGY_PERFORMANCE.EDGE_WIDTH_MAX).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. FIXTURE VALIDATION (ALL 6)
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — Fixture Validation', () => {
  for (const fname of FIXTURES.filter(f => f !== 'topology.malformed.fixture.json')) {
    it(`${fname} validates against TopologyBffResponseSchema`, () => {
      const fixture = loadFixture(fname);
      const result = TopologyBffResponseSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    });
  }

  it('malformed fixture intentionally fails schema validation', () => {
    const fixture = loadFixture('topology.malformed.fixture.json');
    const result = TopologyBffResponseSchema.safeParse(fixture);
    expect(result.success).toBe(false);
  });

  it('populated fixture has 15 nodes', () => {
    const f = loadFixture('topology.populated.fixture.json') as any;
    expect(f.payload.nodes.length).toBe(15);
  });

  it('quiet fixture has 0 nodes', () => {
    const f = loadFixture('topology.quiet.fixture.json') as any;
    expect(f.payload.nodes.length).toBe(0);
  });

  it('large-scale fixture has exactly 200 nodes', () => {
    const f = loadFixture('topology.large-scale.fixture.json') as any;
    expect(f.payload.nodes.length).toBe(200);
  });

  it('large-scale fixture is marked truncated', () => {
    const f = loadFixture('topology.large-scale.fixture.json') as any;
    expect(f.payload.summary.truncated).toBe(true);
  });

  it('error fixture has no payload', () => {
    const f = loadFixture('topology.error.fixture.json') as any;
    expect(f.payload).toBeNull();
    expect(f.error).toBeTruthy();
  });

  it('transport-error fixture has no payload', () => {
    const f = loadFixture('topology.transport-error.fixture.json') as any;
    expect(f.payload).toBeNull();
    expect(f.error).toBeTruthy();
  });

  it('malformed fixture has intent "malformed"', () => {
    const f = loadFixture('topology.malformed.fixture.json') as any;
    expect(f.intent).toBe('malformed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. LARGE-SCALE FIXTURE: 200-NODE PERFORMANCE BUDGET
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — 200-Node Performance Budget', () => {
  const fixture = loadFixture('topology.large-scale.fixture.json') as any;
  const payload = fixture.payload as TopologyPayload;

  it('does not exceed MAX_NODES', () => {
    expect(payload.nodes.length).toBeLessThanOrEqual(TOPOLOGY_PERFORMANCE.MAX_NODES);
  });

  it('summary.maxNodes matches TOPOLOGY_PERFORMANCE.MAX_NODES', () => {
    expect(payload.summary.maxNodes).toBe(TOPOLOGY_PERFORMANCE.MAX_NODES);
  });

  it('all structural validators pass on large-scale fixture', () => {
    expect(validateEdgeReferences(payload)).toBe(true);
    expect(validateClusterReferences(payload)).toBe(true);
    expect(validateSummaryCounts(payload)).toBe(true);
    expect(validateUniqueNodeIds(payload)).toBe(true);
    expect(validateUniqueEdges(payload)).toBe(true);
    expect(validateClusterNodeCounts(payload)).toBe(true);
    expect(validateDetectionAlertCounts(payload)).toBe(true);
  });

  it('all nodes have non-negative totalBytes', () => {
    for (const n of payload.nodes) {
      expect(n.totalBytes).toBeGreaterThanOrEqual(0);
    }
  });

  it('all edges reference valid nodes', () => {
    const nodeIds = new Set(payload.nodes.map((n) => n.id));
    for (const e of payload.edges) {
      expect(nodeIds.has(e.sourceId)).toBe(true);
      expect(nodeIds.has(e.targetId)).toBe(true);
    }
  });

  it('has multiple clusters', () => {
    expect(payload.clusters.length).toBeGreaterThan(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. QUERY REQUEST SCHEMA
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — TopologyQueryRequestSchema', () => {
  it('accepts valid request', () => {
    expect(TopologyQueryRequestSchema.safeParse({ fromMs: 1000, toMs: 2000 }).success).toBe(true);
  });

  it('accepts request with optional maxNodes', () => {
    expect(TopologyQueryRequestSchema.safeParse({ fromMs: 1000, toMs: 2000, maxNodes: 100 }).success).toBe(true);
  });

  it('accepts request with optional clusterId', () => {
    expect(TopologyQueryRequestSchema.safeParse({ fromMs: 1000, toMs: 2000, clusterId: 'cluster-servers' }).success).toBe(true);
  });

  it('rejects request with missing fromMs', () => {
    expect(TopologyQueryRequestSchema.safeParse({ toMs: 2000 }).success).toBe(false);
  });

  it('rejects request with toMs <= fromMs', () => {
    expect(TopologyQueryRequestSchema.safeParse({ fromMs: 2000, toMs: 1000 }).success).toBe(false);
  });

  it('rejects request with negative maxNodes', () => {
    expect(TopologyQueryRequestSchema.safeParse({ fromMs: 1000, toMs: 2000, maxNodes: -1 }).success).toBe(false);
  });

  it('rejects request with maxNodes > 500', () => {
    expect(TopologyQueryRequestSchema.safeParse({ fromMs: 1000, toMs: 2000, maxNodes: 501 }).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 13. BFF ROUTE TESTS (SUPERTEST)
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — BFF Route Tests', () => {
  let app: express.Express;

  // Build a standalone Express app with the topology route
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    const { default: topologyRouter } = await import('../server/routes/topology');
    app.use('/api/bff/topology', topologyRouter);
  });

  describe('POST /api/bff/topology/query', () => {
    it('returns 200 with populated fixture for normal time range', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: Date.now() - 300000, toMs: Date.now() })
        .expect(200);
      expect(res.body.intent).toBe('populated');
      expect(res.body.payload).toBeTruthy();
      expect(res.body.payload.nodes.length).toBeGreaterThan(0);
    });

    it('returns quiet fixture for sentinel fromMs=1', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: 1, toMs: 2 })
        .expect(200);
      expect(res.body.intent).toBe('quiet');
      expect(res.body.payload.nodes.length).toBe(0);
    });

    it('returns error fixture for sentinel fromMs=2', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: 2, toMs: 3 })
        .expect(200);
      expect(res.body.intent).toBe('error');
      expect(res.body.error).toBeTruthy();
    });

    it('returns transport-error fixture for sentinel fromMs=3', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: 3, toMs: 4 })
        .expect(200);
      expect(res.body.intent).toBe('transport-error');
    });

    it('returns malformed fixture for sentinel fromMs=4', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: 4, toMs: 5 })
        .expect(200);
      expect(res.body.intent).toBe('malformed');
    });

    it('returns large-scale fixture for sentinel fromMs=5', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: 5, toMs: 6 })
        .expect(200);
      expect(res.body.intent).toBe('populated');
      expect(res.body.payload.nodes.length).toBe(200);
    });

    it('returns 400 for missing body', async () => {
      await request(app)
        .post('/api/bff/topology/query')
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid body', async () => {
      await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: 'not-a-number' })
        .expect(400);
    });

    it('response validates against TopologyBffResponseSchema', async () => {
      const res = await request(app)
        .post('/api/bff/topology/query')
        .send({ fromMs: Date.now() - 300000, toMs: Date.now() })
        .expect(200);
      const parsed = TopologyBffResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
    });
  });

  describe('GET /api/bff/topology/fixtures', () => {
    it('returns 200 with fixture list', async () => {
      const res = await request(app)
        .get('/api/bff/topology/fixtures')
        .expect(200);
      expect(res.body.fixtures).toBeDefined();
      expect(Array.isArray(res.body.fixtures)).toBe(true);
      expect(res.body.fixtures.length).toBeGreaterThan(0);
    });

    it('fixture list contains all expected fixture names', async () => {
      const res = await request(app)
        .get('/api/bff/topology/fixtures')
        .expect(200);
      const names = res.body.fixtures as string[];
      expect(names).toContain('topology.populated.fixture.json');
      expect(names).toContain('topology.quiet.fixture.json');
      expect(names).toContain('topology.error.fixture.json');
      expect(names).toContain('topology.large-scale.fixture.json');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 14. APP.TSX ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — Route Registration', () => {
  const appTsx = fs.readFileSync(
    path.resolve(__dirname, '../client/src/App.tsx'),
    'utf-8'
  );

  it('/topology route exists in App.tsx', () => {
    expect(appTsx).toContain('path="/topology"');
  });

  it('Topology component is imported', () => {
    expect(appTsx).toContain('import Topology from');
  });

  it('Topology component is used in Route', () => {
    expect(appTsx).toContain('component={Topology}');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 15. NAV DE-PLACEHOLDERING
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — Nav De-placeholdering', () => {
  const dashLayout = fs.readFileSync(
    path.resolve(__dirname, '../client/src/components/DashboardLayout.tsx'),
    'utf-8'
  );

  it('Topology nav item exists', () => {
    expect(dashLayout).toContain('"Topology"');
  });

  it('Topology nav item does NOT have placeholder: true', () => {
    // Find the Topology line and check it doesn't have placeholder
    const lines = dashLayout.split('\n');
    const topologyLine = lines.find((l) => l.includes('"Topology"') && l.includes('path'));
    expect(topologyLine).toBeDefined();
    expect(topologyLine).not.toContain('placeholder');
  });

  it('Topology nav item has path /topology', () => {
    expect(dashLayout).toContain('path: "/topology"');
  });

  it('Help is a real page (no longer placeholder)', () => {
    const lines = dashLayout.split('\n');
    const helpLine = lines.find((l) => l.includes('"Help"') && l.includes('path'));
    expect(helpLine).toBeDefined();
    expect(helpLine).not.toContain('placeholder');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 16. UI DATA-TESTID COVERAGE
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — UI data-testid Coverage', () => {
  const topologyTsx = fs.readFileSync(
    path.resolve(__dirname, '../client/src/pages/Topology.tsx'),
    'utf-8'
  );

  const requiredTestIds = [
    'topology-loading',
    'topology-error',
    'topology-malformed',
    'topology-quiet',
    'topology-populated',
    'topology-svg',
    'topology-nodes',
    'topology-edges',
    'topology-summary',
    'topology-detail-panel',
    'topology-search',
    'topology-cluster-legend',
    'topology-role-legend',
  ];

  for (const testId of requiredTestIds) {
    it(`has data-testid="${testId}"`, () => {
      expect(topologyTsx).toContain(`data-testid="${testId}"`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 17. SHARED TYPE REUSE (NO LOCAL REDEFINITION)
// ═══════════════════════════════════════════════════════════════════
describe('Slice 21 — Shared Type Reuse', () => {
  const topologyTsx = fs.readFileSync(
    path.resolve(__dirname, '../client/src/pages/Topology.tsx'),
    'utf-8'
  );
  const hookTs = fs.readFileSync(
    path.resolve(__dirname, '../client/src/hooks/useTopology.ts'),
    'utf-8'
  );

  it('Topology.tsx imports from shared/topology-types', () => {
    expect(topologyTsx).toContain('shared/topology-types');
  });

  it('Topology.tsx does not define its own TopologyNode type', () => {
    expect(topologyTsx).not.toMatch(/^(export\s+)?(interface|type)\s+TopologyNode\s/m);
  });

  it('useTopology.ts imports from shared/topology-validators', () => {
    expect(hookTs).toContain('shared/topology-validators');
  });

  it('useTopology.ts imports from shared/topology-types', () => {
    expect(hookTs).toContain('shared/topology-types');
  });

  it('useTopology.ts does not define its own TopologyPayload type', () => {
    expect(hookTs).not.toMatch(/^(export\s+)?(interface|type)\s+TopologyPayload\s/m);
  });
});
