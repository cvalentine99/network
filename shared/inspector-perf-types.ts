/**
 * Slice 22b — Inspector Performance Deep-Dive
 *
 * Shared types, constants, and validators for:
 *   1. Inspector render path tracing
 *   2. Detail pane mount/unmount lifecycle
 *   3. Tab switch rerender counting
 *   4. Large payload memoization guards
 *
 * These contracts define the expected behavior of the inspector subsystem
 * from a performance perspective. All budgets and limits are validated
 * against deterministic fixtures, not live hardware.
 */

import { z } from "zod";

// ─── Inspector Component Identifiers ──────────────────────────

export const INSPECTOR_COMPONENT_IDS = [
  "inspector-shell",
  "inspector-breadcrumb",
  "inspector-content",
  "device-detail-pane",
  "detection-detail-pane",
  "alert-detail-pane",
] as const;

export type InspectorComponentId = (typeof INSPECTOR_COMPONENT_IDS)[number];

// ─── Detail Pane Kind ─────────────────────────────────────────

export const DETAIL_PANE_KINDS = ["device", "detection", "alert"] as const;
export type DetailPaneKind = (typeof DETAIL_PANE_KINDS)[number];

// ─── 1. Render Path Contract ──────────────────────────────────

/**
 * The expected render path from user action to terminal state.
 * Each step is a component that participates in the render cascade.
 *
 * The render path is deterministic for each entity kind:
 *   selection change → InspectorProvider state update
 *     → InspectorShell (conditional render)
 *       → InspectorBreadcrumb (history-dependent)
 *       → InspectorContent (switch on kind)
 *         → XxxDetailPane (fetch + state machine)
 *           → LoadingState → PopulatedState | QuietState | ErrorState | ...
 */
export interface RenderPathStep {
  /** Component name */
  component: string;
  /** Whether this component is expected to render for the given kind */
  renders: boolean;
  /** The data-testid this component exposes (if any) */
  testId: string | null;
  /** Whether this component triggers a data fetch */
  fetchesBff: boolean;
  /** Whether this component reads from InspectorContext */
  readsContext: boolean;
}

export interface InspectorRenderPath {
  /** Which entity kind this path describes */
  kind: DetailPaneKind;
  /** Ordered list of components in the render cascade */
  steps: RenderPathStep[];
  /** The terminal data-testid that signals render completion */
  terminalTestIds: string[];
  /** Total expected component count in the path */
  totalComponents: number;
}

/**
 * Canonical render paths for each entity kind.
 * These are the expected component trees when the inspector opens.
 */
