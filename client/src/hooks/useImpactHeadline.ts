/**
 * useImpactHeadline — Fetch KPI headline data from BFF
 *
 * CONTRACT:
 * - Calls /api/bff/impact/headline with current time window params
 * - Validates response via ImpactHeadlineSchema before returning
 * - Returns KPIStripState discriminated union (loading | quiet | populated | error | malformed)
 * - Never contacts ExtraHop directly
 * - Refetches when time window changes
 */
import { useState, useEffect, useCallback } from 'react';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { ImpactHeadlineSchema } from '../../../shared/cockpit-validators';
import type { KPIStripState } from '@/components/impact/KPIStrip';

interface HeadlineResponse {
  headline: unknown;
  timeWindow: unknown;
}

export function useImpactHeadline(): {
  state: KPIStripState;
  refetch: () => void;
} {
  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<KPIStripState>({ kind: 'loading' });
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    const params = new URLSearchParams({
      from: String(tw.fromMs),
      until: String(tw.untilMs),
      cycle: tw.cycle,
    });

    fetch(`/api/bff/impact/headline?${params}`)
      .then(async (res) => {
        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({
            kind: 'error',
            message: body.message || body.error || `HTTP ${res.status}`,
          });
          return;
        }

        const json: HeadlineResponse = await res.json();

        // Validate headline shape
        const validation = ImpactHeadlineSchema.safeParse(json.headline);
        if (!validation.success) {
          setState({
            kind: 'malformed',
            message: `Headline failed schema validation: ${validation.error.issues.map((i) => i.message).join('; ')}`,
          });
          return;
        }

        const h = validation.data;

        // Determine quiet vs populated
        const isQuiet =
          h.totalBytes === 0 &&
          h.totalPackets === 0 &&
          h.bytesPerSecond === 0 &&
          h.packetsPerSecond === 0 &&
          h.baselineDeltaPct === null;

        if (isQuiet) {
          setState({ kind: 'quiet' });
        } else {
          setState({ kind: 'populated', headline: h });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: err.message || 'Network error',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [tw.fromMs, tw.untilMs, tw.cycle, fetchKey]);

  return { state, refetch };
}
