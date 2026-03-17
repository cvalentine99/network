/**
 * useDetectionDetail — BFF hook for the Detection Detail Inspector Pane.
 *
 * Fetches GET /api/bff/impact/detection-detail?id=<detectionId>
 * Returns DetectionDetailState discriminated union (loading | quiet | populated | error | malformed | not-found).
 *
 * Contract:
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Validates response via DetectionDetailSchema before passing to component
 *   - Empty relatedDevices/relatedAlerts/notes/timeline arrays = quiet state (not error)
 *   - 404 = not-found state (distinct from error)
 *   - Refetches when detectionId changes
 *   - AbortController cancels in-flight requests on unmount or detectionId change
 */
import { useState, useEffect } from 'react';
import { DetectionDetailSchema } from '../../../shared/cockpit-validators';
import type { DetectionDetail } from '../../../shared/cockpit-types';

// ─── State union ─────────────────────────────────────────────────────────
export type DetectionDetailState =
  | { status: 'loading' }
  | { status: 'quiet'; detectionDetail: DetectionDetail }
  | { status: 'populated'; detectionDetail: DetectionDetail }
  | { status: 'error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string; details: string }
  | { status: 'not-found'; error: string; message: string };

/**
 * Determine whether a DetectionDetail represents a quiet detection (no enrichment).
 * A detection is quiet when it has no related devices, no related alerts, no notes, and no timeline events.
 */
export function isQuietDetection(detail: DetectionDetail): boolean {
  return (
    detail.relatedDevices.length === 0 &&
    detail.relatedAlerts.length === 0 &&
    detail.notes.length === 0 &&
    detail.timeline.length === 0
  );
}

export function useDetectionDetail(detectionId: number | null): DetectionDetailState {
  const [state, setState] = useState<DetectionDetailState>({ status: 'loading' });

  useEffect(() => {
    if (detectionId === null) {
      setState({ status: 'loading' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const res = await fetch(`/api/bff/impact/detection-detail?id=${detectionId}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        // Handle 404 — detection not found
        if (res.status === 404) {
          const body = await res.json().catch(() => ({ error: 'Detection not found', message: `HTTP 404` }));
          if (controller.signal.aborted) return;
          setState({
            status: 'not-found',
            error: body.error || 'Detection not found',
            message: body.message || `No detection with id ${detectionId}`,
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

        const validation = DetectionDetailSchema.safeParse(body.detectionDetail);

        if (!validation.success) {
          setState({
            status: 'malformed',
            error: 'Data contract violation',
            message: 'Detection detail response failed schema validation',
            details: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          });
          return;
        }

        // Determine quiet vs populated
        if (isQuietDetection(validation.data)) {
          setState({ status: 'quiet', detectionDetail: validation.data });
        } else {
          setState({ status: 'populated', detectionDetail: validation.data });
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: 'Network error',
          message: err instanceof Error ? err.message : 'Failed to fetch detection detail',
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [detectionId]);

  return state;
}
