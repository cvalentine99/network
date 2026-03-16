/**
 * Slice 23 — Cross-Surface Navigation Wiring
 *
 * Tests cover:
 * 1. URL builders — deterministic URL generation from navigation intents
 * 2. URL parsers — round-trip parsing from query strings
 * 3. Link builders — metadata generation for all 5 navigation paths
 * 4. Quiet/empty state — missing or incomplete params return null
 * 5. Malformed input — invalid modes, empty values rejected
 * 6. Navigation matrix — all documented paths exist and are valid
 * 7. Schema validation — Zod schemas accept valid and reject invalid intents
 * 8. Time window invariant — URLs never encode time window params
 * 9. Fixture round-trips — every fixture produces the expected output
 * 10. Cross-cutting invariants — no direct ExtraHop URLs, BFF-only
 *
 * Live integration: not attempted. Deferred by contract.
 */

import { describe, it, expect } from 'vitest';
import {
  buildBlastRadiusUrl,
  buildFlowTheaterUrl,
  parseBlastRadiusNav,
  parseFlowTheaterNav,
  buildTopologyToBlastRadiusLink,
  buildCorrelationToBlastRadiusLink,
  buildBlastRadiusToFlowTheaterLink,
  buildFlowTheaterToBlastRadiusLink,
  CROSS_SURFACE_NAV_MATRIX,
  NAV_PARAM,
  BlastRadiusNavIntentSchema,
  FlowTheaterNavIntentSchema,
  CrossSurfaceNavIntentSchema,
  CrossSurfaceLinkSchema,
} from '../shared/cross-surface-nav-types';
import type {
  BlastRadiusEntryMode,
  FlowTheaterEntryMode,
  CrossSurfaceLink,
} from '../shared/cross-surface-nav-types';

// ─── Fixture imports ──────────────────────────────────────────────────────
import topoToBR from '../fixtures/cross-surface-nav/topology-to-blast-radius.fixture.json';
import corrToBR from '../fixtures/cross-surface-nav/correlation-to-blast-radius.fixture.json';
import brToFT from '../fixtures/cross-surface-nav/blast-radius-to-flow-theater.fixture.json';
import ftToBR from '../fixtures/cross-surface-nav/flow-theater-to-blast-radius.fixture.json';
import quietFixture from '../fixtures/cross-surface-nav/quiet-state.fixture.json';
import malformedFixture from '../fixtures/cross-surface-nav/malformed.fixture.json';

