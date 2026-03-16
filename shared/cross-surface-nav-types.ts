/**
 * Slice 23 — Cross-Surface Navigation Types
 *
 * CONTRACT:
 * - Defines all valid cross-surface navigation intents
 * - URL builders produce deterministic query strings from navigation intents
 * - URL parsers extract navigation intents from query strings
 * - Time window is NOT encoded in URLs — it is preserved via shared TimeWindowProvider
 * - No surface imports another surface's internal state
 * - All navigation is via URL query parameters (wouter-compatible)
 *
 * SUPPORTED CROSS-SURFACE JUMPS:
 * 1. Topology node        → Blast Radius (by device ID, hostname, or IP)
 * 2. Correlation event ref → Blast Radius (by device ref)
 * 3. Blast Radius peer    → Flow Theater (by hostname or device ID)
 * 4. Flow Theater device  → Blast Radius (by hostname or device ID)
 * 5. Any surface device   → Inspector (via InspectorContext, no URL needed)
 *
 * INVARIANTS:
 * - Time window is shared globally; cross-surface nav does NOT encode time in URL
 * - Navigation preserves the current time window by design (all surfaces read same context)
 * - URL parameters are the ONLY coupling between surfaces (no shared mutable state)
 * - Every builder has a matching parser; round-trip is deterministic
 *
 * Live integration: deferred by contract.
 */

import { z } from 'zod';

// ─── Navigation Intent Types ──────────────────────────────────────────────

/** The set of surfaces that can be navigated to */
export type NavigableSurface =
  | 'impact-deck'
  | 'flow-theater'
  | 'blast-radius'
  | 'correlation'
  | 'topology';

/** Blast Radius entry modes (matches BlastRadius page's inputMode) */
export type BlastRadiusEntryMode = 'device-id' | 'hostname' | 'ip-address';

/** Flow Theater entry modes (matches FlowTheater page's TraceEntryMode) */
export type FlowTheaterEntryMode = 'hostname' | 'device' | 'service-row' | 'ip';

/** Intent to navigate to Blast Radius with a pre-filled query */
export interface BlastRadiusNavIntent {
  surface: 'blast-radius';
  mode: BlastRadiusEntryMode;
  value: string;
  /** Optional: auto-submit the query on arrival */
  autoSubmit?: boolean;
}

/** Intent to navigate to Flow Theater with a pre-filled entry */
export interface FlowTheaterNavIntent {
  surface: 'flow-theater';
  mode: FlowTheaterEntryMode;
  value: string;
  autoSubmit?: boolean;
}

/** Union of all cross-surface navigation intents */
export type CrossSurfaceNavIntent =
  | BlastRadiusNavIntent
  | FlowTheaterNavIntent;

// ─── URL Query Parameter Constants ────────────────────────────────────────

export const NAV_PARAM = {
  /** Blast Radius query params */
  BR_MODE: 'brMode',
  BR_VALUE: 'brValue',
  BR_AUTO: 'brAuto',

  /** Flow Theater query params */
  FT_MODE: 'ftMode',
  FT_VALUE: 'ftValue',
  FT_AUTO: 'ftAuto',
} as const;

// ─── URL Builders ─────────────────────────────────────────────────────────

/**
 * Build a URL path + query string for navigating to Blast Radius.
 * Example: /blast-radius?brMode=device-id&brValue=1042&brAuto=1
 */
export function buildBlastRadiusUrl(intent: Omit<BlastRadiusNavIntent, 'surface'>): string {
  const params = new URLSearchParams();
  params.set(NAV_PARAM.BR_MODE, intent.mode);
  params.set(NAV_PARAM.BR_VALUE, intent.value);
  if (intent.autoSubmit) {
    params.set(NAV_PARAM.BR_AUTO, '1');
  }
  return `/blast-radius?${params.toString()}`;
}

/**
 * Build a URL path + query string for navigating to Flow Theater.
 * Example: /flow-theater?ftMode=hostname&ftValue=dc01.lab.local&ftAuto=1
 */
