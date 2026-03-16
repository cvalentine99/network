# AUDIT LEDGER — Hostile-Source-Truth Repair

Generated: 2026-03-16
Audited against: commit dfbd40c6 (current dev sandbox)

## Status Key

| Status | Meaning |
|--------|---------|
| VERIFIED | Confirmed defect in current codebase with file evidence |
| REJECTED | Claim is false — contradicted by file evidence |
| FIXED | Defect existed, repair applied and proven |

---

## TIER 0 — CRITICAL / SECURITY

### T0-1: Manus Debug Collector (sendBeacon telemetry)
**Status:** VERIFIED
**File:** `client/public/__manus__/debug-collector.js` (821 lines)
**Evidence:** Lines 782-798: `navigator.sendBeacon(CONFIG.reportEndpoint, payloadStr)` — sends console logs, network requests, click/focus/scroll events, and session replay data to `/__manus__/logs` every 2 seconds.
**Behavior:** Intercepts `console.*`, `fetch()`, `XMLHttpRequest`, `click`, `focusin`, `focusout`, `scroll`, `submit`, `change`, `keydown` events. Masks password fields but captures all other input values up to 200 chars.
**Impact:** Full browser telemetry exfiltration in dev mode. Captures ExtraHop API responses, user interactions, and error details.
**Severity:** CRITICAL

### T0-2: Manus Runtime Plugin (user info exfiltration)
**Status:** VERIFIED
**File:** `node_modules/vite-plugin-manus-runtime/runtime_dist/manus-runtime.js` (366KB)
**Injection:** `vite.config.ts:7` imports `vitePluginManusRuntime`, which injects a `<script>` tag into every page via `transformIndexHtml`.
**Evidence:** Runtime reads `localStorage.getItem("manus-runtime-user-info")` and includes it in error payloads sent to its container. The `useAuth.ts:46` hook writes user data to that exact key: `localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data))`.
**Impact:** User identity data (name, email, role, openId) written to localStorage by useAuth, then read and transmitted by the Manus runtime.
**Severity:** CRITICAL

### T0-3: Vite Debug Collector Injection
**Status:** VERIFIED
**File:** `vite.config.ts:79-100`
**Evidence:** Plugin `manus-debug-collector` injects `<script src="/__manus__/debug-collector.js" defer>` into every HTML page when `NODE_ENV !== 'production'`. Also mounts `/__manus__/logs` POST endpoint that writes browser telemetry to `.manus-logs/` directory.
**Guard:** Only injects in non-production mode (line 81: `if (process.env.NODE_ENV === "production") return html`).
**Impact:** Any non-production deployment gets full telemetry injection.
**Severity:** CRITICAL

### T0-4: useAuth localStorage Leak
**Status:** VERIFIED
**File:** `client/src/_core/hooks/useAuth.ts:45-47`
**Evidence:** `localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data))` — writes full user object to localStorage on every auth state change, inside a `useMemo` (side effect in render path).
**Impact:** User data persisted in plaintext localStorage, readable by any script on the domain, consumed by T0-2.
**Severity:** CRITICAL

### T0-5: BFF Auth Middleware NODE_ENV Bypass
**Status:** VERIFIED
**File:** `server/bff-auth-middleware.ts:39-56`
**Evidence:** `const isProduction = process.env.NODE_ENV === 'production'` — in non-production mode, unauthenticated requests pass through with `next()` (line 56). Only production enforces 401.
**Impact:** Any deployment where NODE_ENV is not exactly "production" has zero BFF auth. Attacker can access all ExtraHop data routes without authentication.
**Severity:** CRITICAL

### T0-6: testConnection @ts-ignore with Non-Functional TLS Bypass
**Status:** VERIFIED
**File:** `server/routers.ts:374`
**Evidence:** `// @ts-ignore - Node fetch supports rejectUnauthorized via agent` — but the fetch call at line 367-378 does NOT pass an agent or dispatcher. The `@ts-ignore` suppresses the type error but the TLS bypass does nothing. Self-signed cert connections will fail.
**Impact:** testConnection route cannot connect to self-signed ExtraHop appliances. The `verifySsl` config is read but never applied in this route.
**Severity:** HIGH

### T0-7: Static PBKDF2 Salt in Crypto Module
**Status:** VERIFIED
**File:** `server/crypto.ts:24`
**Evidence:** `const SALT = 'netperf-apikey-encryption-salt-v1'` — hardcoded static salt. Comment says "key uniqueness comes from JWT_SECRET" which is partially true but weakens the key derivation.
**Impact:** If JWT_SECRET is weak or reused, the static salt provides no additional entropy. Acceptable for lab use with strong JWT_SECRET, but not production-grade.
**Severity:** MEDIUM

