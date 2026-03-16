/**
 * Slice 21 — Living Topology: BFF Route
 *
 * POST /api/bff/topology/query   — returns topology payload for a time window
 * GET  /api/bff/topology/fixtures — lists available fixture files (dev/test only)
 *
 * LIVE MODE:
 *   - GET /api/v1/devices → device list (nodes)
 *   - GET /api/v1/networks → network/VLAN list (clusters)
 *   - POST /api/v1/metrics → per-device byte counts (edges + totalBytes)
 *   - GET /api/v1/detections → active detections per device
 *   - GET /api/v1/alerts → active alerts per device
 *
 * FIXTURE MODE:
 *   - Loads deterministic fixture files from fixtures/topology/
 *   - Sentinel routing available in dev/test only
 */

import { Router, Request, Response } from 'express';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TopologyQueryRequestSchema, TopologyPayloadSchema } from '../../shared/topology-validators';
import { ehRequest, isFixtureMode, ExtraHopClientError } from '../extrahop-client';
import { normalizeDeviceIdentity } from '../extrahop-normalizers';

const router = Router();
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'topology');

// ─── Sentinel Map (dev/test only) ─────────────────────────────────
const SENTINEL_MAP: Record<number, string> = {
  1: 'topology.quiet.fixture.json',
  2: 'topology.error.fixture.json',
  3: 'topology.transport-error.fixture.json',
  4: 'topology.malformed.fixture.json',
  5: 'topology.large-scale.fixture.json',
};

// ─── Role Mapping ──────────────────────────────────────────────────
// Maps ExtraHop device roles to our TopologyDeviceRole enum
const ROLE_MAP: Record<string, string> = {
  'server': 'server',
  'client': 'client',
  'gateway': 'gateway',
  'firewall': 'firewall',
  'load_balancer': 'load_balancer',
  'loadbalancer': 'load_balancer',
  'db_server': 'db_server',
  'database': 'db_server',
  'dns_server': 'dns_server',
  'dns': 'dns_server',
  'domain_controller': 'domain_controller',
  'dc': 'domain_controller',
  'file_server': 'file_server',
  'fileserver': 'file_server',
  'printer': 'printer',
  'voip': 'voip',
  'custom': 'custom',
  'other': 'other',
};

function mapRole(ehRole: string | null | undefined): string {
  if (!ehRole) return 'unknown';
  return ROLE_MAP[ehRole.toLowerCase()] || 'other';
}

