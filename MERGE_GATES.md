# MERGE GATES — Non-Negotiable Release Criteria

Generated: 2026-03-16
Last verified: 2026-03-16 (commit pending)

## Gate 0: No Telemetry Exfiltration

- [x] No `sendBeacon` calls in any project-owned file
- [x] No `debug-collector.js` in `client/public/`
- [x] No `localStorage.setItem("manus-runtime-user-info", ...)` anywhere in codebase
- [x] No `/__manus__/logs` endpoint in vite.config.ts
- [x] Grep proof: `grep -rn "sendBeacon|manus-runtime-user-info|debug-collector|__manus__/logs" . --include="*.ts" --include="*.tsx" --include="*.js" | grep -v node_modules | grep -v dist | grep -v ".manus-logs"` returns only comments documenting the removal (vite.config.ts lines 11, 13, 15)

**VERDICT: PASS**

## Gate 1: No Auth Bypass by Environment

- [x] `bff-auth-middleware.ts` enforces 401 in ALL environments, not just production
- [x] No `if (isProduction)` / `if (isDev)` guards around auth enforcement
- [x] Grep proof: `grep -n "isProduction|isDev" server/bff-auth-middleware.ts` returns zero matches
- [x] Fixture-mode bypass is DB-config-based (no appliance configured), not NODE_ENV-based

**VERDICT: PASS**

## Gate 2: ExtraHop TLS Handling is Correct

- [x] No `@ts-ignore` on any fetch call — `grep -rn "@ts-ignore" . --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v dist | grep -v "no @ts-ignore"` returns zero matches
- [x] No `process.env.NODE_TLS_REJECT_UNAUTHORIZED` assignment anywhere in codebase
- [x] `testConnection` route uses undici Agent with `connect: { rejectUnauthorized: !verifySsl }` — same pattern as `extrahop-client.ts`
- [x] TLS bypass is scoped to ExtraHop requests only via per-request undici dispatcher, not global

**VERDICT: PASS**

## Gate 3: No Hardcoded Secrets

- [x] No plaintext API keys in source code (only `config.apiKey` from encrypted DB)
- [x] No hardcoded passwords, tokens, or credentials
- [x] `crypto.ts` salt is documented as acceptable for lab use with strong JWT_SECRET

**VERDICT: PASS**

## Gate 4: No Dead Code in Production Path

- [x] Dead `_core` modules deleted: llm.ts, voiceTranscription.ts, imageGeneration.ts, map.ts, dataApi.ts
- [x] Dead components deleted: AIChatBox.tsx, ManusDialog.tsx, Map.tsx
- [x] `DashboardLayoutSkeleton.tsx` deleted (zero imports)
- [x] `notification.ts` retained — imported by `systemRouter.ts` (framework plumbing, provides health check + notifyOwner)

**VERDICT: PASS**

## Gate 5: All BFF Hooks Have AbortController

- [x] Every hook in `client/src/hooks/` that calls `fetch()` has AbortController
- [x] Every hook cleans up (aborts) on unmount or re-fetch
- [x] 12 hooks with useEffect-based fetch have full AbortController lifecycle
- [x] 1 hook (usePcapDownload) is user-triggered (click-to-download), not auto-fetching — AbortController not applicable

**VERDICT: PASS**

## Gate 6: TypeScript Clean

- [x] `npx tsc --noEmit` returns exit code 0 with zero errors
- [x] No `@ts-ignore` comments in project-owned files

**VERDICT: PASS**

## Gate 7: Test Suite Green

- [x] `pnpm test` passes all tests: **41 test files, 2,725 tests, 0 failures**
- [x] No test uses NODE_ENV bypass to skip auth
- [x] Tests that call BFF routes use fixture-mode header (DB-config-based, not NODE_ENV-based)

**VERDICT: PASS**

## Gate 8: Database Schema Matches Code

- [x] `pnpm drizzle-kit generate` returns "No schema changes, nothing to migrate"
- [x] Migration SQL creates all 35 tables defined in `drizzle/schema.ts`
- [x] No stale migration files creating phantom tables
- [x] `relations.ts` defines 20 Drizzle relation definitions for bridge/fact/snap tables
- [x] `deploy/full-schema.sql` regenerated from authoritative migrations + 16 views
- [x] CI drift check script (`ci/check-schema-drift.sh`) passes with 5 vitest tests

**VERDICT: PASS**

## Gate 9: CI Schema-Drift Prevention (NEW)

- [x] `ci/check-schema-drift.sh` script exists and is executable
- [x] Script runs `drizzle-kit generate` and fails (exit 1) if new migration file produced
- [x] 5 vitest tests verify: sync check, migration count, snapshot count, script exists, script passes
- [x] Script returns "PASS: Schema is in sync. No drift detected." when run

**VERDICT: PASS**

---

## Summary

| Gate | Description | Status |
|------|-------------|--------|
| 0 | No Telemetry Exfiltration | PASS |
| 1 | No Auth Bypass by Environment | PASS |
| 2 | ExtraHop TLS Handling | PASS |
| 3 | No Hardcoded Secrets | PASS |
| 4 | No Dead Code | PASS |
| 5 | BFF Hooks AbortController | PASS |
| 6 | TypeScript Clean | PASS |
| 7 | Test Suite Green (2,725 tests) | PASS |
| 8 | Schema Matches Code | PASS |
| 9 | CI Schema-Drift Prevention | PASS |

**ALL GATES PASS. No blockers.**

## Enforcement

Any single gate failure is an automatic NO-SHIP.
Gates are verified with grep/test output, not prose claims.
Each gate produces a pass/fail line with exact evidence commands.
