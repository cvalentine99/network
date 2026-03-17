/**
 * BFF Packets Routes — /api/bff/packets/*
 *
 * Slice 10: PCAP Download Contract
 *
 * Two routes:
 *   POST /api/bff/packets/download   — returns raw binary PCAP stream
 *   POST /api/bff/packets/metadata   — returns JSON metadata about a prospective download
 *
 * Binary contract invariant:
 *   The /download route MUST return Content-Type: application/vnd.tcpdump.pcap
 *   and raw binary bytes. It MUST NOT wrap PCAP bytes in JSON.
 *
 * LIVE INTEGRATION (Slice 29):
 *   - Live mode proxies to ExtraHop POST /api/v1/packets/search
 *   - Metadata route queries packet store availability first
 *   - Download route streams raw binary PCAP from ExtraHop
 *   - Fixture mode returns deterministic fixture PCAP files
 *
 * Contract: browser calls /api/bff/packets/*, never ExtraHop directly.
 */
import { Router } from 'express';
import { PcapRequestSchema, PcapMetadataSchema } from '../../shared/cockpit-validators';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isFixtureMode,
  ehRequest,
  ehBinaryRequest,
  ExtraHopClientError,
} from '../extrahop-client';

const packetsRouter = Router();

/**
 * Generate a deterministic filename from request params.
 */
function generateFilename(ip: string, fromMs: number, untilMs: number, bpfFilter?: string): string {
  const sanitizedIp = ip.replace(/[^a-zA-Z0-9.:-]/g, '_');
  const filterSuffix = bpfFilter
    ? '_' + bpfFilter.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 40)
    : '';
  return `${sanitizedIp}_${fromMs}_${untilMs}${filterSuffix}.pcap`;
}

/**
 * Load a binary fixture file from the fixtures/pcap-download directory.
 * Returns null if the file cannot be read.
 */
function loadPcapFixture(name: string): Buffer | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'pcap-download', name);
    return readFileSync(fixturePath);
  } catch {
    return null;
  }
}

/**
 * POST /api/bff/packets/metadata
 *
 * Request body: PcapRequest (JSON)
 *
 * Response shape on success:
 *   { metadata: PcapMetadata }
 *
 * Response shape on error:
 *   { error: string, message: string, code?: string }
 *
 * This is a pre-flight check that returns metadata about the prospective download
 * without actually initiating the binary transfer.
 */