// ─── Protocol Mapping ──────────────────────────────────────────────
const KNOWN_PROTOCOLS = new Set(['TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'SSH', 'SMB', 'NFS', 'LDAP', 'RDP', 'ICMP']);
function mapProtocol(proto: string | null | undefined): string {
  if (!proto) return 'OTHER';
  const upper = proto.toUpperCase();
  return KNOWN_PROTOCOLS.has(upper) ? upper : 'OTHER';
}

// ─── POST /query ───────────────────────────────────────────────────
router.post('/query', async (req: Request, res: Response) => {
  const parsed = TopologyQueryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      details: parsed.error.issues,
    });
    return;
  }

  // ── FIXTURE MODE ──
  if (await isFixtureMode()) {
    const { fromMs } = parsed.data;
    const fixtureName = ((await isFixtureMode()) && SENTINEL_MAP[fromMs])
      ? SENTINEL_MAP[fromMs]
      : 'topology.populated.fixture.json';

    try {
      const raw = readFileSync(join(FIXTURE_DIR, fixtureName), 'utf-8');
      const data = JSON.parse(raw);
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: `Failed to load fixture: ${fixtureName}`,
        details: String(err),
      });
    }
    return;
  }

  // ── LIVE MODE ──
  const { fromMs, toMs, maxNodes = 200 } = parsed.data;

  try {
    // 1. Fetch devices
    const devicesResp = await ehRequest<any[]>({
      method: 'GET',
      path: '/api/v1/devices?limit=500&search_type=any&active_from=' + fromMs + '&active_until=' + toMs,
      cacheTtlMs: 30_000, // 30s cache for device list
    });

    const rawDevices = Array.isArray(devicesResp.data) ? devicesResp.data : [];

    // 2. Fetch detections in the time window
    const detectionsResp = await ehRequest<any[]>({
      method: 'GET',
      path: `/api/v1/detections?from=${fromMs}&until=${toMs}`,
      cacheTtlMs: 30_000,
    });
    const rawDetections = Array.isArray(detectionsResp.data) ? detectionsResp.data : [];

    // Build detection count per device
    const detectionsByDevice = new Map<number, number>();
    for (const det of rawDetections) {
      if (Array.isArray(det.participants)) {
        for (const p of det.participants) {
          if (p.object_type === 'device' && p.object_id) {
            detectionsByDevice.set(p.object_id, (detectionsByDevice.get(p.object_id) || 0) + 1);
          }
        }
      }
    }

    // 3. Fetch alerts
    const alertsResp = await ehRequest<any[]>({
      method: 'GET',
      path: '/api/v1/alerts',
      cacheTtlMs: 60_000, // 1min cache for alerts (they change less often)
    });
    const rawAlerts = Array.isArray(alertsResp.data) ? alertsResp.data : [];
    // Alerts don't have per-device assignment in the list API, so we count them globally
    const alertCount = rawAlerts.filter((a: any) => !a.disabled).length;

    // 4. Fetch per-device metrics for byte counts
    const deviceIds = rawDevices.slice(0, maxNodes).map((d: any) => d.id).filter(Boolean);

    let deviceBytesMap = new Map<number, number>();
    if (deviceIds.length > 0) {
      try {
        const metricsResp = await ehRequest<any>({
          method: 'POST',
          path: '/api/v1/metrics',
          body: {
            from: fromMs,
            until: toMs,
            metric_category: 'net_detail',
            metric_specs: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
            object_type: 'device',
            object_ids: deviceIds,
          },
          cacheTtlMs: 30_000,
        });

        // Parse metrics response — stats array with oid mapping
        if (metricsResp.data && Array.isArray(metricsResp.data.stats)) {
          for (const stat of metricsResp.data.stats) {
            const oid = stat.oid ?? stat.object_id;
            if (oid && Array.isArray(stat.values)) {
              const bytesIn = typeof stat.values[0] === 'number' ? stat.values[0] : 0;
              const bytesOut = typeof stat.values[1] === 'number' ? stat.values[1] : 0;
              deviceBytesMap.set(oid, (deviceBytesMap.get(oid) || 0) + bytesIn + bytesOut);
            }
          }
        }
      } catch {
        // Metrics fetch failed — continue with zero bytes
      }
    }

    // 5. Build nodes
    const clusterMap = new Map<string, { id: string; label: string; nodeCount: number }>();
    const nodes: any[] = [];
    const truncated = rawDevices.length > maxNodes;
    const devicesToProcess = rawDevices.slice(0, maxNodes);

    for (const dev of devicesToProcess) {
      const identity = normalizeDeviceIdentity(dev);
      const role = mapRole(dev.role ?? dev.auto_role);

      // Determine cluster from VLAN or subnet
      let clusterId = 'default';
      let clusterLabel = 'Default';
      if (dev.vlanid != null) {
        clusterId = `vlan-${dev.vlanid}`;
        clusterLabel = `VLAN ${dev.vlanid}`;
      } else if (identity.ipaddr4) {
        const parts = identity.ipaddr4.split('.');
        if (parts.length === 4) {
          clusterId = `subnet-${parts[0]}.${parts[1]}.${parts[2]}`;
          clusterLabel = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
        }
      }

      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, { id: clusterId, label: clusterLabel, nodeCount: 0 });
      }
      clusterMap.get(clusterId)!.nodeCount++;

      nodes.push({
        id: identity.id,
        displayName: identity.displayName || identity.ipaddr4 || `Device ${identity.id}`,
        ipaddr: identity.ipaddr4 || identity.ipaddr6 || null,
        macaddr: identity.macaddr || null,
        role,
        critical: identity.critical,
        activeDetections: detectionsByDevice.get(identity.id) || 0,
        activeAlerts: 0, // Alerts aren't per-device in the list API
        totalBytes: deviceBytesMap.get(identity.id) || 0,
        clusterId,
      });
    }

    // 6. Build edges — SYNTHETIC / HEURISTIC (audit C2)
    // WARNING: These edges are NOT observed network connections.
    // They are heuristically inferred from per-device byte totals.
    // Real edges require the ExtraHop Activity Map API (POST /activitymaps/query),
    // which returns actual L2/L3/L7 connections with real protocols and latency.
    // Until Activity Map integration is built, edges are synthetic approximations.
    // The response includes edgesAreSynthetic=true so the UI can display a disclaimer.
    const edges: any[] = [];
    let edgeId = 0;
    const nodeIds = new Set(nodes.map(n => n.id));

    // Heuristic: create edges between devices with the most traffic in the same cluster
    const clusterNodes = new Map<string, any[]>();
    for (const node of nodes) {
      if (!clusterNodes.has(node.clusterId)) {
        clusterNodes.set(node.clusterId, []);
      }
      clusterNodes.get(node.clusterId)!.push(node);
    }

    for (const [, clusterNodeList] of Array.from(clusterNodes)) {
      // Sort by totalBytes descending
      const sorted = [...clusterNodeList].sort((a, b) => b.totalBytes - a.totalBytes);
      // Create edges between top talkers in the cluster
      for (let i = 0; i < sorted.length - 1 && i < 10; i++) {
        for (let j = i + 1; j < sorted.length && j < i + 3; j++) {
          const bytes = Math.min(sorted[i].totalBytes, sorted[j].totalBytes);
          if (bytes > 0) {
            edges.push({
              sourceId: sorted[i].id,
              targetId: sorted[j].id,
              protocol: 'TCP', // Default — would need activity map for real protocol data
              bytes,
              hasDetection: (sorted[i].activeDetections > 0 || sorted[j].activeDetections > 0),
              latencyMs: null, // Would need activity map for latency
            });
          }
        }
      }
    }

    // 7. Build clusters array
    const clusters = Array.from(clusterMap.values()).map(c => ({
      id: c.id,
      label: c.label,
      groupBy: c.id.startsWith('vlan-') ? 'vlan' as const : 'subnet' as const,
      nodeCount: c.nodeCount,
    }));

    // 8. Build summary
    const totalBytes = nodes.reduce((sum, n) => sum + n.totalBytes, 0);
    const nodesWithDetections = nodes.filter(n => n.activeDetections > 0).length;
    const nodesWithAlerts = nodes.filter(n => n.activeAlerts > 0).length;

    const summary = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalClusters: clusters.length,
      nodesWithDetections,
      nodesWithAlerts,
      totalBytes,
      truncated,
      maxNodes,
    };

    // 9. Build payload and validate with Zod before sending (audit H1)
    const rawPayload = {
      nodes,
      edges,
      clusters,
      summary,
      timeWindow: { fromMs, toMs },
      edgesAreSynthetic: true,
    };

    const payloadValidation = TopologyPayloadSchema.safeParse(rawPayload);
    if (!payloadValidation.success) {
      console.error('[topology] Output validation failed:', payloadValidation.error.issues);
      res.status(500).json({
        _meta: { fixture: 'live', generatedAt: new Date().toISOString() },
        intent: 'malformed',
        payload: null,
        error: `Topology output validation failed: ${payloadValidation.error.issues.map(i => i.message).join('; ')}`,
      });
      return;
    }

    // edgesAreSynthetic=true tells the UI to show a disclaimer (audit C2)
    res.json({
      _meta: {
        fixture: 'live',
        generatedAt: new Date().toISOString(),
      },
      intent: nodes.length > 0 ? 'populated' : 'quiet',
      payload: payloadValidation.data,
      error: null,
    });
  } catch (err: any) {
    if (err instanceof ExtraHopClientError) {
      res.status(502).json({
        _meta: { fixture: 'live', generatedAt: new Date().toISOString() },
        intent: 'error',
        payload: null,
        error: err.message,
      });
      return;
    }
    res.status(500).json({
      _meta: { fixture: 'live', generatedAt: new Date().toISOString() },
      intent: 'error',
      payload: null,
      error: `Topology fetch failed: ${err.message || 'Unknown error'}`,
    });
  }
});

