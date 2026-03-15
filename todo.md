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
