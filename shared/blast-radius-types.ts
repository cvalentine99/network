/**
 * Slice 18 — Blast Radius Surface
 *
 * "Who is affected?" — Given a source device, show the blast radius:
 * all peer devices that communicated with it, the protocols used,
 * associated detections, and severity-weighted impact scores.
 *
 * This surface answers: if this device is compromised or misbehaving,
 * what is the scope of potential impact?
 */

import type { EpochMs } from './cockpit-types';

// ─── Entry ─────────────────────────────────────────────────────────────────

/** How the blast radius query was initiated */
export type BlastRadiusEntryMode = 'device-id' | 'hostname' | 'ip-address';

/** The query intent for a blast radius lookup */
export interface BlastRadiusIntent {
  mode: BlastRadiusEntryMode;
  value: string;
  timeWindow: {
    fromMs: number;
    untilMs: number;
    durationMs: number;
    cycle: '30sec' | '5min' | '1hr' | '24hr';
  };
}

// ─── Peer Device ───────────────────────────────────────────────────────────

/** A protocol used in communication between source and peer */
export interface BlastRadiusProtocol {
  name: string;
  port: number | null;
  bytesSent: number;
  bytesReceived: number;
  /** Whether this protocol had associated detections */
  hasDetections: boolean;
}

/** Severity level for impact scoring */
export type BlastRadiusSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** A detection associated with a peer connection */
export interface BlastRadiusDetection {
  id: number;
  title: string;
  type: string;
  riskScore: number;
  severity: BlastRadiusSeverity;
  startTime: EpochMs;
  participants: string[];
}

/** A single peer device in the blast radius */
export interface BlastRadiusPeer {
  /** Unique peer device ID */
  deviceId: number;
  /** Display name (hostname, IP, or default) */
  displayName: string;
  /** IPv4 address if available */
  ipaddr: string | null;
  /** Device role (e.g., "server", "client", "gateway") */
  role: string | null;
  /** Whether this peer is on the watchlist */
  critical: boolean;
  /** Protocols used in communication */
  protocols: BlastRadiusProtocol[];
  /** Detections involving this peer */
  detections: BlastRadiusDetection[];
  /** Total bytes exchanged (sent + received) */
  totalBytes: number;
  /** Impact score: weighted by severity of detections and traffic volume */
  impactScore: number;
  /** First seen in the time window */
  firstSeen: EpochMs;
  /** Last seen in the time window */
  lastSeen: EpochMs;
}

// ─── Source Device ─────────────────────────────────────────────────────────

/** The source device at the center of the blast radius */
export interface BlastRadiusSource {
  deviceId: number;
  displayName: string;
  ipaddr: string | null;
  macaddr: string | null;
  role: string | null;
  deviceClass: string | null;
  critical: boolean;
}

// ─── Response Payload ──────────────────────────────────────────────────────

/** Summary statistics for the blast radius */
export interface BlastRadiusSummary {
  /** Total number of peer devices */
  peerCount: number;
  /** Number of peers with detections */
  affectedPeerCount: number;
  /** Total detections across all peers */
  totalDetections: number;
  /** Number of unique protocols observed */
  uniqueProtocols: number;
  /** Total bytes exchanged across all peers */
  totalBytes: number;
  /** Maximum impact score among peers */
  maxImpactScore: number;
  /** Severity distribution: count per severity level */
  severityDistribution: Record<BlastRadiusSeverity, number>;
}

/** The full blast radius response payload */
export interface BlastRadiusPayload {
  source: BlastRadiusSource;
  peers: BlastRadiusPeer[];
  summary: BlastRadiusSummary;
  timeWindow: {
    fromMs: number;
    untilMs: number;
    durationMs: number;
    cycle: string;
  };
}

// ─── UI State ──────────────────────────────────────────────────────────────

export type BlastRadiusStatus = 'idle' | 'loading' | 'populated' | 'quiet' | 'error';

/** Sort options for the peer table */
export type BlastRadiusSortField = 'impactScore' | 'totalBytes' | 'displayName' | 'detections';

export interface BlastRadiusViewState {
  status: BlastRadiusStatus;
  intent: BlastRadiusIntent | null;
  payload: BlastRadiusPayload | null;
  errorMessage: string | null;
  sortField: BlastRadiusSortField;
  sortDirection: 'asc' | 'desc';
  /** Filter: show only peers with detections */
  filterAffectedOnly: boolean;
  /** Selected peer device ID for detail view */
  selectedPeerId: number | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Build the initial idle view state */
export function buildInitialBlastRadiusState(): BlastRadiusViewState {
  return {
    status: 'idle',
    intent: null,
    payload: null,
    errorMessage: null,
    sortField: 'impactScore',
    sortDirection: 'desc',
    filterAffectedOnly: false,
    selectedPeerId: null,
  };
}

/** Sort peers by the given field and direction */
export function sortBlastRadiusPeers(
  peers: BlastRadiusPeer[],
  field: BlastRadiusSortField,
  direction: 'asc' | 'desc'
): BlastRadiusPeer[] {
  const sorted = [...peers].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'impactScore':
        cmp = a.impactScore - b.impactScore;
        break;
      case 'totalBytes':
        cmp = a.totalBytes - b.totalBytes;
        break;
      case 'displayName':
        cmp = a.displayName.localeCompare(b.displayName);
        break;
      case 'detections':
        cmp = a.detections.length - b.detections.length;
        break;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

/** Filter peers to only those with detections */
export function filterAffectedPeers(peers: BlastRadiusPeer[]): BlastRadiusPeer[] {
  return peers.filter(p => p.detections.length > 0);
}

/** Get severity color for UI rendering */
export function getSeverityColor(severity: BlastRadiusSeverity): string {
  switch (severity) {
    case 'critical': return 'oklch(0.628 0.258 29.234)';   // RED
    case 'high':     return 'oklch(0.705 0.213 47.604)';   // ORANGE
    case 'medium':   return 'oklch(0.769 0.188 70.08)';    // AMBER
    case 'low':      return 'oklch(0.769 0.108 85.805)';   // GOLD
    case 'info':     return 'oklch(0.6 0.01 260)';         // MUTED
  }
}

/** Calculate impact score for a peer based on detections and traffic */
export function calculateImpactScore(peer: Pick<BlastRadiusPeer, 'detections' | 'totalBytes' | 'critical'>): number {
  const severityWeights: Record<BlastRadiusSeverity, number> = {
    critical: 100,
    high: 70,
    medium: 40,
    low: 15,
    info: 5,
  };

  let score = 0;
  for (const d of peer.detections) {
    score += severityWeights[d.severity] ?? 0;
    score += d.riskScore * 0.5;
  }

  // Traffic volume adds a small factor (log scale)
  if (peer.totalBytes > 0) {
    score += Math.min(20, Math.log10(peer.totalBytes));
  }

  // Critical devices get a 1.5x multiplier
  if (peer.critical) {
    score *= 1.5;
  }

  return Math.round(score * 100) / 100;
}
