/**
 * useAlerts — BFF hook for the Alerts panel.
 *
 * Fetches GET /api/bff/impact/alerts with the shared time window.
 * Returns AlertsState discriminated union (loading | quiet | populated | error | malformed).
 *
 * Contract:
 *   - Uses shared time window from TimeWindowProvider (never panel-local)
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Validates response via NormalizedAlertSchema before passing to component
 *   - Empty array = quiet state (not error)
 *   - AbortController cancels in-flight requests on unmount or time window change
 */
import { useState, useEffect } from 'react';
import { z } from 'zod';
import { NormalizedAlertSchema } from '../../../shared/cockpit-validators';
import { useTimeWindow } from '@/lib/useTimeWindow';
import type { AlertsState } from '@/components/tables/AlertsPanel';

export function useAlerts(): AlertsState {
  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<AlertsState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const params = new URLSearchParams();
        if (tw.fromMs) params.set('from', String(tw.fromMs));
        if (tw.untilMs) params.set('until', String(tw.untilMs));
        if (tw.cycle) params.set('cycle', tw.cycle);

        const res = await fetch(`/api/bff/impact/alerts?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

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

        const alertsArray = z.array(NormalizedAlertSchema);
        const validation = alertsArray.safeParse(body.alerts);

        if (!validation.success) {
          setState({
            status: 'malformed',
            error: 'Data contract violation',
            message: 'Alerts response failed schema validation',
            details: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          });
          return;
        }

        if (validation.data.length === 0) {
          setState({ status: 'quiet' });
          return;
        }

        setState({ status: 'populated', alerts: validation.data });
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: 'Network error',
          message: err.message || 'Failed to fetch alerts',
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [tw.fromMs, tw.untilMs, tw.cycle]);

  return state;
}
