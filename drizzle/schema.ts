import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  bigint,
} from "drizzle-orm/mysql-core";

/**
 * Core user table (kept for potential future auth).
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Network devices — routers, switches, firewalls, APs, servers, etc.
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  macAddress: varchar("macAddress", { length: 17 }),
  deviceType: varchar("deviceType", { length: 64 }),
  manufacturer: varchar("manufacturer", { length: 128 }),
  model: varchar("model", { length: 128 }),
  osVersion: varchar("osVersion", { length: 128 }),
  location: varchar("location", { length: 255 }),
  status: mysqlEnum("status", ["online", "offline", "warning", "maintenance"])
    .default("offline")
    .notNull(),
  lastSeen: timestamp("lastSeen"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

/**
 * Network alerts — severity-based alerting system.
 */
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId"),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low"])
    .default("medium")
    .notNull(),
  message: text("message").notNull(),
  source: varchar("source", { length: 128 }),
  acknowledged: int("acknowledged").default(0).notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

/**
 * Network interfaces — ports, VLANs, tunnels on devices.
 */
export const interfaces = mysqlTable("interfaces", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId"),
  name: varchar("name", { length: 255 }).notNull(),
  interfaceType: varchar("interfaceType", { length: 64 }),
  status: mysqlEnum("status", ["up", "down", "degraded"]).default("down").notNull(),
  speed: bigint("speed", { mode: "number" }),
  inTraffic: bigint("inTraffic", { mode: "number" }),
  outTraffic: bigint("outTraffic", { mode: "number" }),
  mtu: int("mtu"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Interface = typeof interfaces.$inferSelect;
export type InsertInterface = typeof interfaces.$inferInsert;

/**
 * Performance metrics — latency, throughput, packet loss, jitter, uptime per device.
 */
export const performanceMetrics = mysqlTable("performance_metrics", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId"),
  latency: float("latency"),
  throughput: bigint("throughput", { mode: "number" }),
  packetLoss: float("packetLoss"),
  jitter: float("jitter"),
  uptime: float("uptime"),
  measuredAt: timestamp("measuredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = typeof performanceMetrics.$inferInsert;
