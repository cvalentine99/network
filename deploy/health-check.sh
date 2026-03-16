#!/usr/bin/env bash
# ============================================================
# health-check.sh — Verify the running server is healthy
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[HEALTH]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

PORT="${PORT:-3000}"
BASE="http://localhost:$PORT"
PASS=0
TOTAL=0

check() {
  local name="$1"
  local url="$2"
  local expect_status="${3:-200}"
  TOTAL=$((TOTAL + 1))
  
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  
  if [ "$STATUS" = "$expect_status" ]; then
    log "  PASS  $name (HTTP $STATUS)"
    PASS=$((PASS + 1))
  else
    fail "  FAIL  $name (expected $expect_status, got $STATUS)"
  fi
}

echo ""
log "Running health checks against $BASE ..."
echo ""

# ---------- Core endpoints ----------
check "Frontend (index.html)"       "$BASE/"
check "tRPC health (auth.me)"       "$BASE/api/trpc/auth.me" "200"

# ---------- BFF fixture routes ----------
check "BFF Impact Headline"          "$BASE/api/bff/impact/headline"
check "BFF Top Talkers"              "$BASE/api/bff/impact/top-talkers"
check "BFF Detections"               "$BASE/api/bff/impact/detections"
check "BFF Alerts"                   "$BASE/api/bff/impact/alerts"
check "BFF Appliance Status"         "$BASE/api/bff/impact/appliance-status"
check "BFF Topology Fixtures"        "$BASE/api/bff/topology/fixtures"
check "BFF Correlation Fixtures"     "$BASE/api/bff/correlation/fixtures"
check "BFF Blast Radius Fixtures"    "$BASE/api/bff/blast-radius/fixtures"

echo ""
log "=========================================="
log "  Results: $PASS / $TOTAL passed"
if [ "$PASS" -eq "$TOTAL" ]; then
  log "  Status: ALL HEALTHY"
else
  fail "  Status: $((TOTAL - PASS)) check(s) FAILED"
fi
log "=========================================="
