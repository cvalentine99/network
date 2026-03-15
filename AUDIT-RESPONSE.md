# 49-LIE AUDIT — POINT-BY-POINT RESPONSE

**Date:** 2026-03-15
**Checkpoint:** 4a484887 (pre-fix) → pending (post-fix)
**Test suite:** 2,477 tests across 37 files — all passing

---

## Issue 1: saved_topology_views missing from deployment SQL

**Status: FIXED.**

- `deploy/full-schema.sql` line 602: `CREATE TABLE IF NOT EXISTS saved_topology_views` — added
- `deploy/docker/mysql-init/01-schema.sql` line 602: same — added
- Both files now contain 39 CREATE TABLE statements (verified: `grep -c 'CREATE TABLE' deploy/full-schema.sql` → 39)
- `deploy/bootstrap.sh` line 118: `EXPECTED_TABLES=39` — updated from 38
- `deploy/DEPLOY.md` line 44, 187, 507: all references updated to "39 tables (35 active + 4 legacy)"

**Proof:**
```
grep -c 'CREATE TABLE' deploy/full-schema.sql → 39
grep -c 'CREATE TABLE' deploy/docker/mysql-init/01-schema.sql → 39
grep 'EXPECTED_TABLES' deploy/bootstrap.sh → EXPECTED_TABLES=39
```

---

## Issue 2: Live ExtraHop integration is not proven

**Status: CORRECTED LANGUAGE. No code fix possible without live appliance.**

The following files have been updated to remove "live integration" claims:

- `deploy/DEPLOY.md` line 3: now reads "Live ExtraHop integration has not been validated against a real appliance."
- `deploy/bootstrap.sh` line 18: now reads "Runs verification checks (fixture-mode only — does NOT prove live ExtraHop connectivity)"
- `deploy/bootstrap.sh` line 20: now reads "A green bootstrap proves fixture mode works, NOT live integration."
- `SLICE-28-RECEIPT.md` verdict: changed from "PASSED" to "PASSED with caveats" — explicitly lists that live integration has NOT been tested against a real appliance

**Corrected status language:** Fixture/demo experience is substantially built. Live integration is architecturally wired (BFF routes call ExtraHop client, which resolves credentials from DB or env vars) but has NOT been validated against a real appliance. This is deferred by contract.

---

## Issue 3: Bootstrap success does not prove production readiness

**Status: CORRECTED LANGUAGE.**

- `deploy/bootstrap.sh` header: changed "Verifies the entire stack end-to-end" to "Runs verification checks (fixture-mode only — does NOT prove live ExtraHop connectivity)"
- `deploy/bootstrap.sh` footer: changed "No silent failures" to "A green bootstrap proves fixture mode works, NOT live integration"
- Bootstrap success message already distinguishes between fixture mode (`RUNNING IN FIXTURE MODE`), degraded mode, and ok mode — this was correct before the audit

**Corrected status language:** A green bootstrap proves the deployment is structurally sound and fixture endpoints respond. It does NOT prove live ExtraHop data flows.

---

## Issue 4: Source-string assertions are confidence theater

**Status: CORRECTED LABELING.**

- `server/decontamination.test.ts`: added file-level comment block explaining the two test categories:
  - **Behavioral tests (22 of 38):** real HTTP calls to the running dev server, verify response shapes and status codes
  - **Source-string assertions (16 of 38):** read `.ts` source files and check substring presence — these verify code patterns exist but do NOT prove runtime correctness
- `SLICE-28-RECEIPT.md` test section: each test category now labeled as BEHAVIORAL or SOURCE-STRING
- `SLICE-28-RECEIPT.md` merge blockers: changed from "None. All tests pass." to explicit caveat about source-string assertions

**Corrected status language:** 16 of 38 decontamination tests are source-string assertions. They verify code patterns exist in source files. They do not prove runtime behavior. The remaining 22 are behavioral tests against the running server in fixture mode.

---

## Issue 5: Topology baseline uses fixture data

**Status: FIXED (code) + CORRECTED LANGUAGE.**

