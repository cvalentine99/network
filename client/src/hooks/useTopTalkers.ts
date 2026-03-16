/**
 * useTopTalkers — BFF hook for top talkers data.
 *
 * Slice 04 — Contract-verified hook.
 *
 * Fetches from GET /api/bff/impact/top-talkers with shared time window.
 * Returns TopTalkersState discriminated union for the component.
 *
 * State discrimination:
 *   - loading: fetch in progress
 *   - quiet: response has topTalkers: []
 *   - populated: response has topTalkers with 1+ rows
 *   - transport-error: fetch failed (network, 5xx)
 *   - malformed: response arrived but failed client-side schema check
 *
 * CONTRACT:
 *   - Never contacts ExtraHop directly.
 *   - Uses shared time window from useTimeWindow.
 *   - Validates response via TopTalkerRowSchema.
 */
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { TopTalkerRowSchema } from '../../../shared/cockpit-validators';
import { useTimeWindow } from '@/lib/useTimeWindow';
import type { TopTalkersState } from '@/components/tables/TopTalkersTable';

export function useTopTalkers(): TopTalkersState {
  const { window: timeWindow } = useTimeWindow();
  const [state, setState] = useState<TopTalkersState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTopTalkers() {
      setState({ status: 'loading' });

      try {
        const params = new URLSearchParams({
          from: String(timeWindow.fromMs),
          until: String(timeWindow.untilMs),
          cycle: timeWindow.cycle,
        });

        const res = await fetch(`/api/bff/impact/top-talkers?${params}`, {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown', message: `HTTP ${res.status}` }));
          setState({
            status: 'transport-error',
            error: body.error || 'Fetch failed',
            message: body.message || `HTTP ${res.status}`,
          });
          return;
        }

        const json = await res.json();

        // Validate the topTalkers array via schema
        const validation = z.array(TopTalkerRowSchema).safeParse(json.topTalkers);

        if (!validation.success) {
          setState({
            status: 'malformed',
            error: 'Schema validation failed',
            message: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          });
          return;
        }

        if (validation.data.length === 0) {
          setState({ status: 'quiet' });
        } else {
          setState({ status: 'populated', topTalkers: validation.data });
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setState({
          status: 'transport-error',
          error: 'Network error',
          message: err.message || 'Failed to fetch top talkers',
        });
      }
    }

    fetchTopTalkers();

    return () => {
      controller.abort();
    };
  }, [timeWindow.fromMs, timeWindow.untilMs, timeWindow.cycle]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