export const INSPECTOR_RENDER_PATHS: Record<DetailPaneKind, InspectorRenderPath> = {
  device: {
    kind: "device",
    steps: [
      { component: "InspectorShell", renders: true, testId: "inspector-shell", fetchesBff: false, readsContext: false },
      { component: "InspectorBreadcrumb", renders: true, testId: "inspector-breadcrumb", fetchesBff: false, readsContext: true },
      { component: "InspectorContent", renders: true, testId: null, fetchesBff: false, readsContext: false },
      { component: "DeviceDetailPane", renders: true, testId: null, fetchesBff: true, readsContext: false },
      { component: "DeviceDetailPane.LoadingState", renders: true, testId: "device-detail-loading", fetchesBff: false, readsContext: false },
      { component: "DeviceDetailPane.PopulatedState", renders: true, testId: "device-detail-populated", fetchesBff: false, readsContext: true },
    ],
    terminalTestIds: [
      "device-detail-loading",
      "device-detail-populated",
      "device-detail-quiet",
      "device-detail-error",
      "device-detail-not-found",
      "device-detail-malformed",
    ],
    totalComponents: 6,
  },
  detection: {
    kind: "detection",
    steps: [
      { component: "InspectorShell", renders: true, testId: "inspector-shell", fetchesBff: false, readsContext: false },
      { component: "InspectorBreadcrumb", renders: true, testId: "inspector-breadcrumb", fetchesBff: false, readsContext: true },
      { component: "InspectorContent", renders: true, testId: null, fetchesBff: false, readsContext: false },
      { component: "DetectionDetailPane", renders: true, testId: null, fetchesBff: true, readsContext: false },
      { component: "DetectionDetailPane.LoadingState", renders: true, testId: "detection-detail-loading", fetchesBff: false, readsContext: false },
      { component: "DetectionDetailPane.PopulatedState", renders: true, testId: "detection-detail-populated", fetchesBff: false, readsContext: true },
    ],
    terminalTestIds: [
      "detection-detail-loading",
      "detection-detail-populated",
      "detection-detail-quiet",
      "detection-detail-error",
      "detection-detail-not-found",
      "detection-detail-malformed",
    ],
    totalComponents: 6,
  },
  alert: {
    kind: "alert",
    steps: [
      { component: "InspectorShell", renders: true, testId: "inspector-shell", fetchesBff: false, readsContext: false },
      { component: "InspectorBreadcrumb", renders: true, testId: "inspector-breadcrumb", fetchesBff: false, readsContext: true },
      { component: "InspectorContent", renders: true, testId: null, fetchesBff: false, readsContext: false },
      { component: "AlertDetailPane", renders: true, testId: null, fetchesBff: true, readsContext: false },
      { component: "AlertDetailPane.LoadingState", renders: true, testId: "alert-detail-loading", fetchesBff: false, readsContext: false },
      { component: "AlertDetailPane.PopulatedState", renders: true, testId: "alert-detail-populated", fetchesBff: false, readsContext: true },
    ],
    terminalTestIds: [
      "alert-detail-loading",
      "alert-detail-populated",
      "alert-detail-quiet",
      "alert-detail-error",
      "alert-detail-not-found",
      "alert-detail-malformed",
    ],
    totalComponents: 6,
  },
};

// ─── 2. Mount/Unmount Lifecycle Contract ──────────────────────

/**
 * Expected mount/unmount behavior for detail panes.
 *
 * When the user changes selection:
 *   - Same kind, different ID → pane stays mounted, hook refetches
 *     (CURRENT BEHAVIOR: pane UNMOUNTS and REMOUNTS because InspectorContent
 *      does not key by kind — it switches on kind, so same-kind changes
 *      cause React to reuse the component instance. However, the hook's
 *      useCallback dependency on the ID causes a refetch.)
 *   - Different kind → old pane unmounts, new pane mounts
 *   - Clear selection → all panes unmount
 *
 * IMPORTANT: The current implementation does NOT use React.memo or keys
 * on the detail panes. This means:
 *   - Same-kind selection changes: React reuses the component instance
 *     (no unmount/remount), but the hook refetches due to ID change.
 *   - Different-kind selection changes: React unmounts the old pane
 *     and mounts the new one (full teardown + setup).
 */
export interface MountLifecycleScenario {
  /** Human-readable scenario name */
  name: string;
  /** Starting selection kind (null = no selection) */
  fromKind: DetailPaneKind | null;
  /** Starting entity ID (null = no selection) */
  fromId: number | null;
  /** Ending selection kind */
  toKind: DetailPaneKind;
  /** Ending entity ID */
  toId: number;
  /** Whether the old pane unmounts */
  expectUnmount: boolean;
  /** Whether the new pane mounts fresh */
  expectMount: boolean;
  /** Whether a BFF fetch is triggered */
  expectFetch: boolean;
  /** Explanation of the expected behavior */
  rationale: string;
}