- `server/routes/topology.ts` baseline route: in live mode, now returns an explicit error:
  ```json
  {
    "error": "BASELINE_NOT_AVAILABLE",
    "message": "Historical baseline collection is not yet implemented. Anomaly detection requires baseline data from periodic ETL snapshots.",
    "mode": "live"
  }
  ```
  Previously it silently served fixture baseline data in live mode.

**Corrected status language:** Topology anomaly detection baseline is fixture-only. In live mode, the baseline route returns an explicit error explaining that historical collection is not implemented. Anomaly comparison against real traffic is not available until ETL baseline collection is built.

---

## Issue 6: EH_VERIFY_SSL downgrades to HTTP

**Status: FIXED.**

- `server/extrahop-client.ts` line 252: changed from `const protocol = config.verifySsl ? 'https' : 'http'` to `const url = \`https://${config.hostname}${path}\``
- `server/extrahop-client.ts` line 363: same fix for binary (PCAP) requests
- Both fetch paths now always use HTTPS
- When `verifySsl=false`, the code sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` temporarily during the request, then restores it — this skips certificate verification while keeping the encrypted transport
- `deploy/DEPLOY.md` line 360: updated to "Setting to `false` keeps HTTPS but skips TLS certificate verification (accepts self-signed certs)"
- `deploy/bootstrap.sh`: updated EH_VERIFY_SSL comments to match

**Proof:**
```
grep 'protocol' server/extrahop-client.ts → no results (removed)
grep 'https://' server/extrahop-client.ts → line 252, line 363
grep 'NODE_TLS_REJECT_UNAUTHORIZED' server/extrahop-client.ts → lines 275, 287, 381, 393
```

---

## Issue 7: Security posture is not production-ready

**Status: ACKNOWLEDGED. Not fixable in current contract phase.**

The following security gaps exist and are now documented:

1. **No authentication** — all routes are publicly accessible. `deploy/DEPLOY.md` line 3 now states this explicitly.
2. **Test-grade secrets** — JWT_SECRET and other secrets use default values. Bootstrap does not enforce secret rotation.
3. **No rate limiting** — BFF routes have no request throttling.
4. **NODE_TLS_REJECT_UNAUTHORIZED** — the process-level env var approach is a race condition risk under concurrent requests. A proper fix would use per-request `https.Agent({ rejectUnauthorized: false })` but Node.js native `fetch` does not support custom agents without additional libraries.

**Corrected status language:** Security posture is not production-ready. No authentication, test-grade secrets, no rate limiting. The app is designed for a trusted lab network, not public internet exposure.

---

## Additional fixes applied

### Receipt language corrections (all SLICE-*-RECEIPT.md files)

- Slices 17–22b: all instances of `— **proven** by` changed to `— **proven against fixtures** by`
- Slice 22: "formally proven" changed to "proven against fixtures"
- Slice 22b: "contract-proven" changed to "contract-proven against fixtures"
- Slice 28: verdict changed to "PASSED with caveats" with explicit caveat list

### readFileSync in request handlers (documented, not fixed)

`readFileSync` is used inside async request handlers in 6 route files (impact.ts, packets.ts, trace.ts, blast-radius.ts, correlation.ts, topology.ts). This blocks the Node.js event loop during fixture loading. In fixture mode with small files this is negligible. In production under load it would be a problem. This should be converted to `readFile` (async) in a future cleanup pass.

---

## Corrected overall status

> Fixture/demo experience: substantially built, contract-proven against deterministic fixtures, 2,477 tests passing.
>
> Live ExtraHop integration: architecturally wired but NOT validated against a real appliance. Deferred by contract.
>
> Deployment: fresh deploy defect (missing saved_topology_views table) is now FIXED.
>
> Security: not production-ready. No auth, test-grade secrets, no rate limiting. Designed for trusted lab network.
>
> Bootstrap: proves fixture mode works. Does NOT prove live integration.
>
> Source-string tests: 16 of 38 decontamination tests are pattern checks, not behavioral proof.
>
> Topology baseline: fixture-only. Live mode returns explicit error.
>
> EH_VERIFY_SSL: FIXED. Always HTTPS, cert verification only.
