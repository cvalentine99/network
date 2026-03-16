import { eq, sql, desc, asc, count, and, like, or, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  dimDevice,
  dimAlert,
  dimAppliance,
  dimNetwork,
  dimDeviceGroup,
  dimApplication,
  dimDetection,
  dimDetectionFormat,
  dimTag,
  dimVlan,
  dimNetworkLocality,
  dimActivityMap,
  factMetricResponse,
  factMetricStat,
  factRecordSearch,
  factRecord,
  factDeviceActivity,
  snapDeviceIpaddr,
  snapDeviceDnsname,
  snapDeviceSoftware,
  snapTopology,
  snapTopologyNode,
  snapTopologyEdge,
  bridgeDeviceTag,
  bridgeDeviceDeviceGroup,
  bridgeAlertDevice,
  bridgeAlertDeviceGroup,
  bridgeAlertApplication,
  bridgeAlertNetwork,
  schemaDriftLog,
  applianceConfig,
  savedTopologyViews,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Get the database connection (may return null if DATABASE_URL is not set).
 * Use requireDb() in data-path functions to throw a typed error instead of
 * silently returning empty data. (audit C6)
 */
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

/**
 * DATABASE_UNAVAILABLE error class for typed error handling.
 * tRPC procedures catch this and return INTERNAL_SERVER_ERROR to the UI,
 * which can then distinguish "no data" from "database unreachable". (audit C6)
 */
export class DatabaseUnavailableError extends Error {
  public readonly code = 'DATABASE_UNAVAILABLE' as const;
  constructor() {
    super('Database connection is not available');
    this.name = 'DatabaseUnavailableError';
  }
}

/**
 * Get the database connection or throw DatabaseUnavailableError.
 * All data-path functions should use this instead of getDb() + silent null return.
 * (audit C6: replaces 49 silent null/empty returns with a proper error signal)
 */
export async function requireDb() {
  const db = await getDb();
  if (!db) throw new DatabaseUnavailableError();
  return db;
}

/* ─────────────────────────── User helpers (kept for framework) ─────────────────────────── */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
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
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ─────────────────────────── Dashboard Overview ─────────────────────────── */

export async function getDashboardStats() {
  const db = await requireDb();

  const [deviceCount] = await db.select({ count: count() }).from(dimDevice);
  const [alertCount] = await db.select({ count: count() }).from(dimAlert);
  const [applianceCount] = await db.select({ count: count() }).from(dimAppliance);
  const [networkCount] = await db.select({ count: count() }).from(dimNetwork);
  const [detectionCount] = await db.select({ count: count() }).from(dimDetection);
  const [activeDeviceCount] = await db.select({ count: count() }).from(dimDevice).where(isNotNull(dimDevice.lastSeenTime));
  const [criticalDeviceCount] = await db.select({ count: count() }).from(dimDevice).where(eq(dimDevice.critical, true));
  const [watchlistCount] = await db.select({ count: count() }).from(dimDevice).where(eq(dimDevice.onWatchlist, true));

  return {
    totalDevices: deviceCount?.count ?? 0,
    activeDevices: activeDeviceCount?.count ?? 0,
    criticalDevices: criticalDeviceCount?.count ?? 0,
    watchlistDevices: watchlistCount?.count ?? 0,
    totalAlerts: alertCount?.count ?? 0,
    totalAppliances: applianceCount?.count ?? 0,
    totalNetworks: networkCount?.count ?? 0,
    totalDetections: detectionCount?.count ?? 0,
  };
}

export async function getAlertsBySeverity() {
  const db = await requireDb();
  const results = await db
    .select({ severity: dimAlert.severity, count: count() })
    .from(dimAlert)
    .groupBy(dimAlert.severity)
    .orderBy(asc(dimAlert.severity));
  return results;
}

export async function getDevicesByClass() {
  const db = await requireDb();
  const cnt = count();
  const results = await db
    .select({ deviceClass: dimDevice.deviceClass, count: cnt })
    .from(dimDevice)
    .groupBy(dimDevice.deviceClass)
    .orderBy(desc(cnt));
  return results;
}

export async function getDevicesByRole() {
  const db = await requireDb();
  const cnt = count();
  const results = await db
    .select({ role: dimDevice.role, count: cnt })
    .from(dimDevice)
    .groupBy(dimDevice.role)
    .orderBy(desc(cnt));
  return results;
}

export async function getDevicesByAnalysis() {
  const db = await requireDb();
  const cnt = count();
  const results = await db
    .select({ analysis: dimDevice.analysis, count: cnt })
    .from(dimDevice)
    .groupBy(dimDevice.analysis)
    .orderBy(desc(cnt));
  return results;
}

/* ─────────────────────────── Devices ─────────────────────────── */

export async function getDevices(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  deviceClass?: string;
  role?: string;
  analysis?: string;
  critical?: boolean;
  onWatchlist?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const db = await requireDb();

  const conditions = [];
  if (opts?.search) {
    const s = `%${opts.search}%`;
    conditions.push(
      or(
        like(dimDevice.displayName, s),
        like(dimDevice.ipaddr4, s),
        like(dimDevice.macaddr, s),
        like(dimDevice.dnsName, s),
        like(dimDevice.vendor, s),
      )
    );
  }
  if (opts?.deviceClass) conditions.push(eq(dimDevice.deviceClass, opts.deviceClass));
  if (opts?.role) conditions.push(eq(dimDevice.role, opts.role));
  if (opts?.analysis) conditions.push(eq(dimDevice.analysis, opts.analysis));
  if (opts?.critical !== undefined) conditions.push(eq(dimDevice.critical, opts.critical));
  if (opts?.onWatchlist !== undefined) conditions.push(eq(dimDevice.onWatchlist, opts.onWatchlist));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortCol = (() => {
    switch (opts?.sortBy) {
      case "displayName": return dimDevice.displayName;
      case "ipaddr4": return dimDevice.ipaddr4;
      case "deviceClass": return dimDevice.deviceClass;
      case "role": return dimDevice.role;
      case "vendor": return dimDevice.vendor;
      case "analysis": return dimDevice.analysis;
      case "lastSeenTime": return dimDevice.lastSeenTime;
      case "discoverTime": return dimDevice.discoverTime;
      default: return dimDevice.displayName;
    }
  })();
  const orderDir = opts?.sortDir === "desc" ? desc(sortCol) : asc(sortCol);

  const [totalResult] = await db.select({ count: count() }).from(dimDevice).where(where);
  const rows = await db
    .select()
    .from(dimDevice)
    .where(where)
    .orderBy(orderDir)
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);

  return { rows, total: totalResult?.count ?? 0 };
}

