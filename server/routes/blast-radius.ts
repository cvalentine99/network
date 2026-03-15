/**
 * BFF Blast Radius Routes — /api/bff/blast-radius/*
 *
 * LIVE INTEGRATION (Slice 29):
 *   - Live mode calls ExtraHop REST API for device lookup, peer analysis, and metrics
 *   - Fixture mode unchanged for dev/test
 *   - Sentinel routing gated behind NODE_ENV !== 'production'
 *   - Fixture listing endpoint gated behind NODE_ENV !== 'production'
 *
 * ExtraHop API calls in live mode:
 *   1. Resolve device: GET /api/v1/devices/{id} or GET /api/v1/devices?search_type=...
 *   2. Get peers: GET /api/v1/devices/{id}/peers
 *   3. Get peer metrics: POST /api/v1/metrics (bytes_in/bytes_out per peer)
 *   4. Get detections: GET /api/v1/detections?from=<fromMs>&until=<untilMs>
 */

import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { BlastRadiusIntentSchema, BlastRadiusPayloadSchema } from '../../shared/blast-radius-validators';
import { ehRequest, isFixtureMode, ExtraHopClientError } from '../extrahop-client';
import {
  normalizeDeviceIdentity,
  normalizeDetection,
  buildMetricsRequest,
} from '../extrahop-normalizers';

const blastRadiusRouter = Router();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Load a blast radius fixture file.
 */
function loadFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'blast-radius', name);
    if (!existsSync(fixturePath)) return null;
    return JSON.parse(readFileSync(fixturePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Select the appropriate fixture based on entry mode and value.
 * Sentinel values are ONLY used in dev/test.
 */
function selectFixture(mode: string, value: string): { fixture: string; isError: boolean } {
  if (isDev) {
    if (value === 'unknown.invalid' || value === '0' || value === '0.0.0.0') {
      return { fixture: 'blast-radius.error.fixture.json', isError: true };
    }
    if (value === 'quiet.lab.local' || value === '9999' || value === '10.1.20.254') {
      return { fixture: 'blast-radius.quiet.fixture.json', isError: false };
    }
    if (value === 'transport.fail' || value === '99999') {
      return { fixture: 'blast-radius.transport-error.fixture.json', isError: true };
    }
  }
  switch (mode) {
    case 'hostname':
      return { fixture: 'blast-radius.hostname-entry.fixture.json', isError: false };
    case 'ip-address':
      return { fixture: 'blast-radius.ip-entry.fixture.json', isError: false };
    case 'device-id':
    default:
      return { fixture: 'blast-radius.populated.fixture.json', isError: false };
  }
}

/**
 * POST /api/bff/blast-radius/query
 */
blastRadiusRouter.post('/query', async (req, res) => {
  try {
    // 1. Validate request body
    const parseResult = BlastRadiusIntentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'INVALID_BLAST_RADIUS_INTENT',
        message: 'Invalid blast radius query intent',
        details: parseResult.error.issues,
      });
      return;
    }

    const intent = parseResult.data;
    const { mode, value, timeWindow } = intent;
    const { fromMs, untilMs, durationMs, cycle } = timeWindow;

    // ── FIXTURE MODE ──
    if (isFixtureMode()) {
      const { fixture: fixtureName, isError } = selectFixture(mode, value);
      const fixtureData = loadFixture(fixtureName);

      if (!fixtureData) {
        res.status(500).json({
          error: 'FIXTURE_NOT_FOUND',
          message: `Fixture not found: ${fixtureName}`,
        });
        return;
      }

      if (isError && fixtureData.error) {
        res.status(fixtureData.error.status || 500).json({
          error: fixtureData.error.code,
          message: fixtureData.error.message,
        });
        return;
      }

      const payloadResult = BlastRadiusPayloadSchema.safeParse(fixtureData.payload);
      if (!payloadResult.success) {
        res.status(500).json({
          error: 'FIXTURE_VALIDATION_FAILED',
          message: 'Fixture payload failed schema validation',
          details: payloadResult.error.issues,
        });
        return;
      }

      res.json(payloadResult.data);
      return;
    }

    // ── LIVE MODE ──

    // Step 1: Resolve the source device
    let sourceDevice: any;
    if (mode === 'device-id') {
      const deviceResp = await ehRequest<any>({
        method: 'GET',
        path: `/api/v1/devices/${value}`,
        cacheTtlMs: 60_000,
      });
      sourceDevice = deviceResp.data;
    } else {
      const searchType = mode === 'ip-address' ? 'ip' : 'name';
      const searchResp = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/devices?search_type=${searchType}&value=${encodeURIComponent(value)}&limit=1`,
        cacheTtlMs: 30_000,
      });
      if (!Array.isArray(searchResp.data) || searchResp.data.length === 0) {
        // Quiet state — device not found, return empty blast radius
        res.json({
          source: {
            deviceId: 1, // Schema requires positive int
            displayName: value,
            ipaddr: null,
            macaddr: null,
            role: null,
            deviceClass: null,
            critical: false,
          },
          peers: [],
          summary: {
            peerCount: 0,
            affectedPeerCount: 0,
            totalDetections: 0,
            uniqueProtocols: 0,
            totalBytes: 0,
            maxImpactScore: 0,
            severityDistribution: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
          },
          timeWindow: { fromMs, untilMs, durationMs, cycle },
        });
        return;
      }
      sourceDevice = searchResp.data[0];
    }

    const deviceId = sourceDevice.id;
    const normalizedSource = normalizeDeviceIdentity(sourceDevice);

    // Step 2: Get peers for this device in the time window
    let rawPeers: any[] = [];
    try {
      const peersResp = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/devices/${deviceId}/peers?from=${fromMs}&until=${untilMs}`,
        cacheTtlMs: 30_000,
      });
      rawPeers = Array.isArray(peersResp.data) ? peersResp.data : [];
    } catch {
      // Peer lookup may fail — continue with empty peers
    }

    // Step 3: Get metrics for each peer (batch via POST /api/v1/metrics)
    const peerIds = rawPeers.map((p: any) => p.id).filter((id: number) => id > 0);
    const peerMetrics: Record<number, { bytesIn: number; bytesOut: number }> = {};

    if (peerIds.length > 0) {
      try {
        const metricsBody = buildMetricsRequest({
          from: fromMs,
          until: untilMs,
          cycle: cycle as any,
          metricCategory: 'net_detail',
          metricSpecs: [{ name: 'bytes_in' }, { name: 'bytes_out' }],
          objectType: 'device',
          objectIds: peerIds.slice(0, 100),
        });
        const metricsResp = await ehRequest<any>({
          method: 'POST',
          path: '/api/v1/metrics',
          body: metricsBody,
          cacheTtlMs: 30_000,
        });
        if (metricsResp.data && Array.isArray(metricsResp.data.stats)) {
          for (const stat of metricsResp.data.stats) {
            const oid = stat.oid;
            const vals = Array.isArray(stat.values) ? stat.values : [];
            const bytesIn = typeof vals[0] === 'number' ? vals[0] : 0;
            const bytesOut = typeof vals[1] === 'number' ? vals[1] : 0;
            if (!peerMetrics[oid]) {
              peerMetrics[oid] = { bytesIn: 0, bytesOut: 0 };
            }
            peerMetrics[oid].bytesIn += bytesIn;
            peerMetrics[oid].bytesOut += bytesOut;
          }
        }
      } catch {
        // Metrics may fail — continue with zero bytes
      }
    }

    // Step 4: Get detections in the time window
    let rawDetections: any[] = [];
    try {
      const detectionsResp = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/detections?from=${fromMs}&until=${untilMs}&limit=200`,
        cacheTtlMs: 30_000,
      });
      rawDetections = Array.isArray(detectionsResp.data) ? detectionsResp.data : [];
    } catch {
      // Detections may fail — continue with empty
    }

    // Step 5: Build normalized peer objects
    const severityDist = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    let totalDetections = 0;
    const protocolSet = new Set<string>();
    let totalBytes = 0;
    let maxImpactScore = 0;
    let affectedPeerCount = 0;

    const normalizedPeers = rawPeers.map((peer: any) => {
      const pId = peer.id;
      const metrics = peerMetrics[pId] || { bytesIn: 0, bytesOut: 0 };
      const peerTotalBytes = metrics.bytesIn + metrics.bytesOut;
      totalBytes += peerTotalBytes;

      // Find detections involving this peer
      const peerDetections = rawDetections.filter((d: any) => {
        if (!Array.isArray(d.participants)) return false;
        return d.participants.some((p: any) =>
          p.object_id === pId || p.ipaddr === peer.ipaddr4
        );
      });

      const normalizedPeerDetections = peerDetections.map((d: any) => {
        const nd = normalizeDetection(d);
        const severity: keyof typeof severityDist =
          nd.riskScore >= 80 ? 'critical' :
          nd.riskScore >= 60 ? 'high' :
          nd.riskScore >= 40 ? 'medium' :
          nd.riskScore >= 20 ? 'low' : 'info';
        severityDist[severity]++;
        totalDetections++;
        return {
          id: nd.id,
          title: nd.title,
          type: nd.type,
          riskScore: nd.riskScore,
          severity,
          startTime: nd.startTime,
          participants: nd.participants.map((p: any) =>
            p.hostname || p.ipaddr || `device:${p.object_id}`
          ),
        };
      });

      // Build protocol list
      const protocols: Array<{
        name: string;
        port: number | null;
        bytesSent: number;
        bytesReceived: number;
        hasDetections: boolean;
      }> = [];

      if (peer.activity && Array.isArray(peer.activity)) {
        for (const act of peer.activity) {
          const name = act.stat_name || act.protocol || 'unknown';
          protocolSet.add(name);
          protocols.push({
            name,
            port: act.port ?? null,
            bytesSent: metrics.bytesOut / Math.max(peer.activity.length, 1),
            bytesReceived: metrics.bytesIn / Math.max(peer.activity.length, 1),
            hasDetections: peerDetections.length > 0,
          });
        }
      }
      if (protocols.length === 0) {
        protocols.push({
          name: 'TCP',
          port: null,
          bytesSent: metrics.bytesOut,
          bytesReceived: metrics.bytesIn,
          hasDetections: peerDetections.length > 0,
        });
        protocolSet.add('TCP');
      }

      const impactScore = Math.min(100, (peerTotalBytes / 1_000_000) + (peerDetections.length * 20));
      if (impactScore > maxImpactScore) maxImpactScore = impactScore;
      if (peerDetections.length > 0) affectedPeerCount++;

      return {
        deviceId: pId > 0 ? pId : 1,
        displayName: peer.display_name || peer.displayName || peer.ipaddr4 || `Device ${pId}`,
        ipaddr: peer.ipaddr4 || null,
        role: peer.role || null,
        critical: peer.critical || false,
        protocols,
        detections: normalizedPeerDetections,
        totalBytes: peerTotalBytes,
        impactScore: Math.round(impactScore * 100) / 100,
        firstSeen: peer.discover_time || fromMs,
        lastSeen: peer.mod_time || Date.now(),
      };
    });

    // Step 6: Build and validate response
    const payload = {
      source: {
        deviceId: normalizedSource.id > 0 ? normalizedSource.id : 1,
        displayName: normalizedSource.displayName || value,
        ipaddr: normalizedSource.ipaddr4 || null,
        macaddr: normalizedSource.macaddr || null,
        role: normalizedSource.role || null,
        deviceClass: normalizedSource.deviceClass || null,
        critical: normalizedSource.critical,
      },
      peers: normalizedPeers,
      summary: {
        peerCount: normalizedPeers.length,
        affectedPeerCount,
        totalDetections,
        uniqueProtocols: protocolSet.size,
        totalBytes,
        maxImpactScore: Math.round(maxImpactScore * 100) / 100,
        severityDistribution: severityDist,
      },
      timeWindow: { fromMs, untilMs, durationMs, cycle },
    };

    const validation = BlastRadiusPayloadSchema.safeParse(payload);
    if (!validation.success) {
      console.error('[blast-radius] Live response failed validation:', validation.error.issues);
      res.status(502).json({
        error: 'LIVE_RESPONSE_VALIDATION_FAILED',
        message: 'Live ExtraHop response could not be normalized to contract shape',
        details: validation.error.issues,
      });
      return;
    }

    res.json(validation.data);
  } catch (err: any) {
    if (err instanceof ExtraHopClientError) {
      res.status(err.httpStatus || 502).json({
        error: err.code,
        message: err.message,
      });
      return;
    }
    console.error('[blast-radius] Unexpected error:', err);
    res.status(500).json({
      error: 'BLAST_RADIUS_FAILED',
      message: err.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/bff/blast-radius/fixtures
 *
 * Dev/test only — lists available fixture files.
 */
blastRadiusRouter.get('/fixtures', (_req, res) => {
  if (!isDev) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  if (!isFixtureMode()) {
    res.json({ fixtures: [], mode: 'live' });
    return;
  }

  const fixtureDir = join(process.cwd(), 'fixtures', 'blast-radius');
  if (!existsSync(fixtureDir)) {
    res.json({ fixtures: [], mode: 'fixture' });
    return;
  }

  try {
    const files = readdirSync(fixtureDir).filter((f: string) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files, mode: 'fixture' });
  } catch {
    res.json({ fixtures: [], mode: 'fixture' });
  }
});

export { blastRadiusRouter };
