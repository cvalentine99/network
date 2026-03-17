import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { clearConfigCache } from "./extrahop-client";

// Per-request TLS bypass for testConnection — same pattern as extrahop-client.ts
let _testUndiciAgent: unknown = null;
async function getTestUndiciAgent(): Promise<unknown> {
  if (_testUndiciAgent) return _testUndiciAgent;
  try {
    // @ts-expect-error — undici is bundled with Node.js 18+ but has no types in this project
    const undici = await import('undici');
    _testUndiciAgent = new undici.Agent({
      connect: { rejectUnauthorized: false },
    });
  } catch {
    _testUndiciAgent = null;
  }
  return _testUndiciAgent;
}

/* ─────────────────────────── Dashboard Overview ─────────────────────────── */

const dashboardRouter = router({
  stats: protectedProcedure.query(async () => {
    return db.getDashboardStats();
  }),

  alertsBySeverity: protectedProcedure.query(async () => {
    return db.getAlertsBySeverity();
  }),

  devicesByClass: protectedProcedure.query(async () => {
    return db.getDevicesByClass();
  }),

  devicesByRole: protectedProcedure.query(async () => {
    return db.getDevicesByRole();
  }),

  devicesByAnalysis: protectedProcedure.query(async () => {
    return db.getDevicesByAnalysis();
  }),
});

/* ─────────────────────────── Devices ─────────────────────────── */

const devicesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        deviceClass: z.string().optional(),
        role: z.string().optional(),
        analysis: z.string().optional(),
        critical: z.boolean().optional(),
        onWatchlist: z.boolean().optional(),
        sortBy: z.enum(["displayName", "ipaddr4", "deviceClass", "role", "vendor", "analysis", "lastSeenTime", "discoverTime"]).optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getDevices(input ?? {});
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const device = await db.getDeviceById(input.id);
      if (!device) return null;
      const [ips, dnsNames, software, tags, groups, activity] = await Promise.all([
        db.getDeviceIps(input.id),
        db.getDeviceDnsNames(input.id),
        db.getDeviceSoftware(input.id),
        db.getDeviceTags(input.id),
        db.getDeviceGroups(input.id),
        db.getDeviceActivity(input.id),
      ]);
      return { ...device, ips, dnsNames, software, tags, groups, activity };
    }),
});

/* ─────────────────────────── Alerts ─────────────────────────── */

const alertsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        severity: z.number().optional(),
        type: z.string().optional(),
        disabled: z.boolean().optional(),
        sortBy: z.enum(["name", "severity", "type", "statName"]).optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getAlerts(input ?? {});
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getAlertById(input.id);
    }),
});

/* ─────────────────────────── Appliances ─────────────────────────── */

const appliancesRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getAppliances();
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getApplianceById(input.id);
    }),
});

/* ─────────────────────────── Networks ─────────────────────────── */

const networksRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getNetworks();
  }),
});

/* ─────────────────────────── Detections ─────────────────────────── */

const detectionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        status: z.string().optional(),
        sortBy: z.enum(["title", "riskScore", "status", "startTime", "createTime"]).optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getDetections(input ?? {});
    }),
});

/* ─────────────────────────── Metrics ─────────────────────────── */

const metricsRouter = router({
  responses: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        category: z.string().optional(),
        objectType: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getMetricResponses(input ?? {});
    }),

  stats: protectedProcedure
    .input(z.object({ metricResponseId: z.number() }))
    .query(async ({ input }) => {
      return db.getMetricStats(input.metricResponseId);
    }),

  categories: protectedProcedure.query(async () => {
    return db.getMetricCategories();
  }),
});

/* ─────────────────────────── Topology ─────────────────────────── */

const topologyRouter = router({
  /**
   * Returns the latest topology snapshot from snap_topology tables.
   * NOT IMPLEMENTED: No ETL process currently populates these tables.
   * The snap_topology, snap_topology_node, and snap_topology_edge tables exist
   * in the schema but are always empty. This endpoint will return null until
   * a topology snapshot ETL is built. (audit H3)
   *
   * The actual live topology is served by POST /api/bff/topology/query
   * which calls ExtraHop APIs directly (not from snapshot tables).
   */
  latest: protectedProcedure.query(async () => {
    return db.getLatestTopology();
  }),
});

