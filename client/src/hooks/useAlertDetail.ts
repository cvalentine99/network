/**
 * useAlertDetail — BFF hook for the Alert Detail Inspector Pane.
 *
 * Fetches GET /api/bff/impact/alert-detail?id=<alertId>
 * Returns AlertDetailState discriminated union (loading | quiet | populated | error | malformed | not-found).
 *
 * Contract:
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Validates response via AlertDetailSchema before passing to component
 *   - Empty triggerHistory/associatedDevices/associatedDetections arrays = quiet state (not error)
 *   - 404 = not-found state (distinct from error)
 *   - Refetches when alertId changes
 *   - AbortController cancels in-flight requests on unmount or alertId change
 */
import { useState, useEffect } from 'react';
import { AlertDetailSchema } from '../../../shared/cockpit-validators';
import type { AlertDetail } from '../../../shared/cockpit-types';

// ─── State union ─────────────────────────────────────────────────────────
export type AlertDetailState =
  | { status: 'loading' }
  | { status: 'quiet'; alertDetail: AlertDetail }
  | { status: 'populated'; alertDetail: AlertDetail }
  | { status: 'error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string; details: string }
  | { status: 'not-found'; error: string; message: string };

/**
 * Determine whether an AlertDetail represents a quiet alert (no enrichment).
 * An alert is quiet when it has no trigger history, no associated devices, and no associated detections.
 */
export function isQuietAlert(detail: AlertDetail): boolean {
  return (
    detail.triggerHistory.length === 0 &&
    detail.associatedDevices.length === 0 &&
    detail.associatedDetections.length === 0
  );
}

export function useAlertDetail(alertId: number | null): AlertDetailState {
  const [state, setState] = useState<AlertDetailState>({ status: 'loading' });

  useEffect(() => {
    if (alertId === null) {
      setState({ status: 'loading' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const res = await fetch(`/api/bff/impact/alert-detail?id=${alertId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // Handle 404 — alert not found
        if (res.status === 404) {
          const body = await res.json().catch(() => ({ error: 'Alert not found', message: `HTTP 404` }));
          if (controller.signal.aborted) return;
          setState({
            status: 'not-found',
            error: body.error || 'Alert not found',
            message: body.message || `No alert with id ${alertId}`,
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

        const validation = AlertDetailSchema.safeParse(body.alertDetail);

        if (!validation.success) {
          setState({
            status: 'malformed',
            error: 'Data contract violation',
            message: 'Alert detail response failed schema validation',
            details: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          });
          return;
        }

        // Determine quiet vs populated
        if (isQuietAlert(validation.data)) {
          setState({ status: 'quiet', alertDetail: validation.data });
        } else {
          setState({ status: 'populated', alertDetail: validation.data });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: 'Network error',
          message: err instanceof Error ? err.message : 'Failed to fetch alert detail',
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [alertId]);

  return state;
}