---

## TIER 1 — ARCHITECTURE / DATA PATH

### T1-1: BFF Sentinel/Fixture Routes Gated by isDev
**Status:** VERIFIED
**Files:** `server/routes/impact.ts:46`, `server/routes/trace.ts:42`, `server/routes/blast-radius.ts:30`, `server/routes/correlation.ts:26`, `server/routes/topology.ts:28`
**Evidence:** All BFF routes use `const isDev = process.env.NODE_ENV !== 'production'` to gate sentinel ID routing and fixture listing endpoints.
**Impact:** In non-production deployments, fixture data routes are accessible. This is by design for the fixture-first development model but must be documented.
**Severity:** LOW (by design, but needs documentation)

### T1-2: DashboardLayoutSkeleton Dead Component
**Status:** VERIFIED
**File:** `client/src/components/DashboardLayoutSkeleton.tsx`
**Evidence:** Zero imports from any page or component. Only self-reference at line 3.
**Impact:** Dead code. Minor.
**Severity:** LOW

### T1-3: notification.ts / systemRouter.ts Unused
**Status:** VERIFIED
**Files:** `server/_core/notification.ts`, `server/_core/systemRouter.ts`
**Evidence:** notification.ts has 0 direct imports from project code. systemRouter.ts has 1 import (from index.ts framework plumbing).
**Impact:** Platform template leftovers. notification.ts is truly dead. systemRouter.ts is framework wiring (keep).
**Severity:** LOW

---

## TIER 2 — FRONTEND PERFORMANCE

### T2-1: 13 BFF Hooks Missing AbortController
**Status:** VERIFIED
**Files:** All hooks in `client/src/hooks/` except `useDetections.ts`
**Evidence:** Only `useDetections.ts` has AbortController. The other 13 hooks that call `fetch()` have no abort signal, no cleanup on unmount.
**Missing in:** useAlertDetail, useAlerts, useApplianceStatus, useCorrelationOverlay, useDataSourceMode, useDetectionDetail, useDeviceActivity, useDeviceDetail, useImpactHeadline, useImpactTimeseries, usePcapDownload, useTopTalkers, useTopology
**Impact:** Memory leaks, stale state updates on unmounted components, race conditions on rapid navigation.
**Severity:** HIGH

### T2-2: ForceGraph.tsx Complexity
**Status:** VERIFIED
**File:** `client/src/components/ForceGraph.tsx` (1,969 lines)
**Impact:** Maintainability concern. Contains drag handlers, edge bundling, context menu, minimap, tooltip, simulation, and rendering all in one file.
**Severity:** MEDIUM (functional but hard to maintain)

---

## REJECTED CLAIMS (from external review)

### R1: "No ApplianceSettings.tsx exists"
**Status:** REJECTED
**Evidence:** `client/src/pages/ApplianceSettings.tsx` EXISTS (654 lines), routed at `/settings` in `App.tsx:22`.

### R2: "No testConnection endpoint exists"
**Status:** REJECTED
**Evidence:** `server/routers.ts:343` — `testConnection: protectedProcedure.mutation(...)` EXISTS.

### R3: "No etl-scheduler.ts exists"
**Status:** REJECTED
**Evidence:** `server/etl-scheduler.ts` EXISTS (237 lines), imported and started by `server/_core/index.ts`.

### R4: "ImpactDeck page is orphaned"
**Status:** REJECTED
**Evidence:** Home.tsx IS the Impact Deck, routed at `/` in `App.tsx:20`.

### R5: "Hooks don't call BFF"
**Status:** REJECTED
**Evidence:** All 14 hooks in `client/src/hooks/` call `/api/bff/*` endpoints.

### R6: "No fixtures exist"
**Status:** REJECTED
**Evidence:** 160 fixture files across `fixtures/` directory, used by 40 test files with 2,720 test cases.

### R7: "No encryption at rest"
**Status:** REJECTED
**Evidence:** `server/crypto.ts` implements AES-256-GCM encryption for API keys. `server/db.ts` uses `encryptApiKey()`/`decryptApiKey()` for all appliance config operations.

### R8: "relations.ts is empty"
**Status:** REJECTED (was true, already fixed)
**Evidence:** `drizzle/relations.ts` now has 154 lines with 20 Drizzle relation definitions.
