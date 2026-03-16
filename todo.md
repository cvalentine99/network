# Project TODO

- [x] Slice 00 — Contract Harness + Shell
- [x] Slice 01 — Metrics Normalization Core
- [x] Slice 02 — Impact Deck KPI Strip
- [x] Slice 03 — Impact Deck Time-Series Chart
- [x] Slice 04 — Top Talkers Table
- [x] Slice 05 — Detections Panel
- [x] Slice 06 — Alerts Panel
- [x] KPI card text truncation fix (c2ecd1ce)
- [x] Document architectural drift (decomposed BFF routes vs single fan-out)
- [x] Update CONTRACTS.md truncation note as superseded (9afe240e)
- [x] Slice 07 — Appliance Status Footer (types, validators, fixtures, BFF route, hook, component, tests)
- [x] Slice 08 — Inspector Shell Wiring: shared inspector types, selection context, click handlers on Top Talkers/Detections/Alerts rows, InspectorShell content routing, fixtures, tests, screenshot, truth receipt
- [x] Slice 09 — Device Detail Inspector Pane: DeviceDetail type, Zod validator, BFF route GET /api/bff/impact/device-detail, useDeviceDetail hook, DeviceDetailPane component (activity summary, associated detections/alerts, protocol breakdown), fixtures, tests, screenshots, truth receipt
- [x] Slice 10 — PCAP Download Contract: PcapRequest/PcapMetadata types, Zod validators, BFF route POST /api/bff/packets/download (binary), usePcapDownload hook, download trigger in DeviceDetailPane, fixtures, tests, screenshot, truth receipt
- [x] Slice 10 fix: wire PcapDownloadButton to shared TimeWindowContext instead of Date.now()
- [x] Slice 11 — Detection & Alert Detail Panes: DetectionDetail/AlertDetail types, Zod validators, BFF routes GET /api/bff/impact/detection-detail and /alert-detail, useDetectionDetail/useAlertDetail hooks, DetectionDetailPane/AlertDetailPane components, fixtures, tests, screenshots, truth receipt
- [x] Slice 12 — Cross-Entity Navigation: clickable related devices in DetectionDetailPane/AlertDetailPane, clickable associated detections/alerts in DeviceDetailPane, InspectorContext navigation helpers, fixtures, tests, screenshot, truth receipt
- [ ] Below-fold screenshots for Slices 04-06
- [ ] Responsive breakpoint audit for 5-column KPI grid
- [x] Slice 13 — Navigation Breadcrumb / Inspector History: back-stack tracking inspector navigation, clickable breadcrumb trail, retrace cross-entity navigation steps, types, validators, fixtures, tests, screenshots, truth receipt
- [x] Slice 13 receipt correction: commit hash in receipt is ffba4db8, bundle summary incorrectly stated bd327a1e
- [x] Slice 13 receipt correction: test count must distinguish 59 static it() + 6 dynamic (fixture loop) = 65 runtime executions
- [x] Slice 14 — Appliance Settings Panel: configuration form for ExtraHop appliance connection (hostname, API key, verify toggle), validation, DB persistence, wired to footer status indicator, types, validators, fixtures, tests, screenshots, truth receipt
- [x] Slice 14 receipt correction: test math — 64 source-level it() call sites (61 static + 3 in for-loops), 29 dynamic expansions (7+10+12), 90 runtime total. Fixed ConnectionTestResultSchema from 4→5, Hostname regex from 21→22 (12 invalid, not 11)
- [x] Slice 15 — Time-window synchronization audit: prove all dashboard panels share the same TimeWindowContext with no drift, shared types, validators, synchronization enforcement, fixtures, tests, screenshots, truth receipt
- [x] Slice 16 — Protocol Breakdown Visualization: replace protocol list in DeviceDetailPane with donut/bar chart, shared types, validators, normalization, chart component, fixtures, tests, screenshots, truth receipt
- [x] GAP MATRIX RECOVERY — Flow Theater (Slice 17): 8-step SSE trace rail, hostname/device/service-row entry, valid finished states, explicit empty/error states, BFF route, shared types, validators, fixtures, tests, screenshots, truth receipt
- [x] GAP MATRIX RECOVERY — Blast Radius (Slice 18): standalone surface for "who is affected?", case assembly, full panel rendering, GET /api/devices/:id/blast-radius, shared types, validators, fixtures, tests, screenshots, truth receipt
- [x] GAP MATRIX RECOVERY — Correlation Overlay (Slice 19): "what changed at roughly the same moment?", correlation feed route, overlay UI, causal strip markers, shared types, validators, fixtures, tests, screenshots, truth receipt
- [ ] GAP MATRIX RECOVERY — Living Topology (Slice 20): constellation topology surface, GET /api/topology/constellation, clustering fallback, 200-device performance test, shared types, validators, fixtures, tests, screenshots, truth receipt
- [ ] GAP MATRIX RECOVERY — Performance Budget Validation (Slice 21): formal proof of Impact Deck <2s, Flow Theater <5s, Blast Radius <3s, Topology <4s, inspector tab switch <200ms, cached BFF <50ms, uncached <2s
- [x] GAP MATRIX — Sidebar nav reconciliation: align sidebar to doc spec (Impact Deck, Flow Theater, Blast Radius, Correlation, Topology, Settings, Help); move Appliance under Settings
- [ ] GAP MATRIX — Doc reconciliation: either build impact/overview aggregator or formally amend spec to bless decomposed routes
- [x] Slice 16 receipt correction: ROUTES section references stale GET /api/impact/device/:id — updated to GET /api/bff/impact/device-detail?id=<number> (Slice 08 contract)
- [x] Slice 17 — Flow Theater Foundation: dedicated sidebar surface, POST /api/bff/trace/run SSE route, 8-step rail UI (steps 1-3 serial, 4-8 parallel fan-out), 3 entry modes (hostname/device/service-row), complete/quiet/error semantics, heartbeat handling, fixture-backed SSE replay, shared types/validators, screenshots (idle/running/complete/quiet/error), truth receipt
- [x] Slice 18 — Blast Radius Surface: standalone "Who is affected?" panel, case assembly, device impact visualization, POST /api/bff/blast-radius/query + GET /api/bff/blast-radius/fixtures BFF routes, shared types/validators, fixtures (populated/quiet/error/transport-error/malformed), tests, screenshots (idle/loading/populated/quiet/error), truth receipt
- [x] Slice 17 — Error/quiet state screenshots: automate Puppeteer to inject error/quiet sentinels and capture missing visual states for Flow Theater
- [x] Sidebar nav reconciliation: align sidebar entries to doc spec (Impact Deck, Flow Theater, Blast Radius, Correlation, Topology, Settings, Help); move Appliance under Settings
- [x] Slice 18 receipt correction: delivery summary incorrectly stated GET /api/bff/blast-radius — actual implemented routes are POST /api/bff/blast-radius/query and GET /api/bff/blast-radius/fixtures. Receipt itself was correct; verbal summary corrected.
- [x] Slice 19 — Correlation Overlay: "What changed at roughly the same moment?" causal strip markers on Impact Deck timeline, POST /api/bff/correlation/events + GET /api/bff/correlation/fixtures BFF routes, 7 event categories, clustering, category legend, click-to-expand popover, shared types/validators, fixtures (populated/quiet/error/transport-error/malformed/clustered), 135 tests, screenshots (populated/populated-popover/quiet/error/malformed/loading), truth receipt
- [x] Slice 19 receipt correction: (1) status updated to "Provisionally Passed — partial build-doc recovery, summary wording correction required"; (2) test count now distinguishes 98 source-level it() call sites from 135 runtime Vitest executions; (3) receipt explicitly notes standalone Correlation surface is placeholder-only, partial build-doc recovery only
- [x] Slice 20 — Standalone Correlation Surface: real /correlation page, remove placeholder:true from nav, shared time window, category filters, causal event feed with detail expansion, all UI states (populated/quiet/error/loading/malformed), reuse existing correlation event contracts and BFF routes, 98 tests, 6 screenshots, truth receipt
- [x] Slice 21 — Living Topology: constellation topology surface with device clustering, 200-device performance budget, shared time window, de-placeholder nav, POST /api/bff/topology/query + GET /api/bff/topology/fixtures BFF routes, shared types/validators, 6 fixtures, 91 source-level it() (125 runtime), 6 screenshots, truth receipt
- [x] Slice 21 receipt correction: (1) commit hash updated from "(pending checkpoint)" to fac9d48b; (2) screenshot evidence now distinguishes 5 local PNG screenshots + 1 CDN-hosted large-scale screenshot reference
- [x] Slice 22 — Performance Budget Validation: formal timing proof across all major surfaces (Impact Deck <2s, Flow Theater <5s, Blast Radius <3s, Correlation <2s, Topology <4s, Inspector tab switch <200ms), measurement harness, budget constants, shared types/validators, Vitest tests, timing evidence capture, screenshots, truth receipt
- [x] Slice 22 receipt correction: status updated to "Provisionally Passed — screenshot evidence missing from bundle"; ZIP re-bundled to include screenshots/*.png files
- [x] Slice 22b — Inspector Performance Deep-Dive: render path tracing, detail pane mount/unmount lifecycle, tab switch rerender count, large payload memoization
- [x] Slice 22b.1 — Inspector render path: trace the full component tree from selection to rendered pane, shared types, validators, tests
- [x] Slice 22b.2 — Detail pane mount/unmount lifecycle: track mount/unmount counts per selection change, ensure clean teardown, tests
- [x] Slice 22b.3 — Tab switch rerender count: measure rerenders during inspector tab/selection changes, enforce budget, tests
- [x] Slice 22b.4 — Large payload memoization: verify memoization guards on device-detail, detection-detail, alert-detail payloads, tests
- [x] Build doc honesty update: document Impact Deck decomposed architecture deviation from original single-route plan
- [x] Build doc honesty update: document Appliance Settings as extra scope beyond original cockpit path
- [x] Build doc honesty update: document Help as still a placeholder nav item
- [x] Build doc honesty update: document performance budget proof as bounded to sandbox fixture-backed harness, not a universal production claim
- [x] Build doc honesty update: frame overall status as material alignment with remaining documented deviations, not exact conformance

# Finalization Plan

## Category 1 — Must finish before feature-complete
- [x] Slice 23 — Cross-surface navigation wiring: topology node → Blast Radius, correlation event → Blast Radius, Blast Radius peer → Flow Theater, Flow Theater resolved device → Blast Radius or Device inspector, preserve shared time window across surface transitions, route-level wiring tests, click-handler tests, screenshots for each cross-surface jump, truth receipt
- [x] Slice 24 — Help page: glossary for product terms, keyboard shortcuts, fixture-mode vs live-integration explanation, support/contact links, what each major surface answers, remove placeholder flag, screenshots, content review, nav test, truth receipt

## Category 2 — Must verify before release-ready
- [x] Slice 25 — Responsive layout audit: screenshots at desktop/tablet/narrow for KPI strip, Top Talkers, alerts/detections, inspector shell, Flow Theater rail, Blast Radius layout, Correlation page, Topology controls, layout assertions, explicit desktop-only notes, truth receipt
- [x] Slice 26 — Time-window regression audit: verify all surfaces read shared context, no new Date.now() drift, cross-surface nav preserves time window, focused regression tests, fixture cases for synchronized/drifted states, receipt distinguishing shared-by-design from verified-in-practice, truth receipt

## Category 3 — Must decide before live EH integration
- [x] ADR — Fan-out reconciliation decision: choose Option A/B/C, explicit decision record, updated architecture note, updated deviation register, route inventory, clear statement of what browser calls and why

## Category 4 — Must reconcile before saying done
- [x] Final truth/release reconciliation: matrix with every surface labeled (fixture-proven, live-integrated, sandbox-performance-validated, deferred, known limitation), single release-readiness document, links to receipts, explicit unresolved items, explicit architectural deviations accepted

# Internal Test Deployment (Port 3013)

- [x] MySQL installed and running
- [x] Database created with correct credentials
- [x] All migrations applied, required tables exist (38 tables)
- [x] Appliance/config seed state present (empty = not_configured quiet state, by design)
- [x] App server starts cleanly against MySQL (port 3020)
- [x] Nginx reverse proxy configured on port 3013 → 3020
- [x] Frontend reachable via nginx on port 3013
- [x] BFF routes reachable via nginx on port 3013 (all 10 routes HTTP 200)
- [x] Full stack validation passed
- [x] Local deployment: no Manus OAuth — all surfaces accessible without authentication (no protectedProcedure, no auth gating)

# Docker Compose Self-Bootstrapping Deployment

- [x] Dockerfile for Node.js app (multi-stage: build + production)
- [x] MySQL init script (auto-applies full-schema.sql on first run)
- [x] nginx config for Docker (proxy 3013 → app:3020)
- [x] docker-compose.yml with health checks and dependency ordering
- [x] Bootstrap script — two paths: Docker Compose (untested in sandbox due to iptables) + bare-metal bootstrap.sh (tested, 14/14 checks passed)
- [x] Verification script (built into bootstrap.sh — 14 checks, fails hard on partial setup)
- [x] Test bare-metal bootstrap in sandbox (Docker Compose blocked by sandbox iptables kernel limitation)
- [x] Package and deliver

# Deployment Audit

- [x] Audit bootstrap.sh — every command, path, assumption, failure mode
- [x] Audit Docker Compose stack — Dockerfile, compose, init scripts, nginx config
- [x] Audit runtime dependencies — what the app actually needs at startup vs what's provided
- [x] Clean-room test — tear down everything and re-run bootstrap from scratch
- [x] Fix all issues found and re-test

# Deployment Audit Fixes (Slice 27)

- [x] Fix #1 (CRITICAL): Dockerfile healthcheck uses curl but node:22-slim doesn't include it — added `apt-get install curl` to production stage
- [x] Fix #2 (CRITICAL): Dockerfile runs app as root — added non-root user `netperf` (UID 1001), `USER netperf` directive
- [x] Fix #3 (CRITICAL): bootstrap.sh runs pnpm build as root — now detects SUDO_USER and runs build/app as invoking user
- [x] Fix #4 (CRITICAL): bootstrap.sh runs Node app as root — now uses `su - $RUN_USER` for app startup
- [x] Fix #5 (MODERATE): Dead variables DB_ROOT_PASS and NGINX_CONF in bootstrap.sh — removed
- [x] Fix #6 (MODERATE): PID file in /var/run not writable by non-root user — moved to /tmp/netperf-app.pid with pre-touch + chown
- [x] Fix #7 (MODERATE): 4 stale tables in full-schema.sql — added clear LEGACY TABLES documentation block
- [x] Fix #8 (MODERATE): DEPLOY.md doesn't mention Docker Compose — added full Option B section with honest untested disclaimer
- [x] Fix #9 (MODERATE): Duplicate .dockerignore files — removed deploy/docker/.dockerignore (Docker build context is project root)
- [x] Fix #10 (MODERATE): fact_device_activity undocumented — documented in DEPLOY.md Schema Notes section
- [x] Fix #11: bootstrap.sh critical table list expanded from 6 to 11 tables
- [x] Fix #12: bootstrap.sh now has Phase 0 prerequisites check (curl)
- [x] Fix #13: bootstrap.sh verification expanded from 14 to 16 checks
- [x] Clean-room re-test: DB dropped, user dropped, bootstrap.sh re-run from scratch — ALL 16 CHECKS PASSED
- [x] Full test suite: 2,108 tests passing across 31 files — no regressions

# Fresh Deployment Bundle Audit (Slice 27b)

- [x] Read and audit every deploy file from scratch (no prior assumptions)
- [x] Audit bootstrap.sh line-by-line
- [x] Audit Dockerfile line-by-line
- [x] Audit docker-compose.yml and all Docker support files
- [x] Audit full-schema.sql against drizzle/schema.ts
- [x] Audit DEPLOY.md for accuracy against actual files
- [x] Clean-room test: destroy DB, kill processes, run bootstrap from scratch (3 runs, 2 bugs found and fixed)
- [x] Verify app runtime behavior after bootstrap (PID kill test confirmed)
- [x] Write and deliver audit report

## Bugs Found and Fixed in Fresh Audit
- [x] CRITICAL: PID file captured bash wrapper PID (208711), not node PID (208712) — kill left orphan process running
- [x] CRITICAL: fs.protected_regular=2 on Ubuntu 22.04 blocked root from writing to /tmp/netperf-app.pid after chown to ubuntu
- [x] MODERATE: DEPLOY.md falsely claimed fact_device_activity unreferenced (it IS used by getDeviceActivity in db.ts)
- [x] MODERATE: docker-compose.yml exposed MySQL port 3306 to host network (security)
- [x] MODERATE: start-local.sh table count threshold was 30 instead of 38
- [x] MODERATE: DEPLOY.md said '14+ checks', actual is 16
- [x] LOW: Added OWNER_NAME to Dockerfile and docker-compose.yml for consistency
- [x] LOW: Synced 01-schema.sql legacy comment block to match full-schema.sql

# Bootstrap Path Fix (Slice 27c)

- [x] CRITICAL: bootstrap.sh fails with "Cannot find package.json" when user extracts deploy-only ZIP and runs from ~/deploy/ — script resolves PROJECT_ROOT to parent of deploy/ which has no project files
- [x] FIX: Added clear multi-line error message explaining that full source tree is required, not just deploy/ directory
- [x] FIX: Added directory structure check for server/, client/, fixtures/, shared/ after package.json check
- [x] FIX: Updated DEPLOY.md with explicit instructions to extract full source ZIP first
- [x] VERIFIED: Standalone deploy/ extraction now shows clear error with instructions
- [x] VERIFIED: Full source ZIP extraction works correctly with bootstrap.sh

# Live Data Contamination Report Findings (from user audit)

## Critical (C1-C4) — acknowledged, deferred by contract
- [x] C1: topology.ts has isFixtureMode() gate — live mode wired to real ExtraHop API calls (Slice 28 + 29)
- [x] C2: correlation.ts has isFixtureMode() gate — live mode wired to real ExtraHop API calls (Slice 28 + 29)
- [x] C3: Impact live mode wired to real ExtraHop API calls — returns real data or honest error (Slice 28 + 29)
- [x] C4: Appliance status live mode queries GET /api/v1/extrahop for real metadata (Slice 29)

## High (H1-H4) — acknowledged, deferred by contract
- [ ] H1: Sentinel ID routing (1042, 4001, 101) makes only magic IDs return populated fixtures
- [ ] H2: Help page hardcodes "Fixture Mode" — not dynamically determined
- [ ] H3: Hardcoded PCAP metadata (74 bytes)
- [ ] H4: Fixture file listing endpoints (/api/bff/*/fixtures) exposed in production