// ═══════════════════════════════════════════════════════════════════════════
// 1. URL Builders
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — URL Builders', () => {
  describe('buildBlastRadiusUrl', () => {
    it('builds URL with device-id mode', () => {
      const url = buildBlastRadiusUrl({ mode: 'device-id', value: '1042' });
      expect(url).toBe('/blast-radius?brMode=device-id&brValue=1042');
    });

    it('builds URL with hostname mode', () => {
      const url = buildBlastRadiusUrl({ mode: 'hostname', value: 'dc01.lab.local' });
      expect(url).toBe('/blast-radius?brMode=hostname&brValue=dc01.lab.local');
    });

    it('builds URL with ip-address mode', () => {
      const url = buildBlastRadiusUrl({ mode: 'ip-address', value: '10.1.1.50' });
      expect(url).toBe('/blast-radius?brMode=ip-address&brValue=10.1.1.50');
    });

    it('includes autoSubmit flag when true', () => {
      const url = buildBlastRadiusUrl({ mode: 'device-id', value: '1042', autoSubmit: true });
      expect(url).toContain('brAuto=1');
    });

    it('omits autoSubmit flag when false or undefined', () => {
      const url1 = buildBlastRadiusUrl({ mode: 'device-id', value: '1042', autoSubmit: false });
      const url2 = buildBlastRadiusUrl({ mode: 'device-id', value: '1042' });
      expect(url1).not.toContain('brAuto');
      expect(url2).not.toContain('brAuto');
    });

    it('always starts with /blast-radius?', () => {
      const modes: BlastRadiusEntryMode[] = ['device-id', 'hostname', 'ip-address'];
      for (const mode of modes) {
        const url = buildBlastRadiusUrl({ mode, value: 'test' });
        expect(url).toMatch(/^\/blast-radius\?/);
      }
    });
  });

  describe('buildFlowTheaterUrl', () => {
    it('builds URL with hostname mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'hostname', value: 'dc01.lab.local' });
      expect(url).toBe('/flow-theater?ftMode=hostname&ftValue=dc01.lab.local');
    });

    it('builds URL with device mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'device', value: '1042' });
      expect(url).toBe('/flow-theater?ftMode=device&ftValue=1042');
    });

    it('builds URL with service-row mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'service-row', value: 'SMB::1042' });
      expect(url).toBe('/flow-theater?ftMode=service-row&ftValue=SMB%3A%3A1042');
    });

    it('includes autoSubmit flag when true', () => {
      const url = buildFlowTheaterUrl({ mode: 'hostname', value: 'test', autoSubmit: true });
      expect(url).toContain('ftAuto=1');
    });

    it('always starts with /flow-theater?', () => {
      const modes: FlowTheaterEntryMode[] = ['hostname', 'device', 'service-row', 'ip', 'cidr'];
      for (const mode of modes) {
        const url = buildFlowTheaterUrl({ mode, value: 'test' });
        expect(url).toMatch(/^\/flow-theater\?/);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. URL Parsers — Round-Trip
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — URL Parsers', () => {
  describe('parseBlastRadiusNav', () => {
    it('round-trips device-id mode', () => {
      const url = buildBlastRadiusUrl({ mode: 'device-id', value: '1042', autoSubmit: true });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseBlastRadiusNav(params);
      expect(parsed).toEqual({ mode: 'device-id', value: '1042', autoSubmit: true });
    });

    it('round-trips hostname mode', () => {
      const url = buildBlastRadiusUrl({ mode: 'hostname', value: 'dc01.lab.local' });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseBlastRadiusNav(params);
      expect(parsed).toEqual({ mode: 'hostname', value: 'dc01.lab.local', autoSubmit: false });
    });

    it('round-trips ip-address mode', () => {
      const url = buildBlastRadiusUrl({ mode: 'ip-address', value: '10.1.1.50', autoSubmit: true });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseBlastRadiusNav(params);
      expect(parsed).toEqual({ mode: 'ip-address', value: '10.1.1.50', autoSubmit: true });
    });

    it('returns null for empty params', () => {
      expect(parseBlastRadiusNav(new URLSearchParams())).toBeNull();
    });

    it('returns null for missing value', () => {
      expect(parseBlastRadiusNav(new URLSearchParams('brMode=device-id'))).toBeNull();
    });

    it('returns null for missing mode', () => {
      expect(parseBlastRadiusNav(new URLSearchParams('brValue=1042'))).toBeNull();
    });

    it('returns null for invalid mode', () => {
      expect(parseBlastRadiusNav(new URLSearchParams('brMode=invalid&brValue=1042'))).toBeNull();
    });
  });

  describe('parseFlowTheaterNav', () => {
    it('round-trips hostname mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'hostname', value: 'dc01.lab.local', autoSubmit: true });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseFlowTheaterNav(params);
      expect(parsed).toEqual({ mode: 'hostname', value: 'dc01.lab.local', autoSubmit: true });
    });

    it('round-trips device mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'device', value: '1042' });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseFlowTheaterNav(params);
      expect(parsed).toEqual({ mode: 'device', value: '1042', autoSubmit: false });
    });

    it('round-trips service-row mode (with URL encoding)', () => {
      const url = buildFlowTheaterUrl({ mode: 'service-row', value: 'SMB::1042', autoSubmit: true });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseFlowTheaterNav(params);
      expect(parsed).toEqual({ mode: 'service-row', value: 'SMB::1042', autoSubmit: true });
    });

    it('round-trips ip mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'ip', value: '10.1.20.42', autoSubmit: true });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseFlowTheaterNav(params);
      expect(parsed).toEqual({ mode: 'ip', value: '10.1.20.42', autoSubmit: true });
    });

    it('round-trips cidr mode', () => {
      const url = buildFlowTheaterUrl({ mode: 'cidr', value: '10.1.20.0/24', autoSubmit: true });
      const params = new URLSearchParams(url.split('?')[1]);
      const parsed = parseFlowTheaterNav(params);
      expect(parsed).toEqual({ mode: 'cidr', value: '10.1.20.0/24', autoSubmit: true });
    });

    it('returns null for empty params', () => {
      expect(parseFlowTheaterNav(new URLSearchParams())).toBeNull();
    });

    it('returns null for invalid mode', () => {
      expect(parseFlowTheaterNav(new URLSearchParams('ftMode=invalid&ftValue=test'))).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Link Builders
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Link Builders', () => {
  describe('buildTopologyToBlastRadiusLink', () => {
    it('builds correct link from topology node', () => {
      const link = buildTopologyToBlastRadiusLink(1042, 'dc01.lab.local', '10.1.1.50');
      expect(link.label).toBe('Blast Radius: dc01.lab.local');
      expect(link.href).toContain('/blast-radius?');
      expect(link.href).toContain('brMode=device-id');
      expect(link.href).toContain('brValue=1042');
      expect(link.href).toContain('brAuto=1');
      expect(link.targetSurface).toBe('blast-radius');
      expect(link.sourceSurface).toBe('topology');
      expect(link.entityContext).toBe('topology-node-1042');
    });

    it('validates against CrossSurfaceLinkSchema', () => {
      const link = buildTopologyToBlastRadiusLink(1042, 'dc01.lab.local');
      expect(CrossSurfaceLinkSchema.safeParse(link).success).toBe(true);
    });

    it('matches fixture expectation', () => {
      const link = buildTopologyToBlastRadiusLink(
        topoToBR.sourceNode.id,
        topoToBR.sourceNode.displayName,
        topoToBR.sourceNode.ipaddr,
      );
      expect(link).toEqual(topoToBR.expectedLink);
    });
  });

  describe('buildCorrelationToBlastRadiusLink', () => {
    it('builds link for device ref', () => {
      const link = buildCorrelationToBlastRadiusLink('device', '2048');
      expect(link).not.toBeNull();
      expect(link!.href).toContain('brMode=device-id');
      expect(link!.href).toContain('brValue=2048');
    });

    it('builds link for IP ref', () => {
      const link = buildCorrelationToBlastRadiusLink('ip', '10.1.1.100');
      expect(link).not.toBeNull();
      expect(link!.href).toContain('brMode=ip-address');
    });

    it('builds link for hostname ref', () => {
      const link = buildCorrelationToBlastRadiusLink('hostname', 'web01.lab.local');
      expect(link).not.toBeNull();
      expect(link!.href).toContain('brMode=hostname');
    });

    it('returns null for non-navigable ref kinds', () => {
      expect(buildCorrelationToBlastRadiusLink('protocol', 'SMB')).toBeNull();
      expect(buildCorrelationToBlastRadiusLink('detection', 'det-123')).toBeNull();
      expect(buildCorrelationToBlastRadiusLink('alert', 'alert-456')).toBeNull();
    });

    it('matches fixture expectations for all scenarios', () => {
      for (const scenario of corrToBR.scenarios) {
        const link = buildCorrelationToBlastRadiusLink(scenario.refKind, scenario.refLabel);
        if (scenario.expectedLink === null) {
          expect(link).toBeNull();
        } else {
          expect(link).toEqual(scenario.expectedLink);
        }
      }
    });
  });

  describe('buildBlastRadiusToFlowTheaterLink', () => {
    it('builds correct link from peer', () => {
      const link = buildBlastRadiusToFlowTheaterLink('fileserver.lab.local', 3001);
      expect(link.label).toBe('Trace: fileserver.lab.local');
      expect(link.href).toContain('/flow-theater?');
      expect(link.href).toContain('ftMode=hostname');
      expect(link.href).toContain('ftValue=fileserver.lab.local');
      expect(link.targetSurface).toBe('flow-theater');
      expect(link.sourceSurface).toBe('blast-radius');
    });

    it('matches fixture expectation', () => {
      const link = buildBlastRadiusToFlowTheaterLink(
        brToFT.sourcePeer.displayName,
        brToFT.sourcePeer.deviceId,
      );
      expect(link).toEqual(brToFT.expectedLink);
    });
  });

  describe('buildFlowTheaterToBlastRadiusLink', () => {
    it('uses device-id mode when deviceId is provided', () => {
      const link = buildFlowTheaterToBlastRadiusLink('dc01.lab.local', 1042);
      expect(link.href).toContain('brMode=device-id');
      expect(link.href).toContain('brValue=1042');
    });

    it('falls back to hostname mode when deviceId is undefined', () => {
      const link = buildFlowTheaterToBlastRadiusLink('unknown-host.lab.local');
      expect(link.href).toContain('brMode=hostname');
      expect(link.href).toContain('brValue=unknown-host.lab.local');
    });

    it('matches fixture expectations for all scenarios', () => {
      for (const scenario of ftToBR.scenarios) {
        const link = buildFlowTheaterToBlastRadiusLink(
          scenario.displayName,
          scenario.deviceId ?? undefined,
        );
        expect(link).toEqual(scenario.expectedLink);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Quiet/Empty State — Missing or Incomplete Params
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Quiet/Empty State', () => {
  it('all quiet fixture scenarios return null for both parsers', () => {
    for (const scenario of quietFixture.scenarios) {
      const params = new URLSearchParams(scenario.queryString);
      const br = parseBlastRadiusNav(params);
      const ft = parseFlowTheaterNav(params);
      expect(br).toBeNull();
      expect(ft).toBeNull();
    }
  });

  it('parser returns null when only unrelated params are present', () => {
    const params = new URLSearchParams('foo=bar&baz=qux');
    expect(parseBlastRadiusNav(params)).toBeNull();
    expect(parseFlowTheaterNav(params)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Malformed Input Rejection
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Malformed Input', () => {
  it('rejects empty value string', () => {
    const params = new URLSearchParams('brMode=device-id&brValue=');
    // URLSearchParams returns '' for empty value, which is falsy
    expect(parseBlastRadiusNav(params)).toBeNull();
  });

  it('rejects mode with extra whitespace', () => {
    const params = new URLSearchParams('brMode= device-id &brValue=1042');
    expect(parseBlastRadiusNav(params)).toBeNull();
  });

  it('rejects completely invalid mode strings', () => {
    const invalidModes = ['DEVICE-ID', 'Device-Id', 'deviceid', 'host', 'ip', 'address'];
    for (const mode of invalidModes) {
      const params = new URLSearchParams(`brMode=${mode}&brValue=test`);
      expect(parseBlastRadiusNav(params)).toBeNull();
    }
  });

  it('rejects invalid Flow Theater modes', () => {
    const invalidModes = ['HOSTNAME', 'Device', 'service', 'servicerow'];
    for (const mode of invalidModes) {
      const params = new URLSearchParams(`ftMode=${mode}&ftValue=test`);
      expect(parseFlowTheaterNav(params)).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Navigation Matrix
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Navigation Matrix', () => {
  it('documents exactly 5 cross-surface navigation paths', () => {
    expect(CROSS_SURFACE_NAV_MATRIX).toHaveLength(5);
  });

  it('every matrix entry has required fields', () => {
    for (const entry of CROSS_SURFACE_NAV_MATRIX) {
      expect(entry.from).toBeTruthy();
      expect(entry.to).toBeTruthy();
      expect(entry.trigger).toBeTruthy();
      expect(entry.mechanism).toBeTruthy();
    }
  });

  it('includes topology → blast-radius path', () => {
    const path = CROSS_SURFACE_NAV_MATRIX.find(e => e.from === 'topology' && e.to === 'blast-radius');
    expect(path).toBeDefined();
  });

  it('includes correlation → blast-radius path', () => {
    const path = CROSS_SURFACE_NAV_MATRIX.find(e => e.from === 'correlation' && e.to === 'blast-radius');
    expect(path).toBeDefined();
  });

  it('includes blast-radius → flow-theater path', () => {
    const path = CROSS_SURFACE_NAV_MATRIX.find(e => e.from === 'blast-radius' && e.to === 'flow-theater');
    expect(path).toBeDefined();
  });

  it('includes flow-theater → blast-radius path', () => {
    const path = CROSS_SURFACE_NAV_MATRIX.find(e => e.from === 'flow-theater' && e.to === 'blast-radius');
    expect(path).toBeDefined();
  });

  it('includes topology → impact-deck (inspector) path', () => {
    const path = CROSS_SURFACE_NAV_MATRIX.find(e => e.from === 'topology' && e.to === 'impact-deck');
    expect(path).toBeDefined();
  });

  it('no matrix entry references direct ExtraHop access', () => {
    for (const entry of CROSS_SURFACE_NAV_MATRIX) {
      expect(entry.mechanism.toLowerCase()).not.toContain('extrahop');
      expect(entry.mechanism.toLowerCase()).not.toContain('appliance');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Schema Validation
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Schema Validation', () => {
  describe('BlastRadiusNavIntentSchema', () => {
    it('accepts valid intent', () => {
      const result = BlastRadiusNavIntentSchema.safeParse({
        surface: 'blast-radius',
        mode: 'device-id',
        value: '1042',
        autoSubmit: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid mode', () => {
      const result = BlastRadiusNavIntentSchema.safeParse({
        surface: 'blast-radius',
        mode: 'invalid',
        value: '1042',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty value', () => {
      const result = BlastRadiusNavIntentSchema.safeParse({
        surface: 'blast-radius',
        mode: 'device-id',
        value: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects wrong surface', () => {
      const result = BlastRadiusNavIntentSchema.safeParse({
        surface: 'flow-theater',
        mode: 'device-id',
        value: '1042',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('FlowTheaterNavIntentSchema', () => {
    it('accepts valid intent', () => {
      const result = FlowTheaterNavIntentSchema.safeParse({
        surface: 'flow-theater',
        mode: 'hostname',
        value: 'dc01.lab.local',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid mode', () => {
      const result = FlowTheaterNavIntentSchema.safeParse({
        surface: 'flow-theater',
        mode: 'ip-address',
        value: 'test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CrossSurfaceNavIntentSchema (discriminated union)', () => {
    it('accepts blast-radius intent', () => {
      const result = CrossSurfaceNavIntentSchema.safeParse({
        surface: 'blast-radius',
        mode: 'hostname',
        value: 'test.local',
      });
      expect(result.success).toBe(true);
    });

    it('accepts flow-theater intent', () => {
      const result = CrossSurfaceNavIntentSchema.safeParse({
        surface: 'flow-theater',
        mode: 'device',
        value: '42',
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown surface', () => {
      const result = CrossSurfaceNavIntentSchema.safeParse({
        surface: 'topology',
        mode: 'device-id',
        value: '1042',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('CrossSurfaceLinkSchema', () => {
    it('validates all link builder outputs', () => {
      const links: CrossSurfaceLink[] = [
        buildTopologyToBlastRadiusLink(1042, 'dc01.lab.local'),
        buildBlastRadiusToFlowTheaterLink('fileserver.lab.local', 3001),
        buildFlowTheaterToBlastRadiusLink('dc01.lab.local', 1042),
      ];
      const corrLink = buildCorrelationToBlastRadiusLink('device', '2048');
      if (corrLink) links.push(corrLink);

      for (const link of links) {
        const result = CrossSurfaceLinkSchema.safeParse(link);
        expect(result.success).toBe(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Time Window Invariant
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Time Window Invariant', () => {
  it('Blast Radius URLs never contain time window params', () => {
    const url = buildBlastRadiusUrl({ mode: 'device-id', value: '1042', autoSubmit: true });
    expect(url).not.toContain('fromMs');
    expect(url).not.toContain('untilMs');
    expect(url).not.toContain('durationMs');
    expect(url).not.toContain('cycle');
    expect(url).not.toContain('timeWindow');
  });

  it('Flow Theater URLs never contain time window params', () => {
    const url = buildFlowTheaterUrl({ mode: 'hostname', value: 'test', autoSubmit: true });
    expect(url).not.toContain('fromMs');
    expect(url).not.toContain('untilMs');
    expect(url).not.toContain('durationMs');
    expect(url).not.toContain('cycle');
    expect(url).not.toContain('timeWindow');
  });

  it('NAV_PARAM constants do not include any time-related keys', () => {
    const allParams = Object.values(NAV_PARAM);
    for (const param of allParams) {
      expect(param.toLowerCase()).not.toContain('time');
      expect(param.toLowerCase()).not.toContain('window');
      expect(param.toLowerCase()).not.toContain('from');
      expect(param.toLowerCase()).not.toContain('until');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Fixture Round-Trips
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Fixture Round-Trips', () => {
  it('topology → blast-radius fixture round-trips through builder and parser', () => {
    const link = buildTopologyToBlastRadiusLink(
      topoToBR.sourceNode.id,
      topoToBR.sourceNode.displayName,
      topoToBR.sourceNode.ipaddr,
    );
    const params = new URLSearchParams(link.href.split('?')[1]);
    const parsed = parseBlastRadiusNav(params);
    expect(parsed).toEqual(topoToBR.expectedParsed);
  });

  it('blast-radius → flow-theater fixture round-trips through builder and parser', () => {
    const link = buildBlastRadiusToFlowTheaterLink(
      brToFT.sourcePeer.displayName,
      brToFT.sourcePeer.deviceId,
    );
    const params = new URLSearchParams(link.href.split('?')[1]);
    const parsed = parseFlowTheaterNav(params);
    expect(parsed).toEqual(brToFT.expectedParsed);
  });

  it('all correlation fixture scenarios produce expected links', () => {
    for (const scenario of corrToBR.scenarios) {
      const link = buildCorrelationToBlastRadiusLink(scenario.refKind, scenario.refLabel);
      if (scenario.expectedLink === null) {
        expect(link).toBeNull();
      } else {
        expect(link).toEqual(scenario.expectedLink);
      }
    }
  });

  it('all flow-theater-to-blast-radius fixture scenarios produce expected links', () => {
    for (const scenario of ftToBR.scenarios) {
      const link = buildFlowTheaterToBlastRadiusLink(
        scenario.displayName,
        scenario.deviceId ?? undefined,
      );
      expect(link).toEqual(scenario.expectedLink);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. Cross-Cutting Invariants
// ═══════════════════════════════════════════════════════════════════════════

describe('Slice 23 — Cross-Cutting Invariants', () => {
  it('no URL builder produces URLs containing ExtraHop hostnames', () => {
    const urls = [
      buildBlastRadiusUrl({ mode: 'device-id', value: '1042' }),
      buildFlowTheaterUrl({ mode: 'hostname', value: 'dc01.lab.local' }),
    ];
    for (const url of urls) {
      expect(url).not.toContain('extrahop');
      expect(url).not.toContain(':443');
      expect(url).not.toContain('https://');
    }
  });

  it('all URLs are relative paths (BFF-only, no absolute URLs)', () => {
    const urls = [
      buildBlastRadiusUrl({ mode: 'device-id', value: '1042' }),
      buildBlastRadiusUrl({ mode: 'hostname', value: 'test' }),
      buildBlastRadiusUrl({ mode: 'ip-address', value: '10.0.0.1' }),
      buildFlowTheaterUrl({ mode: 'hostname', value: 'test' }),
      buildFlowTheaterUrl({ mode: 'device', value: '42' }),
      buildFlowTheaterUrl({ mode: 'service-row', value: 'SMB::42' }),
    ];
    for (const url of urls) {
      expect(url).toMatch(/^\//);
      expect(url).not.toMatch(/^https?:\/\//);
    }
  });

  it('link builder outputs always have non-empty entityContext', () => {
    const links = [
      buildTopologyToBlastRadiusLink(1, 'test'),
      buildBlastRadiusToFlowTheaterLink('test', 1),
      buildFlowTheaterToBlastRadiusLink('test', 1),
    ];
    const corrLink = buildCorrelationToBlastRadiusLink('device', '1');
    if (corrLink) links.push(corrLink);

    for (const link of links) {
      expect(link.entityContext.length).toBeGreaterThan(0);
    }
  });

  it('source and target surfaces are always different in link outputs', () => {
    const links = [
      buildTopologyToBlastRadiusLink(1, 'test'),
      buildBlastRadiusToFlowTheaterLink('test', 1),
      buildFlowTheaterToBlastRadiusLink('test', 1),
    ];
    const corrLink = buildCorrelationToBlastRadiusLink('device', '1');
    if (corrLink) links.push(corrLink);

    for (const link of links) {
      expect(link.sourceSurface).not.toBe(link.targetSurface);
    }
  });

  it('fixture files exist for all navigation paths', () => {
    expect(topoToBR).toBeDefined();
    expect(corrToBR).toBeDefined();
    expect(brToFT).toBeDefined();
    expect(ftToBR).toBeDefined();
    expect(quietFixture).toBeDefined();
    expect(malformedFixture).toBeDefined();
  });
});
