# SLICE 27 — Deployment Audit Fix Receipt

## TRUTH RECEIPT

**Slice:** 27 — Deployment Audit Fixes
**Commit:** (pending checkpoint)
**Status:** Passed

### Claims

1. Dockerfile healthcheck now works (curl installed in production stage)
2. Dockerfile runs app as non-root user `netperf` (UID 1001)
3. bootstrap.sh detects invoking user via SUDO_USER and runs build + app as that user
4. bootstrap.sh no longer runs Node.js as root
5. Dead variables (DB_ROOT_PASS, NGINX_CONF) removed from bootstrap.sh
6. PID file moved from /var/run (root-only) to /tmp (user-writable)
7. 4 legacy tables documented in full-schema.sql with clear LEGACY TABLES block
8. DEPLOY.md updated with Docker Compose section (Option B) and honest untested disclaimer
9. Duplicate .dockerignore removed (deploy/docker/.dockerignore)
10. fact_device_activity documented in DEPLOY.md Schema Notes
11. Critical table verification list expanded from 6 to 11 tables
12. Prerequisites check (Phase 0) added to bootstrap.sh
13. Verification checks expanded from 14 to 16
14. Clean-room re-test passed: ALL 16 CHECKS PASSED
15. Full test suite: 2,108 tests passing, no regressions

### Evidence

- **Tests passed:** 2,108 across 31 test files (no change from Slice 26)
- **Bootstrap clean-room test:** DB dropped, user dropped, re-run from scratch — 16/16 checks passed
- **App process ownership:** Verified via `ps aux` — node process runs as `ubuntu`, not `root`
- **dist/ ownership:** Verified via `stat` — `ubuntu:ubuntu`, not `root:root`
- **Fixtures present:** 146 (no change)
- **Screenshots present:** 92 (no change — this slice is deployment-only, no new UI)

### Not Proven

- Docker Compose stack is structurally complete but **not tested** in a real Docker environment. The sandbox does not support Docker networking (iptables kernel limitation). This is explicitly documented in DEPLOY.md.
- The Dockerfile non-root user has not been tested in a real Docker build. The `USER netperf` directive and `curl` installation are structurally correct but unverified at runtime.

### Deferred by Contract

Deferred by contract: live hardware / appliance / packet store / environment access is not part of the current frontend phase. Docker Compose testing is deferred due to sandbox limitations (no Docker networking support).

### Live Integration Status

Not attempted. This slice is deployment infrastructure only.

### Verdict

**Passed.** All 10 audit issues identified by the user have been fixed. The bare-metal bootstrap path has been clean-room tested and passes 16/16 verification checks. The Docker Compose path is documented as untested. No test regressions.

---

## Issue Resolution Matrix

| # | Severity | Issue | Fix | Verified |
|---|----------|-------|-----|----------|
| 1 | CRITICAL | Dockerfile healthcheck uses curl but node:22-slim doesn't include it | Added `apt-get install curl` to production stage | Structurally verified (no Docker runtime test) |
| 2 | CRITICAL | Dockerfile runs app as root | Added non-root user `netperf` (UID 1001), `USER netperf` | Structurally verified |
| 3 | CRITICAL | bootstrap.sh runs pnpm build as root | Detects SUDO_USER, runs build via `su - $RUN_USER` | Clean-room tested, dist/ owned by ubuntu |
| 4 | CRITICAL | bootstrap.sh runs Node app as root | Starts app via `su - $RUN_USER` | Clean-room tested, ps shows ubuntu |
| 5 | MODERATE | Dead variables DB_ROOT_PASS, NGINX_CONF | Removed from script | Grep confirms absence |
| 6 | MODERATE | PID file in /var/run not writable | Moved to /tmp/netperf-app.pid with pre-touch + chown | Clean-room tested |
| 7 | MODERATE | 4 stale tables undocumented | Added LEGACY TABLES documentation block in full-schema.sql | Visual inspection |
| 8 | MODERATE | DEPLOY.md missing Docker Compose | Added full Option B section with untested disclaimer | Visual inspection |
| 9 | MODERATE | Duplicate .dockerignore | Removed deploy/docker/.dockerignore | `find` confirms single file |
| 10 | MODERATE | fact_device_activity undocumented | Documented in DEPLOY.md Schema Notes | Visual inspection |