export async function getDeviceById(id: number) {
  const db = await requireDb();
  const [device] = await db.select().from(dimDevice).where(eq(dimDevice.id, id)).limit(1);
  return device ?? null;
}

export async function getDeviceIps(deviceId: number) {
  const db = await requireDb();
  return db.select().from(snapDeviceIpaddr).where(and(eq(snapDeviceIpaddr.deviceId, deviceId), eq(snapDeviceIpaddr.isCurrent, true)));
}

export async function getDeviceDnsNames(deviceId: number) {
  const db = await requireDb();
  return db.select().from(snapDeviceDnsname).where(and(eq(snapDeviceDnsname.deviceId, deviceId), eq(snapDeviceDnsname.isCurrent, true)));
}

export async function getDeviceSoftware(deviceId: number) {
  const db = await requireDb();
  return db.select().from(snapDeviceSoftware).where(and(eq(snapDeviceSoftware.deviceId, deviceId), eq(snapDeviceSoftware.isCurrent, true)));
}

export async function getDeviceTags(deviceId: number) {
  const db = await requireDb();
  return db
    .select({ tagId: bridgeDeviceTag.tagId, tagName: dimTag.name })
    .from(bridgeDeviceTag)
    .innerJoin(dimTag, eq(dimTag.id, bridgeDeviceTag.tagId))
    .where(eq(bridgeDeviceTag.deviceId, deviceId));
}

export async function getDeviceGroups(deviceId: number) {
  const db = await requireDb();
  return db
    .select({ groupId: bridgeDeviceDeviceGroup.deviceGroupId, groupName: dimDeviceGroup.name })
    .from(bridgeDeviceDeviceGroup)
    .innerJoin(dimDeviceGroup, eq(dimDeviceGroup.id, bridgeDeviceDeviceGroup.deviceGroupId))
    .where(eq(bridgeDeviceDeviceGroup.deviceId, deviceId));
}

