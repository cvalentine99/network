// server/bff/lib/cache.ts
import { LRUCache } from 'lru-cache';
import { bffConfig } from '../config';
import type { TimeWindow } from '../../../shared/impact-types';
import { CYCLE_DURATION_MS } from '../../../shared/impact-constants';

interface CacheEntry { data: any; fetchedAt: number; }

const cache = new LRUCache<string, CacheEntry>({
  max: bffConfig.CACHE_MAX_SIZE,
  ttl: bffConfig.CACHE_TTL_MS,
  updateAgeOnGet: false,
});

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  return entry?.data as T | undefined;
}

export function setCached(key: string, data: any, ttlMs?: number): void {
  cache.set(key, { data, fetchedAt: Date.now() }, { ttl: ttlMs });
}

export function cacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: bffConfig.CACHE_MAX_SIZE };
}

/**
 * Generate a stable cache key from time window + object context + specs.
 * Keys are snapped to cycle boundaries to improve hit rate.
 */
export function cacheKey(window: TimeWindow, objectId: number | string, specs: string[]): string {
  const bucketMs = cycleToBucketMs(window.cycle);
  const fromSnap = Math.floor(window.fromMs / bucketMs) * bucketMs;
  const untilSnap = Math.ceil(window.untilMs / bucketMs) * bucketMs;
  return `${objectId}:${window.cycle}:${fromSnap}-${untilSnap}:${specs.sort().join(',')}`;
}

function cycleToBucketMs(cycle: string): number {
  return CYCLE_DURATION_MS[cycle] || 30000;
}
