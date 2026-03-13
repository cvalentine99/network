/**
 * Appliance Configuration — Shared types (Slice 14)
 *
 * Defines the shape of the appliance connection configuration
 * that is persisted to the database and consumed by the BFF
 * to determine whether to use fixture mode or attempt live connection.
 *
 * CONTRACT:
 *   - ApplianceConfig is the DB row shape (what is stored)
 *   - ApplianceConfigInput is the form submission shape (what the user enters)
 *   - ApplianceConfigResponse is the BFF response shape (what the frontend reads)
 *   - The API key is NEVER returned to the frontend — only a masked hint
 *   - connectionStatus is derived from the last connectivity test, not from the config itself
 */

// ─── DB Row Shape ────────────────────────────────────────────────────────
export interface ApplianceConfig {
  id: number;
  hostname: string;
  apiKey: string;
  verifySsl: boolean;
  cloudServicesEnabled: boolean;
  nickname: string;
  createdAt: string;   // ISO timestamp
  updatedAt: string;   // ISO timestamp
  lastTestedAt: string | null;  // ISO timestamp of last connectivity test
  lastTestResult: 'success' | 'failure' | 'untested';
  lastTestMessage: string;
}

// ─── Form Input Shape ────────────────────────────────────────────────────
export interface ApplianceConfigInput {
  hostname: string;
  apiKey: string;
  verifySsl: boolean;
  cloudServicesEnabled: boolean;
  nickname: string;
}

// ─── BFF Response Shape (API key masked) ─────────────────────────────────
export interface ApplianceConfigResponse {
  id: number;
  hostname: string;
  apiKeyHint: string;          // e.g. "ExHo****3f2a" — first 4 + last 4 chars
  apiKeyConfigured: boolean;   // true if apiKey is non-empty
  verifySsl: boolean;
  cloudServicesEnabled: boolean;
  nickname: string;
  createdAt: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastTestResult: 'success' | 'failure' | 'untested';
  lastTestMessage: string;
}

// ─── Test Connection Result ──────────────────────────────────────────────
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number | null;
  testedAt: string;  // ISO timestamp
}