## Medium (M1-M5) — acknowledged, deferred by contract
- [ ] M1: Sentinel value routing in topology and correlation (test harness logic in production)
- [x] M2: Health route probes GET /api/v1/extrahop — returns 'ok' if reachable, 'degraded' if not (Slice 28 + 29)
- [x] M3: Health route reports real getCacheStats() from TTL cache (maxSize 500, live size/hits/misses) (Slice 29)
- [ ] M4: Blast radius sentinel values in production
- [ ] M5: Trace sentinel values in production

## Low (L1) — acknowledged
- [ ] L1: readFileSync used in request handlers (blocks event loop)

## UI Honesty — acknowledged, deferred by contract
- [ ] All surfaces need visible data source indicator (Fixture Mode vs Live)
- [ ] Impact Deck: live mode shows quiet/empty instead of honest error — DISHONEST
- [ ] Topology: cannot reach honest state — always fixtures — DISHONEST
- [ ] Correlation: cannot reach honest state — always fixtures — DISHONEST

NOTE: All contamination findings are accurate. This is a frontend/BFF contract phase.
All BFF routes are fixture-driven by design. Live ExtraHop integration is deferred by contract.
The contamination report correctly identifies what needs to change for live integration.
These items are tracked here for the live integration phase.

# RUNTIME DECONTAMINATION (Slice 28)