export const MOUNT_LIFECYCLE_SCENARIOS: MountLifecycleScenario[] = [
  {
    name: "initial-device-selection",
    fromKind: null,
    fromId: null,
    toKind: "device",
    toId: 1042,
    expectUnmount: false,
    expectMount: true,
    expectFetch: true,
    rationale: "No previous pane exists. DeviceDetailPane mounts fresh and fetches.",
  },
  {
    name: "same-kind-different-id-device",
    fromKind: "device",
    fromId: 1042,
    toKind: "device",
    toId: 2001,
    expectUnmount: false,
    expectMount: false,
    expectFetch: true,
    rationale: "Same kind (device→device). React reuses component instance. Hook refetches due to ID change.",
  },
  {
    name: "same-kind-same-id-device",
    fromKind: "device",
    fromId: 1042,
    toKind: "device",
    toId: 1042,
    expectUnmount: false,
    expectMount: false,
    expectFetch: false,
    rationale: "Same kind, same ID. No state change. Hook useCallback dep unchanged, no refetch.",
  },
  {
    name: "cross-kind-device-to-detection",
    fromKind: "device",
    fromId: 1042,
    toKind: "detection",
    toId: 4001,
    expectUnmount: true,
    expectMount: true,
    expectFetch: true,
    rationale: "Different kind. React unmounts DeviceDetailPane, mounts DetectionDetailPane.",
  },
  {
    name: "cross-kind-detection-to-alert",
    fromKind: "detection",
    fromId: 4001,
    toKind: "alert",
    toId: 7001,
    expectUnmount: true,
    expectMount: true,
    expectFetch: true,
    rationale: "Different kind. React unmounts DetectionDetailPane, mounts AlertDetailPane.",
  },
  {
    name: "cross-kind-alert-to-device",
    fromKind: "alert",
    fromId: 7001,
    toKind: "device",
    toId: 1042,
    expectUnmount: true,
    expectMount: true,
    expectFetch: true,
    rationale: "Different kind. React unmounts AlertDetailPane, mounts DeviceDetailPane.",
  },
  {
    name: "clear-to-device",
    fromKind: null,
    fromId: null,
    toKind: "device",
    toId: 1042,
    expectUnmount: false,
    expectMount: true,
    expectFetch: true,
    rationale: "From cleared state. DeviceDetailPane mounts fresh.",
  },
];

// ─── 3. Tab Switch Rerender Budget ────────────────────────────

/**
 * Maximum allowed rerenders during a tab/selection switch.
 *
 * When the user clicks a different entity in a table:
 *   1. InspectorProvider updates selection state (1 render)
 *   2. InspectorShell rerenders (conditional on isOpen) (1 render)
 *   3. InspectorBreadcrumb rerenders (reads context) (1 render)
 *   4. InspectorContent rerenders (switch on kind) (1 render)
 *   5. DetailPane rerenders or mounts (1 render for mount, or 1 for rerender)
 *   6. DetailPane internal state change (loading → populated) (1 render)
 *
 * Total expected: 6 renders max for the inspector subtree per selection change.
 * We allow a budget of 8 to account for React StrictMode double-renders in dev.
 */
export const TAB_SWITCH_RERENDER_BUDGET = 8;

/**
 * Components that should NOT rerender when the inspector selection changes
 * (they are outside the inspector subtree).
 */
export const COMPONENTS_IMMUNE_TO_INSPECTOR_CHANGE = [
  "KPIStrip",
  "GhostedTimeline",
  "TopTalkersTable",
  "DetectionsTable",
  "AlertsPanel",
  "ApplianceFooter",
  "TimeWindowSelector",
] as const;

/**
 * Components that MUST rerender when the inspector selection changes.
 */
export const COMPONENTS_AFFECTED_BY_INSPECTOR_CHANGE = [
  "InspectorShell",
  "InspectorBreadcrumb",
  "InspectorContent",
] as const;

export interface RerenderScenario {
  /** Scenario name */
  name: string;
  /** Description of the user action */
  action: string;
  /** Maximum allowed rerenders for the inspector subtree */
  maxRerenders: number;
  /** Whether the ImpactDeck parent should rerender */
  parentRerenders: boolean;
  /** Rationale */
  rationale: string;
}