export function buildFlowTheaterUrl(intent: Omit<FlowTheaterNavIntent, 'surface'>): string {
  const params = new URLSearchParams();
  params.set(NAV_PARAM.FT_MODE, intent.mode);
  params.set(NAV_PARAM.FT_VALUE, intent.value);
  if (intent.autoSubmit) {
    params.set(NAV_PARAM.FT_AUTO, '1');
  }
  return `/flow-theater?${params.toString()}`;
}

// ─── URL Parsers ──────────────────────────────────────────────────────────

/** Parsed Blast Radius navigation params (or null if not present) */
export interface ParsedBlastRadiusNav {
  mode: BlastRadiusEntryMode;
  value: string;
  autoSubmit: boolean;
}

/** Parsed Flow Theater navigation params (or null if not present) */
export interface ParsedFlowTheaterNav {
  mode: FlowTheaterEntryMode;
  value: string;
  autoSubmit: boolean;
}

const BlastRadiusModeSchema = z.enum(['device-id', 'hostname', 'ip-address']);
const FlowTheaterModeSchema = z.enum(['hostname', 'device', 'service-row', 'ip']);

/**
 * Parse Blast Radius nav params from a URLSearchParams instance.
 * Returns null if the required params are missing or invalid.
 */
export function parseBlastRadiusNav(params: URLSearchParams): ParsedBlastRadiusNav | null {
  const rawMode = params.get(NAV_PARAM.BR_MODE);
  const rawValue = params.get(NAV_PARAM.BR_VALUE);
  if (!rawMode || !rawValue) return null;

  const modeResult = BlastRadiusModeSchema.safeParse(rawMode);
  if (!modeResult.success) return null;

  return {
    mode: modeResult.data,
    value: rawValue,
    autoSubmit: params.get(NAV_PARAM.BR_AUTO) === '1',
  };
}

/**
 * Parse Flow Theater nav params from a URLSearchParams instance.
 * Returns null if the required params are missing or invalid.
 */
export function parseFlowTheaterNav(params: URLSearchParams): ParsedFlowTheaterNav | null {
  const rawMode = params.get(NAV_PARAM.FT_MODE);
  const rawValue = params.get(NAV_PARAM.FT_VALUE);
  if (!rawMode || !rawValue) return null;

  const modeResult = FlowTheaterModeSchema.safeParse(rawMode);
  if (!modeResult.success) return null;

  return {
    mode: modeResult.data,
    value: rawValue,
    autoSubmit: params.get(NAV_PARAM.FT_AUTO) === '1',
  };
}

// ─── Navigation Link Metadata ─────────────────────────────────────────────

/** Describes a cross-surface link that can be rendered as a button/link */
export interface CrossSurfaceLink {
  /** Human-readable label for the link */
  label: string;
  /** Target URL (built by the URL builders above) */
  href: string;
  /** Target surface name */
  targetSurface: NavigableSurface;
  /** Source surface name */
  sourceSurface: NavigableSurface;
  /** The entity context (what triggered this link) */
  entityContext: string;
}

/**
 * Build a "View Blast Radius" link from a topology node.
 */
export function buildTopologyToBlastRadiusLink(
  deviceId: number,
  displayName: string,
  ipaddr?: string,
): CrossSurfaceLink {
  // Prefer device ID as the most reliable identifier
  return {
    label: `Blast Radius: ${displayName}`,
    href: buildBlastRadiusUrl({ mode: 'device-id', value: String(deviceId), autoSubmit: true }),
    targetSurface: 'blast-radius',
    sourceSurface: 'topology',
    entityContext: `topology-node-${deviceId}`,
  };
}

/**
 * Build a "View Blast Radius" link from a correlation event ref.
 */
