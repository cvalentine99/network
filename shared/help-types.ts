/**
 * Slice 24 — Help Page Contracts
 *
 * Shared types, constants, and validators for the Help surface.
 * Glossary, keyboard shortcuts, surface descriptions, and integration status.
 */

import { z } from 'zod';

// ─── Glossary ────────────────────────────────────────────────────────────

export interface GlossaryEntry {
  term: string;
  definition: string;
  surface?: string;   // which surface primarily uses this term
  seeAlso?: string[]; // related terms
}

export const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
  surface: z.string().optional(),
  seeAlso: z.array(z.string()).optional(),
});

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Alert',
    definition: 'A threshold-based notification triggered when a metric exceeds a configured boundary. Distinct from detections, which are pattern-based.',
    surface: 'Impact Deck',
    seeAlso: ['Detection'],
  },
  {
    term: 'Baseline Delta',
    definition: 'The percentage difference between the current metric value and the historical baseline for the same time-of-day and day-of-week. A positive delta means traffic is above normal; negative means below.',
    surface: 'Impact Deck',
    seeAlso: ['Time Window', 'Metric Cycle'],
  },
  {
    term: 'BFF (Backend for Frontend)',
    definition: 'A server-side layer that normalizes, validates, and reshapes data from the ExtraHop REST API before it reaches the browser. The browser never contacts ExtraHop directly.',
    seeAlso: ['Fixture Mode'],
  },
  {
    term: 'Blast Radius',
    definition: 'The set of peer devices that communicated with a given source device during the selected time window, along with protocols used, detections triggered, and a severity-weighted impact score.',
    surface: 'Blast Radius',
    seeAlso: ['Impact Score', 'Peer'],
  },
  {
    term: 'Causal Strip',
    definition: 'The horizontal timeline band on the Impact Deck that shows correlation event markers aligned to the same time axis as the throughput chart, enabling visual cause-effect analysis.',
    surface: 'Impact Deck',
    seeAlso: ['Correlation Event'],
  },
  {
    term: 'Correlation Event',
    definition: 'A time-stamped occurrence (detection, alert, config change, firmware update, topology shift, threshold breach, or external event) that may be causally related to other events in the same time window.',
    surface: 'Correlation',
    seeAlso: ['Causal Strip'],
  },
  {
    term: 'Detection',
    definition: 'An ExtraHop-generated security or performance finding for a specific device, with a severity level (low/medium/high/critical) and a numeric risk score.',
    surface: 'Impact Deck',
    seeAlso: ['Alert', 'Risk Score'],
  },
  {
    term: 'Device Identity',
    definition: 'The canonical representation of a network device: numeric ID, display name, ExtraHop ID, IP address, MAC address, role, vendor, and VLAN.',
    seeAlso: ['Top Talker'],
  },
  {
    term: 'Fixture Mode',
    definition: 'The current operating mode where all BFF routes return deterministic fixture data instead of querying a live ExtraHop appliance. All dashboard behavior is validated against these fixtures.',
    seeAlso: ['BFF (Backend for Frontend)', 'Live Integration'],
  },
  {
    term: 'Flow Theater',
    definition: 'An 8-step trace that queries all ExtraHop data sources for a single device, showing where time is being spent. Steps 1-3 run serially (input acceptance, device resolution, activity map), steps 4-8 run in parallel (metrics, records, detections, alerts, packets).',
    surface: 'Flow Theater',
    seeAlso: ['Trace Step'],
  },
  {
    term: 'Impact Score',
    definition: 'A severity-weighted numeric score assigned to each peer in a Blast Radius analysis. Calculated from detection severity, detection count, traffic volume, and critical-device status.',
    surface: 'Blast Radius',
    seeAlso: ['Blast Radius', 'Risk Score'],
  },
  {
    term: 'Inspector',
    definition: 'The slide-over detail panel on the Impact Deck that shows device, detection, or alert details. Supports back-stack navigation and cross-entity links.',
    surface: 'Impact Deck',
    seeAlso: ['Device Identity', 'Detection', 'Alert'],
  },
  {
    term: 'KPI Strip',
    definition: 'The row of five key performance indicator cards at the top of the Impact Deck: Total Bytes, Total Packets, Throughput, Packet Rate, and Baseline Delta.',
    surface: 'Impact Deck',
    seeAlso: ['Baseline Delta'],
  },
  {
    term: 'Live Integration',
    definition: 'The future phase where BFF routes will proxy requests to a real ExtraHop appliance instead of returning fixture data. Not part of the current frontend contract phase.',
    seeAlso: ['Fixture Mode', 'BFF (Backend for Frontend)'],
  },
  {
    term: 'Living Topology',
    definition: 'A force-directed graph visualization showing all discovered devices grouped by subnet/role clusters, with edges representing observed communication and visual indicators for detections and alerts.',
    surface: 'Topology',
    seeAlso: ['Device Identity'],
  },
  {
    term: 'Metric Cycle',
    definition: 'The aggregation interval for time-series data: 1sec, 30sec, 5min, 1hr, or 24hr. Determines the granularity of chart data points.',
    seeAlso: ['Time Window', 'Series Point'],
  },
  {
    term: 'PCAP Download',
    definition: 'The ability to request a packet capture file (.pcap) from the ExtraHop packet store for a specific device and time window. The download is binary and must not be converted to JSON.',
    surface: 'Impact Deck',
    seeAlso: ['Device Identity', 'Time Window'],
  },
  {
    term: 'Peer',
    definition: 'A device that communicated with the source device during the selected time window. Each peer has associated protocols, traffic volumes, detections, and an impact score.',
    surface: 'Blast Radius',
    seeAlso: ['Blast Radius', 'Impact Score'],
  },
  {
    term: 'Risk Score',
    definition: 'A numeric value (0-99) assigned to a detection indicating its assessed severity. Higher scores indicate more critical findings.',
    seeAlso: ['Detection', 'Impact Score'],
  },
  {
    term: 'Series Point',
    definition: 'A single data point in a time-series: epoch timestamp, ISO string, duration, and a map of metric name to value (or null if no data).',
    seeAlso: ['Metric Cycle', 'Time Window'],
  },
  {
    term: 'Time Window',
    definition: 'The shared time range applied to all dashboard surfaces simultaneously. Defined by fromMs, untilMs, durationMs, and cycle. All surfaces must read from the same TimeWindowContext to prevent drift.',
    seeAlso: ['Metric Cycle'],
  },
  {
    term: 'Top Talker',
    definition: 'A device ranked by traffic volume (bytes sent + received) during the selected time window. Shown in the Top Talkers table on the Impact Deck.',
    surface: 'Impact Deck',
    seeAlso: ['Device Identity'],
  },
  {
    term: 'Trace Step',
    definition: 'One of the 8 sequential/parallel phases in a Flow Theater trace: input-accepted, device-resolved, activity-map, metrics-fetched, records-fetched, detections-fetched, alerts-fetched, packets-checked.',
    surface: 'Flow Theater',
    seeAlso: ['Flow Theater'],
  },
];

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────