export const RERENDER_SCENARIOS: RerenderScenario[] = [
  {
    name: "same-kind-switch",
    action: "Click a different device in Top Talkers while inspector is open",
    maxRerenders: TAB_SWITCH_RERENDER_BUDGET,
    parentRerenders: true,
    rationale: "InspectorProvider is in ImpactDeckContent, so selection change causes parent rerender. Inspector subtree rerenders. Detail pane hook refetches.",
  },
  {
    name: "cross-kind-switch",
    action: "Click a detection while viewing a device in inspector",
    maxRerenders: TAB_SWITCH_RERENDER_BUDGET,
    parentRerenders: true,
    rationale: "Kind change causes unmount/mount cycle. One extra render for the mount.",
  },
  {
    name: "close-inspector",
    action: "Click X to close the inspector",
    maxRerenders: 4,
    parentRerenders: true,
    rationale: "clear() sets selection=null, isOpen=false, history=[]. Shell returns null. Minimal render.",
  },
  {
    name: "open-from-closed",
    action: "Click a table row when inspector is closed",
    maxRerenders: TAB_SWITCH_RERENDER_BUDGET,
    parentRerenders: true,
    rationale: "Selection set + isOpen=true. Full inspector subtree mounts.",
  },
  {
    name: "breadcrumb-navigation",
    action: "Click a breadcrumb entry to navigate back in history",
    maxRerenders: TAB_SWITCH_RERENDER_BUDGET,
    parentRerenders: true,
    rationale: "goToIndex updates history + selection. Inspector subtree rerenders. May cause kind change.",
  },
];

// ─── 4. Large Payload Memoization Contract ────────────────────

/**
 * Payload size thresholds for memoization guards.
 *
 * When a detail pane receives a payload above these thresholds,
 * memoization should prevent unnecessary re-computation of
 * derived data (protocol charts, sorted lists, etc.).
 *
 * These thresholds are based on realistic ExtraHop payloads:
 *   - A device with 50+ protocols and 100+ associated detections
 *   - A detection with 20+ related devices and 50+ timeline events
 *   - An alert with 30+ trigger history entries
 */
export const MEMOIZATION_THRESHOLDS = {
  /** Number of protocols that triggers memoization concern */
  protocolCount: 20,
  /** Number of associated detections that triggers memoization concern */
  associatedDetectionCount: 50,
  /** Number of associated alerts that triggers memoization concern */
  associatedAlertCount: 30,
  /** Number of trigger history entries that triggers memoization concern */
  triggerHistoryCount: 30,
  /** Number of related devices that triggers memoization concern */
  relatedDeviceCount: 20,
  /** Number of timeline events that triggers memoization concern */
  timelineEventCount: 50,
  /** Number of notes that triggers memoization concern */
  noteCount: 20,
} as const;

/**
 * Memoization audit result for a single component.
 */
export interface MemoizationAuditEntry {
  /** Component or hook name */
  component: string;
  /** What data is being memoized (or should be) */
  dataDescription: string;
  /** Whether useMemo/useCallback is applied */
  isMemoized: boolean;
  /** Whether React.memo wraps the component */
  isReactMemo: boolean;
  /** Size of the payload in the fixture (item count) */
  fixturePayloadSize: number;
  /** Whether this is a memoization concern (above threshold) */
  isConcern: boolean;
  /** Recommendation */
  recommendation: string;
}

export interface MemoizationAuditReport {
  /** All audit entries */
  entries: MemoizationAuditEntry[];
  /** Total components audited */
  totalAudited: number;
  /** Components with memoization concerns */
  concernCount: number;
  /** Components already properly memoized */
  memoizedCount: number;
  /** Components that need memoization */
  needsMemoizationCount: number;
  /** Generated at */
  generatedAt: string;
}

// ─── Zod Schemas ──────────────────────────────────────────────

export const DetailPaneKindSchema = z.enum(DETAIL_PANE_KINDS);

export const RenderPathStepSchema = z.object({
  component: z.string().min(1),
  renders: z.boolean(),
  testId: z.string().nullable(),
  fetchesBff: z.boolean(),
  readsContext: z.boolean(),
});

export const InspectorRenderPathSchema = z.object({
  kind: DetailPaneKindSchema,
  steps: z.array(RenderPathStepSchema).min(1),
  terminalTestIds: z.array(z.string().min(1)).min(1),
  totalComponents: z.number().int().positive(),
});

export const MountLifecycleScenarioSchema = z.object({
  name: z.string().min(1),
  fromKind: DetailPaneKindSchema.nullable(),
  fromId: z.number().int().nullable(),
  toKind: DetailPaneKindSchema,
  toId: z.number().int().positive(),
  expectUnmount: z.boolean(),
  expectMount: z.boolean(),
  expectFetch: z.boolean(),
  rationale: z.string().min(1),
});

