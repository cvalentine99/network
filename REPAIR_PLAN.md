# REPAIR PLAN — Hostile-Source-Truth Repair

Generated: 2026-03-16
Based on: AUDIT_LEDGER.md verified findings

## Execution Order

All Tier 0 items must be closed before any Tier 1 or Tier 2 work begins.

---

## PHASE 1: Manus/OAuth/Telemetry Eradication (TIER 0)

### 1A: Delete debug-collector.js
- **File:** `client/public/__manus__/debug-collector.js`
- **Action:** Delete the file and the `__manus__` directory
- **Proof:** File no longer exists, no sendBeacon calls in codebase

### 1B: Remove debug-collector injection from vite.config.ts
- **File:** `vite.config.ts`
- **Action:** Remove the `manus-debug-collector` plugin (lines ~79-100) and the `/__manus__/logs` POST endpoint
- **Proof:** No HTML injection of debug-collector script, no logs endpoint

### 1C: Remove useAuth localStorage leak
- **File:** `client/src/_core/hooks/useAuth.ts`
- **Action:** Delete the `localStorage.setItem("manus-runtime-user-info", ...)` call at line 45-47
- **Proof:** No writes to `manus-runtime-user-info` key in codebase

### 1D: Assess vite-plugin-manus-runtime
- **File:** `vite.config.ts` (import at line 7)
- **Action:** This is a platform plugin that provides dev tooling. The runtime itself is a dev-only injection (transformIndexHtml). The user-info exfiltration is neutralized by removing the localStorage write in 1C. The plugin is NOT included in production builds.
- **Decision:** Remove the localStorage write (1C). Document that the runtime plugin is dev-only platform tooling.
- **Proof:** No user data flows to the runtime after 1C is applied.

---

## PHASE 2: ExtraHop TLS/Connectivity Repair (TIER 0)

### 2A: Fix testConnection @ts-ignore with proper undici Agent
- **File:** `server/routers.ts:343-410`
- **Action:** Import the same `getUndiciAgent()` from `extrahop-client.ts` and pass it as `dispatcher` to the fetch call. Remove the `@ts-ignore`. Respect the `verifySsl` config field.
- **Proof:** testConnection works against self-signed certs when verifySsl=false, rejects when verifySsl=true and cert is invalid.

### 2B: Verify extrahop-client.ts TLS handling is correct
- **File:** `server/extrahop-client.ts`
- **Action:** Audit the existing undici Agent usage. Confirm it uses per-request dispatcher, not global `NODE_TLS_REJECT_UNAUTHORIZED`.
- **Proof:** No `process.env.NODE_TLS_REJECT_UNAUTHORIZED` in codebase. Agent is scoped to ExtraHop requests only.

---

## PHASE 3: Auth/Secrets/SSRF/Authorization Hardening (TIER 0)

### 3A: Remove NODE_ENV auth bypass in bff-auth-middleware.ts
- **File:** `server/bff-auth-middleware.ts`
- **Action:** Remove the `isProduction` check. Always enforce auth. For test mode, tests must provide a valid auth token or use a test-specific bypass header with a secret.
- **Proof:** Unauthenticated requests get 401 in ALL environments.

### 3B: Verify no SSRF vectors in BFF routes
- **Files:** All `server/routes/*.ts`
- **Action:** Confirm that user input never directly controls fetch URLs. The hostname comes from encrypted DB config, not from request params.
- **Proof:** Grep shows no `req.query`/`req.params`/`req.body` flowing into fetch URLs.

---

## PHASE 4: Dead Code Removal (TIER 1)

### 4A: Delete DashboardLayoutSkeleton.tsx
- **File:** `client/src/components/DashboardLayoutSkeleton.tsx`
- **Action:** Delete. Zero imports.

### 4B: Delete notification.ts
- **File:** `server/_core/notification.ts`
- **Action:** Delete. Zero project imports.

---

## PHASE 5: Frontend Performance (TIER 2)

### 5A: Add AbortController to 13 BFF hooks
- **Files:** All hooks in `client/src/hooks/` except `useDetections.ts`
- **Action:** Add AbortController pattern matching `useDetections.ts`. Abort on cleanup, abort on re-fetch.
- **Proof:** All hooks have abort cleanup. No stale state updates after unmount.

---

## Blockers and Dependencies

| Phase | Depends On | Blocker |
|-------|-----------|---------|
| 1B | None | None |
| 1C | None | None |
| 2A | None | Need to verify undici Agent export from extrahop-client.ts |
| 3A | None | Tests that call BFF routes will need auth tokens or test bypass |
| 5A | None | 13 hooks to update — mechanical but tedious |