export interface KeyboardShortcut {
  keys: string[];       // e.g. ['Ctrl', 'K'] or ['Esc']
  action: string;
  scope: string;        // 'Global' | surface name
}

export const KeyboardShortcutSchema = z.object({
  keys: z.array(z.string().min(1)).min(1),
  action: z.string().min(1),
  scope: z.string().min(1),
});

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { keys: ['Esc'], action: 'Close inspector panel or dismiss modal', scope: 'Global' },
  { keys: ['?'], action: 'Open Help page', scope: 'Global' },
  { keys: ['1'], action: 'Navigate to Impact Deck', scope: 'Global' },
  { keys: ['2'], action: 'Navigate to Flow Theater', scope: 'Global' },
  { keys: ['3'], action: 'Navigate to Blast Radius', scope: 'Global' },
  { keys: ['4'], action: 'Navigate to Correlation', scope: 'Global' },
  { keys: ['5'], action: 'Navigate to Topology', scope: 'Global' },
  { keys: ['Backspace'], action: 'Navigate back in inspector history', scope: 'Inspector' },
  { keys: ['Enter'], action: 'Submit query / start trace', scope: 'Blast Radius / Flow Theater' },
];

// ─── Surface Descriptions ────────────────────────────────────────────────

export interface SurfaceDescription {
  name: string;
  path: string;
  question: string;     // the question this surface answers
  description: string;
  integrationStatus: 'fixture-proven' | 'live-integrated' | 'sandbox-validated' | 'deferred' | 'placeholder';
}

