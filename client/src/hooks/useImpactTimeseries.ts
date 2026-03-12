/**
 * useImpactTimeseries — Fetch time-series data from BFF
 *
 * CONTRACT:
 * - Calls /api/bff/impact/timeseries with current time window params
 * - Validates response via z.array(SeriesPointSchema) before returning
 * - Returns TimeSeriesChartState discriminated union (loading | quiet | populated | error | malformed)
 * - Never contacts ExtraHop directly
 * - Refetches when time window changes
 */
import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { useTimeWindow } from '@/lib/useTimeWindow';
import { SeriesPointSchema } from '../../../shared/cockpit-validators';
import type { TimeSeriesChartState } from '@/components/charts/GhostedTimeline';

const TimeseriesArraySchema = z.array(SeriesPointSchema);

interface TimeseriesResponse {
  timeseries: unknown;
  timeWindow: unknown;
}

export function useImpactTimeseries(): {
  state: TimeSeriesChartState;
  refetch: () => void;
} {
  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<TimeSeriesChartState>({ kind: 'loading' });
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

    fetch(`/api/bff/impact/timeseries?${params}`)
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

        const json: TimeseriesResponse = await res.json();

        // Validate timeseries array shape
        const validation = TimeseriesArraySchema.safeParse(json.timeseries);
        if (!validation.success) {
          setState({
            kind: 'malformed',
            message: `Timeseries failed schema validation: ${validation.error.issues.map((i) => i.message).join('; ')}`,
          });
          return;
        }

        const points = validation.data;

        // Determine quiet vs populated
        if (points.length === 0) {
          setState({ kind: 'quiet' });
        } else {
          setState({ kind: 'populated', points });
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
