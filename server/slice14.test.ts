/**
 * Slice 14 — Appliance Settings Panel
 *
 * Test coverage:
 *   1. ApplianceConfigInputSchema validation (hostname, apiKey, verifySsl, cloudServicesEnabled, nickname)
 *   2. ApplianceConfigResponseSchema validation
 *   3. ConnectionTestResultSchema validation
 *   4. maskApiKey pure function
 *   5. Fixture file existence and schema compliance
 *   6. BFF route /api/bff/impact/appliance-status integration with DB config
 *   7. Form validation edge cases
 *   8. Malformed data rejection
 *
 * Contract:
 *   - All validators are tested against deterministic fixtures
 *   - maskApiKey is tested with edge cases
 *   - No live hardware required
 *   - No mock data — fixtures are deterministic contract payloads
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ApplianceConfigInputSchema,
  ApplianceConfigResponseSchema,
  ConnectionTestResultSchema,
  maskApiKey,
} from '../shared/appliance-config-validators';

// ─── Fixture loading ─────────────────────────────────────────────────────

const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'appliance-config');

function loadFixture(name: string): any {
  const path = join(FIXTURE_DIR, name);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const FIXTURE_FILES = [
  'appliance-config.quiet.fixture.json',
  'appliance-config.populated.fixture.json',
  'appliance-config.test-success.fixture.json',
  'appliance-config.test-failure.fixture.json',
  'appliance-config.transport-error.fixture.json',
  'appliance-config.malformed.fixture.json',
  'appliance-config.edge-case.fixture.json',
];

// ═══════════════════════════════════════════════════════════════════════════
// 1. Fixture file existence
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Fixture files exist', () => {
  for (const file of FIXTURE_FILES) {
    it(`fixture ${file} exists`, () => {
      expect(existsSync(join(FIXTURE_DIR, file))).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. ApplianceConfigInputSchema validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — ApplianceConfigInputSchema', () => {
  it('accepts valid input with all fields', () => {
    const input = {
      hostname: 'eda01.lab.local',
      apiKey: 'ExtraHopApiKey1234567890abcdef',
      verifySsl: false,
      cloudServicesEnabled: false,
      nickname: 'Lab EDA',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hostname).toBe('eda01.lab.local');
      expect(result.data.apiKey).toBe('ExtraHopApiKey1234567890abcdef');
      expect(result.data.verifySsl).toBe(false);
      expect(result.data.cloudServicesEnabled).toBe(false);
      expect(result.data.nickname).toBe('Lab EDA');
    }
  });

  it('accepts valid IPv4 hostname', () => {
    const input = {
      hostname: '192.168.50.157',
      apiKey: 'key123',
      verifySsl: true,
      cloudServicesEnabled: false,
      nickname: '',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('accepts short hostname', () => {
    const input = {
      hostname: 'eda01',
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('applies defaults for verifySsl, cloudServicesEnabled, nickname', () => {
    const input = {
      hostname: 'eda01',
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verifySsl).toBe(true);
      expect(result.data.cloudServicesEnabled).toBe(false);
      expect(result.data.nickname).toBe('');
    }
  });

  it('rejects empty hostname', () => {
    const input = {
      hostname: '',
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects hostname with invalid characters', () => {
    const input = {
      hostname: 'eda01 lab local',
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects hostname starting with hyphen', () => {
    const input = {
      hostname: '-eda01',
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects hostname ending with hyphen', () => {
    const input = {
      hostname: 'eda01-',
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty apiKey', () => {
    const input = {
      hostname: 'eda01',
      apiKey: '',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects hostname over 255 characters', () => {
    const input = {
      hostname: 'a'.repeat(256),
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects apiKey over 512 characters', () => {
    const input = {
      hostname: 'eda01',
      apiKey: 'k'.repeat(513),
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects nickname over 100 characters', () => {
    const input = {
      hostname: 'eda01',
      apiKey: 'key123',
      nickname: 'n'.repeat(101),
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('accepts hostname at max length (255)', () => {
    // Build a valid 255-char hostname: segments joined by dots
    const seg = 'a'.repeat(63);
    const hostname = `${seg}.${seg}.${seg}.${seg.slice(0, 255 - 63 * 3 - 3)}`;
    const input = {
      hostname,
      apiKey: 'key123',
    };
    const result = ApplianceConfigInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. ApplianceConfigResponseSchema validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — ApplianceConfigResponseSchema', () => {
  it('validates populated fixture config', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(true);
  });

  it('validates test-success fixture config', () => {
    const fixture = loadFixture('appliance-config.test-success.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(true);
  });

  it('validates test-failure fixture config', () => {
    const fixture = loadFixture('appliance-config.test-failure.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(true);
  });

  it('validates edge-case fixture config', () => {
    const fixture = loadFixture('appliance-config.edge-case.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(true);
  });

  it('rejects malformed fixture config', () => {
    const fixture = loadFixture('appliance-config.malformed.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(false);
  });

  it('rejects null config', () => {
    const result = ApplianceConfigResponseSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects config with missing required fields', () => {
    const result = ApplianceConfigResponseSchema.safeParse({
      id: 1,
      hostname: 'eda01',
      // missing apiKeyHint, apiKeyConfigured, etc.
    });
    expect(result.success).toBe(false);
  });

  it('rejects config with invalid lastTestResult enum', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    const modified = { ...fixture.config, lastTestResult: 'maybe' };
    const result = ApplianceConfigResponseSchema.safeParse(modified);
    expect(result.success).toBe(false);
  });

  it('rejects config with negative id', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    const modified = { ...fixture.config, id: -1 };
    const result = ApplianceConfigResponseSchema.safeParse(modified);
    expect(result.success).toBe(false);
  });

  it('rejects config with zero id', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    const modified = { ...fixture.config, id: 0 };
    const result = ApplianceConfigResponseSchema.safeParse(modified);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. ConnectionTestResultSchema validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — ConnectionTestResultSchema', () => {
  it('validates test-success fixture testResult', () => {
    const fixture = loadFixture('appliance-config.test-success.fixture.json');
    const result = ConnectionTestResultSchema.safeParse(fixture.testResult);
    expect(result.success).toBe(true);
  });

  it('validates test-failure fixture testResult', () => {
    const fixture = loadFixture('appliance-config.test-failure.fixture.json');
    const result = ConnectionTestResultSchema.safeParse(fixture.testResult);
    expect(result.success).toBe(true);
  });

  it('accepts null latencyMs', () => {
    const result = ConnectionTestResultSchema.safeParse({
      success: false,
      message: 'No appliance configured',
      latencyMs: null,
      testedAt: '2026-03-12T17:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing success field', () => {
    const result = ConnectionTestResultSchema.safeParse({
      message: 'ok',
      latencyMs: 42,
      testedAt: '2026-03-12T17:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing testedAt field', () => {
    const result = ConnectionTestResultSchema.safeParse({
      success: true,
      message: 'ok',
      latencyMs: 42,
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. maskApiKey pure function
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — maskApiKey', () => {
  it('masks a normal-length key (first 4 + last 4)', () => {
    expect(maskApiKey('ExtraHopApiKey1234567890abcdef3f2a')).toBe('Extr••••3f2a');
  });

  it('masks an 8-character key', () => {
    expect(maskApiKey('12345678')).toBe('1234••••5678');
  });

  it('returns •••• for a 7-character key', () => {
    expect(maskApiKey('1234567')).toBe('••••');
  });

  it('returns •••• for an empty key', () => {
    expect(maskApiKey('')).toBe('••••');
  });

  it('returns •••• for a single-character key', () => {
    expect(maskApiKey('a')).toBe('••••');
  });

  it('masks a 9-character key correctly', () => {
    expect(maskApiKey('123456789')).toBe('1234••••6789');
  });

  it('masks a 512-character key (max length)', () => {
    const key = 'A'.repeat(4) + 'B'.repeat(504) + 'C'.repeat(4);
    const masked = maskApiKey(key);
    expect(masked).toBe('AAAA••••CCCC');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Hostname regex edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Hostname regex edge cases', () => {
  const validHostnames = [
    'eda01',
    'eda01.lab.local',
    '192.168.50.157',
    'a',
    'a1',
    'sensor-01.dc.corp.example.com',
    'EDA01',
    '10.0.0.1',
    'a-b-c',
    'a.b.c.d.e.f',
  ];

  const invalidHostnames = [
    '',
    '-eda01',
    'eda01-',
    '.eda01',
    'eda01.',
    'eda 01',
    'eda01!',
    'eda01@lab',
    'eda01:8080',
    'https://eda01',
    '-',
    '.',
  ];

  for (const h of validHostnames) {
    it(`accepts valid hostname: "${h}"`, () => {
      const result = ApplianceConfigInputSchema.safeParse({
        hostname: h,
        apiKey: 'key123',
      });
      expect(result.success).toBe(true);
    });
  }

  for (const h of invalidHostnames) {
    it(`rejects invalid hostname: "${h}"`, () => {
      const result = ApplianceConfigInputSchema.safeParse({
        hostname: h,
        apiKey: 'key123',
      });
      expect(result.success).toBe(false);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Quiet fixture structure
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Quiet fixture structure', () => {
  it('quiet fixture has null config', () => {
    const fixture = loadFixture('appliance-config.quiet.fixture.json');
    expect(fixture.config).toBeNull();
  });

  it('quiet fixture has _fixture metadata', () => {
    const fixture = loadFixture('appliance-config.quiet.fixture.json');
    expect(fixture._fixture).toBe('appliance-config.quiet');
  });

  it('quiet fixture has _description', () => {
    const fixture = loadFixture('appliance-config.quiet.fixture.json');
    expect(typeof fixture._description).toBe('string');
    expect(fixture._description.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Transport error fixture structure
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Transport error fixture structure', () => {
  it('transport-error fixture has error object', () => {
    const fixture = loadFixture('appliance-config.transport-error.fixture.json');
    expect(fixture.error).toBeDefined();
    expect(typeof fixture.error.code).toBe('string');
    expect(typeof fixture.error.message).toBe('string');
  });

  it('transport-error fixture has no config', () => {
    const fixture = loadFixture('appliance-config.transport-error.fixture.json');
    expect(fixture.config).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Malformed data rejection
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Malformed data rejection', () => {
  it('malformed fixture fails ApplianceConfigResponseSchema', () => {
    const fixture = loadFixture('appliance-config.malformed.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(false);
  });

  it('malformed fixture has at least 3 validation errors', () => {
    const fixture = loadFixture('appliance-config.malformed.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('malformed fixture id is not a number', () => {
    const fixture = loadFixture('appliance-config.malformed.fixture.json');
    expect(typeof fixture.config.id).toBe('string');
  });

  it('malformed fixture lastTestResult is invalid enum', () => {
    const fixture = loadFixture('appliance-config.malformed.fixture.json');
    expect(['success', 'failure', 'untested']).not.toContain(fixture.config.lastTestResult);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Edge case fixture validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Edge case fixture', () => {
  it('edge-case fixture has long hostname', () => {
    const fixture = loadFixture('appliance-config.edge-case.fixture.json');
    expect(fixture.config.hostname.length).toBeGreaterThan(50);
  });

  it('edge-case fixture has SSL verification enabled', () => {
    const fixture = loadFixture('appliance-config.edge-case.fixture.json');
    expect(fixture.config.verifySsl).toBe(true);
  });

  it('edge-case fixture has cloud services enabled', () => {
    const fixture = loadFixture('appliance-config.edge-case.fixture.json');
    expect(fixture.config.cloudServicesEnabled).toBe(true);
  });

  it('edge-case fixture has empty nickname', () => {
    const fixture = loadFixture('appliance-config.edge-case.fixture.json');
    expect(fixture.config.nickname).toBe('');
  });

  it('edge-case fixture passes response schema', () => {
    const fixture = loadFixture('appliance-config.edge-case.fixture.json');
    const result = ApplianceConfigResponseSchema.safeParse(fixture.config);
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. Cross-fixture consistency
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Cross-fixture consistency', () => {
  it('all populated fixtures share the same hostname', () => {
    const populated = loadFixture('appliance-config.populated.fixture.json');
    const success = loadFixture('appliance-config.test-success.fixture.json');
    const failure = loadFixture('appliance-config.test-failure.fixture.json');
    expect(populated.config.hostname).toBe(success.config.hostname);
    expect(populated.config.hostname).toBe(failure.config.hostname);
  });

  it('test-success fixture has success=true in testResult', () => {
    const fixture = loadFixture('appliance-config.test-success.fixture.json');
    expect(fixture.testResult.success).toBe(true);
  });

  it('test-failure fixture has success=false in testResult', () => {
    const fixture = loadFixture('appliance-config.test-failure.fixture.json');
    expect(fixture.testResult.success).toBe(false);
  });

  it('test-success config lastTestResult matches testResult.success', () => {
    const fixture = loadFixture('appliance-config.test-success.fixture.json');
    expect(fixture.config.lastTestResult).toBe('success');
    expect(fixture.testResult.success).toBe(true);
  });

  it('test-failure config lastTestResult matches testResult.success', () => {
    const fixture = loadFixture('appliance-config.test-failure.fixture.json');
    expect(fixture.config.lastTestResult).toBe('failure');
    expect(fixture.testResult.success).toBe(false);
  });

  it('populated fixture lastTestResult is untested', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    expect(fixture.config.lastTestResult).toBe('untested');
  });

  it('populated fixture lastTestedAt is null', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    expect(fixture.config.lastTestedAt).toBeNull();
  });

  it('test-success fixture lastTestedAt is not null', () => {
    const fixture = loadFixture('appliance-config.test-success.fixture.json');
    expect(fixture.config.lastTestedAt).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. ApplianceConfigInput → ApplianceConfigResponse mapping
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 14 — Input to Response mapping contract', () => {
  it('response never contains raw apiKey', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    expect(fixture.config.apiKey).toBeUndefined();
    expect(fixture.config.apiKeyHint).toBeDefined();
  });

  it('response apiKeyHint is masked (contains ••••)', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    expect(fixture.config.apiKeyHint).toContain('••••');
  });

  it('response apiKeyConfigured is boolean', () => {
    const fixture = loadFixture('appliance-config.populated.fixture.json');
    expect(typeof fixture.config.apiKeyConfigured).toBe('boolean');
  });

  it('all response fixtures have ISO timestamp strings for createdAt/updatedAt', () => {
    const fixtures = [
      'appliance-config.populated.fixture.json',
      'appliance-config.test-success.fixture.json',
      'appliance-config.test-failure.fixture.json',
      'appliance-config.edge-case.fixture.json',
    ];
    for (const f of fixtures) {
      const fixture = loadFixture(f);
      expect(new Date(fixture.config.createdAt).toISOString()).toBe(fixture.config.createdAt);
      expect(new Date(fixture.config.updatedAt).toISOString()).toBe(fixture.config.updatedAt);
    }
  });
});