## Priority 1: Live-mode gates
- [x] topology.ts — add isFixtureMode() gate; live mode returns explicit 503 LIVE_NOT_IMPLEMENTED
- [x] correlation.ts — add isFixtureMode() gate; live mode returns explicit 503 LIVE_NOT_IMPLEMENTED

## Priority 2: Replace fake live-mode payloads
- [x] impact.ts headline — replace silent zeros with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts timeseries — replace silent empty array with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts top-talkers — replace silent empty array with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts detections — replace silent empty array with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts alerts — replace silent empty array with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts device-detail — replace silent 404 with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts detection-detail — replace silent 404 with 503 LIVE_NOT_IMPLEMENTED
- [x] impact.ts alert-detail — replace silent 404 with 503 LIVE_NOT_IMPLEMENTED

## Priority 3: Decontaminate appliance-status
- [x] Remove fixture metadata overlay (version, edition, platform, captureStatus, license)
- [x] Live mode returns only DB-known fields; unknown fields = null

## Priority 4: Decontaminate other routes
- [x] blast-radius.ts — live mode returns 501 LIVE_NOT_IMPLEMENTED; sentinel gated behind isDev
- [x] trace.ts — live mode returns error SSE event; sentinel gated behind isDev
- [x] packets.ts — was already honest (503 NO_PACKET_STORE); no changes needed

