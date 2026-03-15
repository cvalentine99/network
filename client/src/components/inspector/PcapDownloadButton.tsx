/**
 * PcapDownloadButton — PCAP download trigger for the Device Detail inspector.
 *
 * Slice 10 — Renders a download button with state feedback.
 *
 * CONTRACT:
 *   - Accepts device IP and current time window
 *   - Calls usePcapDownload hook to initiate binary download
 *   - Shows 4 visual states: idle, fetching, complete, error
 *   - Optional BPF filter input
 *   - No ExtraHop calls — all traffic via BFF
 *
 * Binary contract invariant:
 *   This component triggers a binary download, not a JSON fetch.
 *   The BFF returns raw PCAP bytes; the hook handles Blob creation.
 */
import { useState, useMemo } from 'react';
import { usePcapDownload, type PcapDownloadStatus } from '@/hooks/usePcapDownload';
import type { PcapRequest } from '../../../../shared/cockpit-types';
import { Download, Loader2, CheckCircle, AlertTriangle, Filter } from 'lucide-react';

// ─── Color constants (matching DashboardWidgets) ────────────────────────
const GOLD = 'oklch(0.769 0.108 85.805)';
const MUTED = 'oklch(0.556 0.014 247.261)';
const BRIGHT = 'oklch(0.922 0.016 236.824)';
const RED = 'oklch(0.628 0.258 29.234)';
const GREEN = 'oklch(0.723 0.219 149.579)';

// ─── Status icon ────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: PcapDownloadStatus }) {
  switch (status) {
    case 'idle':
      return <Download className="h-3.5 w-3.5" />;
    case 'fetching':
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case 'complete':
      return <CheckCircle className="h-3.5 w-3.5" />;
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5" />;
  }
}

// ─── Status label ───────────────────────────────────────────────────────
function statusLabel(status: PcapDownloadStatus): string {
  switch (status) {
    case 'idle': return 'Download PCAP';
    case 'fetching': return 'Downloading…';
    case 'complete': return 'Download Complete';
    case 'error': return 'Download Failed';
  }
}

// ─── Status color ───────────────────────────────────────────────────────
export function statusColor(status: PcapDownloadStatus): string {
  switch (status) {
    case 'idle': return GOLD;
    case 'fetching': return GOLD;
    case 'complete': return GREEN;
    case 'error': return RED;
  }
}

// ─── Props ──────────────────────────────────────────────────────────────
interface PcapDownloadButtonProps {
  deviceIp: string;
  fromMs: number;
  untilMs: number;
}

export function PcapDownloadButton({ deviceIp, fromMs, untilMs }: PcapDownloadButtonProps) {
  const { state, download, reset } = usePcapDownload();
  const [showFilter, setShowFilter] = useState(false);
  const [bpfFilter, setBpfFilter] = useState('');

  // Stabilize the request object
  const request: PcapRequest = useMemo(() => ({
    ip: deviceIp,
    fromMs,
    untilMs,
    ...(bpfFilter.trim() ? { bpfFilter: bpfFilter.trim() } : {}),
  }), [deviceIp, fromMs, untilMs, bpfFilter]);

  const handleClick = () => {
    if (state.status === 'complete' || state.status === 'error') {
      reset();
      return;
    }
    if (state.status === 'fetching') return;
    download(request);
  };

  const color = statusColor(state.status);
  const isDisabled = state.status === 'fetching';

  return (
    <div className="mt-4" data-testid="pcap-download-section">
      {/* BPF Filter toggle */}
      <button
        type="button"
        className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-wider"
        style={{ color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={() => setShowFilter(!showFilter)}
        data-testid="pcap-filter-toggle"
      >
        <Filter className="h-3 w-3" />
        {showFilter ? 'Hide BPF Filter' : 'Add BPF Filter'}
      </button>

      {/* BPF Filter input */}
      {showFilter && (
        <div className="mb-3">
          <input
            type="text"
            value={bpfFilter}
            onChange={(e) => setBpfFilter(e.target.value)}
            placeholder="e.g. tcp port 443"
            className="w-full px-3 py-1.5 rounded text-[11px]"
            style={{
              background: 'oklch(1 0 0 / 4%)',
              border: '1px solid oklch(1 0 0 / 8%)',
              color: BRIGHT,
              fontFamily: 'var(--font-mono)',
            }}
            disabled={isDisabled}
            data-testid="pcap-bpf-input"
          />
          <p className="text-[10px] mt-1" style={{ color: MUTED }}>
            Berkeley Packet Filter expression (optional)
          </p>
        </div>
      )}

      {/* Download button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-semibold uppercase tracking-wider transition-all"
        style={{
          background: `color-mix(in oklch, ${color} 15%, transparent)`,
          color,
          border: `1px solid color-mix(in oklch, ${color} 25%, transparent)`,
          cursor: isDisabled ? 'wait' : 'pointer',
          opacity: isDisabled ? 0.7 : 1,
        }}
        data-testid="pcap-download-button"
      >
        <StatusIcon status={state.status} />
        {statusLabel(state.status)}
      </button>

      {/* Error message */}
      {state.status === 'error' && state.message && (
        <div className="mt-2 px-3 py-2 rounded text-[11px]" style={{ background: 'oklch(0.628 0.258 29.234 / 8%)', color: RED }} data-testid="pcap-download-error">
          <p className="font-semibold">{state.error}</p>
          <p style={{ color: MUTED }}>{state.message}</p>
          {state.code && (
            <p className="mt-1" style={{ fontFamily: 'var(--font-mono)', color: MUTED }}>
              Code: {state.code}
            </p>
          )}
        </div>
      )}

      {/* Success metadata */}
      {state.status === 'complete' && state.metadata && (
        <div className="mt-2 px-3 py-2 rounded text-[11px]" style={{ background: 'oklch(0.723 0.219 149.579 / 8%)', color: GREEN }} data-testid="pcap-download-success">
          <p className="font-semibold">Saved: {state.metadata.filename}</p>
          {state.metadata.estimatedBytes !== null && (
            <p style={{ color: MUTED }}>
              Size: {(state.metadata.estimatedBytes / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
      )}
    </div>
  );
}