export function buildCorrelationToBlastRadiusLink(
  refKind: string,
  refLabel: string,
): CrossSurfaceLink | null {
  // Only device refs can navigate to Blast Radius
  if (refKind !== 'device' && refKind !== 'ip' && refKind !== 'hostname') return null;

  const mode: BlastRadiusEntryMode =
    refKind === 'ip' ? 'ip-address' :
    refKind === 'hostname' ? 'hostname' :
    'device-id';

  return {
    label: `Blast Radius: ${refLabel}`,
    href: buildBlastRadiusUrl({ mode, value: refLabel, autoSubmit: true }),
    targetSurface: 'blast-radius',
    sourceSurface: 'correlation',
    entityContext: `correlation-ref-${refKind}-${refLabel}`,
  };
}

/**
 * Build a "Trace in Flow Theater" link from a Blast Radius peer.
 */
export function buildBlastRadiusToFlowTheaterLink(
  displayName: string,
  deviceId: number,
): CrossSurfaceLink {
  return {
    label: `Trace: ${displayName}`,
    href: buildFlowTheaterUrl({ mode: 'hostname', value: displayName, autoSubmit: true }),
    targetSurface: 'flow-theater',
    sourceSurface: 'blast-radius',
    entityContext: `blast-radius-peer-${deviceId}`,
  };
}

/**
 * Build a "View Blast Radius" link from a Flow Theater resolved device.
 */
export function buildFlowTheaterToBlastRadiusLink(
  displayName: string,
  deviceId?: number,
): CrossSurfaceLink {
  const mode: BlastRadiusEntryMode = deviceId != null ? 'device-id' : 'hostname';
  const value = deviceId != null ? String(deviceId) : displayName;

  return {
    label: `Blast Radius: ${displayName}`,
    href: buildBlastRadiusUrl({ mode, value, autoSubmit: true }),
    targetSurface: 'blast-radius',
    sourceSurface: 'flow-theater',
    entityContext: `flow-theater-device-${displayName}`,
  };
}

// ─── Supported Navigation Matrix ──────────────────────────────────────────

/** Documents all supported cross-surface navigation paths */
export const CROSS_SURFACE_NAV_MATRIX: ReadonlyArray<{
  from: NavigableSurface;
  to: NavigableSurface;
  trigger: string;
  mechanism: string;
}> = [
  {
    from: 'topology',
    to: 'blast-radius',
    trigger: 'Node detail panel → "View Blast Radius" button',
    mechanism: 'URL navigation with device-id query param',
  },
  {
    from: 'correlation',
    to: 'blast-radius',
    trigger: 'Event detail → device/ip/hostname ref click',
    mechanism: 'URL navigation with appropriate mode query param',
  },
  {
    from: 'blast-radius',
    to: 'flow-theater',
    trigger: 'Peer row expanded → "Trace in Flow Theater" button',
    mechanism: 'URL navigation with hostname query param',
  },
  {
    from: 'flow-theater',
    to: 'blast-radius',
    trigger: 'Completed trace → "View Blast Radius" link',
    mechanism: 'URL navigation with device-id or hostname query param',
  },
  {
    from: 'topology',
    to: 'impact-deck',
    trigger: 'Node detail panel → "Open in Inspector" button',
    mechanism: 'Navigate to / and open InspectorContext with device selection',
  },
] as const;

// ─── Validation Schemas ───────────────────────────────────────────────────

export const BlastRadiusNavIntentSchema = z.object({
  surface: z.literal('blast-radius'),
  mode: BlastRadiusModeSchema,
  value: z.string().min(1),
  autoSubmit: z.boolean().optional(),
});

export const FlowTheaterNavIntentSchema = z.object({
  surface: z.literal('flow-theater'),
  mode: FlowTheaterModeSchema,
  value: z.string().min(1),
  autoSubmit: z.boolean().optional(),
});

export const CrossSurfaceNavIntentSchema = z.discriminatedUnion('surface', [
  BlastRadiusNavIntentSchema,
  FlowTheaterNavIntentSchema,
]);

export const CrossSurfaceLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().startsWith('/'),
  targetSurface: z.enum(['impact-deck', 'flow-theater', 'blast-radius', 'correlation', 'topology']),
  sourceSurface: z.enum(['impact-deck', 'flow-theater', 'blast-radius', 'correlation', 'topology']),
  entityContext: z.string().min(1),
});
