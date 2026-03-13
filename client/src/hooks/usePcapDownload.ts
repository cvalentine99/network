/**
 * usePcapDownload — Hook for PCAP download lifecycle.
 *
 * Slice 10 — Manages the full download flow:
 *   1. idle        — no download in progress
 *   2. fetching    — POST to /api/bff/packets/download in progress
 *   3. complete    — download completed, blob available
 *   4. error       — download failed (transport, validation, or not-configured)
 *
 * CONTRACT:
 *   - Sends POST /api/bff/packets/download with PcapRequest JSON body
 *   - Expects binary response (application/vnd.tcpdump.pcap)
 *   - Triggers browser download via Blob URL + anchor click
 *   - Error responses are JSON with { error, message, code? }
 *   - No ExtraHop calls — all traffic via BFF
 *   - Uses shared PcapRequest type only
 *
 * Binary contract invariant:
 *   The hook expects raw binary from the BFF, NOT JSON-wrapped PCAP.
 *   Content-Type must be application/vnd.tcpdump.pcap on success.
 */
import { useState, useCallback } from 'react';
import type { PcapRequest, PcapMetadata } from '../../../shared/cockpit-types';

// ─── State types ─────────────────────────────────────────────────────────
export type PcapDownloadStatus = 'idle' | 'fetching' | 'complete' | 'error';

export interface PcapDownloadState {
  status: PcapDownloadStatus;
  /** Populated on 'complete' — metadata extracted from response headers */
  metadata: PcapMetadata | null;
  /** Populated on 'error' */
  error: string | null;
  message: string | null;
  code: string | null;
}

const IDLE_STATE: PcapDownloadState = {
  status: 'idle',
  metadata: null,
  error: null,
  message: null,
  code: null,
};

// ─── Pure helpers (exported for testing) ─────────────────────────────────

/**
 * Extract PcapMetadata from response headers.
 * Returns null if required headers are missing.
 */
export function extractMetadataFromHeaders(
  headers: Headers,
  request: PcapRequest
): PcapMetadata | null {
  const contentType = headers.get('content-type');
  if (!contentType || !contentType.includes('application/vnd.tcpdump.pcap')) {
    return null;
  }

  const disposition = headers.get('content-disposition');
  const filenameMatch = disposition?.match(/filename="?([^";\s]+)"?/);
  const filename = filenameMatch?.[1] || `${request.ip}_${request.fromMs}_${request.untilMs}.pcap`;

  const contentLength = headers.get('content-length');
  const estimatedBytes = contentLength ? parseInt(contentLength, 10) : null;

  return {
    filename,
    contentType: 'application/vnd.tcpdump.pcap',
    estimatedBytes: estimatedBytes !== null && !isNaN(estimatedBytes) ? estimatedBytes : null,
    sourceIp: headers.get('x-pcap-source-ip') || request.ip,
    fromMs: request.fromMs,
    untilMs: request.untilMs,
    bpfFilter: headers.get('x-pcap-bpf-filter') || request.bpfFilter || null,
    packetStoreId: null,
  };
}

/**
 * Validate that a PCAP response has the correct binary content type.
 * Returns true if the response is binary PCAP, false if it's JSON error.
 */
export function isBinaryPcapResponse(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.includes('application/vnd.tcpdump.pcap');
}

/**
 * Trigger a browser download from a Blob.
 * Creates a temporary anchor element, clicks it, then cleans up.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // Cleanup after a short delay to ensure download starts
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }, 100);
}

// ─── Hook ────────────────────────────────────────────────────────────────
export function usePcapDownload() {
  const [state, setState] = useState<PcapDownloadState>(IDLE_STATE);

  const download = useCallback(async (request: PcapRequest) => {
    setState({
      status: 'fetching',
      metadata: null,
      error: null,
      message: null,
      code: null,
    });

    try {
      const response = await fetch('/api/bff/packets/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const contentType = response.headers.get('content-type');

      // If response is JSON, it's an error
      if (!isBinaryPcapResponse(contentType)) {
        let errorBody: { error?: string; message?: string; code?: string } = {};
        try {
          errorBody = await response.json();
        } catch {
          errorBody = { error: 'Unknown error', message: `HTTP ${response.status}` };
        }

        setState({
          status: 'error',
          metadata: null,
          error: errorBody.error || 'Download failed',
          message: errorBody.message || 'Unknown error',
          code: errorBody.code || null,
        });
        return;
      }

      // Binary PCAP response — extract metadata from headers
      const metadata = extractMetadataFromHeaders(response.headers, request);
      const blob = await response.blob();

      // Trigger browser download
      const filename = metadata?.filename || `${request.ip}_${request.fromMs}_${request.untilMs}.pcap`;
      triggerBlobDownload(blob, filename);

      setState({
        status: 'complete',
        metadata,
        error: null,
        message: null,
        code: null,
      });
    } catch (err: any) {
      setState({
        status: 'error',
        metadata: null,
        error: 'Transport error',
        message: err.message || 'Network request failed',
        code: 'TRANSPORT_ERROR',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState(IDLE_STATE);
  }, []);

  return { state, download, reset };
}
