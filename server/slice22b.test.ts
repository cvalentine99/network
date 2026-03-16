/**
 * Slice 22b — Inspector Performance Deep-Dive
 *
 * Tests for:
 *   1. Inspector render path tracing (component tree, testid coverage, BFF fetch points)
 *   2. Detail pane mount/unmount lifecycle (selection change scenarios)
 *   3. Tab switch rerender counting (budget enforcement, immune/affected components)
 *   4. Large payload memoization (audit report, threshold enforcement, hook memoization)
 *
 * All tests validate against deterministic fixtures and shared types.
 * No live hardware or ExtraHop access is required or claimed.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

import {
  INSPECTOR_COMPONENT_IDS,
  DETAIL_PANE_KINDS,
  INSPECTOR_RENDER_PATHS,
  MOUNT_LIFECYCLE_SCENARIOS,
  TAB_SWITCH_RERENDER_BUDGET,
  COMPONENTS_IMMUNE_TO_INSPECTOR_CHANGE,
  COMPONENTS_AFFECTED_BY_INSPECTOR_CHANGE,
  RERENDER_SCENARIOS,
  MEMOIZATION_THRESHOLDS,
  DetailPaneKindSchema,
  RenderPathStepSchema,
  InspectorRenderPathSchema,
  MountLifecycleScenarioSchema,
  RerenderScenarioSchema,
  MemoizationAuditEntrySchema,
  MemoizationAuditReportSchema,
  validateRenderPathConsistency,
  validateRenderPathHasFetch,
  validateTerminalTestIdCoverage,
  validateMountScenarioConsistency,
  validateSameIdNoFetch,
  validateMemoizationReportConsistency,
  validateRenderPathCoverage,
} from "../shared/inspector-perf-types";
import type {
  DetailPaneKind,
  InspectorRenderPath,
  MountLifecycleScenario,
  RerenderScenario,
  MemoizationAuditReport,
} from "../shared/inspector-perf-types";

// ─── Fixture paths ────────────────────────────────────────────

const FIXTURE_DIR = join(__dirname, "..", "fixtures", "inspector-perf");

function loadFixture<T>(filename: string): T {
  const path = join(FIXTURE_DIR, filename);
  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

// ═══════════════════════════════════════════════════════════════
// 1. RENDER PATH TRACING
// ═══════════════════════════════════════════════════════════════

describe("1. Inspector Render Path Tracing", () => {
  describe("Render path coverage", () => {
    it("all three entity kinds have render paths defined", () => {
      const { covered, missing } = validateRenderPathCoverage();
      expect(missing).toHaveLength(0);
      expect(covered).toEqual(["device", "detection", "alert"]);
    });

    it("DETAIL_PANE_KINDS contains exactly 3 kinds", () => {
      expect(DETAIL_PANE_KINDS).toHaveLength(3);
      expect(DETAIL_PANE_KINDS).toContain("device");
      expect(DETAIL_PANE_KINDS).toContain("detection");
      expect(DETAIL_PANE_KINDS).toContain("alert");
    });

    it("INSPECTOR_COMPONENT_IDS contains exactly 6 components", () => {
      expect(INSPECTOR_COMPONENT_IDS).toHaveLength(6);
    });
  });

  describe("Render path structure — device", () => {
    let path: InspectorRenderPath;
    let fixture: any;

    beforeAll(() => {
      path = INSPECTOR_RENDER_PATHS.device;
      fixture = loadFixture("render-path.device.fixture.json");
    });

    it("has consistent step count", () => {
      expect(validateRenderPathConsistency(path)).toBe(true);
    });

    it("has at least one BFF-fetching step", () => {
      expect(validateRenderPathHasFetch(path)).toBe(true);
    });

    it("has exactly 6 terminal testIds (all states)", () => {
      expect(validateTerminalTestIdCoverage(path)).toBe(true);
    });

    it("first step is InspectorShell with data-testid", () => {
      expect(path.steps[0].component).toBe("InspectorShell");
      expect(path.steps[0].testId).toBe("inspector-shell");
    });

    it("InspectorContent does not fetch BFF", () => {
      const content = path.steps.find((s) => s.component === "InspectorContent");
      expect(content).toBeDefined();
      expect(content!.fetchesBff).toBe(false);
    });

    it("DeviceDetailPane fetches BFF", () => {
      const pane = path.steps.find((s) => s.component === "DeviceDetailPane");
      expect(pane).toBeDefined();
      expect(pane!.fetchesBff).toBe(true);
    });

    it("fixture matches the constant definition", () => {
      expect(fixture.kind).toBe("device");
      expect(fixture.totalComponents).toBe(path.totalComponents);
      expect(fixture.terminalTestIds).toEqual(path.terminalTestIds);
    });

    it("fixture validates against InspectorRenderPathSchema", () => {
      const result = InspectorRenderPathSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    });

    it("each step validates against RenderPathStepSchema", () => {
      for (const step of path.steps) {
        const result = RenderPathStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Render path structure — detection", () => {
    let path: InspectorRenderPath;
    let fixture: any;

    beforeAll(() => {
      path = INSPECTOR_RENDER_PATHS.detection;
      fixture = loadFixture("render-path.detection.fixture.json");
    });

    it("has consistent step count", () => {
      expect(validateRenderPathConsistency(path)).toBe(true);
    });

    it("has at least one BFF-fetching step", () => {
      expect(validateRenderPathHasFetch(path)).toBe(true);
    });

    it("has exactly 6 terminal testIds", () => {
      expect(validateTerminalTestIdCoverage(path)).toBe(true);
    });

    it("DetectionDetailPane fetches BFF", () => {
      const pane = path.steps.find((s) => s.component === "DetectionDetailPane");
      expect(pane).toBeDefined();
      expect(pane!.fetchesBff).toBe(true);
    });

    it("fixture validates against InspectorRenderPathSchema", () => {
      const result = InspectorRenderPathSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    });
  });

  describe("Render path structure — alert", () => {
    let path: InspectorRenderPath;
    let fixture: any;

    beforeAll(() => {
      path = INSPECTOR_RENDER_PATHS.alert;
      fixture = loadFixture("render-path.alert.fixture.json");
    });

    it("has consistent step count", () => {
      expect(validateRenderPathConsistency(path)).toBe(true);
    });

    it("has at least one BFF-fetching step", () => {
      expect(validateRenderPathHasFetch(path)).toBe(true);
    });

    it("has exactly 6 terminal testIds", () => {
      expect(validateTerminalTestIdCoverage(path)).toBe(true);
    });

    it("AlertDetailPane fetches BFF", () => {
      const pane = path.steps.find((s) => s.component === "AlertDetailPane");
      expect(pane).toBeDefined();
      expect(pane!.fetchesBff).toBe(true);
    });

    it("fixture validates against InspectorRenderPathSchema", () => {
      const result = InspectorRenderPathSchema.safeParse(fixture);
      expect(result.success).toBe(true);
    });
  });

  describe("Cross-kind render path invariants", () => {
    it("all paths start with InspectorShell", () => {
      for (const kind of DETAIL_PANE_KINDS) {
        expect(INSPECTOR_RENDER_PATHS[kind].steps[0].component).toBe("InspectorShell");
      }
    });

    it("all paths include InspectorBreadcrumb as second step", () => {
      for (const kind of DETAIL_PANE_KINDS) {
        expect(INSPECTOR_RENDER_PATHS[kind].steps[1].component).toBe("InspectorBreadcrumb");
      }
    });

    it("all paths include InspectorContent as third step", () => {
      for (const kind of DETAIL_PANE_KINDS) {
        expect(INSPECTOR_RENDER_PATHS[kind].steps[2].component).toBe("InspectorContent");
      }
    });

    it("exactly one step per path fetches BFF", () => {
      for (const kind of DETAIL_PANE_KINDS) {
        const fetchSteps = INSPECTOR_RENDER_PATHS[kind].steps.filter((s) => s.fetchesBff);
        expect(fetchSteps).toHaveLength(1);
      }
    });

    it("terminal testIds are unique across kinds (no collisions)", () => {
      const allIds = DETAIL_PANE_KINDS.flatMap((k) => INSPECTOR_RENDER_PATHS[k].terminalTestIds);
      const unique = new Set(allIds);
      expect(unique.size).toBe(allIds.length);
    });

    it("no path has NaN, Infinity, or undefined in any field", () => {
      for (const kind of DETAIL_PANE_KINDS) {
        const json = JSON.stringify(INSPECTOR_RENDER_PATHS[kind]);
        expect(json).not.toContain("NaN");
        expect(json).not.toContain("Infinity");
        expect(json).not.toContain("undefined");
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. DETAIL PANE MOUNT/UNMOUNT LIFECYCLE
// ═══════════════════════════════════════════════════════════════

describe("2. Detail Pane Mount/Unmount Lifecycle", () => {
  describe("Scenario definitions", () => {
    it("MOUNT_LIFECYCLE_SCENARIOS has 7 scenarios", () => {
      expect(MOUNT_LIFECYCLE_SCENARIOS).toHaveLength(7);
    });

    it("every scenario has a unique name", () => {
      const names = MOUNT_LIFECYCLE_SCENARIOS.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("every scenario validates against MountLifecycleScenarioSchema", () => {
      for (const scenario of MOUNT_LIFECYCLE_SCENARIOS) {
        const result = MountLifecycleScenarioSchema.safeParse(scenario);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Scenario consistency validators", () => {
    it("all scenarios pass mount consistency validation", () => {
      for (const scenario of MOUNT_LIFECYCLE_SCENARIOS) {
        expect(validateMountScenarioConsistency(scenario)).toBe(true);
      }
    });

    it("same-ID scenarios do not trigger fetch", () => {
      for (const scenario of MOUNT_LIFECYCLE_SCENARIOS) {
        expect(validateSameIdNoFetch(scenario)).toBe(true);
      }
    });
  });

  describe("Specific scenario behaviors", () => {
    it("initial selection always mounts and fetches", () => {
      const initial = MOUNT_LIFECYCLE_SCENARIOS.filter((s) => s.fromKind === null);
      for (const s of initial) {
        expect(s.expectMount).toBe(true);
        expect(s.expectFetch).toBe(true);
        expect(s.expectUnmount).toBe(false);
      }
    });

    it("cross-kind switches always unmount and mount", () => {
      const crossKind = MOUNT_LIFECYCLE_SCENARIOS.filter(
        (s) => s.fromKind !== null && s.fromKind !== s.toKind
      );
      for (const s of crossKind) {
        expect(s.expectUnmount).toBe(true);
        expect(s.expectMount).toBe(true);
        expect(s.expectFetch).toBe(true);
      }
    });

    it("same-kind different-ID does not unmount or mount", () => {
      const sameKindDiffId = MOUNT_LIFECYCLE_SCENARIOS.find(
        (s) => s.name === "same-kind-different-id-device"
      );
      expect(sameKindDiffId).toBeDefined();
      expect(sameKindDiffId!.expectUnmount).toBe(false);
      expect(sameKindDiffId!.expectMount).toBe(false);
      expect(sameKindDiffId!.expectFetch).toBe(true);
    });

    it("same-kind same-ID does not unmount, mount, or fetch", () => {
      const sameIdScenario = MOUNT_LIFECYCLE_SCENARIOS.find(
        (s) => s.name === "same-kind-same-id-device"
      );
      expect(sameIdScenario).toBeDefined();
      expect(sameIdScenario!.expectUnmount).toBe(false);
      expect(sameIdScenario!.expectMount).toBe(false);
      expect(sameIdScenario!.expectFetch).toBe(false);
    });
  });

  describe("Fixture validation", () => {
    let fixture: any;

    beforeAll(() => {
      fixture = loadFixture("mount-lifecycle.scenarios.fixture.json");
    });

    it("fixture has 7 scenarios matching constants", () => {
      expect(fixture.scenarios).toHaveLength(7);
    });

    it("fixture scenario names match constant scenario names", () => {
      const fixtureNames = fixture.scenarios.map((s: any) => s.name);
      const constantNames = MOUNT_LIFECYCLE_SCENARIOS.map((s) => s.name);
      expect(fixtureNames).toEqual(constantNames);
    });

    it("each fixture scenario validates against schema", () => {
      for (const scenario of fixture.scenarios) {
        const result = MountLifecycleScenarioSchema.safeParse(scenario);
        expect(result.success).toBe(true);
      }
    });

    it("fixture scenarios match constant expectations", () => {
      for (let i = 0; i < fixture.scenarios.length; i++) {
        const f = fixture.scenarios[i];
        const c = MOUNT_LIFECYCLE_SCENARIOS[i];
        expect(f.expectUnmount).toBe(c.expectUnmount);
        expect(f.expectMount).toBe(c.expectMount);
        expect(f.expectFetch).toBe(c.expectFetch);
      }
    });
  });

  describe("Source code contract verification", () => {
    let inspectorContentSrc: string;
    let deviceDetailSrc: string;
    let detectionDetailSrc: string;
    let alertDetailSrc: string;
    let inspectorContextSrc: string;

    beforeAll(() => {
      const base = join(__dirname, "..");
      inspectorContentSrc = readFileSync(
        join(base, "client/src/components/inspector/InspectorContent.tsx"),
        "utf-8"
      );
      deviceDetailSrc = readFileSync(
        join(base, "client/src/components/inspector/DeviceDetailPane.tsx"),
        "utf-8"
      );
      detectionDetailSrc = readFileSync(
        join(base, "client/src/components/inspector/DetectionDetailPane.tsx"),
        "utf-8"
      );
      alertDetailSrc = readFileSync(
        join(base, "client/src/components/inspector/AlertDetailPane.tsx"),
        "utf-8"
      );
      inspectorContextSrc = readFileSync(
        join(base, "client/src/contexts/InspectorContext.tsx"),
        "utf-8"
      );
    });

    it("InspectorContent uses switch on selection.kind (not keyed components)", () => {
      expect(inspectorContentSrc).toContain("switch (selection.kind)");
    });

    it("InspectorContent routes device to DeviceDetailPane", () => {
      expect(inspectorContentSrc).toContain("DeviceDetailPane");
      expect(inspectorContentSrc).toContain("case 'device'");
    });

    it("InspectorContent routes detection to DetectionDetailPane", () => {
      expect(inspectorContentSrc).toContain("DetectionDetailPane");
      expect(inspectorContentSrc).toContain("case 'detection'");
    });

    it("InspectorContent routes alert to AlertDetailPane", () => {
      expect(inspectorContentSrc).toContain("AlertDetailPane");
      expect(inspectorContentSrc).toContain("case 'alert'");
    });

    it("DeviceDetailPane uses useDeviceDetail hook", () => {
      expect(deviceDetailSrc).toContain("useDeviceDetail");
    });

    it("DetectionDetailPane uses useDetectionDetail hook", () => {
      expect(detectionDetailSrc).toContain("useDetectionDetail");
    });

    it("AlertDetailPane uses useAlertDetail hook", () => {
      expect(alertDetailSrc).toContain("useAlertDetail");
    });

    it("InspectorContext navigateTo uses setSelection with functional update", () => {
      expect(inspectorContextSrc).toContain("setSelection((prev)");
    });

    it("InspectorContext clear resets selection, isOpen, and history", () => {
      expect(inspectorContextSrc).toContain("setSelection(null)");
      expect(inspectorContextSrc).toContain("setIsOpen(false)");
      expect(inspectorContextSrc).toContain("setHistory([])");
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. TAB SWITCH RERENDER COUNTING
// ═══════════════════════════════════════════════════════════════

describe("3. Tab Switch Rerender Counting", () => {
  describe("Budget constants", () => {
    it("TAB_SWITCH_RERENDER_BUDGET is 8", () => {
      expect(TAB_SWITCH_RERENDER_BUDGET).toBe(8);
    });

    it("COMPONENTS_IMMUNE_TO_INSPECTOR_CHANGE has 7 components", () => {
      expect(COMPONENTS_IMMUNE_TO_INSPECTOR_CHANGE).toHaveLength(7);
    });

    it("COMPONENTS_AFFECTED_BY_INSPECTOR_CHANGE has 3 components", () => {
      expect(COMPONENTS_AFFECTED_BY_INSPECTOR_CHANGE).toHaveLength(3);
    });

    it("immune and affected component lists do not overlap", () => {
      const immune = new Set(COMPONENTS_IMMUNE_TO_INSPECTOR_CHANGE);
      for (const affected of COMPONENTS_AFFECTED_BY_INSPECTOR_CHANGE) {
        expect(immune.has(affected as any)).toBe(false);
      }
    });
  });

  describe("Rerender scenarios", () => {
    it("RERENDER_SCENARIOS has 5 scenarios", () => {
      expect(RERENDER_SCENARIOS).toHaveLength(5);
    });

    it("every scenario has a unique name", () => {
      const names = RERENDER_SCENARIOS.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("every scenario validates against RerenderScenarioSchema", () => {
      for (const scenario of RERENDER_SCENARIOS) {
        const result = RerenderScenarioSchema.safeParse(scenario);
        expect(result.success).toBe(true);
      }
    });

    it("no scenario exceeds TAB_SWITCH_RERENDER_BUDGET", () => {
      for (const scenario of RERENDER_SCENARIOS) {
        expect(scenario.maxRerenders).toBeLessThanOrEqual(TAB_SWITCH_RERENDER_BUDGET);
      }
    });

    it("close-inspector has lower budget than open/switch scenarios", () => {
      const close = RERENDER_SCENARIOS.find((s) => s.name === "close-inspector");
      const open = RERENDER_SCENARIOS.find((s) => s.name === "open-from-closed");
      expect(close).toBeDefined();
      expect(open).toBeDefined();
      expect(close!.maxRerenders).toBeLessThan(open!.maxRerenders);
    });

    it("all scenarios expect parent rerenders (InspectorProvider is in ImpactDeckContent)", () => {
      for (const scenario of RERENDER_SCENARIOS) {
        expect(scenario.parentRerenders).toBe(true);
      }
    });
  });

  describe("Fixture validation", () => {
    let fixture: any;

    beforeAll(() => {
      fixture = loadFixture("rerender-budget.scenarios.fixture.json");
    });

    it("fixture tabSwitchRerenderBudget matches constant", () => {
      expect(fixture.tabSwitchRerenderBudget).toBe(TAB_SWITCH_RERENDER_BUDGET);
    });

    it("fixture immune components match constant", () => {
      expect(fixture.componentsImmuneToInspectorChange).toEqual(
        [...COMPONENTS_IMMUNE_TO_INSPECTOR_CHANGE]
      );
    });

    it("fixture affected components match constant", () => {
      expect(fixture.componentsAffectedByInspectorChange).toEqual(
        [...COMPONENTS_AFFECTED_BY_INSPECTOR_CHANGE]
      );
    });

    it("fixture has 5 scenarios matching constants", () => {
      expect(fixture.scenarios).toHaveLength(5);
    });

    it("each fixture scenario validates against schema", () => {
      for (const scenario of fixture.scenarios) {
        const result = RerenderScenarioSchema.safeParse(scenario);
        expect(result.success).toBe(true);
      }
    });

    it("fixture scenario budgets match constant budgets", () => {
      for (let i = 0; i < fixture.scenarios.length; i++) {
        expect(fixture.scenarios[i].maxRerenders).toBe(RERENDER_SCENARIOS[i].maxRerenders);
      }
    });
  });

  describe("Source code contract verification — context isolation", () => {
    let inspectorContextSrc: string;

    beforeAll(() => {
      inspectorContextSrc = readFileSync(
        join(__dirname, "..", "client/src/contexts/InspectorContext.tsx"),
        "utf-8"
      );
    });

    it("InspectorContext uses useCallback for all selection methods", () => {
      // Each select method should be wrapped in useCallback
      expect(inspectorContextSrc).toContain("const selectDevice = useCallback");
      expect(inspectorContextSrc).toContain("const selectDetection = useCallback");
      expect(inspectorContextSrc).toContain("const selectAlert = useCallback");
      expect(inspectorContextSrc).toContain("const clear = useCallback");
      expect(inspectorContextSrc).toContain("const toggle = useCallback");
    });

    it("InspectorContext uses useCallback for navigation methods", () => {
      expect(inspectorContextSrc).toContain("const goBack = useCallback");
      expect(inspectorContextSrc).toContain("const goToIndex = useCallback");
    });

    it("navigateTo is memoized with useCallback", () => {
      expect(inspectorContextSrc).toContain("const navigateTo = useCallback");
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. LARGE PAYLOAD MEMOIZATION
// ═══════════════════════════════════════════════════════════════

describe("4. Large Payload Memoization", () => {
  describe("Memoization thresholds", () => {
    it("protocolCount threshold is 20", () => {
      expect(MEMOIZATION_THRESHOLDS.protocolCount).toBe(20);
    });

    it("associatedDetectionCount threshold is 50", () => {
      expect(MEMOIZATION_THRESHOLDS.associatedDetectionCount).toBe(50);
    });

    it("associatedAlertCount threshold is 30", () => {
      expect(MEMOIZATION_THRESHOLDS.associatedAlertCount).toBe(30);
    });

    it("triggerHistoryCount threshold is 30", () => {
      expect(MEMOIZATION_THRESHOLDS.triggerHistoryCount).toBe(30);
    });

    it("relatedDeviceCount threshold is 20", () => {
      expect(MEMOIZATION_THRESHOLDS.relatedDeviceCount).toBe(20);
    });

    it("timelineEventCount threshold is 50", () => {
      expect(MEMOIZATION_THRESHOLDS.timelineEventCount).toBe(50);
    });

    it("noteCount threshold is 20", () => {
      expect(MEMOIZATION_THRESHOLDS.noteCount).toBe(20);
    });

    it("all thresholds are positive integers", () => {
      for (const [key, value] of Object.entries(MEMOIZATION_THRESHOLDS)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    });
  });

  describe("Memoization audit report fixture", () => {
    let report: MemoizationAuditReport;

    beforeAll(() => {
      report = loadFixture<MemoizationAuditReport>("memoization-audit.report.fixture.json");
    });

    it("report validates against MemoizationAuditReportSchema", () => {
      const result = MemoizationAuditReportSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it("report has consistent counts", () => {
      expect(validateMemoizationReportConsistency(report)).toBe(true);
    });

    it("report audits at least 10 components", () => {
      expect(report.totalAudited).toBeGreaterThanOrEqual(10);
    });

    it("each entry validates against MemoizationAuditEntrySchema", () => {
      for (const entry of report.entries) {
        const result = MemoizationAuditEntrySchema.safeParse(entry);
        expect(result.success).toBe(true);
      }
    });

    it("hooks are marked as memoized (useCallback)", () => {
      const hooks = report.entries.filter((e) => e.component.startsWith("use"));
      for (const hook of hooks) {
        expect(hook.isMemoized).toBe(true);
      }
    });

    it("detail pane components are NOT marked as React.memo (current state)", () => {
      const panes = report.entries.filter((e) => e.component.endsWith("DetailPane"));
      for (const pane of panes) {
        expect(pane.isReactMemo).toBe(false);
      }
    });

    it("no entry has NaN or Infinity in fixturePayloadSize", () => {
      for (const entry of report.entries) {
        expect(Number.isFinite(entry.fixturePayloadSize)).toBe(true);
        expect(Number.isNaN(entry.fixturePayloadSize)).toBe(false);
      }
    });
  });

  describe("Large payload fixture validation", () => {
    let largePayload: any;

    beforeAll(() => {
      largePayload = loadFixture("large-payload.device.fixture.json");
    });

    it("large payload has 25 protocols (above threshold)", () => {
      expect(largePayload.deviceDetail.protocols).toHaveLength(25);
      expect(largePayload.deviceDetail.protocols.length).toBeGreaterThanOrEqual(
        MEMOIZATION_THRESHOLDS.protocolCount
      );
    });

    it("large payload has 10 associated detections", () => {
      expect(largePayload.deviceDetail.associatedDetections).toHaveLength(10);
    });

    it("large payload has 5 associated alerts", () => {
      expect(largePayload.deviceDetail.associatedAlerts).toHaveLength(5);
    });

    it("large payload activitySummary.totalProtocols matches protocols array length", () => {
      expect(largePayload.deviceDetail.activitySummary.totalProtocols).toBe(
        largePayload.deviceDetail.protocols.length
      );
    });

    it("large payload traffic totals are consistent", () => {
      const { bytesIn, bytesOut, totalBytes } = largePayload.deviceDetail.traffic;
      expect(totalBytes).toBe(bytesIn + bytesOut);
    });

    it("every protocol in large payload has positive totalBytes", () => {
      for (const proto of largePayload.deviceDetail.protocols) {
        expect(proto.totalBytes).toBeGreaterThan(0);
        expect(proto.totalBytes).toBe(proto.bytesIn + proto.bytesOut);
      }
    });

    it("every detection in large payload has a valid riskScore (0-100)", () => {
      for (const det of largePayload.deviceDetail.associatedDetections) {
        expect(det.riskScore).toBeGreaterThanOrEqual(0);
        expect(det.riskScore).toBeLessThanOrEqual(100);
      }
    });

    it("every alert in large payload has a valid severity (0-7)", () => {
      for (const alert of largePayload.deviceDetail.associatedAlerts) {
        expect(alert.severity).toBeGreaterThanOrEqual(0);
        expect(alert.severity).toBeLessThanOrEqual(7);
      }
    });

    it("all detection IDs in large payload are unique", () => {
      const ids = largePayload.deviceDetail.associatedDetections.map((d: any) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all alert IDs in large payload are unique", () => {
      const ids = largePayload.deviceDetail.associatedAlerts.map((a: any) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("Source code memoization audit", () => {
    let useDeviceDetailSrc: string;
    let useDetectionDetailSrc: string;
    let useAlertDetailSrc: string;
    let deviceDetailPaneSrc: string;
    let protocolChartSrc: string;

    beforeAll(() => {
      const base = join(__dirname, "..");
      useDeviceDetailSrc = readFileSync(
        join(base, "client/src/hooks/useDeviceDetail.ts"),
        "utf-8"
      );
      useDetectionDetailSrc = readFileSync(
        join(base, "client/src/hooks/useDetectionDetail.ts"),
        "utf-8"
      );
      useAlertDetailSrc = readFileSync(
        join(base, "client/src/hooks/useAlertDetail.ts"),
        "utf-8"
      );
      deviceDetailPaneSrc = readFileSync(
        join(base, "client/src/components/inspector/DeviceDetailPane.tsx"),
        "utf-8"
      );
      protocolChartSrc = readFileSync(
        join(base, "client/src/components/inspector/ProtocolBreakdownChart.tsx"),
        "utf-8"
      );
    });

    it("useDeviceDetail uses AbortController with [deviceId] dependency", () => {
      expect(useDeviceDetailSrc).toContain("AbortController");
      expect(useDeviceDetailSrc).toContain("controller.abort()");
      expect(useDeviceDetailSrc).toContain("[deviceId]");
    });

    it("useDetectionDetail uses AbortController with [detectionId] dependency", () => {
      expect(useDetectionDetailSrc).toContain("AbortController");
      expect(useDetectionDetailSrc).toContain("controller.abort()");
      expect(useDetectionDetailSrc).toContain("[detectionId]");
    });

    it("useAlertDetail uses AbortController with [alertId] dependency", () => {
      expect(useAlertDetailSrc).toContain("AbortController");
      expect(useAlertDetailSrc).toContain("controller.abort()");
      expect(useAlertDetailSrc).toContain("[alertId]");
    });

    it("useDeviceDetail validates response with DeviceDetailSchema", () => {
      expect(useDeviceDetailSrc).toContain("DeviceDetailSchema.safeParse");
    });

    it("useDetectionDetail validates response with DetectionDetailSchema", () => {
      expect(useDetectionDetailSrc).toContain("DetectionDetailSchema.safeParse");
    });

    it("useAlertDetail validates response with AlertDetailSchema", () => {
      expect(useAlertDetailSrc).toContain("AlertDetailSchema.safeParse");
    });

    it("DeviceDetailPane does not use React.memo (current state, documented)", () => {
      // This is the current state — React.memo is not applied.
      // The memoization audit documents this and provides thresholds.
      expect(deviceDetailPaneSrc).not.toContain("React.memo");
      expect(deviceDetailPaneSrc).not.toContain("memo(");
    });

    it("ProtocolBreakdownChart source exists and is importable", () => {
      expect(protocolChartSrc.length).toBeGreaterThan(0);
    });

    it("detail hooks use useState for state management (not external store)", () => {
      expect(useDeviceDetailSrc).toContain("useState<DeviceDetailState>");
      expect(useDetectionDetailSrc).toContain("useState<DetectionDetailState>");
      expect(useAlertDetailSrc).toContain("useState<AlertDetailState>");
    });

    it("detail hooks use useEffect to trigger fetch on dependency change", () => {
      expect(useDeviceDetailSrc).toContain("useEffect");
      expect(useDetectionDetailSrc).toContain("useEffect");
      expect(useAlertDetailSrc).toContain("useEffect");
    });
  });

  describe("Memoization concern analysis", () => {
    let report: MemoizationAuditReport;
    let largePayload: any;

    beforeAll(() => {
      report = loadFixture<MemoizationAuditReport>("memoization-audit.report.fixture.json");
      largePayload = loadFixture("large-payload.device.fixture.json");
    });

    it("large payload protocols exceed memoization threshold", () => {
      expect(largePayload.deviceDetail.protocols.length).toBeGreaterThanOrEqual(
        MEMOIZATION_THRESHOLDS.protocolCount
      );
    });

    it("standard fixture protocols are below memoization threshold", () => {
      const standardFixture = JSON.parse(
        readFileSync(
          join(__dirname, "..", "fixtures/device-detail/device-detail.populated.fixture.json"),
          "utf-8"
        )
      );
      expect(standardFixture.deviceDetail.protocols.length).toBeLessThan(
        MEMOIZATION_THRESHOLDS.protocolCount
      );
    });

    it("audit report correctly identifies no current concerns for standard fixtures", () => {
      expect(report.concernCount).toBe(0);
    });

    it("audit report correctly identifies 3 hooks as memoized", () => {
      expect(report.memoizedCount).toBe(3);
    });

    it("audit report identifies 0 components needing memoization at current fixture sizes", () => {
      expect(report.needsMemoizationCount).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. CROSS-CUTTING INVARIANTS
// ═══════════════════════════════════════════════════════════════

describe("5. Cross-Cutting Invariants", () => {
  it("all fixture files exist", () => {
    const expectedFixtures = [
      "render-path.device.fixture.json",
      "render-path.detection.fixture.json",
      "render-path.alert.fixture.json",
      "mount-lifecycle.scenarios.fixture.json",
      "rerender-budget.scenarios.fixture.json",
      "memoization-audit.report.fixture.json",
      "large-payload.device.fixture.json",
    ];
    for (const fixture of expectedFixtures) {
      expect(existsSync(join(FIXTURE_DIR, fixture))).toBe(true);
    }
  });

  it("all fixtures are valid JSON", () => {
    const fixtures = [
      "render-path.device.fixture.json",
      "render-path.detection.fixture.json",
      "render-path.alert.fixture.json",
      "mount-lifecycle.scenarios.fixture.json",
      "rerender-budget.scenarios.fixture.json",
      "memoization-audit.report.fixture.json",
      "large-payload.device.fixture.json",
    ];
    for (const fixture of fixtures) {
      const content = readFileSync(join(FIXTURE_DIR, fixture), "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  it("no fixture contains NaN, Infinity, or undefined as string values", () => {
    const fixtures = [
      "render-path.device.fixture.json",
      "render-path.detection.fixture.json",
      "render-path.alert.fixture.json",
      "mount-lifecycle.scenarios.fixture.json",
      "rerender-budget.scenarios.fixture.json",
      "memoization-audit.report.fixture.json",
      "large-payload.device.fixture.json",
    ];
    for (const fixture of fixtures) {
      const content = readFileSync(join(FIXTURE_DIR, fixture), "utf-8");
      // Check for literal string values (not inside description text)
      const parsed = JSON.parse(content);
      const json = JSON.stringify(parsed);
      // NaN and Infinity cannot appear as JSON values, but check for string representations
      expect(json).not.toMatch(/"NaN"/);
      expect(json).not.toMatch(/"Infinity"/);
      expect(json).not.toMatch(/":undefined/);
    }
  });

  it("DetailPaneKindSchema validates all three kinds", () => {
    for (const kind of DETAIL_PANE_KINDS) {
      const result = DetailPaneKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    }
  });

  it("DetailPaneKindSchema rejects invalid kinds", () => {
    const result = DetailPaneKindSchema.safeParse("network");
    expect(result.success).toBe(false);
  });

  it("inspector source files do not contain direct ExtraHop API calls", () => {
    const base = join(__dirname, "..");
    const inspectorFiles = [
      "client/src/components/inspector/InspectorShell.tsx",
      "client/src/components/inspector/InspectorContent.tsx",
      "client/src/components/inspector/DeviceDetailPane.tsx",
      "client/src/components/inspector/DetectionDetailPane.tsx",
      "client/src/components/inspector/AlertDetailPane.tsx",
      "client/src/components/inspector/InspectorBreadcrumb.tsx",
    ];
    for (const file of inspectorFiles) {
      const src = readFileSync(join(base, file), "utf-8");
      expect(src).not.toContain("extrahop.com");
      expect(src).not.toContain("/api/v1/");
      expect(src).not.toMatch(/https?:\/\/\d+\.\d+\.\d+\.\d+/);
    }
  });

  it("all detail hooks fetch via /api/bff/ routes only", () => {
    const base = join(__dirname, "..");
    const hookFiles = [
      "client/src/hooks/useDeviceDetail.ts",
      "client/src/hooks/useDetectionDetail.ts",
      "client/src/hooks/useAlertDetail.ts",
    ];
    for (const file of hookFiles) {
      const src = readFileSync(join(base, file), "utf-8");
      const fetchMatches = src.match(/fetch\(`([^`]+)`\)/g) || [];
      for (const match of fetchMatches) {
        expect(match).toContain("/api/bff/");
      }
    }
  });
});
