import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Unit tests for ExtraHop network monitoring tRPC procedures.
 * These test the procedure definitions, input validation, and return shapes.
 * Since there's no mock data, queries return empty results from the real DB.
 */

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("dashboard procedures", () => {
  it("dashboard.stats returns numeric counts", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.stats();
    expect(result).toHaveProperty("totalDevices");
    expect(result).toHaveProperty("activeDevices");
    expect(result).toHaveProperty("criticalDevices");
    expect(result).toHaveProperty("watchlistDevices");
    expect(result).toHaveProperty("totalAlerts");
    expect(result).toHaveProperty("totalAppliances");
    expect(result).toHaveProperty("totalNetworks");
    expect(result).toHaveProperty("totalDetections");
    expect(typeof result.totalDevices).toBe("number");
    expect(typeof result.totalAlerts).toBe("number");
  });

  it("dashboard.alertsBySeverity returns severity breakdown array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.alertsBySeverity();
    expect(Array.isArray(result)).toBe(true);
  });

  it("dashboard.devicesByClass returns class breakdown array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.devicesByClass();
    expect(Array.isArray(result)).toBe(true);
  });

  it("dashboard.devicesByRole returns role breakdown array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.devicesByRole();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("devices procedures", () => {
  it("devices.list returns rows and total with default input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.devices.list();
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.rows)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("devices.list accepts filter parameters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.devices.list({
      limit: 10,
      offset: 0,
      search: "test",
      deviceClass: "node",
      sortBy: "displayName",
      sortDir: "desc",
    });
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
  });

  it("devices.byId returns null for non-existent device", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.devices.byId({ id: 999999 });
    expect(result).toBeNull();
  });
});

describe("alerts procedures", () => {
  it("alerts.list returns rows and total", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alerts.list();
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it("alerts.list accepts severity filter", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alerts.list({
      severity: 7,
      sortBy: "name",
      sortDir: "asc",
    });
    expect(result).toHaveProperty("rows");
  });
});

describe("networks procedures", () => {
  it("networks.list returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.networks.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("appliances procedures", () => {
  it("appliances.list returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.appliances.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("detections procedures", () => {
  it("detections.list returns rows and total", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.detections.list();
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.rows)).toBe(true);
  });
});

describe("metrics procedures", () => {
  it("metrics.responses returns rows and total", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.metrics.responses();
    expect(result).toHaveProperty("rows");
    expect(result).toHaveProperty("total");
  });

  it("metrics.categories returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.metrics.categories();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("reference data procedures", () => {
  it("reference.deviceGroups returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reference.deviceGroups();
    expect(Array.isArray(result)).toBe(true);
  });

  it("reference.applications returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reference.applications();
    expect(Array.isArray(result)).toBe(true);
  });

  it("reference.vlans returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reference.vlans();
    expect(Array.isArray(result)).toBe(true);
  });

  it("reference.tags returns an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.reference.tags();
    expect(Array.isArray(result)).toBe(true);
  });
});
