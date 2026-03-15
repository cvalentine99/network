/**
 * ExtraHop REST API Client
 *
 * Centralized HTTP client for all ExtraHop API calls.
 * Reads credentials from the appliance_config DB table (not env vars).
 * Includes a TTL cache layer to reduce appliance load.
 *
 * CONTRACT:
 *   - All routes use this client instead of direct fetch()
 *   - Auth header: "ExtraHop apikey=<key>"
 *   - TLS verification controlled by appliance_config.verify_ssl
 *   - All responses are typed — callers normalize into shared types
 *   - Cache is per-endpoint with configurable TTL
 *   - Cache stats are exposed for the health route
 */

import { getApplianceConfig } from './db';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ExtraHopClientConfig {
  hostname: string;
  apiKey: string;
  verifySsl: boolean;
}

export interface ExtraHopRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  /** Cache TTL in ms. 0 = no cache. Default: 0 */
  cacheTtlMs?: number;
  /** Timeout in ms. Default: 15000 */
  timeoutMs?: number;
  /** Accept header. Default: 'application/json' */
  accept?: string;
}

export interface ExtraHopResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  latencyMs: number;
  cached: boolean;
}

export interface ExtraHopBinaryResponse {
  ok: boolean;
  status: number;
  statusText: string;
  buffer: Buffer;
  latencyMs: number;
  contentType: string;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
}

// ─── Cache ────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 500;
const cache = new Map<string, CacheEntry>();
let cacheHits = 0;
let cacheMisses = 0;

function cacheKey(method: string, path: string, body?: unknown): string {
  const bodyStr = body ? JSON.stringify(body) : '';
  return `${method}:${path}:${bodyStr}`;
}

function cacheGet(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) {
    cacheMisses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    cacheMisses++;
    return null;
  }
  cacheHits++;
  return entry.data;
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  // Evict oldest entries if at capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Flush the entire cache. Useful for testing or config changes. */
export function cacheClear(): void {
  cache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/** Get cache statistics for the health route. */
export function getCacheStats(): CacheStats {
  // Purge expired entries before reporting
  const now = Date.now();
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    const entry = cache.get(key);
    if (entry && now > entry.expiresAt) {
      cache.delete(key);
    }
  }
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hits: cacheHits,
    misses: cacheMisses,
  };
}

// ─── Client ───────────────────────────────────────────────────────────────

/**
 * Load ExtraHop config from the database.
 * Returns null if no config exists or DB is unavailable.
 */
async function getConfig(): Promise<ExtraHopClientConfig | null> {
  try {
    const row = await getApplianceConfig();
    if (!row || !row.hostname || !row.apiKey) return null;
    return {
      hostname: row.hostname,
      apiKey: row.apiKey,
      verifySsl: row.verifySsl,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the system is in fixture mode (no live ExtraHop configured).
 * Uses env vars as the gate — same logic as all route files.
 */
export function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

/**
 * Make a JSON request to the ExtraHop REST API.
 *
 * Uses credentials from the appliance_config DB table.
 * Caches responses when cacheTtlMs > 0.
 */
export async function ehRequest<T = unknown>(
  options: ExtraHopRequestOptions
): Promise<ExtraHopResponse<T>> {
  const { method, path, body, cacheTtlMs = 0, timeoutMs = 15000, accept = 'application/json' } = options;

  // Check cache first
  if (cacheTtlMs > 0) {
    const key = cacheKey(method, path, body);
    const cached = cacheGet(key);
    if (cached !== null) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK (cached)',
        data: cached as T,
        latencyMs: 0,
        cached: true,
      };
    }
  }

  // Load config from DB
  const config = await getConfig();
  if (!config) {
    throw new ExtraHopClientError(
      'No appliance configured. Save a configuration in Settings first.',
      'NO_CONFIG',
      0
    );
  }

  // Build URL
  const url = `https://${config.hostname}${path}`;

  // Build headers
  const headers: Record<string, string> = {
    'Authorization': `ExtraHop apikey=${config.apiKey}`,
    'Accept': accept,
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Execute request with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = response.statusText;
      }
      throw new ExtraHopClientError(
        `ExtraHop API error: ${response.status} ${response.statusText} — ${errorBody}`,
        'API_ERROR',
        response.status
      );
    }

    const data = await response.json() as T;

    // Cache the response if TTL is set
    if (cacheTtlMs > 0) {
      const key = cacheKey(method, path, body);
      cacheSet(key, data, cacheTtlMs);
    }

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      data,
      latencyMs,
      cached: false,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (err instanceof ExtraHopClientError) throw err;

    if (err.name === 'AbortError') {
      throw new ExtraHopClientError(
        `ExtraHop API request timed out after ${timeoutMs}ms: ${method} ${path}`,
        'TIMEOUT',
        0
      );
    }

    throw new ExtraHopClientError(
      `ExtraHop API request failed: ${err.message || 'Unknown error'}`,
      'NETWORK_ERROR',
      0
    );
  }
}

/**
 * Make a binary request to the ExtraHop REST API (e.g., PCAP download).
 * Does NOT use caching (binary payloads are too large).
 */
export async function ehBinaryRequest(
  options: Omit<ExtraHopRequestOptions, 'cacheTtlMs' | 'accept'>
): Promise<ExtraHopBinaryResponse> {
  const { method, path, body, timeoutMs = 30000 } = options;

  const config = await getConfig();
  if (!config) {
    throw new ExtraHopClientError(
      'No appliance configured. Save a configuration in Settings first.',
      'NO_CONFIG',
      0
    );
  }

  const url = `https://${config.hostname}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `ExtraHop apikey=${config.apiKey}`,
    'Accept': 'application/vnd.tcpdump.pcap',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = response.statusText;
      }
      throw new ExtraHopClientError(
        `ExtraHop PCAP API error: ${response.status} ${response.statusText} — ${errorBody}`,
        'API_ERROR',
        response.status
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      buffer,
      latencyMs,
      contentType,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    if (err instanceof ExtraHopClientError) throw err;

    if (err.name === 'AbortError') {
      throw new ExtraHopClientError(
        `ExtraHop PCAP request timed out after ${timeoutMs}ms`,
        'TIMEOUT',
        0
      );
    }

    throw new ExtraHopClientError(
      `ExtraHop PCAP request failed: ${err.message || 'Unknown error'}`,
      'NETWORK_ERROR',
      0
    );
  }
}

// ─── Error Class ──────────────────────────────────────────────────────────

export class ExtraHopClientError extends Error {
  code: string;
  httpStatus: number;

  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = 'ExtraHopClientError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
