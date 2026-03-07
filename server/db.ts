import { eq, sql, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  devices,
  alerts,
  interfaces,
  performanceMetrics,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User Helpers ────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db
      .insert(users)
      .values(values)
      .onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Device Helpers ──────────────────────────────────────────────────────────

export async function getAllDevices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices).orderBy(devices.name);
}

export async function getDeviceCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(devices);
  return result[0]?.count ?? 0;
}

export async function getDevicesByStatus() {
  const db = await getDb();
  if (!db) return {};
  const result = await db
    .select({
      status: devices.status,
      count: sql<number>`count(*)`,
    })
    .from(devices)
    .groupBy(devices.status);
  const map: Record<string, number> = {};
  for (const row of result) {
    map[row.status] = row.count;
  }
  return map;
}

// ─── Alert Helpers ───────────────────────────────────────────────────────────

export async function getAllAlerts() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: alerts.id,
      deviceId: alerts.deviceId,
      severity: alerts.severity,
      message: alerts.message,
      source: alerts.source,
      acknowledged: alerts.acknowledged,
      resolvedAt: alerts.resolvedAt,
      createdAt: alerts.createdAt,
      deviceName: devices.name,
    })
    .from(alerts)
    .leftJoin(devices, eq(alerts.deviceId, devices.id))
    .orderBy(desc(alerts.createdAt));
  return result;
}

export async function getActiveAlertCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(sql`${alerts.resolvedAt} IS NULL`);
  return result[0]?.count ?? 0;
}

export async function getAlertsBySeverity() {
  const db = await getDb();
  if (!db) return { critical: 0, high: 0, medium: 0, low: 0 };
  const result = await db
    .select({
      severity: alerts.severity,
      count: sql<number>`count(*)`,
    })
    .from(alerts)
    .where(sql`${alerts.resolvedAt} IS NULL`)
    .groupBy(alerts.severity);
  const map: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const row of result) {
    map[row.severity] = row.count;
  }
  return map;
}

export async function getRecentAlerts(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: alerts.id,
      severity: alerts.severity,
      message: alerts.message,
      createdAt: alerts.createdAt,
      deviceName: devices.name,
    })
    .from(alerts)
    .leftJoin(devices, eq(alerts.deviceId, devices.id))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
  return result;
}

// ─── Interface Helpers ───────────────────────────────────────────────────────

export async function getAllInterfaces() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: interfaces.id,
      deviceId: interfaces.deviceId,
      name: interfaces.name,
      interfaceType: interfaces.interfaceType,
      status: interfaces.status,
      speed: interfaces.speed,
      inTraffic: interfaces.inTraffic,
      outTraffic: interfaces.outTraffic,
      mtu: interfaces.mtu,
      deviceName: devices.name,
    })
    .from(interfaces)
    .leftJoin(devices, eq(interfaces.deviceId, devices.id))
    .orderBy(interfaces.name);
  return result;
}

export async function getInterfaceCountByStatus() {
  const db = await getDb();
  if (!db) return { up: 0, down: 0, degraded: 0 };
  const result = await db
    .select({
      status: interfaces.status,
      count: sql<number>`count(*)`,
    })
    .from(interfaces)
    .groupBy(interfaces.status);
  const map: Record<string, number> = { up: 0, down: 0, degraded: 0 };
  for (const row of result) {
    map[row.status] = row.count;
  }
  return map;
}

// ─── Performance Helpers ─────────────────────────────────────────────────────

export async function getAveragePerformanceMetrics() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      avgLatency: sql<number>`AVG(${performanceMetrics.latency})`,
      avgThroughput: sql<number>`AVG(${performanceMetrics.throughput})`,
      avgPacketLoss: sql<number>`AVG(${performanceMetrics.packetLoss})`,
      avgJitter: sql<number>`AVG(${performanceMetrics.jitter})`,
      avgUptime: sql<number>`AVG(${performanceMetrics.uptime})`,
    })
    .from(performanceMetrics);
  return result[0] ?? null;
}

export async function getPerDevicePerformance() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      deviceId: performanceMetrics.deviceId,
      deviceName: devices.name,
      latency: sql<number>`AVG(${performanceMetrics.latency})`,
      throughput: sql<number>`AVG(${performanceMetrics.throughput})`,
      packetLoss: sql<number>`AVG(${performanceMetrics.packetLoss})`,
      jitter: sql<number>`AVG(${performanceMetrics.jitter})`,
      uptime: sql<number>`AVG(${performanceMetrics.uptime})`,
    })
    .from(performanceMetrics)
    .leftJoin(devices, eq(performanceMetrics.deviceId, devices.id))
    .groupBy(performanceMetrics.deviceId, devices.name);
  return result;
}
