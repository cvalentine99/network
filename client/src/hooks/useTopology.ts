/**
 * useTopology — Fetch topology graph from BFF (Slice 21)
 *
 * CONTRACT:
 * - Calls POST /api/bff/topology/query with current time window
 * - Validates response via TopologyBffResponseSchema
 * - Returns TopologyState discriminated union
 * - Never contacts ExtraHop directly
 * - Refetches when time window changes
 */
import { useState, useEffect, useCallback } from 'react';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { TopologyBffResponseSchema } from '../../../shared/topology-validators';
import type { TopologyPayload } from '../../../shared/topology-types';

export type TopologyState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'populated'; payload: TopologyPayload }
  | { kind: 'quiet'; payload: TopologyPayload }
  | { kind: 'error'; message: string }
  | { kind: 'malformed'; raw: unknown };

export function useTopology(): {
  state: TopologyState;
  refetch: () => void;
} {
  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<TopologyState>({ kind: 'idle' });
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: 'loading' });

    fetch('/api/bff/topology/query', { signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromMs: tw.fromMs, toMs: tw.untilMs }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        const parsed = TopologyBffResponseSchema.safeParse(json);
        if (!parsed.success) {
          setState({ kind: 'malformed', raw: json });
          return;
        }
        const { intent, payload, error } = parsed.data;
        if (intent === 'error' || intent === 'transport-error') {
          setState({ kind: 'error', message: error || 'Unknown error' });
        } else if (intent === 'malformed') {
          setState({ kind: 'malformed', raw: json });
        } else if (payload && payload.nodes.length === 0) {
          setState({ kind: 'quiet', payload });
        } else if (payload) {
          setState({ kind: 'populated', payload });
        } else {
          setState({ kind: 'error', message: 'No payload in response' });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setState({ kind: 'error', message: String(err) });
        }
      });

    return () => {
      controller.abort();
    };
  }, [tw.fromMs, tw.untilMs, fetchKey]);

  return { state, refetch };
}
