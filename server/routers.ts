import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

/* ─────────────────────────── Dashboard Overview ─────────────────────────── */

const dashboardRouter = router({
  stats: publicProcedure.query(async () => {
    return db.getDashboardStats();
  }),

  alertsBySeverity: publicProcedure.query(async () => {
    return db.getAlertsBySeverity();
  }),

  devicesByClass: publicProcedure.query(async () => {
    return db.getDevicesByClass();
  }),

  devicesByRole: publicProcedure.query(async () => {
    return db.getDevicesByRole();
  }),

  devicesByAnalysis: publicProcedure.query(async () => {
    return db.getDevicesByAnalysis();
  }),
});

/* ─────────────────────────── Devices ─────────────────────────── */

const devicesRouter = router({
  list: publicProcedure
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
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getDevices(input ?? {});
    }),

  byId: publicProcedure
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
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        severity: z.number().optional(),
        type: z.string().optional(),
        disabled: z.boolean().optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getAlerts(input ?? {});
    }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getAlertById(input.id);
    }),
});

/* ─────────────────────────── Appliances ─────────────────────────── */

const appliancesRouter = router({
  list: publicProcedure.query(async () => {
    return db.getAppliances();
  }),

  byId: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getApplianceById(input.id);
    }),
});

/* ─────────────────────────── Networks ─────────────────────────── */

const networksRouter = router({
  list: publicProcedure.query(async () => {
    return db.getNetworks();
  }),
});

/* ─────────────────────────── Detections ─────────────────────────── */

const detectionsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(200).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        search: z.string().optional(),
        status: z.string().optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
      }).optional()
    )
    .query(async ({ input }) => {
      return db.getDetections(input ?? {});
    }),
});

/* ─────────────────────────── Metrics ─────────────────────────── */

const metricsRouter = router({
  responses: publicProcedure
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

  stats: publicProcedure
    .input(z.object({ metricResponseId: z.number() }))
    .query(async ({ input }) => {
      return db.getMetricStats(input.metricResponseId);
    }),

  categories: publicProcedure.query(async () => {
    return db.getMetricCategories();
  }),
});

/* ─────────────────────────── Topology ─────────────────────────── */

const topologyRouter = router({
  latest: publicProcedure.query(async () => {
    return db.getLatestTopology();
  }),
});

/* ─────────────────────────── Reference Data ─────────────────────────── */

const referenceRouter = router({
  deviceGroups: publicProcedure.query(async () => {
    return db.getDeviceGroupsList();
  }),

  applications: publicProcedure.query(async () => {
    return db.getApplications();
  }),

  vlans: publicProcedure.query(async () => {
    return db.getVlans();
  }),

  tags: publicProcedure.query(async () => {
    return db.getTags();
  }),

  networkLocalities: publicProcedure.query(async () => {
    return db.getNetworkLocalities();
  }),

  activityMaps: publicProcedure.query(async () => {
    return db.getActivityMaps();
  }),
});

/* ─────────────────────────── Schema Health ─────────────────────────── */

const schemaRouter = router({
  latestDrift: publicProcedure.query(async () => {
    return db.getLatestDriftLog();
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
  reference: referenceRouter,
  schema: schemaRouter,
});

export type AppRouter = typeof appRouter;
