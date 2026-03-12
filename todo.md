# Network Performance Dashboard — TODO

- [x] Apply Obsidian Instrument Panel CSS theme (index.css replacement)
- [x] Add Google Fonts (Inter + JetBrains Mono) to index.html
- [x] Set ThemeProvider to dark mode
- [x] Remove Manus OAuth authentication system entirely
- [x] Install framer-motion and lucide-react (already in dependencies)
- [x] Copy DashboardWidgets.tsx components
- [x] Build sidebar navigation layout (NOC-style, ultrawide optimized)
- [x] Create dashboard home page with KPI cards
- [x] Build network devices page with data tables (sort/filter)
- [x] Build network alerts page with severity badges (critical/high/medium/low)
- [x] Build network interfaces page
- [x] Build network performance metrics page
- [x] Set up MySQL database schema for network data
- [x] Create tRPC procedures for fetching network data
- [x] Wire frontend to backend tRPC queries (no mock data)
- [x] Add Framer Motion stagger entrance animations
- [x] Optimize layout for ultrawide monitors (max-width: 1920px)
- [x] Write vitest tests (6 passing)
- [x] Final polish and checkpoint

## Schema Migration — ExtraHop Data Model

- [x] Drop placeholder tables (devices, alerts, interfaces, performance_metrics)
- [x] Apply ExtraHop DDL — raw layer + dimension tables + bridge tables
- [x] Apply ExtraHop DDL — fact tables + snapshot tables + topology tables
- [x] Apply ExtraHop DDL — schema management + detection tables
- [x] Create application views (008_app_views.sql)
- [x] Create convenience views + indexes (006_indexes_views.sql)
- [x] Update Drizzle schema.ts to match ExtraHop data model
- [x] Update server/db.ts query helpers for ExtraHop views
- [x] Update server/routers.ts tRPC procedures for ExtraHop data
- [x] Update frontend pages for ExtraHop data shapes (Dashboard, Devices, Alerts, Networks, Detections, Appliances)
- [x] Write/update vitest tests (19 passing, 0 failures)

## Impact Deck Sprint

### Phase A-C: Shared Layer
- [x] Create shared/impact-types.ts with all ExtraHop data contracts
- [x] Create shared/impact-constants.ts with metric specs, severity mapping, cycle durations
- [x] Create shared/impact-validators.ts with Zod schemas

### Phase D: BFF Server
- [x] Install BFF dependencies (cors, helmet, compression, axios, lru-cache, pino, express-rate-limit)
- [x] Create server/bff/config.ts with Zod env validation
- [x] Create server/bff/lib/ehClient.ts — Axios client to ExtraHop API
- [x] Create server/bff/lib/timeWindow.ts — Time window resolution
- [x] Create server/bff/lib/normalize.ts — Metric value binding (positional)
- [x] Create server/bff/lib/normalizeDevice.ts — Device record normalization
- [x] Create server/bff/lib/normalizeDetection.ts — Detection/Alert normalization
- [x] Create server/bff/lib/cache.ts — LRU cache
- [x] Create server/bff/middleware/ — rateLimiter, errorHandler, requestLogger
- [x] Create server/bff/routes/health.ts — GET /api/bff/health
- [x] Create server/bff/routes/impact.ts — GET /api/bff/impact/overview
- [x] Integrated BFF into main Express server (server/_core/index.ts)

### Phase E: Frontend Components
- [x] Create client/src/lib/api.ts — BFF fetch wrapper
- [x] Create client/src/lib/formatters.ts — Number/date/byte formatting
- [x] Create client/src/components/charts/GhostedTimeline.tsx — Recharts area chart
- [x] Create client/src/components/tables/TopTalkersTable.tsx — Top 20 devices
- [x] Create client/src/components/tables/DetectionsTable.tsx — Recent detections

### Phase F: Wiring
- [ ] Create client/src/pages/ImpactDeck/ImpactDeck.tsx — Main landing page
- [ ] Update App.tsx — Route "/" to ImpactDeck
- [ ] Update DashboardLayout.tsx — Sidebar "Impact Deck" label
- [ ] Configure VITE_BFF_URL env var
- [ ] Request EH_HOST and EH_API_KEY secrets

### Testing & Verification
- [ ] Write vitest tests for BFF normalizers
- [ ] Write vitest tests for shared utilities
- [ ] Verify 0 TypeScript errors
- [ ] Checkpoint and deliver

## Audit — Impact Deck Not Rendering
- [x] Check server logs for errors
- [x] Check browser console for errors
- [x] Check TypeScript compilation
- [x] Verify ImpactDeck page renders with proper not-configured state
- [x] Fix all identified issues (BFF guard, error parsing, sidebar status, rate limiter warning)
