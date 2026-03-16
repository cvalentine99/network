/**
 * useDataSourceMode — queries GET /api/bff/health and exposes the data source mode.
 *
 * Returns:
 *   mode: 'fixture' | 'live' | 'loading' | 'error'
 *   label: human-readable label for the mode
 *   status: raw BFF health status string
 *
 * The BFF health endpoint returns status: 'not_configured' when in fixture mode
 * (appliance credentials not configured), and 'ok' or 'degraded' when live.
 *
 * This hook is used by the DataSourceBadge component to show a visible
 * indicator on every surface.
 */
import { useState, useEffect } from 'react';

export type DataSourceMode = 'fixture' | 'live' | 'loading' | 'error';

interface DataSourceState {
  mode: DataSourceMode;
  label: string;
  status: string | null;
}

export function useDataSourceMode(): DataSourceState {
  const [state, setState] = useState<DataSourceState>({
    mode: 'loading',
    label: 'Checking data source...',
    status: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function check() {
      try {
        const res = await fetch('/api/bff/health', { signal: controller.signal });
        if (!res.ok) {
          if (!controller.signal.aborted) {
            setState({
              mode: 'error',
              label: 'Health check failed',
              status: null,
            });
          }
          return;
        }

        const data = await res.json();
        if (controller.signal.aborted) return;

        if (data.status === 'not_configured') {
          setState({
            mode: 'fixture',
            label: 'Fixture Mode — Demo Data',
            status: data.status,
          });
        } else {
          // 'ok' or 'degraded' — live mode (even if degraded, it means EH is configured)
          setState({
            mode: 'live',
            label: data.status === 'ok' ? 'Live — ExtraHop Connected' : 'Live — Degraded',
            status: data.status,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState({
            mode: 'error',
            label: 'Health check failed',
            status: null,
          });
        }
      }
    }

    check();

    // Re-check every 60 seconds
    const interval = setInterval(check, 60_000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return state;
}