// ─── GET /baseline (for anomaly detection) ─────────────────────────
router.get('/baseline', async (_req: Request, res: Response) => {
  // In fixture mode, return the baseline fixture
  if (await isFixtureMode()) {
    try {
      const raw = readFileSync(join(FIXTURE_DIR, 'topology.baseline.fixture.json'), 'utf-8');
      const data = JSON.parse(raw);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to load baseline fixture', details: String(err) });
    }
    return;
  }

  // HONEST STATUS: In live mode, historical baseline collection is NOT implemented.
  // Instead of silently returning fixture data (which would be dishonest), return
  // an explicit error so the caller knows baseline comparison is not yet available.
  res.status(501).json({
    error: 'BASELINE_NOT_IMPLEMENTED',
    message: 'Historical baseline collection is not yet implemented. '
      + 'The anomaly detection overlay requires a baseline snapshot from a previous '
      + 'time window, which requires the ETL scheduler to persist historical topology data. '
      + 'This feature is deferred until historical data collection is built.',
    mode: 'live',
  });
});

// ─── GET /fixtures (dev/test only) ────────────────────────────────
router.get('/fixtures', async (_req: Request, res: Response) => {
  if (!(await isFixtureMode())) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  try {
    const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files, mode: (await isFixtureMode()) ? 'fixture' : 'live' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list fixtures', details: String(err) });
  }
});

export default router;
