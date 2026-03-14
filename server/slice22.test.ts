/**
 * Slice 22 — Performance Budget Validation
 *
 * Tests for:
 * 1. Budget constant contracts (every surface has a budget, route, and terminal testid)
 * 2. Schema validation (TimingMeasurement, PerformanceBudgetReport)
 * 3. Consistency validators (passed/failed, report counts, runTimes, stdDev)
 * 4. Edge cases (zero times, single run, all-pass, all-fail)
 * 5. Budget coverage completeness
 * 6. Report fixture validation (if measurement report exists)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

import {
  SURFACE_IDS,
  PERFORMANCE_BUDGETS,
  SURFACE_TERMINAL_TESTIDS,
  SURFACE_ROUTES,
  SurfaceIdSchema,
  TimingMeasurementSchema,
  PerformanceBudgetReportSchema,
  validatePassedConsistency,
  validateReportConsistency,
  validateRunTimesConsistency,
  validateStdDev,
  validateBudgetCoverage,
} from "../shared/performance-budget-types";
import type {
  SurfaceId,
  TimingMeasurement,
  PerformanceBudgetReport,
} from "../shared/performance-budget-types";

// ─── 1. Budget Constant Contracts ──────────────────────────────

describe("Budget Constant Contracts", () => {
  it("SURFACE_IDS contains exactly 6 surfaces", () => {
    expect(SURFACE_IDS).toHaveLength(6);
  });

  it("SURFACE_IDS contains all expected surface identifiers", () => {
    expect(SURFACE_IDS).toContain("impact-deck");
    expect(SURFACE_IDS).toContain("flow-theater");
    expect(SURFACE_IDS).toContain("blast-radius");
    expect(SURFACE_IDS).toContain("correlation");
    expect(SURFACE_IDS).toContain("topology");
    expect(SURFACE_IDS).toContain("inspector-tab-switch");
  });

  it("every SURFACE_ID has a PERFORMANCE_BUDGET entry", () => {
    for (const id of SURFACE_IDS) {
      expect(PERFORMANCE_BUDGETS[id]).toBeDefined();
      expect(typeof PERFORMANCE_BUDGETS[id]).toBe("number");
      expect(PERFORMANCE_BUDGETS[id]).toBeGreaterThan(0);
    }
  });

  it("every SURFACE_ID has a SURFACE_TERMINAL_TESTIDS entry", () => {
    for (const id of SURFACE_IDS) {
      expect(SURFACE_TERMINAL_TESTIDS[id]).toBeDefined();
      expect(typeof SURFACE_TERMINAL_TESTIDS[id]).toBe("string");
      expect(SURFACE_TERMINAL_TESTIDS[id].length).toBeGreaterThan(0);
    }
  });

  it("every SURFACE_ID has a SURFACE_ROUTES entry", () => {
    for (const id of SURFACE_IDS) {
      expect(SURFACE_ROUTES[id]).toBeDefined();
      expect(typeof SURFACE_ROUTES[id]).toBe("string");
      expect(SURFACE_ROUTES[id]).toMatch(/^\//);
    }
  });

  it("budget values match documented targets", () => {
    expect(PERFORMANCE_BUDGETS["impact-deck"]).toBe(2000);
    expect(PERFORMANCE_BUDGETS["flow-theater"]).toBe(5000);
    expect(PERFORMANCE_BUDGETS["blast-radius"]).toBe(3000);
    expect(PERFORMANCE_BUDGETS["correlation"]).toBe(2000);
    expect(PERFORMANCE_BUDGETS["topology"]).toBe(4000);
    expect(PERFORMANCE_BUDGETS["inspector-tab-switch"]).toBe(200);
  });

  it("terminal testid selectors use data-testid attribute format", () => {
    for (const id of SURFACE_IDS) {
      const selector = SURFACE_TERMINAL_TESTIDS[id];
      expect(selector).toMatch(/data-testid/);
    }
  });

  it("routes are unique except inspector-tab-switch shares with impact-deck", () => {
    const routeMap = new Map<string, SurfaceId[]>();
    for (const id of SURFACE_IDS) {
      const route = SURFACE_ROUTES[id];
      if (!routeMap.has(route)) routeMap.set(route, []);
      routeMap.get(route)!.push(id);
    }
    // "/" is shared by impact-deck and inspector-tab-switch
    const rootUsers = routeMap.get("/");
    expect(rootUsers).toBeDefined();
    expect(rootUsers).toContain("impact-deck");
    expect(rootUsers).toContain("inspector-tab-switch");
    // All other routes should be unique
    for (const [route, ids] of Array.from(routeMap.entries())) {
      if (route !== "/") {
        expect(ids).toHaveLength(1);
      }
    }
  });

  it("no budget exceeds 10 seconds (sanity check)", () => {
    for (const id of SURFACE_IDS) {
      expect(PERFORMANCE_BUDGETS[id]).toBeLessThanOrEqual(10000);
    }
  });

  it("no budget is less than 50ms (sanity check)", () => {
    for (const id of SURFACE_IDS) {
      expect(PERFORMANCE_BUDGETS[id]).toBeGreaterThanOrEqual(50);
    }
  });
});

// ─── 2. SurfaceId Schema ──────────────────────────────────────

describe("SurfaceIdSchema", () => {
  it("accepts all valid surface IDs", () => {
    for (const id of SURFACE_IDS) {
      expect(SurfaceIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it("rejects invalid surface IDs", () => {
    expect(SurfaceIdSchema.safeParse("unknown-surface").success).toBe(false);
    expect(SurfaceIdSchema.safeParse("").success).toBe(false);
    expect(SurfaceIdSchema.safeParse(123).success).toBe(false);
    expect(SurfaceIdSchema.safeParse(null).success).toBe(false);
  });
});

// ─── 3. TimingMeasurementSchema ───────────────────────────────

describe("TimingMeasurementSchema", () => {
  const validMeasurement: TimingMeasurement = {
    surfaceId: "impact-deck",
    budgetMs: 2000,
    actualMs: 850,
    passed: true,
    terminalSelector: "[data-testid='kpi-strip']",
    measuredAt: "2026-03-14T12:00:00.000Z",
    runs: 3,
    runTimes: [800, 850, 900],
    stdDevMs: 41,
  };

  it("accepts a valid measurement", () => {
    const result = TimingMeasurementSchema.safeParse(validMeasurement);
    expect(result.success).toBe(true);
  });

  it("rejects measurement with missing surfaceId", () => {
    const { surfaceId, ...rest } = validMeasurement;
    expect(TimingMeasurementSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects measurement with negative budgetMs", () => {
    expect(
      TimingMeasurementSchema.safeParse({ ...validMeasurement, budgetMs: -1 })
        .success
    ).toBe(false);
  });

  it("rejects measurement with negative actualMs", () => {
    expect(
      TimingMeasurementSchema.safeParse({ ...validMeasurement, actualMs: -1 })
        .success
    ).toBe(false);
  });

  it("accepts measurement with actualMs of 0", () => {
    expect(
      TimingMeasurementSchema.safeParse({ ...validMeasurement, actualMs: 0 })
        .success
    ).toBe(true);
  });

  it("rejects measurement with zero runs", () => {
    expect(
      TimingMeasurementSchema.safeParse({ ...validMeasurement, runs: 0 })
        .success
    ).toBe(false);
  });

  it("rejects measurement with empty runTimes", () => {
    expect(
      TimingMeasurementSchema.safeParse({
        ...validMeasurement,
        runTimes: [],
      }).success
    ).toBe(false);
  });

  it("rejects measurement with non-string terminalSelector", () => {
    expect(
      TimingMeasurementSchema.safeParse({
        ...validMeasurement,
        terminalSelector: 123,
      }).success
    ).toBe(false);
  });

  it("rejects measurement with empty terminalSelector", () => {
    expect(
      TimingMeasurementSchema.safeParse({
        ...validMeasurement,
        terminalSelector: "",
      }).success
    ).toBe(false);
  });
});

// ─── 4. PerformanceBudgetReportSchema ─────────────────────────

describe("PerformanceBudgetReportSchema", () => {
  const validReport: PerformanceBudgetReport = {
    measurements: [
      {
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 850,
        passed: true,
        terminalSelector: "[data-testid='kpi-strip']",
        measuredAt: "2026-03-14T12:00:00.000Z",
        runs: 3,
        runTimes: [800, 850, 900],
        stdDevMs: 41,
      },
    ],
    allPassed: true,
    totalSurfaces: 1,
    passedCount: 1,
    failedCount: 0,
    generatedAt: "2026-03-14T12:00:00.000Z",
    environment: "Sandbox Chromium headless",
  };

  it("accepts a valid report", () => {
    expect(PerformanceBudgetReportSchema.safeParse(validReport).success).toBe(
      true
    );
  });

  it("rejects report with empty measurements", () => {
    expect(
      PerformanceBudgetReportSchema.safeParse({
        ...validReport,
        measurements: [],
      }).success
    ).toBe(false);
  });

  it("rejects report with negative passedCount", () => {
    expect(
      PerformanceBudgetReportSchema.safeParse({
        ...validReport,
        passedCount: -1,
      }).success
    ).toBe(false);
  });

  it("rejects report with empty environment", () => {
    expect(
      PerformanceBudgetReportSchema.safeParse({
        ...validReport,
        environment: "",
      }).success
    ).toBe(false);
  });
});

// ─── 5. Consistency Validators ────────────────────────────────

describe("validatePassedConsistency", () => {
  it("returns true when passed=true and actualMs <= budgetMs", () => {
    expect(
      validatePassedConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 1500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [1500],
        stdDevMs: 0,
      })
    ).toBe(true);
  });

  it("returns true when passed=false and actualMs > budgetMs", () => {
    expect(
      validatePassedConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 2500,
        passed: false,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [2500],
        stdDevMs: 0,
      })
    ).toBe(true);
  });

  it("returns false when passed=true but actualMs > budgetMs", () => {
    expect(
      validatePassedConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 2500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [2500],
        stdDevMs: 0,
      })
    ).toBe(false);
  });

  it("returns false when passed=false but actualMs <= budgetMs", () => {
    expect(
      validatePassedConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 1500,
        passed: false,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [1500],
        stdDevMs: 0,
      })
    ).toBe(false);
  });

  it("returns true when actualMs exactly equals budgetMs and passed=true", () => {
    expect(
      validatePassedConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 2000,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [2000],
        stdDevMs: 0,
      })
    ).toBe(true);
  });
});

describe("validateReportConsistency", () => {
  it("returns true for consistent all-pass report", () => {
    const report: PerformanceBudgetReport = {
      measurements: [
        {
          surfaceId: "impact-deck",
          budgetMs: 2000,
          actualMs: 500,
          passed: true,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [500],
          stdDevMs: 0,
        },
        {
          surfaceId: "topology",
          budgetMs: 4000,
          actualMs: 1000,
          passed: true,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [1000],
          stdDevMs: 0,
        },
      ],
      allPassed: true,
      totalSurfaces: 2,
      passedCount: 2,
      failedCount: 0,
      generatedAt: "x",
      environment: "x",
    };
    expect(validateReportConsistency(report)).toBe(true);
  });

  it("returns true for consistent mixed report", () => {
    const report: PerformanceBudgetReport = {
      measurements: [
        {
          surfaceId: "impact-deck",
          budgetMs: 2000,
          actualMs: 500,
          passed: true,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [500],
          stdDevMs: 0,
        },
        {
          surfaceId: "topology",
          budgetMs: 4000,
          actualMs: 5000,
          passed: false,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [5000],
          stdDevMs: 0,
        },
      ],
      allPassed: false,
      totalSurfaces: 2,
      passedCount: 1,
      failedCount: 1,
      generatedAt: "x",
      environment: "x",
    };
    expect(validateReportConsistency(report)).toBe(true);
  });

  it("returns false when passedCount is wrong", () => {
    const report: PerformanceBudgetReport = {
      measurements: [
        {
          surfaceId: "impact-deck",
          budgetMs: 2000,
          actualMs: 500,
          passed: true,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [500],
          stdDevMs: 0,
        },
      ],
      allPassed: true,
      totalSurfaces: 1,
      passedCount: 0, // wrong
      failedCount: 0,
      generatedAt: "x",
      environment: "x",
    };
    expect(validateReportConsistency(report)).toBe(false);
  });

  it("returns false when allPassed is wrong", () => {
    const report: PerformanceBudgetReport = {
      measurements: [
        {
          surfaceId: "impact-deck",
          budgetMs: 2000,
          actualMs: 3000,
          passed: false,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [3000],
          stdDevMs: 0,
        },
      ],
      allPassed: true, // wrong
      totalSurfaces: 1,
      passedCount: 0,
      failedCount: 1,
      generatedAt: "x",
      environment: "x",
    };
    expect(validateReportConsistency(report)).toBe(false);
  });

  it("returns false when totalSurfaces is wrong", () => {
    const report: PerformanceBudgetReport = {
      measurements: [
        {
          surfaceId: "impact-deck",
          budgetMs: 2000,
          actualMs: 500,
          passed: true,
          terminalSelector: "x",
          measuredAt: "x",
          runs: 1,
          runTimes: [500],
          stdDevMs: 0,
        },
      ],
      allPassed: true,
      totalSurfaces: 5, // wrong
      passedCount: 1,
      failedCount: 0,
      generatedAt: "x",
      environment: "x",
    };
    expect(validateReportConsistency(report)).toBe(false);
  });
});

describe("validateRunTimesConsistency", () => {
  it("returns true when runTimes length matches runs and mean matches actualMs", () => {
    expect(
      validateRunTimesConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 3,
        runTimes: [400, 500, 600],
        stdDevMs: 82,
      })
    ).toBe(true);
  });

  it("returns false when runTimes length does not match runs", () => {
    expect(
      validateRunTimesConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 3,
        runTimes: [400, 600], // only 2
        stdDevMs: 0,
      })
    ).toBe(false);
  });

  it("returns false when actualMs does not match mean of runTimes", () => {
    expect(
      validateRunTimesConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 999, // wrong mean
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 3,
        runTimes: [400, 500, 600],
        stdDevMs: 82,
      })
    ).toBe(false);
  });

  it("handles single-run case", () => {
    expect(
      validateRunTimesConsistency({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [500],
        stdDevMs: 0,
      })
    ).toBe(true);
  });
});

describe("validateStdDev", () => {
  it("returns true for single run with stdDev=0", () => {
    expect(
      validateStdDev({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 1,
        runTimes: [500],
        stdDevMs: 0,
      })
    ).toBe(true);
  });

  it("returns true for correctly computed stdDev", () => {
    // runTimes: [400, 500, 600], mean=500, variance=((100^2+0+100^2)/3)=6666.67, stdDev≈81.65
    expect(
      validateStdDev({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 3,
        runTimes: [400, 500, 600],
        stdDevMs: 82,
      })
    ).toBe(true);
  });

  it("returns false for incorrectly computed stdDev", () => {
    expect(
      validateStdDev({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 3,
        runTimes: [400, 500, 600],
        stdDevMs: 200, // wrong
      })
    ).toBe(false);
  });

  it("returns true for identical runTimes with stdDev=0", () => {
    expect(
      validateStdDev({
        surfaceId: "impact-deck",
        budgetMs: 2000,
        actualMs: 500,
        passed: true,
        terminalSelector: "x",
        measuredAt: "x",
        runs: 3,
        runTimes: [500, 500, 500],
        stdDevMs: 0,
      })
    ).toBe(true);
  });
});

// ─── 6. Budget Coverage ───────────────────────────────────────

describe("validateBudgetCoverage", () => {
  it("all surfaces are covered", () => {
    const { covered, missing } = validateBudgetCoverage();
    expect(missing).toHaveLength(0);
    expect(covered).toHaveLength(SURFACE_IDS.length);
  });

  it("covered list contains all SURFACE_IDS", () => {
    const { covered } = validateBudgetCoverage();
    for (const id of SURFACE_IDS) {
      expect(covered).toContain(id);
    }
  });
});

// ─── 7. Report Fixture Validation ─────────────────────────────

describe("Performance Budget Report Fixture", () => {
  const reportPath = join(
    __dirname,
    "..",
    "fixtures",
    "performance-budget-report.json"
  );
  let report: PerformanceBudgetReport | null = null;
  let reportExists = false;

  beforeAll(() => {
    reportExists = existsSync(reportPath);
    if (reportExists) {
      const raw = readFileSync(reportPath, "utf-8");
      report = JSON.parse(raw);
    }
  });

  it("report fixture file exists", () => {
    expect(reportExists).toBe(true);
  });

  it("report validates against PerformanceBudgetReportSchema", () => {
    if (!report) return;
    const result = PerformanceBudgetReportSchema.safeParse(report);
    expect(result.success).toBe(true);
  });

  it("report has consistent summary counts", () => {
    if (!report) return;
    expect(validateReportConsistency(report)).toBe(true);
  });

  it("every measurement has consistent passed field", () => {
    if (!report) return;
    for (const m of report.measurements) {
      expect(validatePassedConsistency(m)).toBe(true);
    }
  });

  it("every measurement has consistent runTimes", () => {
    if (!report) return;
    for (const m of report.measurements) {
      expect(validateRunTimesConsistency(m)).toBe(true);
    }
  });

  it("every measurement has consistent stdDev", () => {
    if (!report) return;
    for (const m of report.measurements) {
      expect(validateStdDev(m)).toBe(true);
    }
  });

  it("report environment is not empty", () => {
    if (!report) return;
    expect(report.environment.length).toBeGreaterThan(0);
  });

  it("report generatedAt is a valid ISO timestamp", () => {
    if (!report) return;
    const date = new Date(report.generatedAt);
    expect(date.getTime()).not.toBeNaN();
  });

  it("every measurement surfaceId is a valid SurfaceId", () => {
    if (!report) return;
    for (const m of report.measurements) {
      expect(SurfaceIdSchema.safeParse(m.surfaceId).success).toBe(true);
    }
  });

  it("no NaN or Infinity values in measurements", () => {
    if (!report) return;
    for (const m of report.measurements) {
      expect(Number.isFinite(m.actualMs)).toBe(true);
      expect(Number.isFinite(m.budgetMs)).toBe(true);
      expect(Number.isFinite(m.stdDevMs)).toBe(true);
      for (const t of m.runTimes) {
        expect(Number.isFinite(t)).toBe(true);
      }
    }
  });
});

// ─── 8. Cross-Surface Budget Ordering ─────────────────────────

describe("Budget Ordering Invariants", () => {
  it("inspector-tab-switch has the tightest budget", () => {
    const inspectorBudget = PERFORMANCE_BUDGETS["inspector-tab-switch"];
    for (const id of SURFACE_IDS) {
      if (id !== "inspector-tab-switch") {
        expect(PERFORMANCE_BUDGETS[id]).toBeGreaterThan(inspectorBudget);
      }
    }
  });

  it("flow-theater has the most generous budget among page surfaces", () => {
    const pageSurfaces: SurfaceId[] = [
      "impact-deck",
      "blast-radius",
      "correlation",
      "topology",
    ];
    const ftBudget = PERFORMANCE_BUDGETS["flow-theater"];
    for (const id of pageSurfaces) {
      expect(ftBudget).toBeGreaterThanOrEqual(PERFORMANCE_BUDGETS[id]);
    }
  });

  it("impact-deck and correlation share the same budget", () => {
    expect(PERFORMANCE_BUDGETS["impact-deck"]).toBe(
      PERFORMANCE_BUDGETS["correlation"]
    );
  });
});
