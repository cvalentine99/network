/**
 * Slice 18 — Blast Radius Surface
 *
 * "Who is affected?" — Given a source device, shows all peer devices
 * that communicated with it, protocols used, associated detections,
 * and severity-weighted impact scores.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Search, Shield, ShieldAlert, ShieldCheck, ShieldX,
  ArrowUpDown, Filter, Loader2, Server, Globe, Activity,
  ChevronDown, ChevronUp, ExternalLink, X,
} from 'lucide-react';
import type {
  BlastRadiusPayload, BlastRadiusPeer, BlastRadiusViewState,
  BlastRadiusSortField, BlastRadiusSeverity,
} from '../../../shared/blast-radius-types';
import {
  buildInitialBlastRadiusState, sortBlastRadiusPeers,
  filterAffectedPeers, getSeverityColor,
} from '../../../shared/blast-radius-types';
import { BlastRadiusPayloadSchema } from '../../../shared/blast-radius-validators';
import CrossSurfaceNavButton from '@/components/CrossSurfaceNavButton';
import { buildBlastRadiusToFlowTheaterLink } from '../../../shared/cross-surface-nav-types';
import { useBlastRadiusNavParams } from '@/hooks/useNavParams';

// ─── Color constants (matching DashboardWidgets) ───────────────────────────

const GOLD = 'oklch(0.769 0.108 85.805)';
const CYAN = 'oklch(0.75 0.15 195)';
const GREEN = 'oklch(0.723 0.219 149.579)';
const RED = 'oklch(0.628 0.258 29.234)';
const ORANGE = 'oklch(0.705 0.213 47.604)';
const AMBER = 'oklch(0.769 0.188 70.08)';
const MUTED = 'oklch(0.6 0.01 260)';
const BRIGHT = 'oklch(0.95 0.005 85)';

const GLASS_BG = 'oklch(0.15 0.005 260 / 60%)';
const GLASS_BORDER = 'oklch(1 0 0 / 8%)';

// ─── Formatters ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Severity Badge ────────────────────────────────────────────────────────

function SeverityBadge({ severity, count }: { severity: BlastRadiusSeverity; count: number }) {
  if (count === 0) return null;
  const color = getSeverityColor(severity);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `color-mix(in oklch, ${color} 20%, transparent)`, color, border: `1px solid color-mix(in oklch, ${color} 30%, transparent)` }}
    >
      {severity} {count}
    </span>
  );
}

// ─── Impact Score Bar ──────────────────────────────────────────────────────

function ImpactBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0;
  const color = score > 150 ? RED : score > 80 ? ORANGE : score > 30 ? AMBER : GREEN;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 rounded-full" style={{ background: 'oklch(1 0 0 / 5%)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color: BRIGHT, minWidth: '3rem', textAlign: 'right' }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Peer Row ──────────────────────────────────────────────────────────────

function PeerRow({
  peer, maxScore, isExpanded, onToggle,
}: {
  peer: BlastRadiusPeer;
  maxScore: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: GLASS_BORDER }}
      data-testid={`peer-row-${peer.deviceId}`}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        {/* Expand icon */}
        <span className="shrink-0" style={{ color: MUTED }}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>

        {/* Device icon */}
        <span className="shrink-0">
          {peer.critical ? (
            <ShieldAlert className="h-4 w-4" style={{ color: RED }} />
          ) : peer.detections.length > 0 ? (
            <ShieldX className="h-4 w-4" style={{ color: ORANGE }} />
          ) : (
            <ShieldCheck className="h-4 w-4" style={{ color: GREEN }} />
          )}
        </span>

        {/* Name + IP */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate" style={{ color: BRIGHT }}>
              {peer.displayName}
            </span>
            {peer.critical && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `color-mix(in oklch, ${RED} 15%, transparent)`, color: RED }}>
                Critical
              </span>
            )}
          </div>
          {peer.ipaddr && peer.ipaddr !== peer.displayName && (
            <span className="text-xs" style={{ color: MUTED }}>{peer.ipaddr}</span>
          )}
        </div>

        {/* Protocols */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {peer.protocols.slice(0, 3).map(p => (
            <span key={p.name} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(1 0 0 / 5%)', color: p.hasDetections ? ORANGE : MUTED }}>
              {p.name}
            </span>
          ))}
          {peer.protocols.length > 3 && (
            <span className="text-[10px]" style={{ color: MUTED }}>+{peer.protocols.length - 3}</span>
          )}
        </div>

        {/* Detections count */}
        <div className="shrink-0 text-center" style={{ minWidth: '3rem' }}>
          <span className="text-sm font-mono tabular-nums" style={{ color: peer.detections.length > 0 ? RED : MUTED }}>
            {peer.detections.length}
          </span>
        </div>

        {/* Traffic */}
        <div className="hidden lg:block shrink-0 text-right" style={{ minWidth: '5rem' }}>
          <span className="text-xs font-mono tabular-nums" style={{ color: CYAN }}>
            {formatBytes(peer.totalBytes)}
          </span>
        </div>

        {/* Impact */}
        <div className="shrink-0" style={{ minWidth: '140px' }}>
          <ImpactBar score={peer.impactScore} maxScore={maxScore} />
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 ml-11 space-y-3">
              {/* Protocols detail */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Protocols</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {peer.protocols.map(p => (
                    <div key={p.name} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'oklch(1 0 0 / 3%)', border: `1px solid ${GLASS_BORDER}` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: p.hasDetections ? ORANGE : BRIGHT }}>{p.name}</span>
                        {p.port !== null && <span className="text-[10px]" style={{ color: MUTED }}>:{p.port}</span>}
                      </div>
                      <div className="text-[10px] font-mono" style={{ color: CYAN }}>
                        {formatBytes(p.bytesSent + p.bytesReceived)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cross-surface navigation */}
              <div className="flex gap-2">
                <CrossSurfaceNavButton
                  link={buildBlastRadiusToFlowTheaterLink(peer.displayName, peer.deviceId)}
                />
              </div>

              {/* Detections detail */}
              {peer.detections.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: MUTED }}>Detections</p>
                  <div className="space-y-1.5">
                    {peer.detections.map(d => (
                      <div key={d.id} className="flex items-center gap-3 px-3 py-2 rounded" style={{ background: 'oklch(1 0 0 / 3%)', border: `1px solid ${GLASS_BORDER}` }}>
                        <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: getSeverityColor(d.severity) }} />
                        <span className="flex-1 text-xs" style={{ color: BRIGHT }}>{d.title}</span>
                        <span className="text-[10px] font-mono" style={{ color: MUTED }}>Risk: {d.riskScore}</span>
                        <SeverityBadge severity={d.severity} count={1} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Summary Cards ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}>
      <Icon className="h-5 w-5 shrink-0" style={{ color }} />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>{label}</p>
        <p className="text-lg font-mono tabular-nums font-semibold" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function BlastRadius() {
  const [state, setState] = useState<BlastRadiusViewState>(buildInitialBlastRadiusState);
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'device-id' | 'hostname' | 'ip-address'>('device-id');
  const [expandedPeerId, setExpandedPeerId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const navParams = useBlastRadiusNavParams();
  const navConsumedRef = useRef(false);

  // Consume cross-surface nav params on mount
  useEffect(() => {
    if (navParams && !navConsumedRef.current) {
      navConsumedRef.current = true;
      setInputMode(navParams.mode);
      setInputValue(navParams.value);
      // autoSubmit is handled after state settles (see next effect)
    }
  }, [navParams]);

  // Auto-submit after nav params are consumed
  const autoSubmitRef = useRef(false);
  useEffect(() => {
    if (navParams?.autoSubmit && navConsumedRef.current && !autoSubmitRef.current && inputValue === navParams.value) {
      autoSubmitRef.current = true;
      // Trigger query on next tick after state has settled
      const timer = setTimeout(() => {
        handleQuery();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [navParams, inputValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleQuery = useCallback(async () => {
    if (!inputValue.trim()) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState(prev => ({
      ...prev,
      status: 'loading',
      errorMessage: null,
      payload: null,
      intent: {
        mode: inputMode,
        value: inputValue.trim(),
        timeWindow: {
          fromMs: Date.now() - 1800000,
          untilMs: Date.now(),
          durationMs: 1800000,
          cycle: '30sec' as const,
        },
      },
    }));

    try {
      const resp = await fetch('/api/bff/blast-radius/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: inputMode,
          value: inputValue.trim(),
          timeWindow: {
            fromMs: Date.now() - 1800000,
            untilMs: Date.now(),
            durationMs: 1800000,
            cycle: '30sec',
          },
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: `HTTP ${resp.status}` }));
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: `Request failed with status ${resp.status}`,
        }));
        return;
      }

      const raw = await resp.json();
      const validated = BlastRadiusPayloadSchema.safeParse(raw);

      if (!validated.success) {
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: 'Response failed schema validation',
        }));
        return;
      }

      const payload = validated.data as BlastRadiusPayload;

      if (payload.peers.length === 0) {
        setState(prev => ({
          ...prev,
          status: 'quiet',
          payload,
        }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'populated',
          payload,
        }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Network request failed',
      }));
    }
  }, [inputValue, inputMode]);

  // Get sorted/filtered peers
  const visiblePeers = (() => {
    if (!state.payload) return [];
    let peers = state.payload.peers;
    if (state.filterAffectedOnly) {
      peers = filterAffectedPeers(peers);
    }
    return sortBlastRadiusPeers(peers, state.sortField, state.sortDirection);
  })();

  const maxScore = state.payload?.summary.maxImpactScore ?? 0;

  const toggleSort = (field: BlastRadiusSortField) => {
    setState(prev => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <div className="space-y-6" data-testid="blast-radius-surface">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: BRIGHT }}>Blast Radius</h1>
        <p className="text-sm mt-1" style={{ color: MUTED }}>Who is affected? Analyze the impact scope of a device.</p>
      </div>

      {/* Entry Form */}
      <div
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-lg"
        style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
        data-testid="blast-radius-entry-form"
      >
        <select
          value={inputMode}
          onChange={e => setInputMode(e.target.value as any)}
          className="px-3 py-2 rounded text-sm bg-transparent border focus:outline-none focus:ring-1"
          style={{ borderColor: GLASS_BORDER, color: BRIGHT }}
          data-testid="blast-radius-mode-select"
        >
          <option value="device-id">Device ID</option>
          <option value="hostname">Hostname</option>
          <option value="ip-address">IP Address</option>
        </select>

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: MUTED }} />
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
            placeholder={
              inputMode === 'device-id' ? 'Enter device ID (e.g., 1042)' :
              inputMode === 'hostname' ? 'Enter hostname (e.g., dc01.lab.local)' :
              'Enter IP address (e.g., 10.1.20.42)'
            }
            className="w-full pl-10 pr-4 py-2 rounded text-sm bg-transparent border focus:outline-none focus:ring-1"
            style={{ borderColor: GLASS_BORDER, color: BRIGHT }}
            disabled={state.status === 'loading'}
            data-testid="blast-radius-input"
          />
        </div>

        <button
          onClick={handleQuery}
          disabled={state.status === 'loading' || !inputValue.trim()}
          className="px-6 py-2 rounded text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: GOLD, color: 'oklch(0.15 0 0)' }}
          data-testid="blast-radius-submit"
        >
          {state.status === 'loading' ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
            </span>
          ) : (
            'Analyze'
          )}
        </button>
      </div>

      {/* Idle State */}
      {state.status === 'idle' && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-lg border-2 border-dashed"
          style={{ borderColor: 'oklch(1 0 0 / 10%)', color: MUTED }}
          data-testid="blast-radius-idle"
        >
          <Shield className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-sm font-medium">Enter a device identifier to analyze its blast radius</p>
          <p className="text-xs mt-1 opacity-60">Shows all peer devices, protocols, detections, and impact scores</p>
        </div>
      )}

      {/* Loading State */}
      {state.status === 'loading' && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-lg"
          style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}
          data-testid="blast-radius-loading"
        >
          <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: GOLD }} />
          <p className="text-sm font-medium" style={{ color: BRIGHT }}>Analyzing blast radius...</p>
          <p className="text-xs mt-1" style={{ color: MUTED }}>Querying peer devices and detections</p>
        </div>
      )}

      {/* Error State */}
      {state.status === 'error' && (
        <div
          className="flex items-center gap-4 p-4 rounded-lg"
          style={{ background: `color-mix(in oklch, ${RED} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${RED} 30%, transparent)` }}
          data-testid="blast-radius-error"
        >
          <AlertTriangle className="h-6 w-6 shrink-0" style={{ color: RED }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: RED }}>Blast Radius Query Failed</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>{state.errorMessage}</p>
          </div>
          <button
            onClick={() => setState(buildInitialBlastRadiusState())}
            className="shrink-0 p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: MUTED }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quiet State */}
      {state.status === 'quiet' && state.payload && (
        <div
          className="space-y-4"
          data-testid="blast-radius-quiet"
        >
          {/* Source card */}
          <div className="p-4 rounded-lg" style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5" style={{ color: GOLD }} />
              <div>
                <p className="text-sm font-medium" style={{ color: BRIGHT }}>{state.payload.source.displayName}</p>
                {state.payload.source.ipaddr && (
                  <p className="text-xs" style={{ color: MUTED }}>{state.payload.source.ipaddr}</p>
                )}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-4 p-4 rounded-lg"
            style={{ background: `color-mix(in oklch, ${AMBER} 10%, transparent)`, border: `1px solid color-mix(in oklch, ${AMBER} 30%, transparent)` }}
            data-testid="blast-radius-quiet-banner"
          >
            <Shield className="h-6 w-6 shrink-0" style={{ color: AMBER }} />
            <div>
              <p className="text-sm font-medium" style={{ color: AMBER }}>No Blast Radius Detected</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                This device had no peer communication in the selected time window. It may be idle, isolated, or not yet discovered.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Populated State */}
      {state.status === 'populated' && state.payload && (
        <div className="space-y-4" data-testid="blast-radius-populated">
          {/* Source device card */}
          <div className="p-4 rounded-lg" style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}>
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5" style={{ color: state.payload.source.critical ? RED : GOLD }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium" style={{ color: BRIGHT }}>{state.payload.source.displayName}</p>
                  {state.payload.source.critical && (
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: `color-mix(in oklch, ${RED} 15%, transparent)`, color: RED }}>Critical</span>
                  )}
                  {state.payload.source.role && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'oklch(1 0 0 / 5%)', color: MUTED }}>{state.payload.source.role}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {state.payload.source.ipaddr && <span className="text-xs" style={{ color: MUTED }}>{state.payload.source.ipaddr}</span>}
                  {state.payload.source.macaddr && <span className="text-xs" style={{ color: MUTED }}>{state.payload.source.macaddr}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <SummaryCard label="Peers" value={formatNumber(state.payload.summary.peerCount)} color={CYAN} icon={Globe} />
            <SummaryCard label="Affected" value={formatNumber(state.payload.summary.affectedPeerCount)} color={state.payload.summary.affectedPeerCount > 0 ? RED : GREEN} icon={ShieldX} />
            <SummaryCard label="Detections" value={formatNumber(state.payload.summary.totalDetections)} color={state.payload.summary.totalDetections > 0 ? ORANGE : GREEN} icon={AlertTriangle} />
            <SummaryCard label="Protocols" value={state.payload.summary.uniqueProtocols.toString()} color={GOLD} icon={Activity} />
            <SummaryCard label="Traffic" value={formatBytes(state.payload.summary.totalBytes)} color={CYAN} icon={Server} />
            <SummaryCard label="Max Impact" value={state.payload.summary.maxImpactScore.toFixed(1)} color={state.payload.summary.maxImpactScore > 100 ? RED : AMBER} icon={ShieldAlert} />
          </div>

          {/* Severity distribution */}
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.entries(state.payload.summary.severityDistribution) as [BlastRadiusSeverity, number][]).map(([sev, count]) => (
              <SeverityBadge key={sev} severity={sev} count={count} />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setState(prev => ({ ...prev, filterAffectedOnly: !prev.filterAffectedOnly }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{
                  background: state.filterAffectedOnly ? `color-mix(in oklch, ${ORANGE} 15%, transparent)` : 'oklch(1 0 0 / 5%)',
                  color: state.filterAffectedOnly ? ORANGE : MUTED,
                  border: `1px solid ${state.filterAffectedOnly ? `color-mix(in oklch, ${ORANGE} 30%, transparent)` : GLASS_BORDER}`,
                }}
                data-testid="blast-radius-filter-affected"
              >
                <Filter className="h-3 w-3" />
                Affected Only
              </button>
            </div>

            <div className="flex items-center gap-1">
              {(['impactScore', 'totalBytes', 'detections', 'displayName'] as BlastRadiusSortField[]).map(field => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors"
                  style={{
                    background: state.sortField === field ? `color-mix(in oklch, ${GOLD} 15%, transparent)` : 'transparent',
                    color: state.sortField === field ? GOLD : MUTED,
                  }}
                >
                  {field === 'impactScore' ? 'Impact' : field === 'totalBytes' ? 'Traffic' : field === 'detections' ? 'Detections' : 'Name'}
                  {state.sortField === field && (
                    state.sortDirection === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Peer table header */}
          <div className="rounded-lg overflow-hidden" style={{ background: GLASS_BG, border: `1px solid ${GLASS_BORDER}` }}>
            <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: GLASS_BORDER }}>
              <span className="w-4" /> {/* expand icon spacer */}
              <span className="w-4" /> {/* device icon spacer */}
              <span className="flex-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Device</span>
              <span className="hidden md:block text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED, minWidth: '120px' }}>Protocols</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: MUTED, minWidth: '3rem' }}>Det.</span>
              <span className="hidden lg:block text-[10px] font-bold uppercase tracking-widest text-right" style={{ color: MUTED, minWidth: '5rem' }}>Traffic</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED, minWidth: '140px' }}>Impact</span>
            </div>

            {/* Peer rows */}
            {visiblePeers.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: MUTED }}>
                  {state.filterAffectedOnly ? 'No affected peers match the current filter' : 'No peers found'}
                </p>
              </div>
            ) : (
              visiblePeers.map(peer => (
                <PeerRow
                  key={peer.deviceId}
                  peer={peer}
                  maxScore={maxScore}
                  isExpanded={expandedPeerId === peer.deviceId}
                  onToggle={() => setExpandedPeerId(prev => prev === peer.deviceId ? null : peer.deviceId)}
                />
              ))
            )}

            {/* Footer */}
            <div className="px-4 py-2 text-xs" style={{ color: MUTED, borderTop: `1px solid ${GLASS_BORDER}` }}>
              {visiblePeers.length} of {state.payload.peers.length} peers
              {state.filterAffectedOnly && ` (filtered to affected only)`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
