/**
 * Appliance Configuration — Zod validators (Slice 14)
 *
 * Validates all appliance config shapes at the boundary:
 *   - ApplianceConfigInputSchema: form submission from the settings page
 *   - ApplianceConfigResponseSchema: BFF response to the frontend
 *   - ConnectionTestResultSchema: result of a connectivity test
 *
 * CONTRACT:
 *   - hostname must be a non-empty string (FQDN or IP)
 *   - apiKey must be a non-empty string (ExtraHop API key)
 *   - verifySsl defaults to true
 *   - cloudServicesEnabled defaults to false
 *   - nickname is optional (defaults to empty string)
 *   - API key is NEVER in the response schema — only apiKeyHint and apiKeyConfigured
 */
import { z } from 'zod';

// ─── Hostname validation ─────────────────────────────────────────────────
// Accepts FQDN (eda01.lab.local), IPv4 (192.168.1.1), or short hostname (eda01)
const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/;

// ─── Form Input Schema ──────────────────────────────────────────────────
export const ApplianceConfigInputSchema = z.object({
  hostname: z.string()
    .min(1, 'Hostname is required')
    .max(255, 'Hostname must be 255 characters or fewer')
    .regex(hostnameRegex, 'Invalid hostname format — use FQDN, IPv4, or short hostname'),
  apiKey: z.string()
    .min(1, 'API key is required')
    .max(512, 'API key must be 512 characters or fewer'),
  verifySsl: z.boolean().default(true),
  cloudServicesEnabled: z.boolean().default(false),
  nickname: z.string().max(100, 'Nickname must be 100 characters or fewer').default(''),
});

export type ValidatedApplianceConfigInput = z.infer<typeof ApplianceConfigInputSchema>;

// ─── BFF Response Schema (API key masked) ────────────────────────────────
export const ApplianceConfigResponseSchema = z.object({
  id: z.number().int().positive(),
  hostname: z.string(),
  apiKeyHint: z.string(),
  apiKeyConfigured: z.boolean(),
  verifySsl: z.boolean(),
  cloudServicesEnabled: z.boolean(),
  nickname: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastTestedAt: z.string().nullable(),
  lastTestResult: z.enum(['success', 'failure', 'untested']),
  lastTestMessage: z.string(),
});

export type ValidatedApplianceConfigResponse = z.infer<typeof ApplianceConfigResponseSchema>;

// ─── Connection Test Result Schema ───────────────────────────────────────
export const ConnectionTestResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  latencyMs: z.number().nullable(),
  testedAt: z.string(),
});

export type ValidatedConnectionTestResult = z.infer<typeof ConnectionTestResultSchema>;

// ─── Pure helper: mask API key ───────────────────────────────────────────
/**
 * Masks an API key for display, showing first 4 and last 4 characters.
 * Returns '••••' if key is too short to mask meaningfully.
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