export async function getDeviceActivity(deviceId: number, limit = 20) {
  const db = await requireDb();
  return db
    .select()
    .from(factDeviceActivity)
    .where(eq(factDeviceActivity.deviceId, deviceId))
    .orderBy(desc(factDeviceActivity.fromTime))
    .limit(limit);
}

/**
 * Upsert device activity records from ExtraHop GET /api/v1/devices/{id}/activity.
 * Uses activity_id (= raw ExtraHop record id) as the deduplication key.
 * Returns the count of rows upserted.
 */
export async function upsertDeviceActivity(
  records: Array<{
    rawId: number;
    activityId: number;
    deviceId: number;
    fromTime: number;
    untilTime: number;
    modTime: number;
    statName: string;
    polledAt: Date;
  }>
): Promise<number> {
  const db = await requireDb();
  if (!db || records.length === 0) return 0;

  let upserted = 0;
  // Process in batches of 50 to avoid query size limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await db.insert(factDeviceActivity).values(batch).onDuplicateKeyUpdate({
      set: {
        fromTime: sql`VALUES(from_time)`,
        untilTime: sql`VALUES(until_time)`,
        modTime: sql`VALUES(mod_time)`,
        statName: sql`VALUES(stat_name)`,
        polledAt: sql`VALUES(polled_at)`,
      },
    });
    upserted += batch.length;
  }
  return upserted;
}

/**
 * Compute activity summary for a device from fact_device_activity.
 * Returns totalProtocols (distinct stat_name count) and totalConnections (total records).
 */
export async function getDeviceActivitySummary(deviceId: number): Promise<{
  totalProtocols: number;
  totalConnections: number;
}> {
  const db = await requireDb();

  const [result] = await db
    .select({
      totalProtocols: sql<number>`COUNT(DISTINCT ${factDeviceActivity.statName})`,
      totalConnections: sql<number>`COUNT(*)`,
    })
    .from(factDeviceActivity)
    .where(eq(factDeviceActivity.deviceId, deviceId));

  return {
    totalProtocols: Number(result?.totalProtocols) || 0,
    totalConnections: Number(result?.totalConnections) || 0,
  };
}

/* ─────────────────────────── Alerts ─────────────────────────── */

export async function getAlerts(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  severity?: number;
  type?: string;
  disabled?: boolean;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const db = await requireDb();

  const conditions = [];
  if (opts?.search) {
    const s = `%${opts.search}%`;
    conditions.push(or(like(dimAlert.name, s), like(dimAlert.statName, s)));
  }
  if (opts?.severity !== undefined) conditions.push(eq(dimAlert.severity, opts.severity));
  if (opts?.type) conditions.push(eq(dimAlert.type, opts.type));
  if (opts?.disabled !== undefined) conditions.push(eq(dimAlert.disabled, opts.disabled));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortCol = (() => {
    switch (opts?.sortBy) {
      case "name": return dimAlert.name;
      case "severity": return dimAlert.severity;
      case "type": return dimAlert.type;
      case "statName": return dimAlert.statName;
      default: return dimAlert.severity;
    }
  })();
  const orderDir = opts?.sortDir === "desc" ? desc(sortCol) : asc(sortCol);

  const [totalResult] = await db.select({ count: count() }).from(dimAlert).where(where);
  const rows = await db.select().from(dimAlert).where(where).orderBy(orderDir).limit(opts?.limit ?? 50).offset(opts?.offset ?? 0);

  return { rows, total: totalResult?.count ?? 0 };
}

export async function getAlertById(id: number) {
  const db = await requireDb();
  const [alert] = await db.select().from(dimAlert).where(eq(dimAlert.id, id)).limit(1);
  return alert ?? null;
}

/* ─────────────────────────── Appliances ─────────────────────────── */

export async function getAppliances() {
  const db = await requireDb();
  return db.select().from(dimAppliance).orderBy(asc(dimAppliance.displayName));
}

export async function getApplianceById(id: number) {
  const db = await requireDb();
  const [appliance] = await db.select().from(dimAppliance).where(eq(dimAppliance.id, id)).limit(1);
  return appliance ?? null;
}