packetsRouter.post('/metadata', async (req, res) => {
  try {
    // 1. Validate request body
    const bodyResult = PcapRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Invalid PCAP request',
        message: bodyResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { ip, fromMs, untilMs, bpfFilter, limitBytes } = bodyResult.data;

    // 2. Validate time window
    if (untilMs <= fromMs) {
      return res.status(400).json({
        error: 'Invalid time window',
        message: 'untilMs must be greater than fromMs',
      });
    }

    // 3. In fixture mode, return fixture metadata
    if (await isFixtureMode()) {
      const filename = generateFilename(ip, fromMs, untilMs, bpfFilter);
      const metadata = {
        filename,
        contentType: 'application/vnd.tcpdump.pcap' as const,
        estimatedBytes: 74, // size of our populated fixture PCAP
        sourceIp: ip,
        fromMs,
        untilMs,
        bpfFilter: bpfFilter || null,
        packetStoreId: null,
      };

      // Validate our own metadata before sending
      const validation = PcapMetadataSchema.safeParse(metadata);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed metadata',
          message: 'Generated metadata failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ metadata: validation.data });
    }

    // 4. Live mode — check packet store availability and return metadata
    try {
      // Probe the ExtraHop appliance to check if packet store is available
      const ehInfo = await ehRequest<any>({
        method: 'GET',
        path: '/api/v1/extrahop',
        cacheTtlMs: 60_000,
      });

      const filename = generateFilename(ip, fromMs, untilMs, bpfFilter);
      const metadata = {
        filename,
        contentType: 'application/vnd.tcpdump.pcap' as const,
        estimatedBytes: limitBytes || 10_485_760, // estimate based on limit
        sourceIp: ip,
        fromMs,
        untilMs,
        bpfFilter: bpfFilter || null,
        packetStoreId: ehInfo.data?.id || null,
      };

      const validation = PcapMetadataSchema.safeParse(metadata);
      if (!validation.success) {
        return res.status(502).json({
          error: 'Malformed metadata',
          message: 'Generated metadata failed schema validation',
          details: validation.error.issues,
        });
      }

      return res.json({ metadata: validation.data });
    } catch (err: unknown) {
      if (err instanceof ExtraHopClientError && err.code === 'NO_CONFIG') {
        return res.status(503).json({
          error: 'Packet store not configured',
          message: 'No ExtraHop appliance is configured. Save a configuration in Settings first.',
          code: 'NO_PACKET_STORE',
        });
      }
      throw err;
    }
  } catch (err: unknown) {
    return res.status(500).json({
      error: 'PCAP metadata fetch failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/bff/packets/download
 *
 * Request body: PcapRequest (JSON)
 *
 * Response on success:
 *   Content-Type: application/vnd.tcpdump.pcap
 *   Content-Disposition: attachment; filename="<generated>.pcap"
 *   X-Pcap-Source-Ip: <ip>
 *   X-Pcap-From-Ms: <fromMs>
 *   X-Pcap-Until-Ms: <untilMs>
 *   Body: raw binary PCAP bytes
 *
 * Response on error:
 *   Content-Type: application/json
 *   { error: string, message: string, code?: string }
 *
 * Binary contract invariant:
 *   Success response MUST be raw binary, NOT JSON-wrapped.
 *   The Content-Type MUST be application/vnd.tcpdump.pcap.
 *   Error responses remain JSON.
 */
packetsRouter.post('/download', async (req, res) => {
  try {
    // 1. Validate request body
    const bodyResult = PcapRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Invalid PCAP request',
        message: bodyResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { ip, fromMs, untilMs, bpfFilter, limitBytes, limitPackets } = bodyResult.data;

    // 2. Validate time window
    if (untilMs <= fromMs) {
      return res.status(400).json({
        error: 'Invalid time window',
        message: 'untilMs must be greater than fromMs',
      });
    }

    // 3. In fixture mode, return fixture PCAP binary
    if (await isFixtureMode()) {
      const pcapBuffer = loadPcapFixture('pcap-download.populated.fixture.pcap');
      if (!pcapBuffer) {
        return res.status(500).json({
          error: 'Fixture load failed',
          message: 'Could not load PCAP fixture file',
        });
      }

      const filename = generateFilename(ip, fromMs, untilMs, bpfFilter);

      // Set binary response headers
      res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pcapBuffer.length);
      res.setHeader('X-Pcap-Source-Ip', ip);
      res.setHeader('X-Pcap-From-Ms', String(fromMs));
      res.setHeader('X-Pcap-Until-Ms', String(untilMs));
      if (bpfFilter) {
        res.setHeader('X-Pcap-Bpf-Filter', bpfFilter);
      }

      // Send raw binary — NOT JSON
      return res.end(pcapBuffer);
    }

    // 4. Live mode — proxy to ExtraHop POST /api/v1/packets/search
    try {
      // Build the ExtraHop packets/search request body
      const ehBody: Record<string, unknown> = {
        from: fromMs,
        until: untilMs,
        bpf: bpfFilter || `host ${ip}`,
        output: 'pcap',
      };
      if (limitBytes) ehBody.limit_bytes = limitBytes;
      if (limitPackets) ehBody.limit_pkts = limitPackets;

      const binaryResp = await ehBinaryRequest({
        method: 'POST',
        path: '/api/v1/packets/search',
        body: ehBody,
        timeoutMs: 120_000, // PCAP downloads can be slow
      });

      if (!binaryResp.ok) {
        // ExtraHop returned an error — try to parse as JSON error
        try {
          const errBody = JSON.parse(binaryResp.buffer.toString('utf-8'));
          return res.status(binaryResp.status).json({
            error: 'PCAP download failed',
            message: errBody.error_message || errBody.message || `ExtraHop returned ${binaryResp.status}`,
            code: 'EH_PACKETS_ERROR',
          });
        } catch {
          return res.status(binaryResp.status).json({
            error: 'PCAP download failed',
            message: `ExtraHop returned ${binaryResp.status} ${binaryResp.statusText}`,
            code: 'EH_PACKETS_ERROR',
          });
        }
      }

      const filename = generateFilename(ip, fromMs, untilMs, bpfFilter);

      // Set binary response headers
      res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', binaryResp.buffer.length);
      res.setHeader('X-Pcap-Source-Ip', ip);
      res.setHeader('X-Pcap-From-Ms', String(fromMs));
      res.setHeader('X-Pcap-Until-Ms', String(untilMs));
      if (bpfFilter) {
        res.setHeader('X-Pcap-Bpf-Filter', bpfFilter);
      }

      // Send raw binary — NOT JSON
      return res.end(binaryResp.buffer);
    } catch (err: unknown) {
      if (err instanceof ExtraHopClientError && err.code === 'NO_CONFIG') {
        return res.status(503).json({
          error: 'Packet store not configured',
          message: 'No ExtraHop appliance is configured. Save a configuration in Settings first.',
          code: 'NO_PACKET_STORE',
        });
      }
      throw err;
    }
  } catch (err: unknown) {
    return res.status(500).json({
      error: 'PCAP download failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export { packetsRouter };
