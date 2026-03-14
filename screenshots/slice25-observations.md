# Slice 25 — Responsive Layout Audit Observations

## Methodology

21 screenshots captured across 7 surfaces at 3 breakpoints: desktop (1440x900), tablet (768x1024), narrow (375x812).

## Desktop (1440px) — All surfaces

All surfaces render as designed at desktop width. Sidebar is visible and persistent. Content areas have adequate spacing. KPI strip cards are horizontally arranged. Charts, tables, and forms are fully visible. This is the primary design target (ultrawide/desktop-first).

## Tablet (768px) — Observations

**Impact Deck:** Sidebar remains visible (collapsed width). KPI strip cards are slightly compressed but all 5 remain in a single row. Labels truncate ("pkt..." for packets). Throughput chart and Top Talkers table render correctly. Correlation event badges wrap to 2 rows. Functional but cramped on the KPI strip.

**Flow Theater:** Entry form renders well. Input fields and Run Trace button are accessible. Idle state message is readable.

**Blast Radius:** Entry form renders well at tablet width. Query mode selector and input field are accessible.

**Correlation:** Page renders correctly with event cards stacking vertically.

**Topology:** Force graph renders in available space. Stats bar (nodes/edges/clusters) wraps slightly. Legend wraps to multiple rows. Search bar remains accessible.

**Settings:** Form fields render correctly. Labels and inputs are readable.

**Help:** Tabs show icons only (labels hidden). Glossary list renders correctly with surface badges. Search input is accessible.

## Narrow (375px) — Observations

**Impact Deck:** Sidebar collapses to hamburger menu. KPI strip cards overflow horizontally — the 5th card (+12.3% baseline delta) is partially clipped at right edge. This is a known limitation: the KPI strip was designed for desktop-width viewing. Throughput chart compresses but remains readable. Correlation event badges wrap to 3 rows. Top Talkers table is below the fold.

**Flow Theater:** Renders cleanly. Entry form stacks vertically. "Run Trace" button is full-width accessible. Idle state message wraps correctly.

**Blast Radius:** Entry form renders well. Query mode dropdown and input field stack vertically.

**Correlation:** Event cards stack vertically. Readable at narrow width.

**Topology:** Force graph renders in available space (small but functional). Stats bar wraps to 2 rows. Legend wraps to 3 rows. Search bar is accessible. Node labels are very small but the graph is interactive.

**Settings:** Form renders correctly in single-column layout.

**Help:** Tab bar shows icons only (no text labels). Glossary entries stack vertically with surface badges. Search input is full-width. All content is accessible.

## Desktop-Only Notes

The following elements are designed for desktop-width viewing and degrade at narrow widths:

1. **KPI Strip (Impact Deck):** 5 cards in a horizontal row. At 375px, the 5th card clips at the right edge. No horizontal scroll is provided. This is a known desktop-first design decision.
2. **Inspector Panel (Impact Deck):** The slide-over inspector is designed for desktop width. At narrow widths it would overlay the entire viewport. Not tested in this audit because the inspector requires a selection interaction.
3. **Topology Force Graph:** At 375px the graph is very small. Node labels are barely readable. The graph is interactive but the experience is degraded.
4. **Top Talkers Table:** Column headers truncate at narrow widths. The table is horizontally scrollable but this is not visually indicated.

## Verdict

The dashboard is designed desktop-first and functions correctly at desktop (1440px) and tablet (768px) widths. At narrow (375px), all surfaces remain accessible but the KPI strip and topology graph degrade. No content is completely hidden or broken at any breakpoint. The sidebar correctly collapses to a hamburger menu at narrow widths. This is consistent with the project's stated purpose as a NOC dashboard (typically viewed on desktop/ultrawide monitors).
