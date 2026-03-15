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
 */
import { useState, useEffect, useCallback } from 'react';
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

  const fetchDetail = useCallback(async () => {
    if (detectionId === null) {
      setState({ status: 'loading' });
      return;
    }

    setState({ status: 'loading' });

    try {
      const res = await fetch(`/api/bff/impact/detection-detail?id=${detectionId}`);

      // Handle 404 — detection not found
      if (res.status === 404) {
        const body = await res.json().catch(() => ({ error: 'Detection not found', message: `HTTP 404` }));
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
        setState({
          status: 'error',
          error: body.error || 'Transport error',
          message: body.message || `HTTP ${res.status}`,
        });
        return;
      }

      const body = await res.json();
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
    } catch (err: any) {
      setState({
        status: 'error',
        error: 'Network error',
        message: err.message || 'Failed to fetch detection detail',
      });
    }
  }, [detectionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return state;
}
