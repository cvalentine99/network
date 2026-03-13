/**
 * useDeviceDetail — BFF hook for the Device Detail Inspector Pane.
 *
 * Fetches GET /api/bff/impact/device-detail?id=<deviceId>
 * Returns DeviceDetailState discriminated union (loading | quiet | populated | error | malformed | not-found).
 *
 * Contract:
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Validates response via DeviceDetailSchema before passing to component
 *   - Empty protocols/detections/alerts arrays = quiet state (not error)
 *   - 404 = not-found state (distinct from error)
 *   - Refetches when deviceId changes
 */
import { useState, useEffect, useCallback } from 'react';
import { DeviceDetailSchema } from '../../../shared/cockpit-validators';
import type { DeviceDetail } from '../../../shared/cockpit-types';

// ─── State union ─────────────────────────────────────────────────────────
export type DeviceDetailState =
  | { status: 'loading' }
  | { status: 'quiet'; deviceDetail: DeviceDetail }
  | { status: 'populated'; deviceDetail: DeviceDetail }
  | { status: 'error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string; details: string }
  | { status: 'not-found'; error: string; message: string };

/**
 * Determine whether a DeviceDetail represents a quiet device (no activity).
 * A device is quiet when it has zero traffic, no protocols, no detections, and no alerts.
 */
export function isQuietDevice(detail: DeviceDetail): boolean {
  return (
    detail.traffic.totalBytes === 0 &&
    detail.protocols.length === 0 &&
    detail.associatedDetections.length === 0 &&
    detail.associatedAlerts.length === 0
  );
}

export function useDeviceDetail(deviceId: number | null): DeviceDetailState {
  const [state, setState] = useState<DeviceDetailState>({ status: 'loading' });

  const fetchDetail = useCallback(async () => {
    if (deviceId === null) {
      setState({ status: 'loading' });
      return;
    }

    setState({ status: 'loading' });

    try {
      const res = await fetch(`/api/bff/impact/device-detail?id=${deviceId}`);

      // Handle 404 — device not found
      if (res.status === 404) {
        const body = await res.json().catch(() => ({ error: 'Device not found', message: `HTTP 404` }));
        setState({
          status: 'not-found',
          error: body.error || 'Device not found',
          message: body.message || `No device with id ${deviceId}`,
        });
        return;
      }

      // Handle other non-OK statuses
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
      const validation = DeviceDetailSchema.safeParse(body.deviceDetail);

      if (!validation.success) {
        setState({
          status: 'malformed',
          error: 'Data contract violation',
          message: 'Device detail response failed schema validation',
          details: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
        return;
      }

      // Determine quiet vs populated
      if (isQuietDevice(validation.data)) {
        setState({ status: 'quiet', deviceDetail: validation.data });
      } else {
        setState({ status: 'populated', deviceDetail: validation.data });
      }
    } catch (err: any) {
      setState({
        status: 'error',
        error: 'Network error',
        message: err.message || 'Failed to fetch device detail',
      });
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return state;
}
