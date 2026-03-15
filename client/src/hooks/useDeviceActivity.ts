/**
 * useDeviceActivity — BFF hook for the Device Activity Timeline.
 *
 * Fetches GET /api/bff/impact/device-activity?id=<deviceId>&limit=<limit>
 * Returns activity rows for the timeline visualization.
 *
 * Slice 31 — Contract:
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Returns discriminated union: loading | populated | quiet | error
 *   - Refetches when deviceId changes
 */
import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ActivityRow {
  activityId: number;
  deviceId: number;
  statName: string;
  fromTime: number;
  untilTime: number;
  modTime: number;
}

export type DeviceActivityState =
  | { status: 'loading' }
  | { status: 'populated'; rows: ActivityRow[] }
  | { status: 'quiet' }
  | { status: 'error'; error: string; message: string };

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
      const rows: ActivityRow[] = Array.isArray(body.activityRows) ? body.activityRows : [];

      if (rows.length === 0) {
        setState({ status: 'quiet' });
      } else {
        setState({ status: 'populated', rows });
      }
    } catch (err: any) {
      setState({
        status: 'error',
        error: 'Network error',
        message: err.message || 'Failed to fetch device activity',
      });
    }
  }, [deviceId, limit]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return state;
}
