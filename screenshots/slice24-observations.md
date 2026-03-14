# Slice 24 — Help Page Screenshot Observations

## slice24-help-glossary.png
- Help page renders with Glossary tab active by default
- 23 terms listed alphabetically from Alert to Trace Step
- Each term shows surface badge (Impact Deck, Blast Radius, Correlation, Flow Theater) where applicable
- Search input visible at top
- Help nav item in sidebar is active (gold highlight) — no longer dimmed/placeholder
- Tab bar shows all 4 tabs: Glossary, Shortcuts, Surfaces, Integration

## slice24-help-glossary-empty.png
- Search term "xyznonexistent" entered
- Empty state message: "No glossary entries match" with search term displayed
- Quiet state renders correctly

## slice24-help-shortcuts.png
- Keyboard shortcuts grouped by scope (Global, Inspector, Blast Radius / Flow Theater)
- Each shortcut shows key combination with styled kbd elements
- 9 shortcuts total

## slice24-help-surfaces.png
- All 7 surfaces listed with name, question, description, and integration status badge
- All surfaces show "FIXTURE PROVEN" status badge in green
- Each surface has a navigation link icon to jump to that surface
- Help surface does not show navigation link (already on Help)

## slice24-help-integration.png
- Current Mode: Fixture Mode with green badge and explanation
- Future Mode: Live Integration with muted badge and explanation
- Architectural Invariant callout: "The browser must not contact ExtraHop directly"
- Gold-bordered callout box for the invariant

## State Coverage
- [x] Populated (glossary with 23 terms)
- [x] Quiet/empty (glossary search with no results)
- [x] All 4 tab states captured
- [ ] Loading state: N/A — Help page is entirely client-side with no data fetching
- [ ] Error state: N/A — Help page has no network dependencies; all data is from shared constants
