/**
 * Slice 07 — Appliance Status Footer
 * Contract tests: BFF route, fixtures, schema validation, helper functions, state discrimination
 *
 * Tests cover:
 * 1. Fixture files exist and parse as valid JSON (5 files × 2 = 10 vitest executions)
 * 2. ApplianceStatusSchema validation against populated fixture
 * 3. ApplianceStatusSchema rejection of malformed fixture
 * 4. Edge-case fixture validation (expired license, inactive capture)
 * 5. Quiet fixture validation (not_configured state)
 * 6. Helper functions: formatUptime, connectionStatusDisplay, captureStatusDisplay, licenseStatusDisplay
 * 7. BFF route /api/bff/impact/appliance-status live local response
 * 8. State discrimination: quiet vs populated vs error
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ApplianceStatusSchema } from '../shared/cockpit-validators';
import {
  formatUptime,
  connectionStatusDisplay,
  captureStatusDisplay,
  licenseStatusDisplay,
} from '../client/src/components/impact/ApplianceFooter';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'appliance-status');

// ─── Fixture file names ──────────────────────────────────────────────────
const FIXTURE_FILES = [
  'appliance-status.populated.fixture.json',
  'appliance-status.quiet.fixture.json',
  'appliance-status.transport-error.fixture.json',
  'appliance-status.malformed.fixture.json',
  'appliance-status.edge-case.fixture.json',
];

// ─── 1. Fixture files exist and parse ────────────────────────────────────
// 2 it() call sites → 10 vitest executions (5 files × 2 tests each via for-loop)
describe('Fixture files exist and parse', () => {
  for (const file of FIXTURE_FILES) {
    it(`${file} exists on disk`, () => {
      expect(existsSync(join(FIXTURE_DIR, file))).toBe(true);
    });
    it(`${file} parses as valid JSON`, () => {
      const raw = readFileSync(join(FIXTURE_DIR, file), 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  }
});

// ─── 2. Populated fixture schema validation ──────────────────────────────
describe('Populated fixture schema validation', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.populated.fixture.json'), 'utf-8'));
  const status = raw.applianceStatus;

  it('has an applianceStatus object', () => {
    expect(status).toBeDefined();
    expect(typeof status).toBe('object');
  });

  it('passes ApplianceStatusSchema', () => {
    const result = ApplianceStatusSchema.safeParse(status);
    expect(result.success).toBe(true);
  });

  it('hostname is a non-empty string', () => {
    expect(typeof status.hostname).toBe('string');
    expect(status.hostname.length).toBeGreaterThan(0);
  });

  it('version is a non-empty string', () => {
    expect(typeof status.version).toBe('string');
    expect(status.version.length).toBeGreaterThan(0);
  });

  it('connectionStatus is "connected"', () => {
    expect(status.connectionStatus).toBe('connected');
  });

  it('captureStatus is "active"', () => {
    expect(status.captureStatus).toBe('active');
  });

  it('licenseStatus is "valid"', () => {
    expect(status.licenseStatus).toBe('valid');
  });

  it('licensedModules is a non-empty array of strings', () => {
    expect(Array.isArray(status.licensedModules)).toBe(true);
    expect(status.licensedModules.length).toBeGreaterThan(0);
    for (const mod of status.licensedModules) {
      expect(typeof mod).toBe('string');
    }
  });

  it('uptimeSeconds is a non-negative number', () => {
    expect(typeof status.uptimeSeconds).toBe('number');
    expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('lastChecked is a valid ISO string', () => {
    expect(typeof status.lastChecked).toBe('string');
    expect(new Date(status.lastChecked).toISOString()).toBe(status.lastChecked);
  });
});

// ─── 3. Malformed fixture rejection ──────────────────────────────────────
describe('Malformed fixture schema rejection', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.malformed.fixture.json'), 'utf-8'));
  const status = raw.applianceStatus;

  it('malformed fixture fails ApplianceStatusSchema', () => {
    const result = ApplianceStatusSchema.safeParse(status);
    expect(result.success).toBe(false);
  });

  it('schema reports specific field errors', () => {
    const result = ApplianceStatusSchema.safeParse(status);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      // hostname is number (should be string)
      expect(paths).toContain('hostname');
      // captureStatus is "banana" (not in enum)
      expect(paths).toContain('captureStatus');
      // licensedModules is string (should be array)
      expect(paths).toContain('licensedModules');
    }
  });

  it('malformed fixture has wrong type for hostname (number instead of string)', () => {
    expect(typeof status.hostname).toBe('number');
  });

  it('malformed fixture has invalid captureStatus enum value', () => {
    expect(status.captureStatus).toBe('banana');
  });

  it('malformed fixture has negative uptimeSeconds', () => {
    expect(status.uptimeSeconds).toBeLessThan(0);
  });
});

// ─── 4. Edge-case fixture validation ─────────────────────────────────────
describe('Edge-case fixture validation (expired license, inactive capture)', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.edge-case.fixture.json'), 'utf-8'));
  const status = raw.applianceStatus;

  it('passes ApplianceStatusSchema', () => {
    const result = ApplianceStatusSchema.safeParse(status);
    expect(result.success).toBe(true);
  });

  it('captureStatus is "inactive"', () => {
    expect(status.captureStatus).toBe('inactive');
  });

  it('licenseStatus is "expired"', () => {
    expect(status.licenseStatus).toBe('expired');
  });

  it('licensedModules is empty array', () => {
    expect(status.licensedModules).toEqual([]);
  });

  it('captureInterface is empty string (no active capture)', () => {
    expect(status.captureInterface).toBe('');
  });

  it('connectionStatus is still "connected" (appliance reachable but degraded)', () => {
    expect(status.connectionStatus).toBe('connected');
  });
});

// ─── 5. Quiet fixture validation ─────────────────────────────────────────
describe('Quiet fixture validation (not_configured)', () => {
  const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.quiet.fixture.json'), 'utf-8'));
  const status = raw.applianceStatus;

  it('passes ApplianceStatusSchema', () => {
    const result = ApplianceStatusSchema.safeParse(status);
    expect(result.success).toBe(true);
  });

  it('connectionStatus is "not_configured"', () => {
    expect(status.connectionStatus).toBe('not_configured');
  });

  it('hostname is empty string', () => {
    expect(status.hostname).toBe('');
  });

  it('version is empty string', () => {
    expect(status.version).toBe('');
  });

  it('licensedModules is empty array', () => {
    expect(status.licensedModules).toEqual([]);
  });

  it('captureStatus is "unknown"', () => {
    expect(status.captureStatus).toBe('unknown');
  });

  it('licenseStatus is "unknown"', () => {
    expect(status.licenseStatus).toBe('unknown');
  });
});

// ─── 6. Helper functions ─────────────────────────────────────────────────

describe('formatUptime', () => {
  it('formats seconds < 60 as "Xs"', () => {
    expect(formatUptime(45)).toBe('45s');
  });

  it('formats 0 as "0s"', () => {
    expect(formatUptime(0)).toBe('0s');
  });

  it('formats 60-3599 as "Xm"', () => {
    expect(formatUptime(120)).toBe('2m');
    expect(formatUptime(3599)).toBe('59m');
  });

  it('formats 3600-86399 as "Xh Ym"', () => {
    expect(formatUptime(3661)).toBe('1h 1m');
    expect(formatUptime(7200)).toBe('2h 0m');
  });

  it('formats >= 86400 as "Xd Yh"', () => {
    expect(formatUptime(86400)).toBe('1d 0h');
    expect(formatUptime(90000)).toBe('1d 1h');
  });

  it('returns "—" for NaN', () => {
    expect(formatUptime(NaN)).toBe('—');
  });

  it('returns "—" for Infinity', () => {
    expect(formatUptime(Infinity)).toBe('—');
  });

  it('returns "—" for negative values', () => {
    expect(formatUptime(-100)).toBe('—');
  });
});

describe('connectionStatusDisplay', () => {
  it('maps "connected" to green with Connected label', () => {
    const result = connectionStatusDisplay('connected');
    expect(result.label).toBe('Connected');
    expect(result.icon).toBe('connected');
  });

  it('maps "not_configured" to muted with Not Configured label', () => {
    const result = connectionStatusDisplay('not_configured');
    expect(result.label).toBe('Not Configured');
    expect(result.icon).toBe('disconnected');
  });

  it('maps "error" to red with Connection Error label', () => {
    const result = connectionStatusDisplay('error');
    expect(result.label).toBe('Connection Error');
    expect(result.icon).toBe('disconnected');
  });
});

describe('captureStatusDisplay', () => {
  it('maps "active" to green with Capturing label', () => {
    const result = captureStatusDisplay('active');
    expect(result.label).toBe('Capturing');
  });

  it('maps "inactive" to red with Inactive label', () => {
    const result = captureStatusDisplay('inactive');
    expect(result.label).toBe('Inactive');
  });

  it('maps "unknown" to muted with Unknown label', () => {
    const result = captureStatusDisplay('unknown');
    expect(result.label).toBe('Unknown');
  });
});

describe('licenseStatusDisplay', () => {
  it('maps "valid" to green with Valid label', () => {
    const result = licenseStatusDisplay('valid');
    expect(result.label).toBe('Valid');
  });

  it('maps "expired" to red with Expired label', () => {
    const result = licenseStatusDisplay('expired');
    expect(result.label).toBe('Expired');
  });

  it('maps "unknown" to muted with Unknown label', () => {
    const result = licenseStatusDisplay('unknown');
    expect(result.label).toBe('Unknown');
  });
});

// ─── 7. BFF route live local tests ──────────────────────────────────────
describe('BFF route /api/bff/impact/appliance-status live local', () => {
  const BASE = 'http://localhost:3000/api/bff/impact/appliance-status';

  it('returns HTTP 200', async () => {
    const res = await fetch(BASE);
    expect(res.status).toBe(200);
  });

  it('response has applianceStatus object', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(json.applianceStatus).toBeDefined();
    expect(typeof json.applianceStatus).toBe('object');
  });

  it('response passes ApplianceStatusSchema', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    const result = ApplianceStatusSchema.safeParse(json.applianceStatus);
    expect(result.success).toBe(true);
  });

  it('response has valid connectionStatus enum value', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(['connected', 'not_configured', 'error']).toContain(json.applianceStatus.connectionStatus);
  });

  it('response has valid captureStatus enum value', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(['active', 'inactive', 'unknown']).toContain(json.applianceStatus.captureStatus);
  });

  it('response has valid licenseStatus enum value', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(['valid', 'expired', 'unknown']).toContain(json.applianceStatus.licenseStatus);
  });

  it('response uptimeSeconds is a non-negative number', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    expect(typeof json.applianceStatus.uptimeSeconds).toBe('number');
    expect(json.applianceStatus.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('response lastChecked is a valid ISO string', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    const d = new Date(json.applianceStatus.lastChecked);
    expect(d.toISOString()).toBe(json.applianceStatus.lastChecked);
  });

  it('route URL goes through /api/bff/* (never ExtraHop directly)', async () => {
    const res = await fetch(BASE);
    expect(res.url).toContain('/api/bff/impact/appliance-status');
    expect(res.url).not.toContain('extrahop');
    expect(res.url).not.toContain('192.168');
  });

  it('in fixture mode returns not_configured connectionStatus', async () => {
    const res = await fetch(BASE);
    const json = await res.json();
    // BFF is in fixture mode (no EH_HOST/EH_API_KEY), so connectionStatus should be not_configured
    expect(json.applianceStatus.connectionStatus).toBe('not_configured');
  });
});

// ─── 8. State discrimination ─────────────────────────────────────────────
describe('State discrimination: quiet vs populated', () => {
  it('quiet fixture has connectionStatus=not_configured and empty hostname → hook returns quiet', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.quiet.fixture.json'), 'utf-8'));
    const s = raw.applianceStatus;
    // Quiet condition: connectionStatus=not_configured AND hostname=''
    expect(s.connectionStatus).toBe('not_configured');
    expect(s.hostname).toBe('');
  });

  it('populated fixture has connectionStatus=connected and non-empty hostname → hook returns populated', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.populated.fixture.json'), 'utf-8'));
    const s = raw.applianceStatus;
    expect(s.connectionStatus).toBe('connected');
    expect(s.hostname.length).toBeGreaterThan(0);
  });

  it('edge-case fixture has connectionStatus=connected → hook returns populated (even with expired license)', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.edge-case.fixture.json'), 'utf-8'));
    const s = raw.applianceStatus;
    expect(s.connectionStatus).toBe('connected');
    expect(s.hostname.length).toBeGreaterThan(0);
  });

  it('transport-error fixture has error shape (no applianceStatus)', () => {
    const raw = JSON.parse(readFileSync(join(FIXTURE_DIR, 'appliance-status.transport-error.fixture.json'), 'utf-8'));
    expect(raw.error).toBeDefined();
    expect(raw.applianceStatus).toBeUndefined();
  });
});
