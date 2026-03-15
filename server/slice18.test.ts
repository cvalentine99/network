/**
 * Slice 18 — Blast Radius: Comprehensive Test Suite
 *
 * Tests cover:
 * 1. Zod schema validation (entry mode, intent, severity, protocol, detection, peer, source, summary, payload, view state)
 * 2. Pure function tests (buildInitialBlastRadiusState, sortBlastRadiusPeers, filterAffectedPeers, getSeverityColor, calculateImpactScore)
 * 3. Fixture validation (all 7 fixtures pass/fail schema as expected)
 * 4. BFF route tests via supertest (populated, quiet, error, transport-error, invalid intent, hostname, ip-address)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Shared types
import type {
  BlastRadiusPeer, BlastRadiusPayload, BlastRadiusViewState,
  BlastRadiusSeverity, BlastRadiusSortField,
} from '../shared/blast-radius-types';
import {
  buildInitialBlastRadiusState, sortBlastRadiusPeers,
  filterAffectedPeers, getSeverityColor, calculateImpactScore,
} from '../shared/blast-radius-types';

// Validators
import {
  BlastRadiusEntryModeSchema,
  BlastRadiusIntentSchema,
  BlastRadiusSeveritySchema,
  BlastRadiusProtocolSchema,
  BlastRadiusDetectionSchema,
  BlastRadiusPeerSchema,
  BlastRadiusSourceSchema,
  BlastRadiusSummarySchema,
  BlastRadiusPayloadSchema,
  BlastRadiusStatusSchema,
  BlastRadiusSortFieldSchema,
  BlastRadiusViewStateSchema,
  BlastRadiusTimeWindowSchema,
} from '../shared/blast-radius-validators';

// ─── Fixture helpers ───────────────────────────────────────────────────────

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'blast-radius');

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf-8'));
}

function listFixtures(): string[] {
  return readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.fixture.json'));
}

// ─── 1. Schema Validation Tests ────────────────────────────────────────────

describe('Slice 18 — Schema Validation', () => {
  describe('BlastRadiusEntryModeSchema', () => {
    it('accepts valid entry modes', () => {
      expect(BlastRadiusEntryModeSchema.parse('device-id')).toBe('device-id');
      expect(BlastRadiusEntryModeSchema.parse('hostname')).toBe('hostname');
      expect(BlastRadiusEntryModeSchema.parse('ip-address')).toBe('ip-address');
    });

    it('rejects invalid entry modes', () => {
      expect(BlastRadiusEntryModeSchema.safeParse('mac-address').success).toBe(false);
      expect(BlastRadiusEntryModeSchema.safeParse('').success).toBe(false);
      expect(BlastRadiusEntryModeSchema.safeParse(123).success).toBe(false);
      expect(BlastRadiusEntryModeSchema.safeParse(null).success).toBe(false);
    });
  });

  describe('BlastRadiusTimeWindowSchema', () => {
    it('accepts valid time window', () => {
      const tw = { fromMs: 1710000000000, untilMs: 1710001800000, durationMs: 1800000, cycle: '30sec' as const };
      expect(BlastRadiusTimeWindowSchema.parse(tw)).toEqual(tw);
    });

    it('rejects untilMs <= fromMs', () => {
      const tw = { fromMs: 1710001800000, untilMs: 1710000000000, durationMs: 1800000, cycle: '30sec' as const };
      expect(BlastRadiusTimeWindowSchema.safeParse(tw).success).toBe(false);
    });

    it('rejects negative durationMs', () => {
      const tw = { fromMs: 1710000000000, untilMs: 1710001800000, durationMs: -1, cycle: '30sec' as const };
      expect(BlastRadiusTimeWindowSchema.safeParse(tw).success).toBe(false);
    });

    it('rejects invalid cycle', () => {
      const tw = { fromMs: 1710000000000, untilMs: 1710001800000, durationMs: 1800000, cycle: '10sec' };
      expect(BlastRadiusTimeWindowSchema.safeParse(tw).success).toBe(false);
    });
  });

  describe('BlastRadiusIntentSchema', () => {
    const validIntent = {
      mode: 'device-id',
      value: '1042',
      timeWindow: { fromMs: 1710000000000, untilMs: 1710001800000, durationMs: 1800000, cycle: '30sec' },
    };

    it('accepts valid intent', () => {
      expect(BlastRadiusIntentSchema.parse(validIntent)).toEqual(validIntent);
    });

    it('rejects empty value', () => {
      expect(BlastRadiusIntentSchema.safeParse({ ...validIntent, value: '' }).success).toBe(false);
    });

    it('rejects missing timeWindow', () => {
      const { timeWindow, ...noTw } = validIntent;
      expect(BlastRadiusIntentSchema.safeParse(noTw).success).toBe(false);
    });
  });

  describe('BlastRadiusSeveritySchema', () => {
    it('accepts all valid severities', () => {
      for (const s of ['critical', 'high', 'medium', 'low', 'info']) {
        expect(BlastRadiusSeveritySchema.parse(s)).toBe(s);
      }
    });

    it('rejects invalid severities', () => {
      expect(BlastRadiusSeveritySchema.safeParse('extreme').success).toBe(false);
      expect(BlastRadiusSeveritySchema.safeParse('').success).toBe(false);
    });
  });

  describe('BlastRadiusProtocolSchema', () => {
    it('accepts valid protocol', () => {
      const p = { name: 'SMB', port: 445, bytesSent: 1000, bytesReceived: 2000, hasDetections: true };
      expect(BlastRadiusProtocolSchema.parse(p)).toEqual(p);
    });

    it('accepts null port', () => {
      const p = { name: 'DNS', port: null, bytesSent: 100, bytesReceived: 200, hasDetections: false };
      expect(BlastRadiusProtocolSchema.parse(p)).toEqual(p);
    });

    it('rejects empty name', () => {
      expect(BlastRadiusProtocolSchema.safeParse({ name: '', port: 80, bytesSent: 0, bytesReceived: 0, hasDetections: false }).success).toBe(false);
    });

    it('rejects negative bytes', () => {
      expect(BlastRadiusProtocolSchema.safeParse({ name: 'X', port: 80, bytesSent: -1, bytesReceived: 0, hasDetections: false }).success).toBe(false);
    });
  });

  describe('BlastRadiusDetectionSchema', () => {
    const validDetection = {
      id: 5001,
      title: 'Anomalous SMB Write Volume',
      type: 'anomaly',
      riskScore: 82,
      severity: 'high',
      startTime: 1710000300000,
      participants: ['dc01.lab.local', 'ws-finance-01.lab.local'],
    };

    it('accepts valid detection', () => {
      expect(BlastRadiusDetectionSchema.parse(validDetection)).toEqual(validDetection);
    });

    it('rejects riskScore > 100', () => {
      expect(BlastRadiusDetectionSchema.safeParse({ ...validDetection, riskScore: 150 }).success).toBe(false);
    });

    it('rejects negative riskScore', () => {
      expect(BlastRadiusDetectionSchema.safeParse({ ...validDetection, riskScore: -1 }).success).toBe(false);
    });

    it('rejects id <= 0', () => {
      expect(BlastRadiusDetectionSchema.safeParse({ ...validDetection, id: 0 }).success).toBe(false);
      expect(BlastRadiusDetectionSchema.safeParse({ ...validDetection, id: -5 }).success).toBe(false);
    });
  });

  describe('BlastRadiusPeerSchema', () => {
    const validPeer = {
      deviceId: 2001,
      displayName: 'ws-finance-01.lab.local',
      ipaddr: '10.1.20.101',
      role: 'client',
      critical: false,
      protocols: [{ name: 'SMB', port: 445, bytesSent: 1000, bytesReceived: 2000, hasDetections: false }],
      detections: [],
      totalBytes: 3000,
      impactScore: 7.4,
      firstSeen: 1710000000000,
      lastSeen: 1710001800000,
    };

    it('accepts valid peer', () => {
      expect(BlastRadiusPeerSchema.parse(validPeer)).toEqual(validPeer);
    });

    it('rejects empty protocols array', () => {
      expect(BlastRadiusPeerSchema.safeParse({ ...validPeer, protocols: [] }).success).toBe(false);
    });

    it('rejects lastSeen < firstSeen', () => {
      expect(BlastRadiusPeerSchema.safeParse({ ...validPeer, firstSeen: 1710001800000, lastSeen: 1710000000000 }).success).toBe(false);
    });

    it('rejects negative totalBytes', () => {
      expect(BlastRadiusPeerSchema.safeParse({ ...validPeer, totalBytes: -500 }).success).toBe(false);
    });

    it('accepts null ipaddr and role', () => {
      const p = { ...validPeer, ipaddr: null, role: null };
      expect(BlastRadiusPeerSchema.parse(p)).toEqual(p);
    });
  });

  describe('BlastRadiusSourceSchema', () => {
    const validSource = {
      deviceId: 1042,
      displayName: 'dc01.lab.local',
      ipaddr: '10.1.20.42',
      macaddr: '00:1a:8c:10:00:2a',
      role: 'domain_controller',
      deviceClass: 'node',
      critical: true,
    };

    it('accepts valid source', () => {
      expect(BlastRadiusSourceSchema.parse(validSource)).toEqual(validSource);
    });

    it('rejects missing displayName', () => {
      const { displayName, ...noName } = validSource;
      expect(BlastRadiusSourceSchema.safeParse(noName).success).toBe(false);
    });
  });

  describe('BlastRadiusSummarySchema', () => {
    const validSummary = {
      peerCount: 6,
      affectedPeerCount: 5,
      totalDetections: 8,
      uniqueProtocols: 8,
      totalBytes: 5545069568,
      maxImpactScore: 186.64,
      severityDistribution: { critical: 2, high: 2, medium: 2, low: 1, info: 0 },
    };

    it('accepts valid summary', () => {
      expect(BlastRadiusSummarySchema.parse(validSummary)).toEqual(validSummary);
    });

    it('rejects missing severity keys', () => {
      const bad = { ...validSummary, severityDistribution: { critical: 0, high: 0 } };
      expect(BlastRadiusSummarySchema.safeParse(bad).success).toBe(false);
    });

    it('rejects negative counts', () => {
      expect(BlastRadiusSummarySchema.safeParse({ ...validSummary, peerCount: -1 }).success).toBe(false);
    });
  });

  describe('BlastRadiusPayloadSchema', () => {
    it('validates the populated fixture payload', () => {
      const fixture = loadFixture('blast-radius.populated.fixture.json');
      const result = BlastRadiusPayloadSchema.safeParse(fixture.payload);
      expect(result.success).toBe(true);
    });

    it('validates the quiet fixture payload', () => {
      const fixture = loadFixture('blast-radius.quiet.fixture.json');
      const result = BlastRadiusPayloadSchema.safeParse(fixture.payload);
      expect(result.success).toBe(true);
    });

    it('rejects the malformed fixture payload', () => {
      const fixture = loadFixture('blast-radius.malformed.fixture.json');
      const result = BlastRadiusPayloadSchema.safeParse(fixture.payload);
      expect(result.success).toBe(false);
    });
  });

  describe('BlastRadiusStatusSchema', () => {
    it('accepts all valid statuses', () => {
      for (const s of ['idle', 'loading', 'populated', 'quiet', 'error']) {
        expect(BlastRadiusStatusSchema.parse(s)).toBe(s);
      }
    });

    it('rejects invalid statuses', () => {
      expect(BlastRadiusStatusSchema.safeParse('pending').success).toBe(false);
    });
  });

  describe('BlastRadiusSortFieldSchema', () => {
    it('accepts all valid sort fields', () => {
      for (const f of ['impactScore', 'totalBytes', 'displayName', 'detections']) {
        expect(BlastRadiusSortFieldSchema.parse(f)).toBe(f);
      }
    });

    it('rejects invalid sort fields', () => {
      expect(BlastRadiusSortFieldSchema.safeParse('severity').success).toBe(false);
    });
  });

  describe('BlastRadiusViewStateSchema', () => {
    it('validates initial state', () => {
      const initial = buildInitialBlastRadiusState();
      expect(BlastRadiusViewStateSchema.parse(initial)).toEqual(initial);
    });
  });
});

// ─── 2. Pure Function Tests ────────────────────────────────────────────────

describe('Slice 18 — Pure Functions', () => {
  describe('buildInitialBlastRadiusState', () => {
    it('returns idle state with null payload', () => {
      const state = buildInitialBlastRadiusState();
      expect(state.status).toBe('idle');
      expect(state.intent).toBeNull();
      expect(state.payload).toBeNull();
      expect(state.errorMessage).toBeNull();
      expect(state.sortField).toBe('impactScore');
      expect(state.sortDirection).toBe('desc');
      expect(state.filterAffectedOnly).toBe(false);
      expect(state.selectedPeerId).toBeNull();
    });

    it('returns a new object each time (no shared references)', () => {
      const a = buildInitialBlastRadiusState();
      const b = buildInitialBlastRadiusState();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('sortBlastRadiusPeers', () => {
    const peers: BlastRadiusPeer[] = [
      { deviceId: 1, displayName: 'alpha', ipaddr: null, role: null, critical: false, protocols: [{ name: 'X', port: 80, bytesSent: 100, bytesReceived: 200, hasDetections: false }], detections: [], totalBytes: 300, impactScore: 50, firstSeen: 0, lastSeen: 1 },
      { deviceId: 2, displayName: 'charlie', ipaddr: null, role: null, critical: false, protocols: [{ name: 'Y', port: 443, bytesSent: 500, bytesReceived: 500, hasDetections: false }], detections: [{ id: 1, title: 'D1', type: 'a', riskScore: 50, severity: 'high', startTime: 0, participants: [] }], totalBytes: 1000, impactScore: 120, firstSeen: 0, lastSeen: 1 },
      { deviceId: 3, displayName: 'bravo', ipaddr: null, role: null, critical: false, protocols: [{ name: 'Z', port: 22, bytesSent: 10, bytesReceived: 20, hasDetections: false }], detections: [], totalBytes: 30, impactScore: 5, firstSeen: 0, lastSeen: 1 },
    ];

    it('sorts by impactScore descending', () => {
      const sorted = sortBlastRadiusPeers(peers, 'impactScore', 'desc');
      expect(sorted.map(p => p.deviceId)).toEqual([2, 1, 3]);
    });

    it('sorts by impactScore ascending', () => {
      const sorted = sortBlastRadiusPeers(peers, 'impactScore', 'asc');
      expect(sorted.map(p => p.deviceId)).toEqual([3, 1, 2]);
    });

    it('sorts by totalBytes descending', () => {
      const sorted = sortBlastRadiusPeers(peers, 'totalBytes', 'desc');
      expect(sorted.map(p => p.deviceId)).toEqual([2, 1, 3]);
    });

    it('sorts by displayName ascending', () => {
      const sorted = sortBlastRadiusPeers(peers, 'displayName', 'asc');
      expect(sorted.map(p => p.displayName)).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('sorts by displayName descending', () => {
      const sorted = sortBlastRadiusPeers(peers, 'displayName', 'desc');
      expect(sorted.map(p => p.displayName)).toEqual(['charlie', 'bravo', 'alpha']);
    });

    it('sorts by detections count descending', () => {
      const sorted = sortBlastRadiusPeers(peers, 'detections', 'desc');
      expect(sorted[0].deviceId).toBe(2); // has 1 detection
    });

    it('does not mutate the original array', () => {
      const original = [...peers];
      sortBlastRadiusPeers(peers, 'impactScore', 'desc');
      expect(peers.map(p => p.deviceId)).toEqual(original.map(p => p.deviceId));
    });
  });

  describe('filterAffectedPeers', () => {
    const peers: BlastRadiusPeer[] = [
      { deviceId: 1, displayName: 'a', ipaddr: null, role: null, critical: false, protocols: [{ name: 'X', port: 80, bytesSent: 0, bytesReceived: 0, hasDetections: false }], detections: [{ id: 1, title: 'D', type: 'a', riskScore: 50, severity: 'high', startTime: 0, participants: [] }], totalBytes: 0, impactScore: 50, firstSeen: 0, lastSeen: 1 },
      { deviceId: 2, displayName: 'b', ipaddr: null, role: null, critical: false, protocols: [{ name: 'Y', port: 443, bytesSent: 0, bytesReceived: 0, hasDetections: false }], detections: [], totalBytes: 0, impactScore: 5, firstSeen: 0, lastSeen: 1 },
      { deviceId: 3, displayName: 'c', ipaddr: null, role: null, critical: false, protocols: [{ name: 'Z', port: 22, bytesSent: 0, bytesReceived: 0, hasDetections: false }], detections: [{ id: 2, title: 'D2', type: 'b', riskScore: 30, severity: 'low', startTime: 0, participants: [] }], totalBytes: 0, impactScore: 20, firstSeen: 0, lastSeen: 1 },
    ];

    it('returns only peers with detections', () => {
      const filtered = filterAffectedPeers(peers);
      expect(filtered.length).toBe(2);
      expect(filtered.map(p => p.deviceId)).toEqual([1, 3]);
    });

    it('returns empty array when no peers have detections', () => {
      const noDet = peers.map(p => ({ ...p, detections: [] }));
      expect(filterAffectedPeers(noDet)).toEqual([]);
    });

    it('does not mutate original array', () => {
      const original = [...peers];
      filterAffectedPeers(peers);
      expect(peers.length).toBe(original.length);
    });
  });

  describe('getSeverityColor', () => {
    it('returns distinct colors for each severity', () => {
      const colors = new Set<string>();
      for (const s of ['critical', 'high', 'medium', 'low', 'info'] as BlastRadiusSeverity[]) {
        const c = getSeverityColor(s);
        expect(typeof c).toBe('string');
        expect(c.length).toBeGreaterThan(0);
        colors.add(c);
      }
      // All 5 should be unique
      expect(colors.size).toBe(5);
    });

    it('returns OKLCH format strings', () => {
      for (const s of ['critical', 'high', 'medium', 'low', 'info'] as BlastRadiusSeverity[]) {
        expect(getSeverityColor(s)).toMatch(/^oklch\(/);
      }
    });
  });

  describe('calculateImpactScore', () => {
    it('returns 0 for peer with no detections and no traffic', () => {
      const score = calculateImpactScore({ detections: [], totalBytes: 0, critical: false });
      expect(score).toBe(0);
    });

    it('weights critical severity highest', () => {
      const critScore = calculateImpactScore({
        detections: [{ id: 1, title: 'X', type: 'a', riskScore: 50, severity: 'critical', startTime: 0, participants: [] }],
        totalBytes: 0,
        critical: false,
      });
      const lowScore = calculateImpactScore({
        detections: [{ id: 1, title: 'X', type: 'a', riskScore: 50, severity: 'low', startTime: 0, participants: [] }],
        totalBytes: 0,
        critical: false,
      });
      expect(critScore).toBeGreaterThan(lowScore);
    });

    it('applies 1.5x multiplier for critical devices', () => {
      const base = calculateImpactScore({
        detections: [{ id: 1, title: 'X', type: 'a', riskScore: 50, severity: 'high', startTime: 0, participants: [] }],
        totalBytes: 1000,
        critical: false,
      });
      const critical = calculateImpactScore({
        detections: [{ id: 1, title: 'X', type: 'a', riskScore: 50, severity: 'high', startTime: 0, participants: [] }],
        totalBytes: 1000,
        critical: true,
      });
      expect(critical).toBeCloseTo(base * 1.5, 1);
    });

    it('adds traffic volume factor (log scale, capped at 20)', () => {
      const noTraffic = calculateImpactScore({ detections: [], totalBytes: 0, critical: false });
      const bigTraffic = calculateImpactScore({ detections: [], totalBytes: 1e15, critical: false });
      expect(bigTraffic).toBeGreaterThan(noTraffic);
      expect(bigTraffic).toBeLessThanOrEqual(20); // capped
    });

    it('accumulates across multiple detections', () => {
      const one = calculateImpactScore({
        detections: [{ id: 1, title: 'X', type: 'a', riskScore: 50, severity: 'high', startTime: 0, participants: [] }],
        totalBytes: 0,
        critical: false,
      });
      const two = calculateImpactScore({
        detections: [
          { id: 1, title: 'X', type: 'a', riskScore: 50, severity: 'high', startTime: 0, participants: [] },
          { id: 2, title: 'Y', type: 'b', riskScore: 50, severity: 'high', startTime: 0, participants: [] },
        ],
        totalBytes: 0,
        critical: false,
      });
      expect(two).toBeGreaterThan(one);
    });

    it('returns finite number (no NaN/Infinity)', () => {
      const score = calculateImpactScore({
        detections: [{ id: 1, title: 'X', type: 'a', riskScore: 100, severity: 'critical', startTime: 0, participants: [] }],
        totalBytes: Number.MAX_SAFE_INTEGER,
        critical: true,
      });
      expect(Number.isFinite(score)).toBe(true);
    });
  });
});

// ─── 3. Fixture Validation Tests ───────────────────────────────────────────

describe('Slice 18 — Fixture Validation', () => {
  it('fixture directory contains exactly 7 fixtures', () => {
    const fixtures = listFixtures();
    expect(fixtures.length).toBe(7);
  });

  describe('populated fixture', () => {
    const fixture = loadFixture('blast-radius.populated.fixture.json');

    it('has _meta with expected fields', () => {
      expect(fixture._meta.fixture).toBe('blast-radius.populated');
      expect(fixture._meta.expectedStatus).toBe('populated');
      expect(fixture._meta.peerCount).toBe(6);
      expect(fixture._meta.detectionCount).toBe(7);
    });

    it('intent passes schema validation', () => {
      expect(BlastRadiusIntentSchema.safeParse(fixture.intent).success).toBe(true);
    });

    it('payload passes schema validation', () => {
      expect(BlastRadiusPayloadSchema.safeParse(fixture.payload).success).toBe(true);
    });

    it('has correct peer count', () => {
      expect(fixture.payload.peers.length).toBe(6);
    });

    it('has correct total detections', () => {
      const total = fixture.payload.peers.reduce((sum: number, p: any) => sum + p.detections.length, 0);
      expect(total).toBe(fixture.payload.summary.totalDetections);
    });

    it('summary peerCount matches peers array length', () => {
      expect(fixture.payload.summary.peerCount).toBe(fixture.payload.peers.length);
    });

    it('all peer deviceIds are positive integers', () => {
      for (const p of fixture.payload.peers) {
        expect(Number.isInteger(p.deviceId)).toBe(true);
        expect(p.deviceId).toBeGreaterThan(0);
      }
    });

    it('no NaN or Infinity in numeric fields', () => {
      for (const p of fixture.payload.peers) {
        expect(Number.isFinite(p.totalBytes)).toBe(true);
        expect(Number.isFinite(p.impactScore)).toBe(true);
        for (const proto of p.protocols) {
          expect(Number.isFinite(proto.bytesSent)).toBe(true);
          expect(Number.isFinite(proto.bytesReceived)).toBe(true);
        }
      }
    });
  });

  describe('quiet fixture', () => {
    const fixture = loadFixture('blast-radius.quiet.fixture.json');

    it('has _meta with expectedStatus quiet', () => {
      expect(fixture._meta.expectedStatus).toBe('quiet');
    });

    it('payload passes schema validation', () => {
      expect(BlastRadiusPayloadSchema.safeParse(fixture.payload).success).toBe(true);
    });

    it('has zero peers', () => {
      expect(fixture.payload.peers.length).toBe(0);
    });

    it('summary counts are all zero', () => {
      expect(fixture.payload.summary.peerCount).toBe(0);
      expect(fixture.payload.summary.affectedPeerCount).toBe(0);
      expect(fixture.payload.summary.totalDetections).toBe(0);
      expect(fixture.payload.summary.totalBytes).toBe(0);
    });
  });

  describe('error fixture', () => {
    const fixture = loadFixture('blast-radius.error.fixture.json');

    it('has _meta with expectedStatus error', () => {
      expect(fixture._meta.expectedStatus).toBe('error');
    });

    it('has error object with code and message', () => {
      expect(fixture.error.code).toBe('DEVICE_NOT_FOUND');
      expect(fixture.error.message).toContain('unknown.invalid');
      expect(fixture.error.status).toBe(404);
    });

    it('does not have a payload field', () => {
      expect(fixture.payload).toBeUndefined();
    });
  });

  describe('transport-error fixture', () => {
    const fixture = loadFixture('blast-radius.transport-error.fixture.json');

    it('has error code UPSTREAM_UNREACHABLE', () => {
      expect(fixture.error.code).toBe('UPSTREAM_UNREACHABLE');
      expect(fixture.error.status).toBe(502);
    });
  });

  describe('malformed fixture', () => {
    const fixture = loadFixture('blast-radius.malformed.fixture.json');

    it('payload fails schema validation', () => {
      expect(BlastRadiusPayloadSchema.safeParse(fixture.payload).success).toBe(false);
    });

    it('source has wrong types', () => {
      expect(BlastRadiusSourceSchema.safeParse(fixture.payload.source).success).toBe(false);
    });

    it('contains NaN-like string in impactScore', () => {
      const firstPeer = fixture.payload.peers[0];
      expect(firstPeer.impactScore).toBe('NaN');
    });
  });

  describe('hostname-entry fixture', () => {
    const fixture = loadFixture('blast-radius.hostname-entry.fixture.json');

    it('intent uses hostname mode', () => {
      expect(fixture.intent.mode).toBe('hostname');
    });

    it('payload passes schema validation', () => {
      expect(BlastRadiusPayloadSchema.safeParse(fixture.payload).success).toBe(true);
    });

    it('has 3 peers', () => {
      expect(fixture.payload.peers.length).toBe(3);
    });
  });

  describe('ip-entry fixture', () => {
    const fixture = loadFixture('blast-radius.ip-entry.fixture.json');

    it('intent uses ip-address mode', () => {
      expect(fixture.intent.mode).toBe('ip-address');
    });

    it('payload passes schema validation', () => {
      expect(BlastRadiusPayloadSchema.safeParse(fixture.payload).success).toBe(true);
    });

    it('has 2 peers with zero detections', () => {
      expect(fixture.payload.peers.length).toBe(2);
      const total = fixture.payload.peers.reduce((s: number, p: any) => s + p.detections.length, 0);
      expect(total).toBe(0);
    });
  });
});

// ─── 4. BFF Route Tests ───────────────────────────────────────────────────

describe('Slice 18 — BFF Route Tests', () => {
  // We test via HTTP against the running dev server
  const BASE = 'http://localhost:3000/api/bff/blast-radius';

  const validIntent = {
    mode: 'device-id',
    value: '1042',
    timeWindow: { fromMs: 1710000000000, untilMs: 1710001800000, durationMs: 1800000, cycle: '30sec' },
  };

  describe('GET /fixtures', () => {
    it('returns fixture list in fixture mode', async () => {
      const resp = await fetch(`${BASE}/fixtures`);
      expect(resp.status).toBe(200);
      const data = await resp.json();
      expect(data.mode).toBe('fixture');
      expect(data.fixtures).toBeInstanceOf(Array);
      expect(data.fixtures.length).toBe(7);
    });
  });

  describe('POST /query — populated', () => {
    it('returns 200 with valid payload for device-id 1042', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validIntent),
      });
      expect(resp.status).toBe(200);
      const data = await resp.json();
      expect(BlastRadiusPayloadSchema.safeParse(data).success).toBe(true);
      expect(data.source.displayName).toBe('dc01.lab.local');
      expect(data.peers.length).toBe(6);
    });
  });

  describe('POST /query — quiet', () => {
    it('returns 200 with empty peers for quiet sentinel', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, value: '9999' }),
      });
      expect(resp.status).toBe(200);
      const data = await resp.json();
      expect(data.peers.length).toBe(0);
    });
  });

  describe('POST /query — error (device not found)', () => {
    it('returns 404 for unknown.invalid sentinel', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, mode: 'hostname', value: 'unknown.invalid' }),
      });
      expect(resp.status).toBe(404);
      const data = await resp.json();
      expect(data.error).toBe('DEVICE_NOT_FOUND');
    });
  });

  describe('POST /query — transport error', () => {
    it('returns 502 for transport.fail sentinel', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, value: 'transport.fail' }),
      });
      expect(resp.status).toBe(502);
      const data = await resp.json();
      expect(data.error).toBe('UPSTREAM_UNREACHABLE');
    });
  });

  describe('POST /query — hostname entry', () => {
    it('returns hostname-entry fixture for hostname mode', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, mode: 'hostname', value: 'mail-relay.lab.local' }),
      });
      expect(resp.status).toBe(200);
      const data = await resp.json();
      expect(data.source.displayName).toBe('mail-relay.lab.local');
      expect(data.peers.length).toBe(3);
    });
  });

  describe('POST /query — ip-address entry', () => {
    it('returns ip-entry fixture for ip-address mode', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, mode: 'ip-address', value: '10.1.20.200' }),
      });
      expect(resp.status).toBe(200);
      const data = await resp.json();
      expect(data.source.displayName).toBe('10.1.20.200');
      expect(data.peers.length).toBe(2);
    });
  });

  describe('POST /query — invalid intent', () => {
    it('returns 400 for invalid mode', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'bad', value: 'x', timeWindow: { fromMs: 1, untilMs: 2, durationMs: 1, cycle: '30sec' } }),
      });
      expect(resp.status).toBe(400);
      const data = await resp.json();
      expect(data.error).toBe('INVALID_BLAST_RADIUS_INTENT');
    });

    it('returns 400 for empty value', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, value: '' }),
      });
      expect(resp.status).toBe(400);
    });

    it('returns 400 for missing timeWindow', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'device-id', value: '1042' }),
      });
      expect(resp.status).toBe(400);
    });

    it('returns 400 for invalid cycle', async () => {
      const resp = await fetch(`${BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validIntent, timeWindow: { ...validIntent.timeWindow, cycle: 'invalid' } }),
      });
      expect(resp.status).toBe(400);
    });
  });
});
