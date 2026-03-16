# MERGE GATES — Non-Negotiable Release Criteria

Generated: 2026-03-16

## Gate 0: No Telemetry Exfiltration

- [ ] No `sendBeacon` calls in any project-owned file
- [ ] No `debug-collector.js` in `client/public/`
- [ ] No `localStorage.setItem("manus-runtime-user-info", ...)` anywhere in codebase
- [ ] No `/__manus__/logs` endpoint in vite.config.ts
- [ ] Grep proof: `grep -rn "sendBeacon\|manus-runtime-user-info\|debug-collector\|__manus__/logs" . | grep -v node_modules | grep -v dist` returns zero results

## Gate 1: No Auth Bypass by Environment

- [ ] `bff-auth-middleware.ts` enforces 401 in ALL environments, not just production
- [ ] No `if (isProduction)` / `if (isDev)` guards around auth enforcement
- [ ] Test proof: unauthenticated fetch to any `/api/bff/*` route returns 401

## Gate 2: ExtraHop TLS Handling is Correct

- [ ] No `@ts-ignore` on any fetch call
- [ ] No `process.env.NODE_TLS_REJECT_UNAUTHORIZED` anywhere in codebase
- [ ] `testConnection` route uses undici Agent with `connect: { rejectUnauthorized: !verifySsl }` — same pattern as `extrahop-client.ts`
- [ ] TLS bypass is scoped to ExtraHop requests only, not global

## Gate 3: No Hardcoded Secrets

- [ ] No plaintext API keys in source code (only `config.apiKey` from encrypted DB)
- [ ] No hardcoded passwords, tokens, or credentials
- [ ] `crypto.ts` salt is documented as acceptable for lab use

## Gate 4: No Dead Code in Production Path

- [ ] No dead `_core` modules (llm, voiceTranscription, imageGeneration, map, dataApi — already deleted)
- [ ] No dead components (AIChatBox, ManusDialog, Map — already deleted)
- [ ] `DashboardLayoutSkeleton.tsx` deleted
- [ ] `notification.ts` deleted (or documented as platform requirement)

## Gate 5: All BFF Hooks Have AbortController

- [ ] Every hook in `client/src/hooks/` that calls `fetch()` has AbortController
- [ ] Every hook cleans up (aborts) on unmount or re-fetch
- [ ] Grep proof: `for f in client/src/hooks/*.ts; do has_fetch=$(grep -c "fetch(" "$f"); has_abort=$(grep -c "AbortController" "$f"); if [ "$has_fetch" -gt 0 ] && [ "$has_abort" -eq 0 ]; then echo "FAIL: $f"; fi; done` returns zero results

## Gate 6: TypeScript Clean

- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] No `@ts-ignore` comments in project-owned files

## Gate 7: Test Suite Green

- [ ] `npx vitest run` passes all tests
- [ ] No test uses NODE_ENV bypass to skip auth
- [ ] Tests that call BFF routes provide proper auth context

## Gate 8: Database Schema Matches Code

- [ ] Migration SQL creates all tables defined in `drizzle/schema.ts`
- [ ] No stale migration files creating phantom tables
- [ ] `relations.ts` defines relations for all bridge/fact/snap tables

---

## Enforcement

Any single gate failure is an automatic NO-SHIP.
Gates must be verified with grep/test output, not prose claims.
Each gate produces a pass/fail line in the final evidence report.
