/**
 * useDetections — BFF hook for the Detections panel
 *
 * CONTRACT:
 * - Fetches from /api/bff/impact/detections (never ExtraHop directly)
 * - Uses shared time window from TimeWindowProvider
 * - Validates response via NormalizedDetectionSchema
 * - Returns DetectionsState discriminated union
 * - 5 states: loading, quiet, populated, error, malformed
 */
import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { NormalizedDetectionSchema } from '../../../shared/cockpit-validators';
import { useTimeWindow } from '@/lib/useTimeWindow';
import type { DetectionsState } from '@/components/tables/DetectionsTable';

const DetectionsArraySchema = z.array(NormalizedDetectionSchema);

export function useDetections(): DetectionsState {
  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<DetectionsState>({ kind: 'loading' });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ kind: 'loading' });

    const params = new URLSearchParams({
      from: String(tw.fromMs),
      until: String(tw.untilMs),
      cycle: tw.cycle,
    });

    fetch(`/api/bff/impact/detections?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            kind: 'error',
            error: body.error || `HTTP ${res.status}`,
            message: body.message || 'Detections fetch failed',
          });
          return;
        }

        const body = await res.json();

        // Check for error shape in response body
        if (body.error) {
          setState({
            kind: 'error',
            error: body.error,
            message: body.message || 'Unknown error',
          });
          return;
        }

        // Validate detections array via schema
        const validation = DetectionsArraySchema.safeParse(body.detections);
        if (!validation.success) {
          setState({
            kind: 'malformed',
            message: `Schema validation failed: ${validation.error.issues.length} issue(s)`,
          });
          return;
        }

        // Discriminate quiet vs populated
        if (validation.data.length === 0) {
          setState({ kind: 'quiet' });
        } else {
          setState({ kind: 'populated', detections: validation.data });
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({
          kind: 'error',
          error: 'Transport failure',
          message: err.message || 'Network request failed',
        });
      });

    return () => {
      controller.abort();
    };
  }, [tw.fromMs, tw.untilMs, tw.cycle]);

  return state;
}
