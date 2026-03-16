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
 *   - AbortController cancels in-flight requests on unmount or deviceId change
 */
import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (deviceId === null) {
      setState({ status: 'loading' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const res = await fetch(`/api/bff/impact/device-detail?id=${deviceId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // Handle 404 — device not found
        if (res.status === 404) {
          const body = await res.json().catch(() => ({ error: 'Device not found', message: `HTTP 404` }));
          if (controller.signal.aborted) return;
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
          if (controller.signal.aborted) return;
          setState({
            status: 'error',
            error: body.error || 'Transport error',
            message: body.message || `HTTP ${res.status}`,
          });
          return;
        }

        const body = await res.json();
        if (controller.signal.aborted) return;

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
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: 'Network error',
          message: err.message || 'Failed to fetch device detail',
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deviceId]);

  return state;
}