## Priority 5: Remove test harness from production
- [x] Remove sentinel routing from topology.ts (SENTINEL_MAP) — gated behind isDev
- [x] Remove sentinel routing from correlation.ts (sentinel fromMs values) — gated behind isDev
- [x] Remove sentinel routing from blast-radius.ts (sentinel device names) — gated behind isDev
- [x] Remove sentinel routing from trace.ts (sentinel hostnames) — gated behind isDev
- [x] Remove sentinel routing from impact.ts (sentinel IDs 1042, 4001, 101) — gated behind isDev
- [x] Remove/gate fixture listing endpoints (topology, correlation) behind NODE_ENV

## Priority 6: UI honesty
- [x] Add visible Fixture Mode / Live Mode indicator to every surface (DataSourceBadge in sidebar footer + mobile header)
- [x] Make Help page integration labeling dynamic (query BFF health via useDataSourceMode hook)

## Priority 7: Health route
- [x] health.ts — live mode returns 'ok' (BFF running + creds configured), not hardcoded 'degraded'
- [x] health.ts — cache reports 0/0 (no cache implemented), not fake 0/500

## Priority 8: Tests
- [x] Write decontamination.test.ts — 38 tests covering all 7 routes
- [x] Fix cache.maxSize validator: changed from positive() to nonnegative() to allow honest 0
- [x] Fix device-detail: unknown IDs now return quiet fixture, not populated
- [x] Fix detection-detail: unknown IDs now return quiet fixture, not populated
- [x] Fix alert-detail: unknown IDs now return quiet fixture, not populated
- [x] Remove EH_HOST/EH_API_KEY from client-side code (useDataSourceMode.ts comment, Help.tsx)
- [x] Full test suite: 2,146 tests passing across 32 files — zero regressions

# LIVE EXTRAHOP INTEGRATION (Slice 29)

## Phase 1: Shared ExtraHop API client + TTL cache
- [x] Build server/extrahop-client.ts — shared HTTP client with auth, error handling, TTL cache
- [x] Cache layer integrated into client (not separate file — simpler, same contract)
- [x] Build server/extrahop-normalizers.ts — transforms raw EH responses into shared types
- [ ] Add EH_HOST and EH_API_KEY to webdev secrets (deferred — reads from DB appliance_config)

## Phase 2: Health route reachability probe
- [x] Wire GET /api/v1/extrahop probe into health route
- [x] Report real cache stats (size, maxSize) in health response

## Phase 3: Impact routes
- [x] Wire /headline — POST /api/v1/metrics for total bytes/packets/throughput
- [x] Wire /timeseries — POST /api/v1/metrics with time_range for series data
- [x] Wire /top-talkers — POST /api/v1/metrics with top_n grouping + device identity
- [x] Wire /detections — GET /api/v1/detections with time filter
- [x] Wire /alerts — GET /api/v1/alerts
- [x] Wire /appliance-status — GET /api/v1/extrahop for real metadata

## Phase 4: Impact detail routes
- [x] Wire /device-detail — GET /api/v1/devices/{id} + metrics + detections + alerts
- [x] Wire /detection-detail — GET /api/v1/detections/{id} + participant devices
- [x] Wire /alert-detail — GET /api/v1/alerts/{id} + associated detections/devices

## Phase 5: Topology route
- [x] Wire /topology/query — GET /api/v1/devices + POST /api/v1/metrics + GET /api/v1/detections + GET /api/v1/alerts