export const RerenderScenarioSchema = z.object({
  name: z.string().min(1),
  action: z.string().min(1),
  maxRerenders: z.number().int().positive(),
  parentRerenders: z.boolean(),
  rationale: z.string().min(1),
});

export const MemoizationAuditEntrySchema = z.object({
  component: z.string().min(1),
  dataDescription: z.string().min(1),
  isMemoized: z.boolean(),
  isReactMemo: z.boolean(),
  fixturePayloadSize: z.number().int().nonnegative(),
  isConcern: z.boolean(),
  recommendation: z.string().min(1),
});

export const MemoizationAuditReportSchema = z.object({
  entries: z.array(MemoizationAuditEntrySchema).min(1),
  totalAudited: z.number().int().positive(),
  concernCount: z.number().int().nonnegative(),
  memoizedCount: z.number().int().nonnegative(),
  needsMemoizationCount: z.number().int().nonnegative(),
  generatedAt: z.string().min(1),
});

// ─── Validators ───────────────────────────────────────────────

/**
 * Validate that a render path has consistent step count.
 */
export function validateRenderPathConsistency(path: InspectorRenderPath): boolean {
  return path.steps.length === path.totalComponents;
}

/**
 * Validate that every render path has at least one BFF-fetching step.
 */
export function validateRenderPathHasFetch(path: InspectorRenderPath): boolean {
  return path.steps.some((s) => s.fetchesBff);
}

/**
 * Validate that terminal testIds in the path match the detail pane's known states.
 */
export function validateTerminalTestIdCoverage(path: InspectorRenderPath): boolean {
  // Every kind should have exactly 6 terminal states: loading, populated, quiet, error, not-found, malformed
  return path.terminalTestIds.length === 6;
}

/**
 * Validate that a mount lifecycle scenario is internally consistent.
 * - If fromKind is null, expectUnmount must be false
 * - If toKind differs from fromKind, expectUnmount must be true (unless fromKind is null)
 * - If expectMount is true, expectFetch must be true
 */
export function validateMountScenarioConsistency(scenario: MountLifecycleScenario): boolean {
  if (scenario.fromKind === null && scenario.expectUnmount) return false;
  if (
    scenario.fromKind !== null &&
    scenario.fromKind !== scenario.toKind &&
    !scenario.expectUnmount
  ) return false;
  if (scenario.expectMount && !scenario.expectFetch) return false;
  return true;
}

/**
 * Validate that same-kind same-ID scenario does not trigger fetch.
 */
export function validateSameIdNoFetch(scenario: MountLifecycleScenario): boolean {
  if (
    scenario.fromKind === scenario.toKind &&
    scenario.fromId === scenario.toId
  ) {
    return !scenario.expectFetch;
  }
  return true;
}

/**
 * Validate that a memoization audit report has consistent counts.
 */
export function validateMemoizationReportConsistency(report: MemoizationAuditReport): boolean {
  const concerns = report.entries.filter((e) => e.isConcern).length;
  const memoized = report.entries.filter((e) => e.isMemoized || e.isReactMemo).length;
  const needsMemo = report.entries.filter((e) => e.isConcern && !e.isMemoized && !e.isReactMemo).length;
  return (
    report.totalAudited === report.entries.length &&
    report.concernCount === concerns &&
    report.memoizedCount === memoized &&
    report.needsMemoizationCount === needsMemo
  );
}

/**
 * Validate that all three entity kinds have render paths defined.
 */
export function validateRenderPathCoverage(): {
  covered: DetailPaneKind[];
  missing: DetailPaneKind[];
} {
  const covered: DetailPaneKind[] = [];
  const missing: DetailPaneKind[] = [];
  for (const kind of DETAIL_PANE_KINDS) {
    if (INSPECTOR_RENDER_PATHS[kind]) {
      covered.push(kind);
    } else {
      missing.push(kind);
    }
  }
  return { covered, missing };
}
