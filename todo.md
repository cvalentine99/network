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

## Cleanup — Remove All Canned Content

- [ ] Strip Home.tsx (Dashboard) of all placeholder KPIs, charts, tables
- [ ] Strip Devices.tsx of all placeholder content
- [ ] Strip Alerts.tsx of all placeholder content
- [ ] Strip Interfaces.tsx (Networks) of all placeholder content
- [ ] Strip Performance.tsx (Detections) of all placeholder content
- [ ] Strip Appliances.tsx of all placeholder content
- [ ] Leave only Obsidian theme shell + sidebar nav + empty page containers
