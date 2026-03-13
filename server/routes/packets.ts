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
 * In fixture mode (no live appliance), returns deterministic fixture PCAP files.
 * In live mode, proxies to ExtraHop POST /api/v1/packets/search.
 *
 * Contract: browser calls /api/bff/packets/*, never ExtraHop directly.
 */
import { Router } from 'express';
import { PcapRequestSchema, PcapMetadataSchema } from '../../shared/cockpit-validators';
import { readFileSync } from 'fs';
import { join } from 'path';

const packetsRouter = Router();

/**
 * Determine if we are in fixture mode.
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

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
packetsRouter.post('/metadata', (req, res) => {
  try {
    // 1. Validate request body
    const bodyResult = PcapRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Invalid PCAP request',
        message: bodyResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { ip, fromMs, untilMs, bpfFilter } = bodyResult.data;

    // 2. Validate time window
    if (untilMs <= fromMs) {
      return res.status(400).json({
        error: 'Invalid time window',
        message: 'untilMs must be greater than fromMs',
      });
    }

    // 3. In fixture mode, return fixture metadata
    if (isFixtureMode()) {
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

    // 4. Live mode — placeholder
    return res.status(503).json({
      error: 'Packet store not configured',
      message: 'No packet store is connected to this appliance. PCAP download requires an ExtraHop Trace appliance or a connected packet store.',
      code: 'NO_PACKET_STORE',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'PCAP metadata fetch failed',
      message: err.message || 'Unknown error',
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
packetsRouter.post('/download', (req, res) => {
  try {
    // 1. Validate request body
    const bodyResult = PcapRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Invalid PCAP request',
        message: bodyResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { ip, fromMs, untilMs, bpfFilter } = bodyResult.data;

    // 2. Validate time window
    if (untilMs <= fromMs) {
      return res.status(400).json({
        error: 'Invalid time window',
        message: 'untilMs must be greater than fromMs',
      });
    }

    // 3. In fixture mode, return fixture PCAP binary
    if (isFixtureMode()) {
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

    // 4. Live mode — placeholder
    return res.status(503).json({
      error: 'Packet store not configured',
      message: 'No packet store is connected to this appliance. PCAP download requires an ExtraHop Trace appliance or a connected packet store.',
      code: 'NO_PACKET_STORE',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'PCAP download failed',
      message: err.message || 'Unknown error',
    });
  }
});

export { packetsRouter };
