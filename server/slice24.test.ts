/**
 * Slice 24 — Help Page Tests
 *
 * Validates: glossary content, keyboard shortcuts, surface descriptions,
 * integration status labels, schema enforcement, fixture integrity,
 * and navigation de-placeholder.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  GLOSSARY, KEYBOARD_SHORTCUTS, SURFACE_DESCRIPTIONS,
  INTEGRATION_STATUS_LABELS, INTEGRATION_STATUS_COLORS,
  GlossaryEntrySchema, KeyboardShortcutSchema, SurfaceDescriptionSchema,
  type GlossaryEntry, type KeyboardShortcut, type SurfaceDescription,
} from '../shared/help-types';
import * as fs from 'fs';
import * as path from 'path';

// ─── Glossary Content Tests ──────────────────────────────────────────────

describe('Glossary content', () => {
  it('has at least 20 terms', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry passes GlossaryEntrySchema', () => {
    for (const entry of GLOSSARY) {
      const result = GlossaryEntrySchema.safeParse(entry);
      expect(result.success, `Failed for term: ${entry.term}`).toBe(true);
    }
  });

  it('no duplicate terms', () => {
    const terms = GLOSSARY.map(e => e.term);
    const unique = new Set(terms);
    expect(unique.size).toBe(terms.length);
  });

  it('every term has a non-empty definition', () => {
    for (const entry of GLOSSARY) {
      expect(entry.definition.length, `Empty definition for: ${entry.term}`).toBeGreaterThan(10);
    }
  });

  it('seeAlso references point to existing terms', () => {
    const termSet = new Set(GLOSSARY.map(e => e.term));
    for (const entry of GLOSSARY) {
      if (entry.seeAlso) {
        for (const ref of entry.seeAlso) {
          expect(termSet.has(ref), `seeAlso "${ref}" in "${entry.term}" not found in glossary`).toBe(true);
        }
      }
    }
  });

  it('surface references are valid surface names', () => {
    const surfaceNames = new Set(SURFACE_DESCRIPTIONS.map(s => s.name));
    for (const entry of GLOSSARY) {
      if (entry.surface) {
        expect(surfaceNames.has(entry.surface), `Surface "${entry.surface}" in "${entry.term}" not found`).toBe(true);
      }
    }
  });

  it('covers key product terms', () => {
    const terms = new Set(GLOSSARY.map(e => e.term));
    const required = [
      'Baseline Delta', 'Blast Radius', 'BFF (Backend for Frontend)',
      'Correlation Event', 'Detection', 'Alert', 'Flow Theater',
      'Impact Score', 'Inspector', 'KPI Strip', 'Time Window',
      'Top Talker', 'Fixture Mode', 'Live Integration',
    ];
    for (const req of required) {
      expect(terms.has(req), `Missing required term: ${req}`).toBe(true);
    }
  });

  it('terms are sorted alphabetically', () => {
    const terms = GLOSSARY.map(e => e.term);
    const sorted = [...terms].sort((a, b) => a.localeCompare(b));
    expect(terms).toEqual(sorted);
  });
});

// ─── Keyboard Shortcuts Tests ────────────────────────────────────────────

describe('Keyboard shortcuts', () => {
  it('has at least 5 shortcuts', () => {
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThanOrEqual(5);
  });

  it('every shortcut passes KeyboardShortcutSchema', () => {
    for (const sc of KEYBOARD_SHORTCUTS) {
      const result = KeyboardShortcutSchema.safeParse(sc);
      expect(result.success, `Failed for: ${sc.action}`).toBe(true);
    }
  });

  it('no duplicate key combinations within the same scope', () => {
    const seen = new Set<string>();
    for (const sc of KEYBOARD_SHORTCUTS) {
      const key = `${sc.scope}::${sc.keys.join('+')}`;
      expect(seen.has(key), `Duplicate shortcut: ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('includes Esc for closing inspector', () => {
    const esc = KEYBOARD_SHORTCUTS.find(sc => sc.keys.includes('Esc'));
    expect(esc).toBeDefined();
    expect(esc!.action.toLowerCase()).toContain('close');
  });

  it('includes number keys for surface navigation', () => {
    const numKeys = KEYBOARD_SHORTCUTS.filter(sc => sc.keys.length === 1 && /^[1-5]$/.test(sc.keys[0]));
    expect(numKeys.length).toBeGreaterThanOrEqual(5);
  });

  it('includes ? for help', () => {
    const help = KEYBOARD_SHORTCUTS.find(sc => sc.keys.includes('?'));
    expect(help).toBeDefined();
    expect(help!.action.toLowerCase()).toContain('help');
  });
});

// ─── Surface Descriptions Tests ──────────────────────────────────────────

describe('Surface descriptions', () => {
  it('has exactly 7 surfaces', () => {
    expect(SURFACE_DESCRIPTIONS.length).toBe(7);
  });

  it('every surface passes SurfaceDescriptionSchema', () => {
    for (const surface of SURFACE_DESCRIPTIONS) {
      const result = SurfaceDescriptionSchema.safeParse(surface);
      expect(result.success, `Failed for: ${surface.name}`).toBe(true);
    }
  });

  it('no duplicate paths', () => {
    const paths = SURFACE_DESCRIPTIONS.map(s => s.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });

  it('every surface has a question starting with a question word', () => {
    for (const surface of SURFACE_DESCRIPTIONS) {
      const firstWord = surface.question.split(' ')[0].toLowerCase();
      expect(
        ['what', 'where', 'who', 'how', 'when', 'why'].includes(firstWord),
        `Question for "${surface.name}" doesn't start with a question word: "${surface.question}"`
      ).toBe(true);
    }
  });

  it('all surfaces are currently fixture-proven', () => {
    for (const surface of SURFACE_DESCRIPTIONS) {
      expect(surface.integrationStatus, `${surface.name} is not fixture-proven`).toBe('fixture-proven');
    }
  });

  it('includes all sidebar nav surfaces', () => {
    const names = new Set(SURFACE_DESCRIPTIONS.map(s => s.name));
    const required = ['Impact Deck', 'Flow Theater', 'Blast Radius', 'Correlation', 'Topology', 'Settings', 'Help'];
    for (const req of required) {
      expect(names.has(req), `Missing surface: ${req}`).toBe(true);
    }
  });

  it('paths match actual routes', () => {
    const expectedPaths = ['/', '/flow-theater', '/blast-radius', '/correlation', '/topology', '/settings', '/help'];
    const actualPaths = SURFACE_DESCRIPTIONS.map(s => s.path);
    for (const ep of expectedPaths) {
      expect(actualPaths.includes(ep), `Missing path: ${ep}`).toBe(true);
    }
  });
});

// ─── Integration Status Labels Tests ─────────────────────────────────────

describe('Integration status labels', () => {
  it('has labels for all 5 status values', () => {
    const statuses: SurfaceDescription['integrationStatus'][] = [
      'fixture-proven', 'live-integrated', 'sandbox-validated', 'deferred', 'placeholder',
    ];
    for (const status of statuses) {
      expect(INTEGRATION_STATUS_LABELS[status]).toBeDefined();
      expect(INTEGRATION_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('has colors for all 5 status values', () => {
    const statuses: SurfaceDescription['integrationStatus'][] = [
      'fixture-proven', 'live-integrated', 'sandbox-validated', 'deferred', 'placeholder',
    ];
    for (const status of statuses) {
      expect(INTEGRATION_STATUS_COLORS[status]).toBeDefined();
      expect(INTEGRATION_STATUS_COLORS[status]).toContain('oklch');
    }
  });
});

// ─── Navigation De-placeholder Tests ─────────────────────────────────────

describe('Navigation de-placeholder', () => {
  it('DashboardLayout Help item has no placeholder flag', () => {
    const layoutSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/components/DashboardLayout.tsx'),
      'utf-8'
    );
    // The Help nav item should NOT have placeholder: true
    const helpLine = layoutSrc.split('\n').find(l => l.includes('"Help"'));
    expect(helpLine).toBeDefined();
    expect(helpLine).not.toContain('placeholder');
  });

  it('App.tsx includes /help route', () => {
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/App.tsx'),
      'utf-8'
    );
    expect(appSrc).toContain('path="/help"');
    expect(appSrc).toContain('Help');
  });

  it('Help page component exists', () => {
    const exists = fs.existsSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx')
    );
    expect(exists).toBe(true);
  });

  it('Help page has data-testid="help-page"', () => {
    const helpSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx'),
      'utf-8'
    );
    expect(helpSrc).toContain('data-testid="help-page"');
  });
});

// ─── Fixture Integrity Tests ─────────────────────────────────────────────

describe('Help fixture integrity', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/help');

  it('glossary populated fixture exists and is valid JSON', () => {
    const raw = fs.readFileSync(path.join(fixtureDir, 'glossary.populated.fixture.json'), 'utf-8');
    const data = JSON.parse(raw);
    expect(data.termCount).toBe(GLOSSARY.length);
    expect(data.sampleTerms.length).toBeGreaterThan(0);
  });

  it('glossary quiet fixture exists and is valid JSON', () => {
    const raw = fs.readFileSync(path.join(fixtureDir, 'glossary.quiet.fixture.json'), 'utf-8');
    const data = JSON.parse(raw);
    expect(data.matchCount).toBe(0);
    expect(data.searchTerm).toBeDefined();
  });

  it('surfaces populated fixture exists and is valid JSON', () => {
    const raw = fs.readFileSync(path.join(fixtureDir, 'surfaces.populated.fixture.json'), 'utf-8');
    const data = JSON.parse(raw);
    expect(data.surfaceCount).toBe(SURFACE_DESCRIPTIONS.length);
    expect(data.allFixtureProven).toBe(true);
    expect(data.noneLiveIntegrated).toBe(true);
  });
});

// ─── UI State Contract Tests ─────────────────────────────────────────────

describe('Help UI state contracts', () => {
  it('Help page has 4 tabs: glossary, shortcuts, surfaces, integration', () => {
    const helpSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx'),
      'utf-8'
    );
    expect(helpSrc).toContain("id: 'glossary'");
    expect(helpSrc).toContain("id: 'shortcuts'");
    expect(helpSrc).toContain("id: 'surfaces'");
    expect(helpSrc).toContain("id: 'integration'");
  });

  it('Help page has testids for all major sections', () => {
    const helpSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx'),
      'utf-8'
    );
    const requiredTestIds = [
      'help-page', 'help-tabs', 'glossary-list', 'glossary-empty',
      'glossary-search', 'keyboard-shortcuts', 'surface-descriptions',
      'integration-mode',
    ];
    for (const tid of requiredTestIds) {
      expect(helpSrc, `Missing testid: ${tid}`).toContain(`data-testid="${tid}"`);
    }
  });

  it('Glossary section handles empty search state', () => {
    const helpSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx'),
      'utf-8'
    );
    expect(helpSrc).toContain('glossary-empty');
    expect(helpSrc).toContain('No glossary entries match');
  });

  it('Integration section explains both fixture mode and live integration', () => {
    const helpSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx'),
      'utf-8'
    );
    expect(helpSrc).toContain('Fixture Mode');
    expect(helpSrc).toContain('Live Integration');
    expect(helpSrc).toContain('Architectural Invariant');
    expect(helpSrc).toContain('browser must not contact ExtraHop directly');
  });
});

// ─── Cross-cutting Invariants ────────────────────────────────────────────

describe('Help cross-cutting invariants', () => {
  it('Help page does not import from ExtraHop or live endpoints', () => {
    const helpSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/pages/Help.tsx'),
      'utf-8'
    );
    expect(helpSrc).not.toContain('extrahop');
    expect(helpSrc).not.toContain('fetch(');
    expect(helpSrc).not.toContain('/api/');
  });

  it('shared help-types.ts does not reference live endpoints', () => {
    const typesSrc = fs.readFileSync(
      path.resolve(__dirname, '../shared/help-types.ts'),
      'utf-8'
    );
    expect(typesSrc).not.toContain('extrahop.com');
    expect(typesSrc).not.toContain('localhost:');
    expect(typesSrc).not.toContain('fetch(');
  });

  it('no placeholder nav items remain in DashboardLayout', () => {
    const layoutSrc = fs.readFileSync(
      path.resolve(__dirname, '../client/src/components/DashboardLayout.tsx'),
      'utf-8'
    );
    // Check that no item has placeholder: true
    const placeholderMatches = layoutSrc.match(/placeholder:\s*true/g);
    expect(placeholderMatches).toBeNull();
  });
});
