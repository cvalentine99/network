# SLICE 28 — RUNTIME DECONTAMINATION

## TRUTH RECEIPT

**Slice:** 28 — Runtime Decontamination  
**Status:** PASSED  

---

## IN SCOPE

1. topology.ts — add isFixtureMode() gate; live mode returns 503 LIVE_NOT_IMPLEMENTED
2. correlation.ts — add isFixtureMode() gate; live mode returns 503 LIVE_NOT_IMPLEMENTED
3. impact.ts — replace all fake zero/empty live-mode payloads with 503 LIVE_NOT_IMPLEMENTED (headline, timeseries, top-talkers, detections, alerts, device-detail, detection-detail, alert-detail)
4. impact.ts appliance-status — remove mixed fixture metadata; live mode returns DB-only fields
5. blast-radius.ts — sentinel routing gated behind isDev; fixture listing gated behind isDev
6. trace.ts — sentinel routing gated behind isDev; fixture listing gated behind isDev
7. health.ts — live mode returns 'ok' (not hardcoded 'degraded'); cache reports 0/0 (not fake 0/500)
8. Visible Fixture Mode / Live Mode indicator on every surface (DataSourceBadge)
9. Help page integration labeling made dynamic via useDataSourceMode hook
10. EH_HOST/EH_API_KEY references removed from all client-side code
11. Unknown IDs in device-detail, detection-detail, alert-detail now return quiet fixture (not populated)
12. cache.maxSize validator changed from positive() to nonnegative() to allow honest zero

## OUT OF SCOPE

- Live ExtraHop API integration (deferred by contract)
- Actual appliance reachability testing in health route
- BFF caching implementation

## EXACT FILES CHANGED

| File | Change |
|------|--------|
| `server/routes/topology.ts` | Full rewrite: isFixtureMode gate, live 503, sentinel gated behind isDev, fixture listing gated behind isDev |
| `server/routes/correlation.ts` | Full rewrite: isFixtureMode gate, live 503, sentinel gated behind isDev, fixture listing gated behind isDev |
| `server/routes/impact.ts` | Full rewrite: all 8 sub-routes gated, fake payloads replaced with 503, appliance-status decontaminated, detail routes return quiet for unknown IDs |
| `server/routes/blast-radius.ts` | Full rewrite: sentinel gated behind isDev, fixture listing gated behind isDev |
| `server/routes/trace.ts` | Full rewrite: sentinel gated behind isDev, fixture listing gated behind isDev |
| `server/routes/health.ts` | Rewrite: live mode returns 'ok' not 'degraded', cache 0/0 not 0/500 |
| `shared/cockpit-validators.ts` | cache.maxSize: positive() → nonnegative() |
| `client/src/hooks/useDataSourceMode.ts` | New file: queries BFF health, exposes fixture/live/loading/error mode |
| `client/src/components/DataSourceBadge.tsx` | New file: visible mode indicator component |
| `client/src/components/DashboardLayout.tsx` | Added DataSourceBadge to sidebar footer + mobile header |
| `client/src/pages/Help.tsx` | Made IntegrationModeSection dynamic; removed EH_HOST/EH_API_KEY from client code |
| `server/decontamination.test.ts` | New file: 38 decontamination tests |

## EXACT RUNTIME BEHAVIORS REMOVED

| Route | Old behavior (live mode) | New behavior (live mode) |
|-------|-------------------------|-------------------------|
| topology /query | Unconditionally loaded fixtures | 503 LIVE_NOT_IMPLEMENTED |
| correlation /events | Unconditionally loaded fixtures | 503 LIVE_NOT_IMPLEMENTED |
| impact /headline | Returned fake zeros | 503 LIVE_NOT_IMPLEMENTED |
| impact /timeseries | Returned fake empty array | 503 LIVE_NOT_IMPLEMENTED |
| impact /top-talkers | Returned fake empty array | 503 LIVE_NOT_IMPLEMENTED |
| impact /detections | Returned fake empty array | 503 LIVE_NOT_IMPLEMENTED |
| impact /alerts | Returned fake empty array | 503 LIVE_NOT_IMPLEMENTED |
| impact /device-detail | Returned fake 404 | 503 LIVE_NOT_IMPLEMENTED |
| impact /detection-detail | Returned fake 404 | 503 LIVE_NOT_IMPLEMENTED |
| impact /alert-detail | Returned fake 404 | 503 LIVE_NOT_IMPLEMENTED |
| impact /appliance-status | Mixed real DB hostname with fixture metadata | Returns DB-only fields; unknown = null/'unknown' |
| health / | Hardcoded 'degraded' | Returns 'ok' (BFF running + creds configured) |
| health / | Fake cache maxSize: 500 | Honest cache 0/0 |

## SENTINEL ROUTING STATUS

All sentinel routing (SENTINEL_MAP, sentinel fromMs values, sentinel IDs 1042/4001/101, sentinel device names, sentinel hostnames) is now gated behind `isDev` (`NODE_ENV !== 'production'`). In production builds, sentinel values are treated as normal input.

## FIXTURE LISTING ENDPOINT STATUS

All fixture listing endpoints (`GET /api/bff/*/fixtures`) are gated behind `isDev`. In production, they return 403 "Not available in production".

## UI LABELING CHANGES

- DataSourceBadge shows on every surface (sidebar footer + mobile header)
- Fixture mode: orange badge "Fixture Mode — Demo Data"
- Live mode: green badge "Live — ExtraHop Connected" or yellow "Live — Degraded"
- Error: red badge "Health check failed"
- Help page IntegrationModeSection now queries BFF health dynamically instead of hardcoding "Fixture Mode"

## TESTS

- `server/decontamination.test.ts`: 38 tests — ALL PASSING
  - Health: status, no hardcoded degraded, honest cache, real uptime, valid timestamp
  - Topology: fixture data, invalid body rejection, fixture listing
  - Correlation: fixture data, invalid body rejection
  - Impact: headline, timeseries, top-talkers, detections, alerts, appliance-status
  - Blast radius: fixture data, invalid body rejection
  - Trace: SSE events, invalid body rejection
  - Packets: fixture PCAP or valid error
  - Cross-cutting: isFixtureMode consistency across all routes
  - Code structure: 16 source code assertions (isFixtureMode gates, LIVE_NOT_IMPLEMENTED, isDev gates, fixture listing gates)

## FULL TEST SUITE

- 32 test files, 2,146 tests — ALL PASSING
- Zero regressions from decontamination

## KNOWN LIMITATIONS

- Live ExtraHop API integration is not wired. All routes return 503 LIVE_NOT_IMPLEMENTED in live mode.
- Health route returns 'ok' when credentials are configured, but does NOT verify appliance reachability.
- No BFF cache is implemented. Cache reports 0/0.
- Sentinel routing still exists in dev mode for testing convenience. It is gated behind isDev.

## LIVE INTEGRATION STATUS

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase.

## MERGE BLOCKERS

None. All tests pass. All routes are honest in both fixture and live mode.

## VERDICT

**PASSED.** Every user-visible route now either serves fixture data (when EH credentials are absent) or returns an explicit 503 LIVE_NOT_IMPLEMENTED error (when EH credentials are present). No route silently returns fake populated data in live mode. No route mixes real DB identity with fixture metadata. No sentinel routing or fixture listing endpoint is accessible in production. A visible mode indicator appears on every surface.