/* ─────────────────────────── Saved Topology Views (Slice 35E) ─────────────────────────── */

/** Local-only user ID — no Manus OAuth required */
const LOCAL_USER_ID = 'local';

const savedViewsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getSavedTopologyViews(LOCAL_USER_ID);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      return db.getSavedTopologyViewById(input.id, LOCAL_USER_ID);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      viewMode: z.string().default('constellation'),
      zoom: z.number().positive().max(10).default(1),
      panX: z.number().finite().default(0),
      panY: z.number().finite().default(0),
      collapsedSubnets: z.array(z.string()).default([]),
      roleFilters: z.array(z.string()).default([]),
      protocolFilters: z.array(z.string()).default([]),
      anomalyOverlayEnabled: z.boolean().default(false),
      anomalyThreshold: z.number().positive().default(50),
      criticalPathSource: z.number().int().positive().nullable().default(null),
      criticalPathDestination: z.number().int().positive().nullable().default(null),
      searchTerm: z.string().default(''),
      nodePositions: z.record(z.string(), z.object({ x: z.number().finite(), y: z.number().finite() })).nullable().default(null),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createSavedTopologyView({
        userId: LOCAL_USER_ID,
        ...input,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(100).optional(),
      viewMode: z.string().optional(),
      zoom: z.number().positive().max(10).optional(),
      panX: z.number().finite().optional(),
      panY: z.number().finite().optional(),
      collapsedSubnets: z.array(z.string()).optional(),
      roleFilters: z.array(z.string()).optional(),
      protocolFilters: z.array(z.string()).optional(),
      anomalyOverlayEnabled: z.boolean().optional(),
      anomalyThreshold: z.number().positive().optional(),
      criticalPathSource: z.number().int().positive().nullable().optional(),
      criticalPathDestination: z.number().int().positive().nullable().optional(),
      searchTerm: z.string().optional(),
      nodePositions: z.record(z.string(), z.object({ x: z.number().finite(), y: z.number().finite() })).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const ok = await db.updateSavedTopologyView(id, LOCAL_USER_ID, rest);
      return { success: ok };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const ok = await db.deleteSavedTopologyView(input.id, LOCAL_USER_ID);
      return { success: ok };
    }),
});

/* ─────────────────────────── Reference Data ─────────────────────────── */

const referenceRouter = router({
  deviceGroups: protectedProcedure.query(async () => {
    return db.getDeviceGroupsList();
  }),

  applications: protectedProcedure.query(async () => {
    return db.getApplications();
  }),

  vlans: protectedProcedure.query(async () => {
    return db.getVlans();
  }),

  tags: protectedProcedure.query(async () => {
    return db.getTags();
  }),

  networkLocalities: protectedProcedure.query(async () => {
    return db.getNetworkLocalities();
  }),

  activityMaps: protectedProcedure.query(async () => {
    return db.getActivityMaps();
  }),
});

/* ─────────────────────────── Schema Health ─────────────────────────── */

const schemaRouter = router({
  latestDrift: protectedProcedure.query(async () => {
    return db.getLatestDriftLog();
  }),
});

/* ─────────────────────────── Appliance Config (Slice 14) ─────────────────────────── */

import { ApplianceConfigInputSchema, maskApiKey } from '../shared/appliance-config-validators';

