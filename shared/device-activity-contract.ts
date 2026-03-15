/**
 * Slice 30 — Device Activity ETL Data Contract
 *
 * SOURCE: ExtraHop REST API
 *   GET /api/v1/devices/{id}/activity
 *
 * ExtraHop response shape (from API docs):
 * [
 *   {
 *     "id": <number>,           // activity record ID (maps to raw_id)
 *     "stat_name": <string>,    // metric category (e.g., "net", "http_client", "dns_client")
 *     "from_time": <number>,    // epoch ms — start of activity window
 *     "until_time": <number>,   // epoch ms — end of activity window
 *     "mod_time": <number>      // epoch ms — last modification time
 *   }
 * ]
 *
 * TARGET: fact_device_activity table
 *   id           BIGINT UNSIGNED AUTO_INCREMENT PK
 *   raw_id       BIGINT UNSIGNED NOT NULL       — ExtraHop activity record ID
 *   activity_id  BIGINT NOT NULL UNIQUE         — deduplication key (= raw_id from EH)
 *   device_id    INT NOT NULL                   — ExtraHop device ID
 *   from_time    BIGINT NOT NULL                — epoch ms
 *   until_time   BIGINT NOT NULL                — epoch ms
 *   mod_time     BIGINT NOT NULL                — epoch ms
 *   stat_name    VARCHAR(255) NOT NULL          — metric category
 *   polled_at    DATETIME(3) NOT NULL           — when we fetched this data
 *
 * CONSUMER: getDeviceActivity(deviceId, limit) in server/db.ts
 *   → returns rows ordered by from_time DESC
 *   → consumed by tRPC devices.byId procedure
 *   → consumed by BFF device-detail route for activitySummary computation
 *
 * ETL FLOW:
 *   1. BFF device-detail route (live mode) calls GET /api/v1/devices/{id}/activity
 *   2. normalizeDeviceActivity() transforms raw EH response → DeviceActivityRecord[]
 *   3. upsertDeviceActivity() inserts/updates rows in fact_device_activity (dedup on activity_id)
 *   4. activitySummary is computed from the activity records:
 *      - totalProtocols = count of distinct stat_name values
 *      - totalConnections = count of activity records
 *      - peakThroughputBps = null (not derivable from activity endpoint alone)
 *
 * FIXTURE MODE: Returns fixture data from device-detail.populated.fixture.json (unchanged)
 * LIVE MODE: Calls ExtraHop API, upserts to DB, computes summary from real data
 */

import { z } from 'zod';

// ─── ExtraHop Raw Response Shape ────────────────────────────────────────

/** Raw shape returned by GET /api/v1/devices/{id}/activity */
export const EhDeviceActivityRecordSchema = z.object({
  id: z.number(),
  stat_name: z.string(),
  from_time: z.number(),
  until_time: z.number(),
  mod_time: z.number(),
});

export type EhDeviceActivityRecord = z.infer<typeof EhDeviceActivityRecordSchema>;

/** Full response is an array */
export const EhDeviceActivityResponseSchema = z.array(EhDeviceActivityRecordSchema);

export type EhDeviceActivityResponse = z.infer<typeof EhDeviceActivityResponseSchema>;

// ─── Normalized Shape (for DB insert) ───────────────────────────────────

/** Shape after normalization, ready for DB upsert */
export const DeviceActivityRowSchema = z.object({
  rawId: z.number(),
  activityId: z.number(),
  deviceId: z.number().int(),
  fromTime: z.number(),
  untilTime: z.number(),
  modTime: z.number(),
  statName: z.string().min(1),
  polledAt: z.date(),
});

export type DeviceActivityRow = z.infer<typeof DeviceActivityRowSchema>;

// ─── Activity Summary (computed from activity records) ──────────────────

/** Computed from the activity records for the device-detail response */
export const DeviceActivitySummarySchema = z.object({
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  totalProtocols: z.number().int().nonnegative(),
  totalConnections: z.number().int().nonnegative(),
  peakThroughputBps: z.number().nullable(),
});

export type DeviceActivitySummary = z.infer<typeof DeviceActivitySummarySchema>;

// ─── ETL Result ─────────────────────────────────────────────────────────

/** Result of the ETL operation */
export const DeviceActivityEtlResultSchema = z.object({
  deviceId: z.number().int(),
  recordsFetched: z.number().int().nonnegative(),
  recordsUpserted: z.number().int().nonnegative(),
  distinctProtocols: z.number().int().nonnegative(),
  summary: DeviceActivitySummarySchema,
});

export type DeviceActivityEtlResult = z.infer<typeof DeviceActivityEtlResultSchema>;