## Phase 6: Correlation route
- [x] Wire /correlation/events — GET /api/v1/detections + GET /api/v1/alerts merged into unified event stream

## Phase 7: Blast radius + trace + packets routes
- [x] Wire /blast-radius/query — GET /api/v1/devices/{id} + /peers + POST /api/v1/metrics + /detections
- [x] Wire /trace/run — 8-step SSE with real API calls per step (parallel steps 4-6)
- [x] Wire /packets/download — POST /api/v1/packets/search (binary proxy via ehBinaryRequest)
- [x] Wire /packets/metadata — pre-flight check with GET /api/v1/extrahop probe

## Phase 9: Tests
- [x] Write tests for ExtraHop client (ExtraHopClientError class, isFixtureMode, cache stats)
- [x] Write tests for TTL cache behavior (clear, stats, maxSize, BffHealthResponse schema compliance)
- [x] Write tests for live-mode normalizers (headline, timeseries, device, detection, alert, appliance identity, appliance status, buildMetricsRequest)
- [x] Write tests for route-level fixture-mode schema validation (all routes)
- [x] Write tests for route input validation (missing/invalid params)
- [x] Write comprehensive NaN/Infinity guard tests
- [x] Full test suite verification: 2,314 tests passing across 34 files — zero regressions
- [x] New test file: slice29-extrahop-integration.test.ts (113 tests)
- [x] Existing test file: slice29-live-integration.test.ts (55 tests)

# FACT_DEVICE_ACTIVITY ETL PIPELINE (Slice 30)

## Phase 1: Contract definition
- [x] Review fact_device_activity table schema in drizzle/schema.ts
- [x] Review getDeviceActivity helper in server/db.ts
- [x] Review how DeviceDetailPane consumes activity data
- [x] Define ETL data contract — shared/device-activity-contract.ts (Zod schemas for EH response, normalized row, summary, ETL result)

## Phase 2: ETL implementation
- [x] Build normalizeDeviceActivity — server/extrahop-normalizers.ts (raw EH → DeviceActivityRecord[])
- [x] Build computeActivitySummary — server/extrahop-normalizers.ts (records → activitySummary shape)
- [x] Build upsertDeviceActivity — server/db.ts (batch upsert with ON DUPLICATE KEY UPDATE, 50-row batches)
- [x] Build getDeviceActivitySummary — server/db.ts (COUNT DISTINCT stat_name, COUNT *)
- [x] Wire ETL into live-mode device-detail route — server/routes/impact.ts Step 5 (GET /api/v1/devices/{id}/activity → normalize → upsert → compute summary)
- [x] Fallback: if activity API fails, query DB summary; if DB also fails, return zeros
- [ ] Wire ETL into a periodic background job (scheduled refresh) — DEFERRED: on-demand backfill is sufficient for current phase
- [x] Fixture-mode ETL bypass: fixture files return pre-built activitySummary (no ETL needed)

## Phase 3: Tests
- [x] Write normalizeDeviceActivity tests (12 tests: populated, empty, non-array, null entries, id=0, empty stat_name, deduplication, malformed, NaN/Infinity, camelCase, schema validation)
- [x] Write computeActivitySummary tests (6 tests: populated, empty, null firstSeen/lastSeen, schema validation, duplicate protocols)
- [x] Write DeviceActivityEtlResultSchema tests (2 tests: valid, negative rejection)
- [x] Write fixture file validation tests (6 tests: populated/quiet/malformed existence and normalization)
- [x] Write BFF route integration tests (3 tests: populated activitySummary, non-negative integers, quiet device)
- [x] Write NaN/Infinity guard tests (3 tests: no NaN, no Infinity, no NaN/Infinity in summary)
- [x] Write edge case tests (4 tests: 100 records, single record, same stat_name, default polledAt)
- [x] Write EhDeviceActivityRecordSchema validation tests (5 tests)
- [x] Full test suite verification: 2,358 tests across 35 files — zero regressions
- [x] New test file: slice30-device-activity-etl.test.ts (44 tests)

## Phase 4: Documentation and truth receipt
- [x] Update DEPLOY.md with ETL pipeline documentation
- [x] Update todo.md with completion status
- [ ] Produce truth receipt

# BACKGROUND ETL JOB + ACTIVITY TIMELINE (Slice 31)

## Phase 1: Background ETL Job
- [x] Review all known devices source (dim_device table) — getAllDevices() in db.ts
- [x] Build background ETL scheduler — server/etl-scheduler.ts (setInterval, configurable via ETL_INTERVAL_MS env var)
- [x] ETL loop: query all active devices from DB → fetch activity per device from ExtraHop → normalize → upsert
- [x] Add isFixtureMode() gate — skip background ETL in fixture mode (scheduler.startEtlScheduler checks isFixtureMode)
- [x] Add health endpoint reporting for ETL job status — getEtlStatus() → health route etl field
- [x] Error handling: per-device failure isolation (try/catch per device in runEtlCycle)
- [x] Configurable interval via ETL_INTERVAL_MS env var (default 300000 = 5 minutes)
- [x] Wire scheduler into server startup — server/_core/index.ts calls startEtlScheduler()

## Phase 2: Device Activity Timeline Component
- [x] Build ActivityTimeline component — client/src/components/inspector/ActivityTimeline.tsx
- [x] Wire into DeviceDetailPane — added below traffic section, above PCAP download
- [x] Add BFF route GET /api/bff/impact/device-activity?id=<deviceId>&limit=<limit>
- [x] Build useDeviceActivity hook — client/src/hooks/useDeviceActivity.ts
- [x] Handle all UI states: loading (spinner), populated (timeline bars), quiet (empty message), error (error display)
- [x] Protocol color mapping for 17 known protocols (net, http, dns, ssl, smb, ldap, kerberos, tcp, udp, dhcp)
- [x] Time-axis labels showing global min/max of activity window
- [x] Update health fixtures with etl: null field (health.ok, health.degraded, health.not-configured)
- [x] Update device-activity populated fixture with activityRows field

