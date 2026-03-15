/**
 * useNavParams — Slice 23
 *
 * Hook to parse cross-surface navigation parameters from the current URL.
 * Uses window.location.search (not wouter) to read query params.
 *
 * CONTRACT:
 * - Returns parsed nav params or null if not present/invalid
 * - Clears URL params after reading (one-shot consumption)
 * - Does not modify any other state
 */

import { useState, useEffect } from 'react';
import {
  parseBlastRadiusNav,
  parseFlowTheaterNav,
  type ParsedBlastRadiusNav,
  type ParsedFlowTheaterNav,
} from '../../../shared/cross-surface-nav-types';

/**
 * Parse and consume Blast Radius navigation params from the URL.
 * Returns the parsed params once, then clears the URL query string.
 */
export function useBlastRadiusNavParams(): ParsedBlastRadiusNav | null {
  const [navParams, setNavParams] = useState<ParsedBlastRadiusNav | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return parseBlastRadiusNav(params);
  });

  useEffect(() => {
    if (navParams) {
      // Clear the URL params after consuming them (one-shot)
      const url = new URL(window.location.href);
      url.searchParams.delete('brMode');
      url.searchParams.delete('brValue');
      url.searchParams.delete('brAuto');
      window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
    }
  }, [navParams]);

  return navParams;
}

/**
 * Parse and consume Flow Theater navigation params from the URL.
 * Returns the parsed params once, then clears the URL query string.
 */
export function useFlowTheaterNavParams(): ParsedFlowTheaterNav | null {
  const [navParams, setNavParams] = useState<ParsedFlowTheaterNav | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return parseFlowTheaterNav(params);
  });

  useEffect(() => {
    if (navParams) {
      // Clear the URL params after consuming them (one-shot)
      const url = new URL(window.location.href);
      url.searchParams.delete('ftMode');
      url.searchParams.delete('ftValue');
      url.searchParams.delete('ftAuto');
      window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
    }
  }, [navParams]);

  return navParams;
}
