/**
 * Topology ForceGraph — Layout persistence (localStorage)
 * Saves/loads node positions per view key.
 */

import type { SavedPosition } from './types';
import { LAYOUT_STORAGE_PREFIX } from './constants';

function getStorageKey(viewKey?: string): string {
  return viewKey ? `${LAYOUT_STORAGE_PREFIX}:${viewKey}` : LAYOUT_STORAGE_PREFIX;
}

export function loadSavedPositions(viewKey?: string): Map<number, SavedPosition> {
  try {
    const raw = localStorage.getItem(getStorageKey(viewKey));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, SavedPosition>;
    const m = new Map<number, SavedPosition>();
    for (const [k, v] of Object.entries(parsed)) {
      const id = Number(k);
      if (
        !Number.isNaN(id) &&
        v &&
        typeof v.x === 'number' &&
        typeof v.y === 'number' &&
        Number.isFinite(v.x) &&
        Number.isFinite(v.y)
      ) {
        m.set(id, v);
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

export function saveSavedPositions(
  positions: Map<number, SavedPosition>,
  viewKey?: string
): void {
  try {
    const obj: Record<string, SavedPosition> = {};
    positions.forEach((v, k) => {
      obj[String(k)] = v;
    });
    localStorage.setItem(getStorageKey(viewKey), JSON.stringify(obj));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function clearSavedPositions(viewKey?: string): void {
  try {
    localStorage.removeItem(getStorageKey(viewKey));
  } catch {
    // silently ignore
  }
}
