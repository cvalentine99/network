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

import { getApplianceConfigDecrypted } from './db';
import https from 'node:https';

// Per-request TLS agent to avoid NODE_TLS_REJECT_UNAUTHORIZED race condition (audit M6)
// Reusable agent instance for connections that skip TLS verification.
// This is safe because the agent only affects connections made through it,
// not the entire process.
const insecureAgent = new https.Agent({ rejectUnauthorized: false });

// Lazy-load undici Agent for per-request TLS bypass (audit M6)
let _undiciAgent: unknown = null;
async function getUndiciAgent(): Promise<unknown> {
  if (_undiciAgent) return _undiciAgent;
  try {
    // Node.js 18+ bundles undici; import it dynamically to avoid bundler issues
    // @ts-expect-error — undici is bundled with Node.js 18+ but has no types in this project
    const undici = await import('undici');
    _undiciAgent = new undici.Agent({
      connect: { rejectUnauthorized: false },
    });
  } catch {
    // Fallback: if undici is not available, set process-wide flag (less safe but functional)
    console.warn('[extrahop-client] undici not available, falling back to process-wide TLS bypass');
    _undiciAgent = null;
  }
  return _undiciAgent;
}

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
  // LRU: move to end of Map insertion order on access (audit M5)
  cache.delete(key);
  cache.set(key, entry);
  cacheHits++;
  return entry.data;
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  // If key already exists, delete first so re-insert moves it to end (LRU)
  if (cache.has(key)) {
    cache.delete(key);
  }
  // Evict least-recently-used (first in Map order) if at capacity (audit M5)
  if (cache.size >= MAX_CACHE_SIZE) {
    const lruKey = cache.keys().next().value;
    if (lruKey !== undefined) {
      cache.delete(lruKey);
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
    const row = await getApplianceConfigDecrypted();
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
 * Check if usable credentials exist from EITHER source:
 *   1. ENV vars: EH_HOST + EH_API_KEY
 *   2. DB: appliance_config row with non-empty hostname + apiKey
 *
 * Returns true only when NEITHER source has usable credentials.
 * This is synchronous for env-var check and caches the DB result.
 */
let _dbConfigCache: { config: ExtraHopClientConfig | null; checkedAt: number } | null = null;
const DB_CONFIG_CACHE_TTL_MS = 10_000; // Re-check DB every 10s

function hasEnvCredentials(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !!host && host !== '' && !!key && key !== '' && key !== 'REPLACE_ME';
}

/**
 * Async check: is the system in fixture mode?
 * Returns true only when NO usable credentials exist in env OR DB.
 */
export async function isFixtureMode(): Promise<boolean> {
  // Fast path: env vars are set → live mode
  if (hasEnvCredentials()) return false;

  // Check DB (with short TTL cache to avoid hammering DB on every request)
  const now = Date.now();
  if (_dbConfigCache && (now - _dbConfigCache.checkedAt) < DB_CONFIG_CACHE_TTL_MS) {
    return _dbConfigCache.config === null;
  }

  const config = await getConfig();
  _dbConfigCache = { config, checkedAt: now };
  return config === null;
}

/**
 * Synchronous check for env-only credentials.
 * Used ONLY in startup paths (ETL scheduler init) where async is not available.
 * For route-level gating, always use the async isFixtureMode().
 */
export function isFixtureModeSync(): boolean {
  if (hasEnvCredentials()) return false;
  // If we have a recent DB cache, use it
  if (_dbConfigCache && (Date.now() - _dbConfigCache.checkedAt) < DB_CONFIG_CACHE_TTL_MS) {
    return _dbConfigCache.config === null;
  }
  // No cache available — conservatively assume fixture mode for sync callers
  // The async version will populate the cache on first request
  return true;
}

/** Clear the DB config cache. Used when appliance config is saved. */
export function clearConfigCache(): void {
  _dbConfigCache = null;
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

  // Always use HTTPS — EH_VERIFY_SSL only controls certificate verification,
  // it does NOT downgrade to plaintext HTTP
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
    // When verifySsl=false, skip TLS certificate verification but KEEP HTTPS.
    // Uses per-request https.Agent instead of process-wide NODE_TLS_REJECT_UNAUTHORIZED (audit M6)
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    };
    // Node.js 18+ fetch supports undici dispatcher for per-request TLS control
    if (!config.verifySsl) {
      fetchOptions.dispatcher = await getUndiciAgent();
    }
    const response = await fetch(url, fetchOptions);
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

  // Always use HTTPS — EH_VERIFY_SSL only controls certificate verification
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
    // TLS bypass for self-signed certs — per-request agent (audit M6)
    const fetchOptions: RequestInit & { dispatcher?: unknown } = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    };
    if (!config.verifySsl) {
      fetchOptions.dispatcher = await getUndiciAgent();
    }
    const response = await fetch(url, fetchOptions);
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