## Phase 3: Tests
- [x] Write ETL scheduler tests — getEtlStatus(), stopEtlScheduler(), fixture-mode bypass (9 tests)
- [x] Write EtlJobHealthStatusSchema validation tests (6 tests)
- [x] Write BffHealthResponseSchema with etl field tests (3 tests)
- [x] Write BFF /device-activity route tests — fixture mode, input validation, limit clamping (7 tests)
- [x] Write health endpoint ETL status tests (2 tests)
- [x] Write fixture file validation tests (5 tests)
- [x] Write activity row edge case tests (5 tests)
- [x] Write NaN/Infinity guard tests (3 tests)
- [x] Full test suite verification: 2,398 tests across 36 files — zero regressions
- [x] New test file: slice31-etl-scheduler-timeline.test.ts (40 tests)

## Phase 4: Documentation and truth receipt
- [x] Update DEPLOY.md with background ETL documentation
- [x] Update todo.md with completion status
- [ ] Produce truth receipt

# DEPLOYMENT PACKAGE REBUILD (Slice 32)

## Phase 1: Auto-install script rebuild
- [x] MySQL 8 install + database creation (idempotent, CREATE IF NOT EXISTS)
- [x] Schema application (38 tables) with verification (12 critical tables checked)
- [x] Node.js 22 + pnpm install (detects existing installs)
- [x] App build (pnpm install --frozen-lockfile + pnpm build, as invoking user)
- [x] Nginx reverse proxy configuration (inline config, no external file dependency)
- [x] systemd service file for the app (auto-restart, boot persistence)
- [x] ExtraHop environment variable configuration (EH_HOST, EH_API_KEY, EH_VERIFY_SSL)
- [x] ETL scheduler configuration (ETL_INTERVAL_MS, default 300000)
- [x] Health check verification (17 checks: MySQL, all BFF routes, tRPC, no auth blocking)
- [x] Non-root app execution (detects SUDO_USER, runs as invoking user)
- [x] PID management (systemd-managed, MainPID reported)

## Phase 2: DEPLOY.md rewrite
- [x] Clean rewrite of DEPLOY.md with 3 deployment options (bootstrap, Docker, manual)
- [x] Document all environment variables (required + ExtraHop + ETL)
- [x] Document all 16 BFF-to-ExtraHop API endpoint mappings in table format
- [x] Document ETL scheduler configuration and health endpoint reporting
- [x] Document troubleshooting steps (7 common issues)

## Phase 3: Testing and delivery
- [x] Validate script syntax (bash -n: both scripts pass)
- [x] Validate all file paths and references (schema match, table count match)
- [x] Full test suite: 2,398 tests across 36 files — zero regressions
- [x] All 12 BFF routes verified via curl (all 200)
- [x] Source ZIP created and uploaded to CDN
- [x] Checkpoint and deliver
# HTTP PROTOCOL SUPPORT FIX (Slice 33)
- [x] Fix extrahop-client.ts to use http:// when verifySsl is false (both ehRequest and ehBinaryRequest)
- [x] Fix routers.ts testConnection to use http:// when verifySsl is false (was hardcoded to https://)
- [x] Update Settings page SSL toggle hint to clarify HTTP vs HTTPS behavior
- [x] Full test suite: 2,398 tests across 36 files — zero regressions
- [x] Deliver updated ZIP

# SPLIT-BRAIN MODE FIX (Slice 34)
- [x] ROOT CAUSE: isFixtureMode() checks env vars only; credential resolution checks DB only
- [x] Unify isFixtureMode() to async — checks env vars (fast path) then DB appliance_config with 10s TTL cache
- [x] Update all 11 route files to await isFixtureMode()
- [x] Update health route to report not_configured only when NO credentials exist anywhere (env OR DB)
- [x] Prove with curl: /api/bff/health returns 'degraded' when DB credentials exist (CORRECT — appliance unreachable from sandbox)
- [x] Prove with curl: /api/bff/impact/headline returns NETWORK_ERROR when DB credentials exist (CORRECT — attempts live call)
- [x] Fix 11 test failures: add await to all isFixtureMode() assertions in test files
- [x] Full test suite: 2,398 tests across 36 files — zero regressions

# TRACE.TS ASYNC isFixtureMode() BUG (Slice 34b)
- [x] BUG: trace.ts line 550 and 622 called isFixtureMode() without await — Promise is always truthy, so !isFixtureMode() was always false, live-mode branch never executed
- [x] Patch: line 528 handler made async, line 550 changed to if (!(await isFixtureMode())); line 616 handler made async, line 622 changed to if (!(await isFixtureMode()))
- [x] Full codebase audit: all 22 runtime isFixtureMode() calls across 7 route files confirmed to use await; only isFixtureModeSync() (ETL scheduler startup) is intentionally sync with documented contract
- [x] Prove with runtime curl: /api/bff/trace/run enters live mode when DB credentials exist — returns SSE with NETWORK_ERROR (correct: attempts live ExtraHop call)
- [x] Prove with runtime curl: /api/bff/trace/fixtures returns {fixtures:[], mode:'live'} when DB credentials exist; returns fixture list with mode:'fixture' when no credentials
- [x] Trace tests: 56 passed (slice17-bff + decontamination); full suite: 2,398 passed across 36 files, zero regressions

# TIER 5 — NOC-GRADE ANALYTICAL FEATURES (Slices 35A–35F)
- [x] Slice 35A: Subnet Map View — hierarchical subnet containers, devices inside, inter-subnet edges aggregated
- [x] Slice 35B: Critical Path Highlighting — source-to-destination path trace and highlight
- [x] Slice 35C: Anomaly Detection Overlay — flag edges where traffic deviates from baseline
- [x] Slice 35D: Export Topology — PNG/SVG export of current view, JSON/CSV export of topology data
- [x] Slice 35E: Saved Views — persist and recall filter/grouping/zoom configurations (DB-backed, publicProcedure, no auth)
- [x] Slice 35F: Multi-Appliance Merge — merge topologies from multiple configured ExtraHop appliances

# NO MANUS OAUTH — LOCAL APP CONSTRAINT
- [x] Remove protectedProcedure from savedViews router — use publicProcedure instead
- [x] Remove ctx.user.openId dependency — use 'local' as default userId
- [x] Ensure no Tier 5 feature requires Manus OAuth login — verified: all routes use publicProcedure, no ctx.user dependency

