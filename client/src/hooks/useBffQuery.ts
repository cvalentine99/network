/**
 * useBffQuery — Generic BFF fetch hook (Rec 7)
 *
 * Extracts the common fetch-validate-state pattern shared by 14+ BFF hooks.
 * Each hook was duplicating: AbortController, loading state, fetch, schema
 * validation, quiet/populated/error/malformed discrimination, and refetch.
 *
 * This generic hook encapsulates all of that. Existing hooks can be
 * progressively migrated to use it.
 *
 * CONTRACT:
 * - Fetches from a BFF URL (never ExtraHop directly)
 * - Validates response with a Zod schema before returning
 * - Returns a discriminated union: loading | populated | quiet | error | malformed
 * - Cancels in-flight requests on unmount or dependency change
 * - Refetches when deps change or refetch() is called
 * - Supports both GET (query params) and POST (JSON body) methods
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ZodSchema, ZodError } from 'zod';
import { useTimeWindow } from '@/lib/useTimeWindow';

// ─── State discriminated union ────────────────────────────────────
export type BffQueryState<T> =
  | { kind: 'loading' }
  | { kind: 'populated'; data: T }
  | { kind: 'quiet'; data: T }
  | { kind: 'error'; message: string }
  | { kind: 'malformed'; raw: unknown; zodError?: ZodError };

// ─── Config ───────────────────────────────────────────────────────
export interface BffQueryConfig<TRaw, TData> {
  /** BFF endpoint URL (e.g. '/api/bff/impact/headline') */
  url: string;

  /** HTTP method — default 'GET' */
  method?: 'GET' | 'POST';

  /**
   * Zod schema to validate the raw response JSON.
   * If validation fails, state becomes 'malformed'.
   */
  schema: ZodSchema<TRaw>;

  /**
   * Transform validated data into the shape the component needs.
   * Also decides whether the result is 'quiet' or 'populated'.
   * Return { data, quiet } where quiet=true means valid but empty.
   */
  transform: (raw: TRaw) => { data: TData; quiet: boolean };

  /**
   * Whether to include the shared time window as query params (GET)
   * or in the JSON body (POST). Default true.
   */
  useTimeWindow?: boolean;

  /**
   * Additional query params (GET) or body fields (POST) to include.
   */
  params?: Record<string, string | number | boolean | null | undefined>;

  /**
   * Extra dependencies that trigger a refetch when they change.
   * Serialized with JSON.stringify for comparison.
   */
  deps?: unknown[];

  /**
   * Whether the query is enabled. Default true.
   * When false, the hook stays in 'loading' and does not fetch.
   */
  enabled?: boolean;
}

export interface BffQueryResult<T> {
  state: BffQueryState<T>;
  refetch: () => void;
}

export function useBffQuery<TRaw, TData>(
  config: BffQueryConfig<TRaw, TData>,
): BffQueryResult<TData> {
  const {
    url,
    method = 'GET',
    schema,
    transform,
    useTimeWindow: useTw = true,
    params,
    deps = [],
    enabled = true,
  } = config;

  const { window: tw } = useTimeWindow();
  const [state, setState] = useState<BffQueryState<TData>>({ kind: 'loading' });
  const [fetchKey, setFetchKey] = useState(0);
  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  // Serialize deps for effect comparison
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!enabled) {
      setState({ kind: 'loading' });
      return;
    }

    const controller = new AbortController();
    setState({ kind: 'loading' });

    (async () => {
      try {
        let fetchUrl = url;
        let fetchInit: RequestInit = { signal: controller.signal };

        // Build time window params
        const twParams: Record<string, string> = {};
        if (useTw) {
          if (tw.fromMs) twParams.from = String(tw.fromMs);
          if (tw.untilMs) twParams.until = String(tw.untilMs);
          if (tw.cycle) twParams.cycle = tw.cycle;
        }

        // Merge additional params
        const allParams: Record<string, string> = { ...twParams };
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            if (v !== null && v !== undefined) {
              allParams[k] = String(v);
            }
          }
        }

        if (method === 'GET') {
          const qs = new URLSearchParams(allParams).toString();
          if (qs) fetchUrl = `${url}?${qs}`;
        } else {
          // POST — time window in body
          const body: Record<string, unknown> = {};
          if (useTw) {
            body.fromMs = tw.fromMs;
            body.toMs = tw.untilMs;
          }
          if (params) {
            for (const [k, v] of Object.entries(params)) {
              if (v !== null && v !== undefined) body[k] = v;
            }
          }
          fetchInit = {
            ...fetchInit,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          };
        }

        if (method === 'GET') {
          fetchInit.method = 'GET';
        }

        const res = await fetch(fetchUrl, fetchInit);

        if (controller.signal.aborted) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (controller.signal.aborted) return;
          setState({
            kind: 'error',
            message: body.message || body.error || `HTTP ${res.status}`,
          });
          return;
        }

        const json = await res.json();
        if (controller.signal.aborted) return;

        // Validate with schema
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          setState({ kind: 'malformed', raw: json, zodError: parsed.error });
          return;
        }

        // Transform
        const { data, quiet } = transform(parsed.data);
        setState(quiet ? { kind: 'quiet', data } : { kind: 'populated', data });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Unknown fetch error',
        });
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, fetchKey, enabled, tw.fromMs, tw.untilMs, tw.cycle, depsKey]);

  return { state, refetch };
}
