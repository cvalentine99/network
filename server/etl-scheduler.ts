/**
 * Background ETL Scheduler — Device Activity Poller
 *
 * Slice 31 — Periodically fetches device activity from ExtraHop for all known
 * devices in dim_device and upserts into fact_device_activity.
 *
 * CONTRACT:
 *   - Only runs when NOT in fixture mode (isFixtureMode() === false)
 *   - Per-device failure isolation: one device failure does not stop the batch
 *   - Configurable interval via ETL_INTERVAL_MS env var (default: 300000 = 5 min)
 *   - Exposes status for the health endpoint (last run, devices polled, records upserted)
 *   - Does NOT block server startup — runs asynchronously after server is listening
 *   - Graceful shutdown via stopEtlScheduler()
 */

import { isFixtureModeSync, ehRequest } from './extrahop-client';
import { normalizeDeviceActivity } from './extrahop-normalizers';
import { upsertDeviceActivity, requireDb } from './db';
import { dimDevice } from '../drizzle/schema';
import { isNotNull } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────

export interface EtlJobStatus {
  running: boolean;
  lastRunAt: string | null;
  lastRunDurationMs: number;
  lastRunDevicesPolled: number;
  lastRunDevicesSucceeded: number;
  lastRunDevicesFailed: number;
  lastRunRecordsUpserted: number;
  totalRuns: number;
  totalErrors: number;
  intervalMs: number;
  nextRunAt: string | null;
}

// ─── State ────────────────────────────────────────────────────────────────

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

const status: EtlJobStatus = {
  running: false,
  lastRunAt: null,
  lastRunDurationMs: 0,
  lastRunDevicesPolled: 0,
  lastRunDevicesSucceeded: 0,
  lastRunDevicesFailed: 0,
  lastRunRecordsUpserted: 0,
  totalRuns: 0,
  totalErrors: 0,
  intervalMs: 0,
  nextRunAt: null,
};

// ─── Core ETL Function ───────────────────────────────────────────────────

/**
 * Run one ETL cycle: fetch all active device IDs from dim_device,
 * then for each device, GET /api/v1/devices/{id}/activity → normalize → upsert.
 *
 * Returns a summary of the run.
 */
export async function runEtlCycle(): Promise<{
  devicesPolled: number;
  devicesSucceeded: number;
  devicesFailed: number;
  recordsUpserted: number;
  durationMs: number;
  errors: Array<{ deviceId: number; error: string }>;
}> {
  const start = Date.now();
  const errors: Array<{ deviceId: number; error: string }> = [];
  let devicesSucceeded = 0;
  let totalRecordsUpserted = 0;

  // Step 1: Get all active device IDs from dim_device
  const db = await requireDb();

  const devices = await db
    .select({ id: dimDevice.id })
    .from(dimDevice)
    .where(isNotNull(dimDevice.lastSeenTime));

  const deviceIds = devices.map(d => d.id);
  const polledAt = new Date();

  // Step 2: For each device, fetch activity and upsert
  // Process sequentially to avoid overwhelming the ExtraHop appliance
  for (const deviceId of deviceIds) {
    try {
      const activityResponse = await ehRequest<any[]>({
        method: 'GET',
        path: `/api/v1/devices/${deviceId}/activity`,
        cacheTtlMs: 0, // No cache for ETL — we want fresh data
        timeoutMs: 10_000,
      });

      const rawActivity = Array.isArray(activityResponse.data) ? activityResponse.data : [];
      const normalizedRecords = normalizeDeviceActivity(rawActivity, deviceId, polledAt);

      if (normalizedRecords.length > 0) {
        const upserted = await upsertDeviceActivity(normalizedRecords);
        totalRecordsUpserted += upserted;
      }

      devicesSucceeded++;
    } catch (err: any) {
      // Per-device failure isolation — log and continue
      errors.push({
        deviceId,
        error: err.message || 'Unknown error',
      });
    }
  }

  return {
    devicesPolled: deviceIds.length,
    devicesSucceeded,
    devicesFailed: errors.length,
    recordsUpserted: totalRecordsUpserted,
    durationMs: Date.now() - start,
    errors,
  };
}

// ─── Scheduler ───────────────────────────────────────────────────────────

/**
 * Start the background ETL scheduler.
 * Only starts if NOT in fixture mode.
 * Runs the first cycle immediately, then repeats at the configured interval.
 */
export function startEtlScheduler(): void {
  if (isFixtureModeSync()) {
    console.log('[ETL] Fixture mode — background ETL scheduler not started.');
    return;
  }

  const intervalMs = parseInt(process.env.ETL_INTERVAL_MS || '300000', 10);
  if (intervalMs < 30_000) {
    console.warn(`[ETL] Interval ${intervalMs}ms is too short. Minimum is 30000ms. Using 300000ms.`);
  }
  const safeInterval = Math.max(intervalMs, 30_000);

  status.intervalMs = safeInterval;
  status.running = true;

  console.log(`[ETL] Background ETL scheduler started. Interval: ${safeInterval}ms (${(safeInterval / 60000).toFixed(1)} min)`);

  // Run first cycle after a short delay (let server finish startup)
  setTimeout(async () => {
    await executeEtlCycle();

    // Schedule recurring cycles
    intervalHandle = setInterval(async () => {
      await executeEtlCycle();
    }, safeInterval);
  }, 5_000);
}

/**
 * Execute a single ETL cycle with status tracking and error isolation.
 */
async function executeEtlCycle(): Promise<void> {
  if (isRunning) {
    console.log('[ETL] Previous cycle still running — skipping this tick.');
    return;
  }

  isRunning = true;
  status.totalRuns++;

  try {
    const result = await runEtlCycle();

    status.lastRunAt = new Date().toISOString();
    status.lastRunDurationMs = result.durationMs;
    status.lastRunDevicesPolled = result.devicesPolled;
    status.lastRunDevicesSucceeded = result.devicesSucceeded;
    status.lastRunDevicesFailed = result.devicesFailed;
    status.lastRunRecordsUpserted = result.recordsUpserted;

    if (result.errors.length > 0) {
      status.totalErrors += result.errors.length;
      console.warn(`[ETL] Cycle complete: ${result.devicesSucceeded}/${result.devicesPolled} devices OK, ${result.errors.length} failed, ${result.recordsUpserted} records upserted (${result.durationMs}ms)`);
      for (const err of result.errors.slice(0, 5)) {
        console.warn(`[ETL]   Device ${err.deviceId}: ${err.error}`);
      }
      if (result.errors.length > 5) {
        console.warn(`[ETL]   ... and ${result.errors.length - 5} more errors`);
      }
    } else {
      console.log(`[ETL] Cycle complete: ${result.devicesPolled} devices, ${result.recordsUpserted} records upserted (${result.durationMs}ms)`);
    }
  } catch (err: any) {
    status.totalErrors++;
    console.error(`[ETL] Cycle failed: ${err.message || 'Unknown error'}`);
  } finally {
    isRunning = false;
    if (status.running && status.intervalMs > 0) {
      status.nextRunAt = new Date(Date.now() + status.intervalMs).toISOString();
    }
  }
}

/**
 * Stop the background ETL scheduler.
 */
export function stopEtlScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  status.running = false;
  status.nextRunAt = null;
  console.log('[ETL] Background ETL scheduler stopped.');
}

/**
 * Get the current ETL job status for the health endpoint.
 */
export function getEtlStatus(): EtlJobStatus {
  return { ...status };
}