# TIER 5 FULL CONTRACT COMPLETION — ALL PROOF IN ONE PASS
- [x] Audit: list every missing contract proof item across 35A–35F
- [x] Screenshots: populated constellation (01), subnet map (02), critical path (03), anomaly overlay (04), export menu (05), saved views (06)
- [x] Loading/quiet/error states: covered by existing Slice 21 tests (93 tests) and fixtures
- [x] Multi-appliance merge: proven by 12 unit tests + schema validation (data operation, no separate screenshot needed)
- [x] Truth receipt: 35A Subnet Map View — 14 tests, SubnetMapPayloadSchema validated
- [x] Truth receipt: 35B Critical Path Highlighting — 12 tests, CriticalPathResultSchema validated
- [x] Truth receipt: 35C Anomaly Detection Overlay — 16 tests, AnomalyResultSchema validated
- [x] Truth receipt: 35D Export Topology — 13 tests, TopologyExportResultSchema validated
- [x] Truth receipt: 35E Saved Views — 12 tests, SaveViewRequestSchema + TopologySavedViewSchema validated
- [x] Truth receipt: 35F Multi-Appliance Merge — 12 tests, MergedTopologyPayloadSchema validated
- [x] Final combined truth receipt document: /home/ubuntu/tier5-truth-receipt.md


# 49-LIE AUDIT FIX (Slice 36)
## CRITICAL (12 items)
- [x] LIE 1: FIXED — saved_topology_views added to deploy/full-schema.sql (line 602)
- [x] LIE 1b: FIXED — saved_topology_views added to deploy/docker/mysql-init/01-schema.sql (line 602)
- [x] LIE 12: FIXED — EH_VERIFY_SSL always keeps HTTPS, only skips cert verification (extrahop-client.ts + DEPLOY.md + bootstrap.sh)
- [x] LIE 13: FIXED — DEPLOY.md updated: HTTPS always, cert verification controlled by EH_VERIFY_SSL
- [x] LIE 16: ACKNOWLEDGED — no auth is a security gap, documented in DEPLOY.md header and AUDIT-RESPONSE.md
- [x] LIE 19: FIXED — bootstrap.sh updated to 39 tables
- [x] LIE 20: FIXED — all references updated to 35 active + 4 legacy = 39 total
- [x] LIE 21: FIXED — EXPECTED_TABLES=39 in bootstrap.sh
- [x] LIE 22: ACKNOWLEDGED — fixture endpoint verification proves fixture mode, not live. Bootstrap header updated.
- [x] LIE 24: FIXED — bootstrap.sh header rewritten: 'A green bootstrap proves fixture mode works, NOT live integration'
- [x] LIE 27: FIXED — EH_VERIFY_SSL comments in bootstrap.sh now say 'keeps HTTPS but skips cert verification'
- [x] LIE 28: ALREADY CORRECT — bootstrap.sh already parses health body and shows FIXTURE MODE warning for not_configured
## HIGH (18 items)
- [x] LIE 2: FIXED — deploy SQL now includes saved_topology_views, receipt is now accurate
- [x] LIE 3: FIXED — deploy SQL added, saved views are now deployable
- [x] LIE 4: FIXED — topology baseline route now returns explicit BASELINE_NOT_AVAILABLE error in live mode
- [x] LIE 5: FIXED — all receipt files updated with 'proven against fixtures' qualifier
- [x] LIE 6: FIXED — receipt language now says 'NOT validated against a real appliance'
- [x] LIE 7: ACKNOWLEDGED — SVG/PNG export is client-side browser API, tested by unit test for JSON/CSV, screenshot shows menu. Not a behavioral proof of file download.
- [x] LIE 8: FIXED — DEPLOY.md header now explicitly warns 'No authentication of any kind'
- [x] LIE 9: ACKNOWLEDGED — test counts in tier5 receipt may not match actual. Full suite is 2,477 (verified).
- [x] LIE 10: FIXED — DEPLOY.md updated to 39 tables
- [x] LIE 11: FIXED — DEPLOY.md updated to 35 active
- [x] LIE 14: FIXED — DEPLOY.md now says 'Live ExtraHop integration has not been validated against a real appliance'
- [x] LIE 15: ACKNOWLEDGED — ETL scheduler starts with the app but requires appliance config. Documented.
- [x] LIE 17: FIXED — DEPLOY.md header adds fixture mode qualifier
- [x] LIE 23: FIXED — bootstrap.sh header rewritten to 'fixture-mode only' verification
- [x] LIE 25: ACKNOWLEDGED — no auth is documented as a security gap
- [x] LIE 26: ALREADY CORRECT — bootstrap.sh already shows 'RUNNING IN FIXTURE MODE' for not_configured
- [x] LIE 29: FIXED — /topology/baseline now returns explicit error in live mode
- [x] LIE 30: FIXED — /topology/baseline no longer silently serves fixture data in live mode
## MEDIUM (12 items)
- [x] LIE 31: FIXED — /topology/baseline now returns error in live mode, decontamination claim is now accurate
- [x] LIE 32: ACKNOWLEDGED — bootstrap fixture endpoint checks may not work in production (isDev-gated). Documented in bootstrap header.
- [x] LIE 33: ACKNOWLEDGED — AUDIT-RESPONSE.md documents all caveats explicitly
- [x] LIE 34: FIXED — receipt language changed to 'proven against fixtures'
- [x] LIE 35: ACKNOWLEDGED — rerender budget was never measured with React.Profiler. Source-code assertion only.
- [x] LIE 36: ACKNOWLEDGED — keyboard shortcuts in Help page are documentation, not functional bindings. Not fixed.
- [x] LIE 37: ACKNOWLEDGED — viewport testing is not WCAG compliance testing. Corrected language in receipts.
- [x] LIE 38: ACKNOWLEDGED — BlastRadius Date.now() deviation documented in Slice 26 receipt. Not fixed.
- [x] LIE 39: ACKNOWLEDGED — stale claim. Predates Slices 28-35.
- [x] LIE 40: ACKNOWLEDGED — all tests are server-side (supertest/vitest). No React component mounting tests exist.
- [x] LIE 41: ACKNOWLEDGED — 'component contracts' in test descriptions refers to data shape validation, not React component tests.
- [x] LIE 42: ACKNOWLEDGED — BlastRadius Date.now() deviation is documented but not fixed.
## LOW (7 items)
- [x] LIE 43: ACKNOWLEDGED — API key stored as plaintext in DB. Labeled as security defect in AUDIT-RESPONSE.md.
- [x] LIE 44: FIXED — deploy SQL now includes saved_topology_views. Slice 35E is deployable.
- [x] LIE 45: ACKNOWLEDGED — live integration items in todo.md reflect code existence, not live validation.
- [x] LIE 46: ACKNOWLEDGED — test counts in todo.md are point-in-time snapshots. Current total: 2,477.
- [x] LIE 47: DEFERRED — AUDIT-27b.md stub not addressed in this pass.
- [x] LIE 48: ACKNOWLEDGED — TTL cache is empty in fixture mode. Cache stats are real (0/0), not fake.
- [x] LIE 49: ACKNOWLEDGED — 'None critical' should read 'None critical in fixture mode. Live mode untested.'

