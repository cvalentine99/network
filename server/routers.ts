import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

const networkRouter = router({
  overview: publicProcedure.query(async () => {
    const [
      totalDevices,
      activeAlerts,
      interfaceStatus,
      alertsBySeverity,
      recentAlerts,
      devicesByStatus,
      avgMetrics,
    ] = await Promise.all([
      db.getDeviceCount(),
      db.getActiveAlertCount(),
      db.getInterfaceCountByStatus(),
      db.getAlertsBySeverity(),
      db.getRecentAlerts(8),
      db.getDevicesByStatus(),
      db.getAveragePerformanceMetrics(),
    ]);

    return {
      totalDevices,
      activeAlerts,
      interfacesUp: interfaceStatus.up ?? 0,
      interfacesDown: (interfaceStatus.down ?? 0) + (interfaceStatus.degraded ?? 0),
      avgLatency: avgMetrics?.avgLatency ?? null,
      avgThroughput: avgMetrics?.avgThroughput ?? null,
      alertsBySeverity,
      recentAlerts,
      devicesByStatus,
    };
  }),

  devices: publicProcedure.query(async () => {
    return db.getAllDevices();
  }),

  alerts: publicProcedure.query(async () => {
    return db.getAllAlerts();
  }),

  interfaces: publicProcedure.query(async () => {
    return db.getAllInterfaces();
  }),

  performanceMetrics: publicProcedure.query(async () => {
    const [avgMetrics, deviceMetrics] = await Promise.all([
      db.getAveragePerformanceMetrics(),
      db.getPerDevicePerformance(),
    ]);

    return {
      avgLatency: avgMetrics?.avgLatency ?? null,
      avgThroughput: avgMetrics?.avgThroughput ?? null,
      avgPacketLoss: avgMetrics?.avgPacketLoss ?? null,
      avgUptime: avgMetrics?.avgUptime ?? null,
      avgJitter: avgMetrics?.avgJitter ?? null,
      deviceMetrics,
    };
  }),
});

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
  network: networkRouter,
});

export type AppRouter = typeof appRouter;
