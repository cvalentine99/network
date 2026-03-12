# Obsidian Cockpit — Contract Registry

This file tracks the truth receipts for every completed slice.

---

## Truth Receipt Template

```
# TRUTH RECEIPT

Slice:
Status:
Commit:

## Claims
-

## Evidence
- validators present
- fixtures present
- tests passed
- screenshots present

## Not Proven
-

## Deferred by Contract
- live hardware / appliance / packet store / environment validation is not part of the current frontend phase

## Verdict
- Passed / Failed / Blocked
```

---

## Slice 00 — Contract Harness + Shell

# TRUTH RECEIPT

Slice: 00 — Contract Harness + Shell
Status: Passed
Commit: pending checkpoint

## Scope Contract

### In Scope
- App shell with DashboardLayout sidebar
- Global shared time window store (TimeWindowProvider + useTimeWindow hook)
- TimeWindowSelector component in page header (reads/writes global time window)
- Auto-cycle selection logic (duration → cycle mapping)
- Resolved time window display (from–until · cycle) in toolbar
- Inspector shell (opens/closes without breaking layout, placeholder content)
- BFF health route at GET /api/bff/health (schema-validated response)
- Shared types: cockpit-types.ts (TimeWindow, MetricSeries, SeriesPoint, DeviceIdentity, NormalizedDetection, NormalizedAlert, ApplianceIdentity, BffHealthResponse, ImpactOverviewPayload, TopTalkerRow)
- Shared validators: cockpit-validators.ts (Zod schemas for all contract shapes)
- Shared constants: cockpit-constants.ts (ACTIVE_SENTINEL, metric specs, severity mappings, cycle durations, time presets)
- Fixture directory structure: fixtures/health/, fixtures/impact/
- Fixture files: 8 total (4 health, 4 impact)
- Shared UI state components: EmptyState, ErrorState (transport + contract), LoadingSkeleton, KPICardSkeleton
- Truth receipt template in CONTRACTS.md

### Out of Scope
- Impact Deck KPI cards (Slice 02)
- Metrics normalization core (Slice 01)
- Top talkers table
- Detection/alert panels
- Live ExtraHop integration
- PCAP download
- Device detail inspector content

## Data Contract

### BFF Health Request
- Method: GET
- Path: /api/bff/health
- No request body

### BFF Health Response
- Schema: BffHealthResponseSchema (Zod)
- Fields: status (ok|degraded|not_configured), bff (uptime, memoryMB, cache), appliance (ApplianceIdentity|null), timestamp (ISO string)
- Quiet state: status=not_configured, appliance=null (when EH_HOST/EH_API_KEY not set)
- Error state: HTTP 500 with { error, message } on internal failure

### Time Window Query
- Schema: TimeWindowQuerySchema (Zod)
- Fields: from (number, default -300000), until (number, optional), cycle (enum, default 'auto')

## UI Contract

### Loading State
- LoadingSkeleton component renders pulsing placeholder bars
- KPICardSkeleton renders card-shaped skeleton for future KPI cards

### Quiet/Empty State
- EmptyState component renders icon + title + message
- Distinct from error state — empty data is valid

### Populated State
- Shell renders with time window selector, resolved time range display, inspector toggle
- Content area shows placeholder text for future slices

### Error State — Transport Failure
- ErrorState type="transport" renders AlertTriangle icon in red

### Error State — Data Contract Violation
- ErrorState type="contract" renders ShieldX icon in orange

## Evidence

### Tests: 47 passed, 0 failed
- BffHealthResponseSchema: 6 tests (accepts ok/not-configured/degraded fixtures, rejects malformed/null/empty)
- ImpactOverviewPayloadSchema: 3 tests (accepts populated/quiet, rejects malformed)
- ImpactHeadlineSchema: 4 tests (accepts valid, rejects negative/NaN)
- TimeWindow resolution: 9 tests (relative from, duration, auto-cycle selection at all boundaries, schema validation)
- cockpit-constants: 4 tests (ACTIVE_SENTINEL, mapAlertSeverity, riskScoreToSeverity, CYCLE_DURATION_MS)
- Fixture files exist: 16 tests (8 files × exists + valid JSON)
- Static audit: 4 tests (no ExtraHop IP, no API key pattern, no EH env vars, no direct fetch calls in client code)
- BFF health route: 1 test (GET returns schema-valid response)

### Fixtures: 8 files
- fixtures/health/health.ok.fixture.json
- fixtures/health/health.not-configured.fixture.json
- fixtures/health/health.degraded.fixture.json
- fixtures/health/health.malformed.fixture.json
- fixtures/impact/impact-overview.populated.fixture.json
- fixtures/impact/impact-overview.quiet.fixture.json
- fixtures/impact/impact-overview.transport-error.fixture.json
- fixtures/impact/impact-overview.malformed.fixture.json

### Validators: 12 Zod schemas
- TimeWindowQuerySchema, TimeWindowSchema, SeriesPointSchema
- ApplianceIdentitySchema, BffHealthResponseSchema
- ImpactHeadlineSchema, NormalizedDetectionSchema, NormalizedAlertSchema
- DeviceIdentitySchema, TopTalkerRowSchema, ImpactOverviewPayloadSchema

### Screenshots
- Shell default state: webdev-preview screenshot showing Impact Deck header, time window selector ("Last 5 minutes"), resolved time range with cycle, inspector toggle button, content placeholder
- Inspector open state: browser screenshot showing Inspector panel open on right side with "Select an item to inspect" placeholder, layout not broken

### Static Audit
- grep confirms: no 192.168.50.157 in client/src/
- grep confirms: no EH_HOST or EH_API_KEY in client/src/
- grep confirms: no direct ExtraHop API calls in client/src/
- curl confirms: GET /api/bff/health returns HTTP 200 with schema-valid JSON

## Not Proven
- Inspector does not yet display real device/detection detail (deferred to later slices)
- BFF health route does not yet call live ExtraHop appliance
- Time window auto-refresh interval not yet implemented

## Deferred by Contract
- Live hardware / appliance / packet store / environment validation is not part of the current frontend phase
- Live ExtraHop API integration deferred — health route returns fixture/not_configured response
- Real appliance identity population deferred — appliance field is null in current phase

## Live Integration Status
- Not attempted. Deferred by contract.

## Verdict
- **Passed.** All 47 tests pass. All 8 fixtures present and schema-valid. Screenshots captured for shell default and inspector-open states. Static audit confirms no ExtraHop direct access from client code. BFF health route returns schema-validated response at /api/bff/health. Shared types, validators, and constants established as single source of truth. Inspector opens/closes without breaking layout. Time window is globally shared via React Context.

---