/* ─────────────────────────── Networks ─────────────────────────── */

export async function getNetworks() {
  const db = await requireDb();
  return db.select().from(dimNetwork).orderBy(asc(dimNetwork.name));
}

/* ─────────────────────────── Device Groups ─────────────────────────── */

export async function getDeviceGroupsList() {
  const db = await requireDb();
  return db.select().from(dimDeviceGroup).orderBy(asc(dimDeviceGroup.name));
}

/* ─────────────────────────── Applications ─────────────────────────── */

export async function getApplications() {
  const db = await requireDb();
  return db.select().from(dimApplication).orderBy(asc(dimApplication.displayName));
}

/* ─────────────────────────── Detections ─────────────────────────── */

export async function getDetections(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}) {
  const db = await requireDb();

  const conditions = [];
  if (opts?.search) {
    const s = `%${opts.search}%`;
    conditions.push(or(like(dimDetection.title, s), like(dimDetection.type, s)));
  }
  if (opts?.status) conditions.push(eq(dimDetection.status, opts.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortCol = (() => {
    switch (opts?.sortBy) {
      case "title": return dimDetection.title;
      case "riskScore": return dimDetection.riskScore;
      case "status": return dimDetection.status;
      case "startTime": return dimDetection.startTime;
      case "createTime": return dimDetection.createTime;
      default: return dimDetection.riskScore;
    }
  })();
  const orderDir = opts?.sortDir === "desc" ? desc(sortCol) : asc(sortCol);

  const [totalResult] = await db.select({ count: count() }).from(dimDetection).where(where);
  const rows = await db.select().from(dimDetection).where(where).orderBy(orderDir).limit(opts?.limit ?? 50).offset(opts?.offset ?? 0);

  return { rows, total: totalResult?.count ?? 0 };
}

/* ─────────────────────────── Metrics ─────────────────────────── */

export async function getMetricResponses(opts?: {
  limit?: number;
  offset?: number;
  category?: string;
  objectType?: string;
}) {
  const db = await requireDb();

  const conditions = [];
  if (opts?.category) conditions.push(eq(factMetricResponse.metricCategory, opts.category));
  if (opts?.objectType) conditions.push(eq(factMetricResponse.objectType, opts.objectType));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db.select({ count: count() }).from(factMetricResponse).where(where);
  const rows = await db
    .select()
    .from(factMetricResponse)
    .where(where)
    .orderBy(desc(factMetricResponse.polledAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);

  return { rows, total: totalResult?.count ?? 0 };
}

export async function getMetricStats(metricResponseId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(factMetricStat)
    .where(eq(factMetricStat.metricResponseId, metricResponseId))
    .orderBy(desc(factMetricStat.statTime));
}

export async function getMetricCategories() {
  const db = await requireDb();
  const cnt = count();
  const results = await db
    .select({ category: factMetricResponse.metricCategory, count: cnt })
    .from(factMetricResponse)
    .groupBy(factMetricResponse.metricCategory)
    .orderBy(desc(cnt));
  return results;
}

/* ─────────────────────────── Topology───────────────────────── */

export async function getVlans() {
  const db = await requireDb();
  return db.select().from(dimVlan).orderBy(asc(dimVlan.vlanid));
}

/* ─────────────────────────── Tags ─────────────────────────── */

export async function getTags() {
  const db = await requireDb();
  return db.select().from(dimTag).orderBy(asc(dimTag.name));
}

/* ─────────────────────────── Network Localities ─────────────────────────── */

export async function getNetworkLocalities() {
  const db = await requireDb();
  return db.select().from(dimNetworkLocality).orderBy(asc(dimNetworkLocality.name));
}

/* ─────────────────────────── Activity Maps ─────────────────────────── */

export async function getActivityMaps() {
  const db = await requireDb();
  return db.select().from(dimActivityMap).orderBy(asc(dimActivityMap.name));
}

/* ─────────────────────────── Topology ─────────────────────────── */

/**
 * Get the latest topology snapshot from snap_topology tables.
 * NOT IMPLEMENTED: No ETL process currently populates these tables.
 * Will always return null until a topology snapshot ETL is built. (audit H3)
 */
export async function getLatestTopology() {
  const db = await requireDb();
  const [latest] = await db.select().from(snapTopology).orderBy(desc(snapTopology.polledAt)).limit(1);
  if (!latest) return null;
  const nodes = await db.select().from(snapTopologyNode).where(eq(snapTopologyNode.topologyId, latest.id));
  const edges = await db.select().from(snapTopologyEdge).where(eq(snapTopologyEdge.topologyId, latest.id));
  return { topology: latest, nodes, edges };
}

/* ─────────────────────────── Records ─────────────────────────── */

/**
 * DEAD CODE: No tRPC route or Express endpoint calls this function.
 * The fact_record_search table exists but no ETL populates it.
 * Kept for future Records feature. (audit H6)
 */
export async function getRecordSearches(opts?: { limit?: number; offset?: number }) {
  const db = await requireDb();
  const [totalResult] = await db.select({ count: count() }).from(factRecordSearch);
  const rows = await db
    .select()
    .from(factRecordSearch)
    .orderBy(desc(factRecordSearch.polledAt))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
  return { rows, total: totalResult?.count ?? 0 };
}

/**
 * DEAD CODE: No tRPC route or Express endpoint calls this function.
 * The fact_record table exists but no ETL populates it.
 * Kept for future Records feature. (audit H6)
 */
export async function getRecordsBySearch(searchId: number) {
  const db = await requireDb();
  // Note: original had missing semicolon, fixed here;
  return db.select().from(factRecord).where(eq(factRecord.searchId, searchId));
}

/* ─────────────────────────── Appliance Configuration (Slice 14) ─────────────────────────── */

/**
 * Get the current appliance configuration (only one row expected).
 * Returns null if no configuration exists.
 */
export async function getApplianceConfig() {
  const db = await requireDb();
  const [row] = await db.select().from(applianceConfig).limit(1);
  return row ?? null;
}

/**
 * Upsert the appliance configuration.
 * If a row exists, update it. If not, insert a new one.
 * API key is encrypted at rest using AES-256-GCM (audit C3).
 * Returns the saved row (with encrypted apiKey — callers must use getApplianceConfigDecrypted).
 */
export async function upsertApplianceConfig(input: {
  hostname: string;
  apiKey: string;
  verifySsl: boolean;
  cloudServicesEnabled: boolean;
  nickname: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Encrypt the API key before storing (audit C3)
  const { encryptApiKey } = await import('./crypto');
  const encryptedApiKey = encryptApiKey(input.apiKey);

  const existing = await getApplianceConfig();

  if (existing) {
    await db
      .update(applianceConfig)
      .set({
        hostname: input.hostname,
        apiKey: encryptedApiKey,
        verifySsl: input.verifySsl,
        cloudServicesEnabled: input.cloudServicesEnabled,
        nickname: input.nickname,
        lastTestResult: 'untested',
        lastTestMessage: '',
        lastTestedAt: null,
      })
      .where(eq(applianceConfig.id, existing.id));
    const [updated] = await db.select().from(applianceConfig).where(eq(applianceConfig.id, existing.id)).limit(1);
    return updated;
  } else {
    await db.insert(applianceConfig).values({
      hostname: input.hostname,
      apiKey: encryptedApiKey,
      verifySsl: input.verifySsl,
      cloudServicesEnabled: input.cloudServicesEnabled,
      nickname: input.nickname,
    });
    const [inserted] = await db.select().from(applianceConfig).orderBy(desc(applianceConfig.id)).limit(1);
    return inserted;
  }
}

/**
 * Get appliance config with the API key decrypted.
 * This is the function that should be used by code that needs the actual API key
 * (e.g., ExtraHop client, test connection). (audit C3)
 */
export async function getApplianceConfigDecrypted() {
  const row = await getApplianceConfig();
  if (!row) return null;
  try {
    const { decryptApiKey, isEncryptedApiKey } = await import('./crypto');
    // Handle migration: if the key is not encrypted (legacy plaintext), return as-is
    const apiKey = isEncryptedApiKey(row.apiKey) ? decryptApiKey(row.apiKey) : row.apiKey;
    return { ...row, apiKey };
  } catch {
    // If decryption fails, return the row with the raw value (migration scenario)
    return row;
  }
}

/**
 * Update the test result fields after a connectivity test.
 */
export async function updateApplianceTestResult(input: {
  id: number;
  lastTestResult: 'success' | 'failure';
  lastTestMessage: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db
    .update(applianceConfig)
    .set({
      lastTestResult: input.lastTestResult,
      lastTestMessage: input.lastTestMessage,
      lastTestedAt: new Date(),
    })
    .where(eq(applianceConfig.id, input.id));

  const [updated] = await db.select().from(applianceConfig).where(eq(applianceConfig.id, input.id)).limit(1);
  return updated;
}

/**
 * Delete the appliance configuration (reset to unconfigured state).
 */
export async function deleteApplianceConfig(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(applianceConfig).where(eq(applianceConfig.id, id));
}

/* ─────────────────────────── Schema Health ─────────────────────────── */

/**
 * Called by schemaRouter.latestDrift tRPC route.
 * The schema_drift_log table exists and is populated by bootstrap.sh.
 * Returns null if no drift checks have been run yet. (audit H6 — wired, not dead)
 */
export async function getLatestDriftLog() {
  const db = await requireDb();
  const [latest] = await db.select().from(schemaDriftLog).orderBy(desc(schemaDriftLog.runAt)).limit(1);
  return latest ?? null;
}

/* ─────────────────────────── Saved Topology Views (Slice 35E) ─────────────────────────── */

export async function getSavedTopologyViews(userId: string) {
  const db = await requireDb();
  return db.select().from(savedTopologyViews)
    .where(eq(savedTopologyViews.userId, userId))
    .orderBy(desc(savedTopologyViews.updatedAt));
}

export async function getSavedTopologyViewById(id: number, userId: string) {
  const db = await requireDb();
  const [view] = await db.select().from(savedTopologyViews)
    .where(and(eq(savedTopologyViews.id, id), eq(savedTopologyViews.userId, userId)))
    .limit(1);
  return view ?? null;
}

export async function createSavedTopologyView(input: {
  userId: string;
  name: string;
  viewMode: string;
  zoom: number;
  panX: number;
  panY: number;
  collapsedSubnets: string[];
  roleFilters: string[];
  protocolFilters: string[];
  anomalyOverlayEnabled: boolean;
  anomalyThreshold: number;
  criticalPathSource: number | null;
  criticalPathDestination: number | null;
  searchTerm: string;
  nodePositions?: Record<string, { x: number; y: number }> | null;
}) {
  const db = await requireDb();
  const [result] = await db.insert(savedTopologyViews).values({
    userId: input.userId,
    name: input.name,
    viewMode: input.viewMode,
    zoom: input.zoom,
    panX: input.panX,
    panY: input.panY,
    collapsedSubnets: input.collapsedSubnets,
    roleFilters: input.roleFilters,
    protocolFilters: input.protocolFilters,
    anomalyOverlayEnabled: input.anomalyOverlayEnabled,
    anomalyThreshold: input.anomalyThreshold,
    criticalPathSource: input.criticalPathSource,
    criticalPathDestination: input.criticalPathDestination,
    searchTerm: input.searchTerm,
    nodePositions: input.nodePositions ?? null,
  });
  return result.insertId;
}

export async function updateSavedTopologyView(id: number, userId: string, input: {
  name?: string;
  viewMode?: string;
  zoom?: number;
  panX?: number;
  panY?: number;
  collapsedSubnets?: string[];
  roleFilters?: string[];
  protocolFilters?: string[];
  anomalyOverlayEnabled?: boolean;
  anomalyThreshold?: number;
  criticalPathSource?: number | null;
  criticalPathDestination?: number | null;
  searchTerm?: string;
  nodePositions?: Record<string, { x: number; y: number }> | null;
}) {
  const db = await requireDb();
  const [result] = await db.update(savedTopologyViews)
    .set(input)
    .where(and(eq(savedTopologyViews.id, id), eq(savedTopologyViews.userId, userId)));
  return result.affectedRows > 0;
}

export async function deleteSavedTopologyView(id: number, userId: string) {
  const db = await requireDb();
  const [result] = await db.delete(savedTopologyViews)
    .where(and(eq(savedTopologyViews.id, id), eq(savedTopologyViews.userId, userId)));
  return result.affectedRows > 0;
}
