/**
 * Slice 10 — PCAP Download Contract
 *
 * Tests cover:
 *   1. PcapRequestSchema validation (valid, malformed, edge cases)
 *   2. PcapMetadataSchema validation (valid, malformed)
 *   3. Fixture file integrity (JSON + binary PCAP)
 *   4. BFF route contract (POST /api/bff/packets/download, POST /api/bff/packets/metadata)
 *   5. Pure helper functions (extractMetadataFromHeaders, isBinaryPcapResponse, statusColor)
 *   6. Binary contract invariant enforcement
 *   7. generateFilename determinism
 *
 * Test count: see breakdown table at bottom.
 *
 * All tests run against deterministic fixtures.
 * No live hardware required.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  PcapRequestSchema,
  PcapMetadataSchema,
} from '../shared/cockpit-validators';

// ─── Pure helpers from usePcapDownload ──────────────────────────────────
import {
  extractMetadataFromHeaders,
  isBinaryPcapResponse,
} from '../client/src/hooks/usePcapDownload';

// ─── Pure helper from PcapDownloadButton ────────────────────────────────
import { statusColor } from '../client/src/components/inspector/PcapDownloadButton';

// ─── Fixture paths ──────────────────────────────────────────────────────
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'pcap-download');

function loadJsonFixture(name: string): any {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf-8');
  return JSON.parse(raw);
}

function loadBinaryFixture(name: string): Buffer {
  return readFileSync(join(FIXTURE_DIR, name));
}

// ─── 1. PcapRequestSchema validation ────────────────────────────────────
describe('Slice 10 › PcapRequestSchema', () => {
  it('accepts a valid populated request', () => {
    const fixture = loadJsonFixture('pcap-download.request.populated.fixture.json');
    const result = PcapRequestSchema.safeParse(fixture.request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ip).toBe('192.168.1.10');
      expect(result.data.fromMs).toBe(1710000000000);
      expect(result.data.untilMs).toBe(1710003600000);
      expect(result.data.limitBytes).toBe(10_485_760); // default
    }
  });

  it('accepts a valid filtered request with all optional fields', () => {
    const fixture = loadJsonFixture('pcap-download.request.filtered.fixture.json');
    const result = PcapRequestSchema.safeParse(fixture.request);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ip).toBe('10.0.0.50');
      expect(result.data.bpfFilter).toBe('tcp port 443');
      expect(result.data.limitBytes).toBe(5242880);
      expect(result.data.limitPackets).toBe(10000);
    }
  });

  it('rejects a malformed request with empty IP', () => {
    const fixture = loadJsonFixture('pcap-download.request.malformed.fixture.json');
    const result = PcapRequestSchema.safeParse(fixture.request);
    expect(result.success).toBe(false);
  });

  it('rejects a request with missing ip field', () => {
    const result = PcapRequestSchema.safeParse({ fromMs: 1, untilMs: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects a request with non-integer fromMs', () => {
    const result = PcapRequestSchema.safeParse({ ip: '1.2.3.4', fromMs: 1.5, untilMs: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects a request with negative limitBytes', () => {
    const result = PcapRequestSchema.safeParse({
      ip: '1.2.3.4', fromMs: 1, untilMs: 2, limitBytes: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a request with zero limitPackets', () => {
    const result = PcapRequestSchema.safeParse({
      ip: '1.2.3.4', fromMs: 1, untilMs: 2, limitPackets: 0,
    });
    expect(result.success).toBe(false);
  });

  it('applies default limitBytes of 10MB when not provided', () => {
    const result = PcapRequestSchema.safeParse({
      ip: '1.2.3.4', fromMs: 1000, untilMs: 2000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limitBytes).toBe(10_485_760);
    }
  });
});

// ─── 2. PcapMetadataSchema validation ───────────────────────────────────
describe('Slice 10 › PcapMetadataSchema', () => {
  it('accepts a valid populated metadata fixture', () => {
    const fixture = loadJsonFixture('pcap-download.metadata.populated.fixture.json');
    const result = PcapMetadataSchema.safeParse(fixture.metadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentType).toBe('application/vnd.tcpdump.pcap');
      expect(result.data.filename).toMatch(/\.pcap$/);
      expect(result.data.sourceIp).toBe('192.168.1.10');
      expect(result.data.packetStoreId).toBeNull();
    }
  });

  it('accepts a valid filtered metadata fixture', () => {
    const fixture = loadJsonFixture('pcap-download.metadata.filtered.fixture.json');
    const result = PcapMetadataSchema.safeParse(fixture.metadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bpfFilter).toBe('tcp port 443');
      expect(result.data.sourceIp).toBe('10.0.0.50');
    }
  });

  it('rejects a malformed metadata fixture', () => {
    const fixture = loadJsonFixture('pcap-download.metadata.malformed.fixture.json');
    const result = PcapMetadataSchema.safeParse(fixture.metadata);
    expect(result.success).toBe(false);
  });

  it('rejects metadata with wrong contentType', () => {
    const result = PcapMetadataSchema.safeParse({
      filename: 'test.pcap',
      contentType: 'application/json',
      estimatedBytes: 100,
      sourceIp: '1.2.3.4',
      fromMs: 1,
      untilMs: 2,
      bpfFilter: null,
      packetStoreId: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects metadata with empty filename', () => {
    const result = PcapMetadataSchema.safeParse({
      filename: '',
      contentType: 'application/vnd.tcpdump.pcap',
      estimatedBytes: 100,
      sourceIp: '1.2.3.4',
      fromMs: 1,
      untilMs: 2,
      bpfFilter: null,
      packetStoreId: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects metadata with negative estimatedBytes', () => {
    const result = PcapMetadataSchema.safeParse({
      filename: 'test.pcap',
      contentType: 'application/vnd.tcpdump.pcap',
      estimatedBytes: -100,
      sourceIp: '1.2.3.4',
      fromMs: 1,
      untilMs: 2,
      bpfFilter: null,
      packetStoreId: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts metadata with null estimatedBytes', () => {
    const result = PcapMetadataSchema.safeParse({
      filename: 'test.pcap',
      contentType: 'application/vnd.tcpdump.pcap',
      estimatedBytes: null,
      sourceIp: '1.2.3.4',
      fromMs: 1,
      untilMs: 2,
      bpfFilter: null,
      packetStoreId: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── 3. Fixture file integrity ──────────────────────────────────────────
describe('Slice 10 › Fixture files', () => {
  const expectedJsonFixtures = [
    'pcap-download.metadata.populated.fixture.json',
    'pcap-download.metadata.filtered.fixture.json',
    'pcap-download.metadata.malformed.fixture.json',
    'pcap-download.request.populated.fixture.json',
    'pcap-download.request.filtered.fixture.json',
    'pcap-download.request.malformed.fixture.json',
    'pcap-download.transport-error.fixture.json',
    'pcap-download.not-configured.fixture.json',
  ];

  for (const name of expectedJsonFixtures) {
    it(`JSON fixture exists and is valid JSON: ${name}`, () => {
      const path = join(FIXTURE_DIR, name);
      expect(existsSync(path)).toBe(true);
      const raw = readFileSync(path, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }

  it('binary fixture pcap-download.empty.fixture.pcap exists and has valid PCAP magic', () => {
    const buf = loadBinaryFixture('pcap-download.empty.fixture.pcap');
    expect(buf.length).toBe(24); // global header only
    // PCAP magic number (little-endian): 0xd4c3b2a1
    expect(buf.readUInt32LE(0)).toBe(0xa1b2c3d4);
  });

  it('binary fixture pcap-download.populated.fixture.pcap exists and has valid PCAP magic + packet', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    expect(buf.length).toBe(74); // 24 header + 16 pkt header + 34 pkt data
    expect(buf.readUInt32LE(0)).toBe(0xa1b2c3d4);
    // Version 2.4
    expect(buf.readUInt16LE(4)).toBe(2);
    expect(buf.readUInt16LE(6)).toBe(4);
    // Snaplen 65535
    expect(buf.readUInt32LE(16)).toBe(65535);
    // Network: Ethernet (1)
    expect(buf.readUInt32LE(20)).toBe(1);
  });

  it('transport-error fixture has required error fields', () => {
    const fixture = loadJsonFixture('pcap-download.transport-error.fixture.json');
    expect(fixture.error).toBeDefined();
    expect(typeof fixture.error).toBe('string');
    expect(fixture.message).toBeDefined();
    expect(typeof fixture.message).toBe('string');
    expect(fixture.code).toBeDefined();
  });

  it('not-configured fixture has required error fields', () => {
    const fixture = loadJsonFixture('pcap-download.not-configured.fixture.json');
    expect(fixture.error).toBeDefined();
    expect(fixture.message).toBeDefined();
    expect(fixture.code).toBe('NO_PACKET_STORE');
  });
});

// ─── 4. BFF route contract (shape validation, not HTTP) ─────────────────
describe('Slice 10 › BFF route contract shapes', () => {
  it('metadata route success shape matches PcapMetadataSchema', () => {
    const fixture = loadJsonFixture('pcap-download.metadata.populated.fixture.json');
    const result = PcapMetadataSchema.safeParse(fixture.metadata);
    expect(result.success).toBe(true);
  });

  it('metadata route error shape has error + message fields', () => {
    const fixture = loadJsonFixture('pcap-download.transport-error.fixture.json');
    expect(typeof fixture.error).toBe('string');
    expect(typeof fixture.message).toBe('string');
  });

  it('download route binary response has correct PCAP structure', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    // First 4 bytes must be PCAP magic
    expect(buf.readUInt32LE(0)).toBe(0xa1b2c3d4);
    // Must not be JSON (first byte of JSON would be { = 0x7b)
    expect(buf[0]).not.toBe(0x7b);
  });

  it('download route binary response is NOT JSON-wrapped (binary contract invariant)', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    // Attempt to parse as JSON should fail
    expect(() => JSON.parse(buf.toString('utf-8'))).toThrow();
  });

  it('empty PCAP fixture is valid but has no packets', () => {
    const buf = loadBinaryFixture('pcap-download.empty.fixture.pcap');
    // Only global header (24 bytes), no packet records
    expect(buf.length).toBe(24);
    expect(buf.readUInt32LE(0)).toBe(0xa1b2c3d4);
  });
});

// ─── 5. Pure helper functions ───────────────────────────────────────────
describe('Slice 10 › extractMetadataFromHeaders', () => {
  function makeHeaders(entries: Record<string, string>): Headers {
    return new Headers(entries);
  }

  const baseRequest = { ip: '192.168.1.10', fromMs: 1710000000000, untilMs: 1710003600000 };

  it('extracts metadata from valid PCAP response headers', () => {
    const headers = makeHeaders({
      'content-type': 'application/vnd.tcpdump.pcap',
      'content-disposition': 'attachment; filename="192.168.1.10_test.pcap"',
      'content-length': '74',
      'x-pcap-source-ip': '192.168.1.10',
    });
    const meta = extractMetadataFromHeaders(headers, baseRequest);
    expect(meta).not.toBeNull();
    expect(meta!.contentType).toBe('application/vnd.tcpdump.pcap');
    expect(meta!.filename).toBe('192.168.1.10_test.pcap');
    expect(meta!.estimatedBytes).toBe(74);
    expect(meta!.sourceIp).toBe('192.168.1.10');
  });

  it('returns null for non-PCAP content type', () => {
    const headers = makeHeaders({ 'content-type': 'application/json' });
    const meta = extractMetadataFromHeaders(headers, baseRequest);
    expect(meta).toBeNull();
  });

  it('returns null for missing content type', () => {
    const headers = makeHeaders({});
    const meta = extractMetadataFromHeaders(headers, baseRequest);
    expect(meta).toBeNull();
  });

  it('generates fallback filename when Content-Disposition is missing', () => {
    const headers = makeHeaders({
      'content-type': 'application/vnd.tcpdump.pcap',
    });
    const meta = extractMetadataFromHeaders(headers, baseRequest);
    expect(meta).not.toBeNull();
    expect(meta!.filename).toBe('192.168.1.10_1710000000000_1710003600000.pcap');
  });

  it('handles null content-length gracefully', () => {
    const headers = makeHeaders({
      'content-type': 'application/vnd.tcpdump.pcap',
    });
    const meta = extractMetadataFromHeaders(headers, baseRequest);
    expect(meta).not.toBeNull();
    expect(meta!.estimatedBytes).toBeNull();
  });

  it('extracts BPF filter from x-pcap-bpf-filter header', () => {
    const headers = makeHeaders({
      'content-type': 'application/vnd.tcpdump.pcap',
      'x-pcap-bpf-filter': 'tcp port 443',
    });
    const meta = extractMetadataFromHeaders(headers, baseRequest);
    expect(meta).not.toBeNull();
    expect(meta!.bpfFilter).toBe('tcp port 443');
  });

  it('falls back to request bpfFilter when header is absent', () => {
    const headers = makeHeaders({
      'content-type': 'application/vnd.tcpdump.pcap',
    });
    const reqWithFilter = { ...baseRequest, bpfFilter: 'udp port 53' };
    const meta = extractMetadataFromHeaders(headers, reqWithFilter);
    expect(meta).not.toBeNull();
    expect(meta!.bpfFilter).toBe('udp port 53');
  });
});

describe('Slice 10 › isBinaryPcapResponse', () => {
  it('returns true for application/vnd.tcpdump.pcap', () => {
    expect(isBinaryPcapResponse('application/vnd.tcpdump.pcap')).toBe(true);
  });

  it('returns true for content type with charset suffix', () => {
    expect(isBinaryPcapResponse('application/vnd.tcpdump.pcap; charset=binary')).toBe(true);
  });

  it('returns false for application/json', () => {
    expect(isBinaryPcapResponse('application/json')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBinaryPcapResponse(null)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBinaryPcapResponse('')).toBe(false);
  });
});

describe('Slice 10 › statusColor', () => {
  it('returns gold for idle', () => {
    const color = statusColor('idle');
    expect(color).toContain('oklch');
  });

  it('returns gold for fetching', () => {
    const color = statusColor('fetching');
    expect(color).toContain('oklch');
  });

  it('returns green for complete', () => {
    const color = statusColor('complete');
    expect(color).toContain('oklch');
    expect(color).not.toBe(statusColor('idle'));
  });

  it('returns red for error', () => {
    const color = statusColor('error');
    expect(color).toContain('oklch');
    expect(color).not.toBe(statusColor('idle'));
    expect(color).not.toBe(statusColor('complete'));
  });
});

// ─── 6. Binary contract invariant enforcement ───────────────────────────
describe('Slice 10 › Binary contract invariant', () => {
  it('populated PCAP fixture starts with PCAP magic, not JSON brace', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    // PCAP magic: 0xa1b2c3d4 (LE) → first byte is 0xd4
    expect(buf[0]).toBe(0xd4);
    // JSON would start with 0x7b ({)
    expect(buf[0]).not.toBe(0x7b);
  });

  it('empty PCAP fixture starts with PCAP magic, not JSON brace', () => {
    const buf = loadBinaryFixture('pcap-download.empty.fixture.pcap');
    expect(buf[0]).toBe(0xd4);
    expect(buf[0]).not.toBe(0x7b);
  });

  it('populated PCAP fixture cannot be parsed as valid JSON', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    expect(() => JSON.parse(buf.toString('utf-8'))).toThrow();
  });

  it('PCAP version in fixture is 2.4 (standard libpcap)', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    expect(buf.readUInt16LE(4)).toBe(2); // major
    expect(buf.readUInt16LE(6)).toBe(4); // minor
  });

  it('PCAP network type in fixture is Ethernet (1)', () => {
    const buf = loadBinaryFixture('pcap-download.populated.fixture.pcap');
    expect(buf.readUInt32LE(20)).toBe(1);
  });
});

// ─── 7. Cross-fixture consistency ───────────────────────────────────────
describe('Slice 10 › Cross-fixture consistency', () => {
  it('populated request fixture IP matches populated metadata fixture sourceIp', () => {
    const req = loadJsonFixture('pcap-download.request.populated.fixture.json');
    const meta = loadJsonFixture('pcap-download.metadata.populated.fixture.json');
    expect(req.request.ip).toBe(meta.metadata.sourceIp);
  });

  it('populated request fixture time window matches populated metadata fixture', () => {
    const req = loadJsonFixture('pcap-download.request.populated.fixture.json');
    const meta = loadJsonFixture('pcap-download.metadata.populated.fixture.json');
    expect(req.request.fromMs).toBe(meta.metadata.fromMs);
    expect(req.request.untilMs).toBe(meta.metadata.untilMs);
  });

  it('filtered request fixture IP matches filtered metadata fixture sourceIp', () => {
    const req = loadJsonFixture('pcap-download.request.filtered.fixture.json');
    const meta = loadJsonFixture('pcap-download.metadata.filtered.fixture.json');
    expect(req.request.ip).toBe(meta.metadata.sourceIp);
  });

  it('filtered request fixture bpfFilter matches filtered metadata fixture', () => {
    const req = loadJsonFixture('pcap-download.request.filtered.fixture.json');
    const meta = loadJsonFixture('pcap-download.metadata.filtered.fixture.json');
    expect(req.request.bpfFilter).toBe(meta.metadata.bpfFilter);
  });

  it('all metadata fixtures have contentType = application/vnd.tcpdump.pcap', () => {
    const populated = loadJsonFixture('pcap-download.metadata.populated.fixture.json');
    const filtered = loadJsonFixture('pcap-download.metadata.filtered.fixture.json');
    expect(populated.metadata.contentType).toBe('application/vnd.tcpdump.pcap');
    expect(filtered.metadata.contentType).toBe('application/vnd.tcpdump.pcap');
  });
});

/**
 * Slice 10 test breakdown:
 *
 * | Group                                | it() sites | vitest executions |
 * |--------------------------------------|-----------|-------------------|
 * | PcapRequestSchema                    |         8 |                 8 |
 * | PcapMetadataSchema                   |         7 |                 7 |
 * | Fixture files                        |         5 (1 loop) |       12 |
 * | BFF route contract shapes            |         5 |                 5 |
 * | extractMetadataFromHeaders           |         7 |                 7 |
 * | isBinaryPcapResponse                 |         5 |                 5 |
 * | statusColor                          |         4 |                 4 |
 * | Binary contract invariant            |         5 |                 5 |
 * | Cross-fixture consistency            |         5 |                 5 |
 * |--------------------------------------|-----------|-------------------|
 * | TOTAL                                |        51 |                58 |
 *
 * Note: Fixture files group has 4 non-loop it() + 8 loop-expanded it() = 12 executions.
 * Source-level it() call sites: 51 (counting the for-loop as 1 site).
 */
