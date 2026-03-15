# Deployment Bundle Audit Report — Fresh Independent Review

**Date:** 2026-03-14
**Scope:** Every file in `deploy/` — bootstrap.sh, Dockerfile, docker-compose.yml, full-schema.sql, DEPLOY.md, nginx configs, helper scripts, mysql-init
**Method:** Line-by-line read of every file, shellcheck, clean-room test (DB dropped, user dropped, dist deleted, nginx removed), runtime verification
**Clean-room tests run:** 3 (two found bugs, third passed all 16 checks)

---

## Summary

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 2 | 2 | 0 |
| MODERATE | 4 | 4 | 0 |
| LOW | 6 | 3 | 3 (cosmetic, documented) |

---

## CRITICAL Findings (Fixed)

### C1: PID file captures bash wrapper PID, not node PID

**File:** `bootstrap.sh`
**Problem:** The `su` block runs `nohup node dist/index.js &` inside a bash shell. `$!` captures the bash wrapper PID, not the node PID. Killing the PID from the file leaves the node process running as an orphan.
**Proof:** Killed PID 207581 (from file) → node PID 207582 survived, port 3020 still responding.
**Fix:** Replaced `$!` capture with `pgrep -f 'node dist/index.js' -u "$RUN_USER"` after a 1-second sleep. Chown happens after write.
**Verified:** PID file now contains actual node PID (208712). Kill via PID file stops the app. Port 3020 freed.

### C2: fs.protected_regular=2 blocks PID file write

**File:** `bootstrap.sh`
**Problem:** Ubuntu 22.04 sets `fs.protected_regular=2`, which prevents root from writing to files in `/tmp` that are owned by other users. The script was: (1) touch as root, (2) chown to ubuntu, (3) write as root → **Permission denied**.
**Fix:** Removed pre-chown. Now: (1) rm -f, (2) write as root, (3) chown to ubuntu after write.
**Verified:** Clean-room test #3 passed without permission errors.

---

## MODERATE Findings (Fixed)

### M1: DEPLOY.md falsely claims fact_device_activity is unreferenced

**File:** `DEPLOY.md` line 283
**Problem:** Claimed "not yet referenced by any BFF route or tRPC procedure." Actually referenced by `server/db.ts:getDeviceActivity()` which is called by `server/routers.ts` line 65 in the device detail tRPC procedure.
**Fix:** Updated to accurately state the table is referenced but has no ETL populating it yet.

### M2: docker-compose.yml exposes MySQL port 3306 to host

**File:** `docker-compose.yml` line 28
**Problem:** MySQL port exposed to host network. Only the app container needs MySQL access via the internal Docker network.
**Fix:** Commented out the ports section with a note to uncomment for external DB tools.

### M3: start-local.sh table count threshold too low

**File:** `start-local.sh` line 46
**Problem:** Checks `TABLE_COUNT < 30` but expected count is 38. A partially applied schema (e.g., 35 tables) would pass.
**Fix:** Changed threshold from 30 to 38.

### M4: DEPLOY.md verification count understated

**File:** `DEPLOY.md` line 35
**Problem:** Said "14+ verification checks" but bootstrap.sh runs exactly 16.
**Fix:** Updated to "16 verification checks."

---

## LOW Findings (Documented, Not Fixed)

### L1: nginx-netperf.conf is a dead file

**File:** `deploy/nginx-netperf.conf`
**Status:** Not referenced by bootstrap.sh (which generates nginx config inline). Useful for manual Option C deployment. Kept as documentation.

### L2: 02-verify.sql checks legacy table 'devices'

**File:** `deploy/docker/mysql-init/02-verify.sql` line 14
**Status:** Checks for 'devices' which is a legacy table. The check is valid (table exists in schema) but inconsistent with bootstrap.sh which checks 11 active tables. Not harmful.

### L3: 02-verify.sql only checks 6 tables vs bootstrap.sh's 11

**File:** `deploy/docker/mysql-init/02-verify.sql`
**Status:** Docker schema init via `/docker-entrypoint-initdb.d/` is more reliable than manual apply, so fewer checks are acceptable. Not harmful.

---

## Additional Fixes Applied

### OWNER_NAME consistency

- Added `OWNER_NAME="Local Tester"` to Dockerfile (line 63)
- Added `OWNER_NAME: "Local Tester"` to docker-compose.yml (line 53)
- App does not reference OWNER_NAME in code, but all three deployment paths now set it consistently

### Schema sync

- Synced legacy table comment block in `01-schema.sql` to match `full-schema.sql` (they are now byte-identical)

---

## Shellcheck Results

Shellcheck reported 0 errors, 0 warnings on bootstrap.sh after fixes. (SC2086 word-splitting warnings are suppressed by design for the `su` block where variable expansion is intentional.)

---

## Clean-Room Test Results

### Test #3 (final, after all fixes)

**Starting state:** Database dropped, user dropped, dist/ deleted, nginx config removed, PID file removed, ports 3020/3013 free.

```
ALL 16 CHECKS PASSED
  ✓ MySQL: 38 tables
  ✓ App /health (direct) → HTTP 200
  ✓ App ↔ MySQL (tRPC) → HTTP 200
  ✓ Frontend via nginx → HTTP 200
  ✓ BFF /health → HTTP 200
  ✓ BFF /impact/headline → HTTP 200
  ✓ BFF /impact/timeseries → HTTP 200
  ✓ BFF /impact/top-talkers → HTTP 200
  ✓ BFF /impact/detections → HTTP 200
  ✓ BFF /impact/alerts → HTTP 200
  ✓ BFF /impact/appliance-status → HTTP 200
  ✓ BFF /topology/fixtures → HTTP 200
  ✓ BFF /blast-radius/fixtures → HTTP 200
  ✓ BFF /correlation/fixtures → HTTP 200
  ✓ tRPC via nginx → HTTP 200
  ✓ No auth blocking (no 401/403)
```

### PID verification (post-fix)

- PID file: 208712 (actual node process, not bash wrapper 208711)
- `ps -p 208712 -o comm=` → `node` (correct)
- `kill $(cat /tmp/netperf-app.pid)` → app stopped, port 3020 freed (correct)
- PID file owned by ubuntu (correct)

---

## What Remains Untested

| Item | Reason |
|------|--------|
| Docker Compose stack | Sandbox does not support Docker networking. Structurally complete, not validated. |
| Dockerfile build | No Docker daemon available. Image structure audited, not built. |
| up.sh / down.sh | Depend on Docker Compose. Audited for correctness, not executed. |
| Bootstrap on fresh Ubuntu 22.04 ISO | Sandbox has pre-installed packages. The apt-get install paths are present but not exercised from zero. |

---

## Files Modified in This Audit

| File | Changes |
|------|---------|
| `deploy/bootstrap.sh` | PID capture fix (pgrep instead of $!), fs.protected_regular fix (chown after write) |
| `deploy/DEPLOY.md` | Verification count 14→16, fact_device_activity claim corrected |
| `deploy/start-local.sh` | Table count threshold 30→38 |
| `deploy/docker/docker-compose.yml` | MySQL port commented out, OWNER_NAME added |
| `deploy/docker/Dockerfile` | OWNER_NAME added |
| `deploy/docker/mysql-init/01-schema.sql` | Legacy comment synced with full-schema.sql |

---

## Verdict

The bootstrap.sh bare-metal installer is now verified working from a clean state with correct PID management. The Docker Compose stack is structurally audited but untested (no Docker daemon available). All documentation claims have been verified against actual code and corrected where inaccurate.

**Deferred by contract:** Docker Compose runtime validation requires a Docker host not available in this environment.
