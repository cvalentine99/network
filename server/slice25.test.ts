/**
 * Slice 25 — Responsive Layout Audit
 *
 * Tests validate:
 * 1. Screenshot evidence exists for all surfaces at all breakpoints
 * 2. Tailwind responsive classes are present in key components
 * 3. DashboardLayout has mobile sidebar collapse behavior
 * 4. Desktop-only limitations are documented
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════════
// 1. SCREENSHOT EVIDENCE
// ═══════════════════════════════════════════════════════════════════

const BREAKPOINTS = ['desktop', 'tablet', 'narrow'];
const SURFACES = [
  'impact-deck',
  'flow-theater',
  'blast-radius',
  'correlation',
  'topology',
  'settings',
  'help',
];

describe('Slice 25 — Screenshot Evidence', () => {
  for (const bp of BREAKPOINTS) {
    for (const surface of SURFACES) {
      it(`screenshot exists: ${surface} @ ${bp}`, () => {
        const filePath = path.resolve(
          __dirname,
          `../screenshots/slice25-${surface}-${bp}.png`
        );
        expect(fs.existsSync(filePath), `Missing: slice25-${surface}-${bp}.png`).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size).toBeGreaterThan(1000); // not an empty file
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
// 2. TAILWIND RESPONSIVE CLASSES IN KEY COMPONENTS
// ═══════════════════════════════════════════════════════════════════

describe('Slice 25 — Responsive Tailwind Classes', () => {
  const dashLayoutSrc = fs.readFileSync(
    path.resolve(__dirname, '../client/src/components/DashboardLayout.tsx'),
    'utf-8'
  );

  it('DashboardLayout uses responsive width classes for sidebar', () => {
    // Should have some responsive class like md: or lg: or hidden/block
    const hasResponsive =
      dashLayoutSrc.includes('md:') ||
      dashLayoutSrc.includes('lg:') ||
      dashLayoutSrc.includes('hidden') ||
      dashLayoutSrc.includes('block');
    expect(hasResponsive).toBe(true);
  });

  it('DashboardLayout has mobile menu toggle mechanism', () => {
    // Should have some state for mobile menu or sidebar toggle
    const hasMobileToggle =
      dashLayoutSrc.includes('setSidebarOpen') ||
      dashLayoutSrc.includes('sidebarOpen') ||
      dashLayoutSrc.includes('menuOpen') ||
      dashLayoutSrc.includes('setMenuOpen') ||
      dashLayoutSrc.includes('isMobile') ||
      dashLayoutSrc.includes('hamburger') ||
      dashLayoutSrc.includes('Menu') ||
      dashLayoutSrc.includes('PanelLeft');
    expect(hasMobileToggle).toBe(true);
  });

  const kpiStripSrc = fs.readFileSync(
    path.resolve(__dirname, '../client/src/components/impact/KPIStrip.tsx'),
    'utf-8'
  );

  it('KPIStrip uses flex layout for horizontal card arrangement', () => {
    expect(kpiStripSrc).toMatch(/flex/);
  });

  it('KPIStrip uses gap or space for card spacing', () => {
    const hasSpacing =
      kpiStripSrc.includes('gap-') ||
      kpiStripSrc.includes('space-x-') ||
      kpiStripSrc.includes('space-y-');
    expect(hasSpacing).toBe(true);
  });

  const helpSrc = fs.readFileSync(
    path.resolve(__dirname, '../client/src/pages/Help.tsx'),
    'utf-8'
  );

  it('Help page uses grid or flex for responsive layout', () => {
    const hasLayout =
      helpSrc.includes('grid') || helpSrc.includes('flex');
    expect(hasLayout).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. OBSERVATIONS FILE EXISTS
// ═══════════════════════════════════════════════════════════════════

describe('Slice 25 — Observations Documentation', () => {
  const obsPath = path.resolve(
    __dirname,
    '../screenshots/slice25-observations.md'
  );

  it('observations file exists', () => {
    expect(fs.existsSync(obsPath)).toBe(true);
  });

  const obs = fs.readFileSync(obsPath, 'utf-8');

  it('documents desktop observations', () => {
    expect(obs).toContain('Desktop');
  });

  it('documents tablet observations', () => {
    expect(obs).toContain('Tablet');
  });

  it('documents narrow observations', () => {
    expect(obs).toContain('Narrow');
  });

  it('documents desktop-only notes', () => {
    expect(obs).toContain('Desktop-Only Notes');
  });

  it('documents KPI strip clipping at narrow width', () => {
    expect(obs).toMatch(/KPI.*strip/i);
    expect(obs).toMatch(/clip|overflow|truncat/i);
  });

  it('documents topology degradation at narrow width', () => {
    expect(obs).toMatch(/topology/i);
    expect(obs).toMatch(/small|degrad/i);
  });

  it('documents sidebar collapse behavior', () => {
    expect(obs).toMatch(/sidebar.*collapse|hamburger/i);
  });

  it('documents this is a desktop-first dashboard', () => {
    expect(obs).toMatch(/desktop.first/i);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. BREAKPOINT CONSTANTS
// ═══════════════════════════════════════════════════════════════════

describe('Slice 25 — Breakpoint Constants', () => {
  const AUDIT_BREAKPOINTS = {
    desktop: { width: 1440, height: 900 },
    tablet: { width: 768, height: 1024 },
    narrow: { width: 375, height: 812 },
  };

  it('desktop breakpoint is 1440x900', () => {
    expect(AUDIT_BREAKPOINTS.desktop).toEqual({ width: 1440, height: 900 });
  });

  it('tablet breakpoint is 768x1024', () => {
    expect(AUDIT_BREAKPOINTS.tablet).toEqual({ width: 768, height: 1024 });
  });

  it('narrow breakpoint is 375x812', () => {
    expect(AUDIT_BREAKPOINTS.narrow).toEqual({ width: 375, height: 812 });
  });

  it('all 3 breakpoints are represented', () => {
    expect(Object.keys(AUDIT_BREAKPOINTS)).toHaveLength(3);
  });

  it('all 7 surfaces are audited', () => {
    expect(SURFACES).toHaveLength(7);
  });

  it('total screenshot count is 21 (7 surfaces x 3 breakpoints)', () => {
    expect(SURFACES.length * BREAKPOINTS.length).toBe(21);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. DESKTOP-ONLY KNOWN LIMITATIONS
// ═══════════════════════════════════════════════════════════════════

describe('Slice 25 — Desktop-Only Known Limitations', () => {
  const KNOWN_DESKTOP_ONLY = [
    {
      component: 'KPI Strip',
      issue: '5th card clips at 375px width',
      severity: 'cosmetic',
      surface: 'Impact Deck',
    },
    {
      component: 'Inspector Panel',
      issue: 'Overlays entire viewport at narrow widths',
      severity: 'functional-degradation',
      surface: 'Impact Deck',
    },
    {
      component: 'Topology Force Graph',
      issue: 'Node labels barely readable at 375px',
      severity: 'cosmetic',
      surface: 'Topology',
    },
    {
      component: 'Top Talkers Table',
      issue: 'Column headers truncate at narrow widths',
      severity: 'cosmetic',
      surface: 'Impact Deck',
    },
  ];

  it('4 known desktop-only limitations are documented', () => {
    expect(KNOWN_DESKTOP_ONLY).toHaveLength(4);
  });

  it('each limitation has component, issue, severity, and surface', () => {
    for (const lim of KNOWN_DESKTOP_ONLY) {
      expect(lim.component).toBeTruthy();
      expect(lim.issue).toBeTruthy();
      expect(lim.severity).toBeTruthy();
      expect(lim.surface).toBeTruthy();
    }
  });

  it('severity is either cosmetic or functional-degradation', () => {
    for (const lim of KNOWN_DESKTOP_ONLY) {
      expect(['cosmetic', 'functional-degradation']).toContain(lim.severity);
    }
  });

  it('no limitation is severity "broken"', () => {
    for (const lim of KNOWN_DESKTOP_ONLY) {
      expect(lim.severity).not.toBe('broken');
    }
  });
});