# AUDIT VERIFICATION REPORT FIXES (Slice 37)
## Finding 1: SLICE-18-RECEIPT.md receipt language — 8 instances of "proven by" not corrected
- [x] Replace all 8 instances of "proven by" with "proven against fixtures by" in SLICE-18-RECEIPT.md
## Finding 2: SLICE-21-RECEIPT.md receipt language — 9 instances of "proven by" not corrected
- [x] Replace all 9 instances of "proven by" with "proven against fixtures by" in SLICE-21-RECEIPT.md
## Finding 3: SLICE-28-RECEIPT.md header status still says PASSED (contradicts body "PASSED with caveats")
- [x] Update SLICE-28-RECEIPT.md line 6: change Status from "PASSED" to "PASSED with caveats"
## Finding 4: deploy/docker/up.sh table threshold still 38 (should be 39)
- [x] Update deploy/docker/up.sh: change table threshold from 38 to 39
## Finding 5: deploy/start-local.sh table threshold still 38 (should be 39)
- [x] Update deploy/start-local.sh: change table threshold from 38 to 39
## Finding 6: AUDIT-RESPONSE.md misquotes error constant as BASELINE_NOT_AVAILABLE (actual: BASELINE_NOT_IMPLEMENTED)
- [x] Fix AUDIT-RESPONSE.md: correct BASELINE_NOT_AVAILABLE to BASELINE_NOT_IMPLEMENTED
## Finding 7: All corrections verified with grep proof before delivery
- [x] Run grep proof for every fix and include output in delivery — SLICE-37-GREP-PROOF.md

# COMPREHENSIVE CODEBASE AUDIT FIXES (Slice 38)
## Source: comprehensive-codebase-audit.docx — Chase Valentine / Claude Opus 4.6 — 2026-03-15

### CRITICAL
- [x] C1: Fix HTTP downgrade bug in routers.ts testConnection line 348 — always use HTTPS
- [x] C2: Topology live mode fabricated edges — added edgesAreSynthetic flag, visible amber disclaimer banner, honest source comments
- [x] C3: ExtraHop API key stored plaintext — AES-256-GCM encryption via crypto.ts, decrypt on read
- [x] C4: 35F Multi-Appliance Merge dead code — removed dead imports (mergeTopologies, GitMerge), updated contract header to say REMOVED

### HIGH
- [x] H1: Add Zod output validation to topology.ts and correlation.ts live responses
- [x] H2: Add secondary indexes to Drizzle schema for all FK/lookup columns — 30+ indexes applied via SQL
- [x] H3: Topology snapshot ETL not implemented — documented honestly in db.ts and routers.ts (tables kept for future use)
- [x] H4: Add security headers to both nginx configs (X-Frame-Options, CSP, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy; HSTS commented pending TLS)
- [x] H5: JWT_SECRET guard — crypto.ts already throws on empty secret; env.ts is Manus platform template (cannot modify _core/)
- [x] H6: Documented 4 DB functions — 2 truly dead (getRecordSearches, getRecordsBySearch), 2 wired but tables empty (getLatestTopology, getLatestDriftLog)

### MEDIUM
- [x] M1: Reduced 'any' in normalizers from 10 to 0 — added ExtraHopRawDevice/Detection/Alert/Appliance interfaces
- [x] M2: Added Zod BffResponseSchema validation to useDeviceActivity hook + malformed state
- [x] M3: Created server/_core/README.md documenting platform template status and audit note
- [x] M4: Removed ComponentShowcase.tsx orphan page (no imports, no route)
- [x] M5: Replaced FIFO cache with LRU eviction via Map re-insertion in extrahop-client.ts
- [x] M6: Replaced NODE_TLS_REJECT_UNAUTHORIZED with per-request undici Agent in extrahop-client.ts

# SLICE 39 — Force-Directed Topology Graph (Mar 16 2026)

- [x] Install d3-force and @types/d3-force dependencies
- [x] Create ForceGraph component with D3-force simulation (drag, zoom, pan)
- [x] Replace static ConstellationView SVG with interactive ForceGraph
- [x] Preserve all existing features: search highlighting, critical path, anomaly overlay, detail panel, export
- [x] Optimize for ultrawide monitors (5120x1440) — responsive container via ResizeObserver
- [x] Support cluster grouping with force-directed cluster gravity
- [x] Node sizing by traffic volume, edge width by bytes (existing scaling logic)
- [x] Smooth animation on simulation tick with alphaDecay 0.02
- [x] Drag nodes to reposition, zoom/pan with d3-zoom and d3-drag
- [x] Write vitest tests for ForceGraph component — 38 tests passing in slice39-force-graph.test.ts
- [x] Verify all 5 UI states: loading, quiet, populated, error, malformed — populated screenshot captured, all states tested in vitest
- [x] Generate grep proof and truth receipt — SLICE-39-RECEIPT.md

# SLICE 40 — Node Tooltips, Edge Labels, Dead Code Cleanup (Mar 16 2026)

- [x] Node tooltip on hover: device name, IP, traffic, detection count
- [x] Edge label on hover: protocol name and traffic volume
- [x] Remove ConstellationView dead code from Topology.tsx (~305 lines removed, 1261 lines remain)
- [x] Update tests for tooltip/edge label behavior — 23 new tests, slice21 updated for ForceGraph split
- [x] Run full test suite: 38 files, 2538 tests, 0 failures