const applianceConfigRouter = router({
  /** Get current appliance config (API key masked) */
  get: protectedProcedure.query(async () => {
    const row = await db.getApplianceConfig();
    if (!row) return null;
    return {
      id: row.id,
      hostname: row.hostname,
      apiKeyHint: maskApiKey(row.apiKey),
      apiKeyConfigured: row.apiKey.length > 0,
      verifySsl: row.verifySsl,
      cloudServicesEnabled: row.cloudServicesEnabled,
      nickname: row.nickname,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestResult: row.lastTestResult,
      lastTestMessage: row.lastTestMessage,
    };
  }),

  /** Save (upsert) appliance config */
  save: protectedProcedure
    .input(ApplianceConfigInputSchema)
    .mutation(async ({ input }) => {
      const row = await db.upsertApplianceConfig(input);
      if (!row) throw new Error('Failed to save appliance config');
      // Bust the fixture-mode cache so routes immediately see the new config
      clearConfigCache();
      return {
        id: row.id,
        hostname: row.hostname,
        apiKeyHint: maskApiKey(row.apiKey),
        apiKeyConfigured: row.apiKey.length > 0,
        verifySsl: row.verifySsl,
        cloudServicesEnabled: row.cloudServicesEnabled,
        nickname: row.nickname,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
        lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
        lastTestResult: row.lastTestResult,
        lastTestMessage: row.lastTestMessage,
      };
    }),

  /** Test connection to the configured appliance */
  testConnection: protectedProcedure.mutation(async () => {
    // Use decrypted config — testConnection needs the real API key (audit C3)
    const config = await db.getApplianceConfigDecrypted();
    if (!config) {
      return {
        success: false,
        message: 'No appliance configured. Save a configuration first.',
        latencyMs: null,
        testedAt: new Date().toISOString(),
      };
    }

    const testedAt = new Date().toISOString();

    // Attempt a basic connectivity check using the configured hostname
    const start = Date.now();
    try {
      // ALWAYS use HTTPS — verifySsl controls certificate validation, NOT protocol.
      // HTTP downgrade was a security bug (audit C1). API key must never travel unencrypted.
      const url = `https://${config.hostname}/api/v1/extrahop`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Build fetch options with per-request TLS bypass when verifySsl=false
      // Uses undici dispatcher — same pattern as extrahop-client.ts (no @ts-ignore, no global bypass)
      const fetchOpts: RequestInit & { dispatcher?: unknown } = {
        method: 'GET',
        headers: {
          'Authorization': `ExtraHop apikey=${config.apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      };
      if (!config.verifySsl) {
        fetchOpts.dispatcher = await getTestUndiciAgent();
      }
      const res = await fetch(url, fetchOpts).catch((err: Error) => {
        clearTimeout(timeout);
        throw err;
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      if (res.ok) {
        await db.updateApplianceTestResult({
          id: config.id,
          lastTestResult: 'success',
          lastTestMessage: `Connected successfully (${latencyMs}ms)`,
        });
        return {
          success: true,
          message: `Connected successfully (${latencyMs}ms)`,
          latencyMs,
          testedAt,
        };
      } else {
        const msg = `HTTP ${res.status}: ${res.statusText}`;
        await db.updateApplianceTestResult({
          id: config.id,
          lastTestResult: 'failure',
          lastTestMessage: msg,
        });
        return { success: false, message: msg, latencyMs, testedAt };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const msg = err.name === 'AbortError'
        ? 'Connection timed out (10s)'
        : `Connection failed: ${err.message || 'Unknown error'}`;
      await db.updateApplianceTestResult({
        id: config.id,
        lastTestResult: 'failure',
        lastTestMessage: msg,
      });
      return { success: false, message: msg, latencyMs, testedAt };
    }
  }),

  /** Delete appliance config (reset to unconfigured) */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteApplianceConfig(input.id);
      return { success: true };
    }),
});

/* ─────────────────────────── App Router ─────────────────────────── */

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: dashboardRouter,
  devices: devicesRouter,
  alerts: alertsRouter,
  appliances: appliancesRouter,
  networks: networksRouter,
  detections: detectionsRouter,
  metrics: metricsRouter,
  topology: topologyRouter,
  savedViews: savedViewsRouter,
  reference: referenceRouter,
  schema: schemaRouter,
  applianceConfig: applianceConfigRouter,
});

export type AppRouter = typeof appRouter;
