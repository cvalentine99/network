/**
 * useDeviceActivity — BFF hook for the Device Activity Timeline.
 *
 * Fetches GET /api/bff/impact/device-activity?id=<deviceId>&limit=<limit>
 * Returns activity rows for the timeline visualization.
 *
 * Slice 31 — Contract:
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Returns discriminated union: loading | populated | quiet | error | malformed
 *   - Refetches when deviceId changes
 *   - Validates response with Zod schema (audit M2)
 */
import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';

// ─── Zod Schema for BFF response validation (audit M2) ──────────────────

const ActivityRowSchema = z.object({
  activityId: z.number(),
  deviceId: z.number().int(),
  statName: z.string(),
  fromTime: z.number(),
  untilTime: z.number(),
  modTime: z.number(),
});

const BffResponseSchema = z.object({
  activityRows: z.array(ActivityRowSchema),
});

// ─── Types ────────────────────────────────────────────────────────────────

export type ActivityRow = z.infer<typeof ActivityRowSchema>;

export type DeviceActivityState =
  | { status: 'loading' }
  | { status: 'populated'; rows: ActivityRow[] }
  | { status: 'quiet' }
  | { status: 'error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string };

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useDeviceActivity(deviceId: number | null, limit = 50): DeviceActivityState {
  const [state, setState] = useState<DeviceActivityState>({ status: 'loading' });

  const fetchActivity = useCallback(async () => {
    if (deviceId === null) {
      setState({ status: 'loading' });
      return;
    }

    setState({ status: 'loading' });

    try {
      const res = await fetch(`/api/bff/impact/device-activity?id=${deviceId}&limit=${limit}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Transport error', message: `HTTP ${res.status}` }));
        setState({
          status: 'error',
          error: body.error || 'Transport error',
          message: body.message || `HTTP ${res.status}`,
        });
        return;
      }

      const body = await res.json();

      // Validate response shape with Zod (audit M2)
      const parsed = BffResponseSchema.safeParse(body);
      if (!parsed.success) {
        console.error('[useDeviceActivity] Response validation failed:', parsed.error.issues);
        setState({
          status: 'malformed',
          error: 'Malformed response',
          message: `BFF response failed schema validation: ${parsed.error.issues.map(i => i.message).join('; ')}`,
        });
        return;
      }

      const rows = parsed.data.activityRows;

      if (rows.length === 0) {
        setState({ status: 'quiet' });
      } else {
        setState({ status: 'populated', rows });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch device activity';
      setState({
        status: 'error',
        error: 'Network error',
        message,
      });
    }
  }, [deviceId, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return state;
}
