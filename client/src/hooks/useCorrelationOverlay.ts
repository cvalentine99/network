/**
 * useCorrelationOverlay — Fetch correlation events from BFF (Slice 19)
 *
 * CONTRACT:
 * - Calls POST /api/bff/correlation/events with current time window
 * - Validates response via CorrelationPayloadSchema
 * - Returns CorrelationOverlayState discriminated union
 * - Never contacts ExtraHop directly
 * - Refetches when time window changes
 */
import { useState, useEffect, useCallback } from 'react';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { CorrelationPayloadSchema } from '../../../shared/correlation-validators';
import type { CorrelationOverlayState } from '../../../shared/correlation-types';

export function useCorrelationOverlay(): {
  state: CorrelationOverlayState;
  refetch: () => void;
} {
  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<CorrelationOverlayState>({ kind: 'idle' });
  const [fetchKey, setFetchKey] = useState(0);
  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });

    fetch('/api/bff/correlation/events', { signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromMs: tw.fromMs,
        untilMs: tw.untilMs,
      }),
    })
      .then(async (res) => {
        if (controller.signal.aborted) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            kind: 'error',
            message: body.message || body.error || `HTTP ${res.status}`,
          });
          return;
        }

        const json = await res.json();

        // Validate payload shape
        const validation = CorrelationPayloadSchema.safeParse(json);
        if (!validation.success) {
          setState({
            kind: 'malformed',
            message: `Correlation payload failed schema validation: ${validation.error.issues.map((i) => i.message).join('; ')}`,
          });
          return;
        }

        const payload = validation.data;

        // Determine quiet vs populated
        if (payload.events.length === 0) {
          setState({
            kind: 'quiet',
            timeWindow: payload.timeWindow,
          });
        } else {
          setState({ kind: 'populated', payload });
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState({
          kind: 'error',
          message: err.message || 'Network error',
        });
      });

    return () => {
      controller.abort();
    };
  }, [tw.fromMs, tw.untilMs, fetchKey]);

  return { state, refetch };
}
