import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDeviceCount: vi.fn().mockResolvedValue(42),
  getActiveAlertCount: vi.fn().mockResolvedValue(7),
  getInterfaceCountByStatus: vi.fn().mockResolvedValue({ up: 120, down: 3, degraded: 2 }),
  getAlertsBySeverity: vi.fn().mockResolvedValue({ critical: 2, high: 3, medium: 1, low: 1 }),
  getRecentAlerts: vi.fn().mockResolvedValue([
    {
      id: 1,
      severity: "critical",
      message: "High CPU usage on core-switch-01",
      createdAt: new Date("2026-03-07T10:00:00Z"),
      deviceName: "core-switch-01",
    },
  ]),
  getDevicesByStatus: vi.fn().mockResolvedValue({ online: 35, offline: 4, warning: 3 }),
  getAveragePerformanceMetrics: vi.fn().mockResolvedValue({
    avgLatency: 12.5,
    avgThroughput: 500000000,
    avgPacketLoss: 0.02,
    avgJitter: 1.3,
    avgUptime: 99.95,
  }),
  getAllDevices: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "core-switch-01",
      ipAddress: "10.0.1.1",
      macAddress: "AA:BB:CC:DD:EE:01",
      deviceType: "switch",
      manufacturer: "Cisco",
      model: "Catalyst 9300",
      osVersion: "IOS-XE 17.6",
      location: "DC1-Rack-A1",
      status: "online",
      lastSeen: new Date("2026-03-07T10:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-03-07T10:00:00Z"),
    },
  ]),
  getAllAlerts: vi.fn().mockResolvedValue([
    {
      id: 1,
      deviceId: 1,
      severity: "critical",
      message: "High CPU usage on core-switch-01",
      source: "SNMP",
      acknowledged: 0,
      resolvedAt: null,
      createdAt: new Date("2026-03-07T10:00:00Z"),
      deviceName: "core-switch-01",
    },
  ]),
  getAllInterfaces: vi.fn().mockResolvedValue([
    {
      id: 1,
      deviceId: 1,
      name: "GigabitEthernet0/1",
      interfaceType: "ethernet",
      status: "up",
      speed: 1000000000,
      inTraffic: 500000000,
      outTraffic: 300000000,
      mtu: 1500,
      deviceName: "core-switch-01",
    },
  ]),
  getPerDevicePerformance: vi.fn().mockResolvedValue([
    {
      deviceId: 1,
      deviceName: "core-switch-01",
      latency: 8.2,
      throughput: 750000000,
      packetLoss: 0.01,
      jitter: 0.8,
      uptime: 99.99,
    },
  ]),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("network.overview", () => {
  it("returns aggregated overview data", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.network.overview();

    expect(result).toBeDefined();
    expect(result.totalDevices).toBe(42);
    expect(result.activeAlerts).toBe(7);
    expect(result.interfacesUp).toBe(120);
    expect(result.interfacesDown).toBe(5); // down + degraded
    expect(result.avgLatency).toBe(12.5);
    expect(result.avgThroughput).toBe(500000000);
    expect(result.alertsBySeverity).toEqual({ critical: 2, high: 3, medium: 1, low: 1 });
    expect(result.recentAlerts).toHaveLength(1);
    expect(result.recentAlerts[0].severity).toBe("critical");
    expect(result.devicesByStatus).toEqual({ online: 35, offline: 4, warning: 3 });
  });
});

describe("network.devices", () => {
  it("returns device list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.network.devices();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("core-switch-01");
    expect(result[0].ipAddress).toBe("10.0.1.1");
    expect(result[0].status).toBe("online");
  });
});

describe("network.alerts", () => {
  it("returns alert list with device names", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.network.alerts();

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe("critical");
    expect(result[0].deviceName).toBe("core-switch-01");
    expect(result[0].source).toBe("SNMP");
  });
});

describe("network.interfaces", () => {
  it("returns interface list with device names", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.network.interfaces();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("GigabitEthernet0/1");
    expect(result[0].status).toBe("up");
    expect(result[0].speed).toBe(1000000000);
    expect(result[0].deviceName).toBe("core-switch-01");
  });
});

describe("network.performanceMetrics", () => {
  it("returns aggregated and per-device metrics", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.network.performanceMetrics();

    expect(result.avgLatency).toBe(12.5);
    expect(result.avgThroughput).toBe(500000000);
    expect(result.avgPacketLoss).toBe(0.02);
    expect(result.avgUptime).toBe(99.95);
    expect(result.avgJitter).toBe(1.3);
    expect(result.deviceMetrics).toHaveLength(1);
    expect(result.deviceMetrics[0].deviceName).toBe("core-switch-01");
    expect(result.deviceMetrics[0].latency).toBe(8.2);
  });
});