export const SurfaceDescriptionSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  question: z.string().min(1),
  description: z.string().min(1),
  integrationStatus: z.enum(['fixture-proven', 'live-integrated', 'sandbox-validated', 'deferred', 'placeholder']),
});

export const SURFACE_DESCRIPTIONS: SurfaceDescription[] = [
  {
    name: 'Impact Deck',
    path: '/',
    question: 'What is happening on the network right now?',
    description: 'The primary monitoring cockpit showing KPI strip (bytes, packets, throughput, packet rate, baseline delta), network throughput chart with correlation event markers, top talkers table, detections panel, alerts panel, and an inspector for device/detection/alert details.',
    integrationStatus: 'fixture-proven',
  },
  {
    name: 'Flow Theater',
    path: '/flow-theater',
    question: 'Where is the time going for a specific device?',
    description: 'An 8-step trace that queries all ExtraHop data sources for a single device. Enter a hostname, device ID, IP address, or service row key, and watch the trace progress through input acceptance, device resolution, activity map, metrics, records, detections, alerts, and packet checks.',
    integrationStatus: 'fixture-proven',
  },
  {
    name: 'Blast Radius',
    path: '/blast-radius',
    question: 'Who is affected by a specific device?',
    description: 'Given a source device, shows all peer devices that communicated with it, the protocols used, associated detections, and severity-weighted impact scores. Peers can be expanded for protocol and detection detail, and linked to Flow Theater for deeper analysis.',
    integrationStatus: 'fixture-proven',
  },
  {
    name: 'Correlation',
    path: '/correlation',
    question: 'What changed at roughly the same moment?',
    description: 'A time-ordered feed of correlation events (detections, alerts, config changes, firmware updates, topology shifts, threshold breaches, external events) with category filtering, severity indicators, and expandable detail cards with device refs linking to Blast Radius.',
    integrationStatus: 'fixture-proven',
  },
  {
    name: 'Topology',
    path: '/topology',
    question: 'What does the network look like?',
    description: 'A force-directed constellation view of all discovered devices grouped by subnet/role clusters. Nodes are sized by traffic volume, colored by cluster, and ringed for detections/alerts. Supports search, zoom, fullscreen, and click-to-inspect with links to Blast Radius.',
    integrationStatus: 'fixture-proven',
  },
  {
    name: 'Settings',
    path: '/settings',
    question: 'How is the appliance connection configured?',
    description: 'Configuration form for the ExtraHop appliance connection: hostname, API key, TLS verification toggle. Validates inputs, persists to database, and reports connection status in the appliance footer indicator.',
    integrationStatus: 'fixture-proven',
  },
  {
    name: 'Help',
    path: '/help',
    question: 'How do I use this dashboard?',
    description: 'Glossary of product terms, keyboard shortcuts, surface descriptions with the question each answers, and an explanation of fixture mode vs. live integration.',
    integrationStatus: 'fixture-proven',
  },
];

// ─── Integration Status Labels ───────────────────────────────────────────

export const INTEGRATION_STATUS_LABELS: Record<SurfaceDescription['integrationStatus'], string> = {
  'fixture-proven': 'Validated against deterministic fixtures',
  'live-integrated': 'Connected to live ExtraHop appliance',
  'sandbox-validated': 'Performance-validated in sandbox environment',
  'deferred': 'Implementation deferred to future phase',
  'placeholder': 'Placeholder — not yet implemented',
};

export const INTEGRATION_STATUS_COLORS: Record<SurfaceDescription['integrationStatus'], string> = {
  'fixture-proven': 'oklch(0.723 0.219 149.579)',    // green
  'live-integrated': 'oklch(0.75 0.15 195)',          // cyan
  'sandbox-validated': 'oklch(0.769 0.108 85.805)',   // gold
  'deferred': 'oklch(0.6 0.01 260)',                  // muted
  'placeholder': 'oklch(0.628 0.258 29.234)',         // red
};
