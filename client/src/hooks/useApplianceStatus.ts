/**
 * useApplianceStatus — BFF hook for the Appliance Status Footer (Slice 07).
 *
 * Fetches GET /api/bff/impact/appliance-status (no time window dependency).
 * Returns ApplianceStatusState discriminated union (loading | quiet | populated | error | malformed).
 *
 * Contract:
 *   - Fetches via /api/bff/* only (never ExtraHop directly)
 *   - Validates response via ApplianceStatusSchema before passing to component
 *   - connectionStatus = 'not_configured' → quiet state
 *   - connectionStatus = 'connected' → populated state
 *   - connectionStatus = 'error' → populated state (with error indicators in the data)
 *   - Does NOT depend on shared time window (appliance health is instantaneous)
 *   - AbortController cancels in-flight requests on unmount
 */
import { useState, useEffect } from 'react';
import { ApplianceStatusSchema } from '../../../shared/cockpit-validators';
import type { ApplianceStatus } from '../../../shared/cockpit-types';

export type ApplianceStatusState =
  | { status: 'loading' }
  | { status: 'quiet' }
  | { status: 'populated'; applianceStatus: ApplianceStatus }
  | { status: 'error'; error: string; message: string }
  | { status: 'malformed'; error: string; message: string; details?: string };

export function useApplianceStatus(): ApplianceStatusState {
  const [state, setState] = useState<ApplianceStatusState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });

    (async () => {
      try {
        const res = await fetch('/api/bff/impact/appliance-status', {
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

        const validation = ApplianceStatusSchema.safeParse(body.applianceStatus);

        if (!validation.success) {
          setState({
            status: 'malformed',
            error: 'Data contract violation',
            message: 'Appliance status response failed schema validation',
            details: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
          });
          return;
        }

        // not_configured with empty hostname = quiet state
        if (validation.data.connectionStatus === 'not_configured' && validation.data.hostname === '') {
          setState({ status: 'quiet' });
          return;
        }

        setState({ status: 'populated', applianceStatus: validation.data });
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: 'Network error',
          message: err.message || 'Failed to fetch appliance status',
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
