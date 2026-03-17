#!/usr/bin/env bash
###############################################################################
# NetPerf NOC — One-Command Bootstrap
# Usage: ./up.sh
# Prereqs: docker, docker compose (v2)
# Result: Full stack on http://localhost:3013
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }

echo ""
echo "========================================="
echo "  NetPerf NOC — Bootstrap"
echo "========================================="
echo ""

# ─── Preflight ───
echo "[1/4] Preflight checks..."

if ! command -v docker &> /dev/null; then
  fail "docker not found. Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi
pass "docker found: $(docker --version | head -1)"

if ! docker compose version &> /dev/null; then
  fail "docker compose (v2) not found. Install Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi
pass "docker compose found: $(docker compose version | head -1)"

if ! docker info &> /dev/null 2>&1; then
  fail "Docker daemon is not running. Start Docker first."
  exit 1
fi
pass "Docker daemon running"

echo ""

# ─── Build & Start ───
echo "[2/4] Building and starting stack..."
echo "  This will take 2-5 minutes on first run (downloading images, building app)."
echo ""

docker compose up --build -d 2>&1 | while IFS= read -r line; do
  echo "  $line"
done

echo ""

# ─── Wait for health ───
echo "[3/4] Waiting for all services to be healthy..."

MAX_WAIT=120
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  MYSQL_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' netperf-mysql 2>/dev/null || echo "missing")
  APP_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' netperf-app 2>/dev/null || echo "missing")
  NGINX_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' netperf-nginx 2>/dev/null || echo "missing")

  if [ "$MYSQL_HEALTH" = "healthy" ] && [ "$APP_HEALTH" = "healthy" ] && [ "$NGINX_HEALTH" = "healthy" ]; then
    break
  fi

  if [ $((ELAPSED % 10)) -eq 0 ]; then
    echo "  Waiting... mysql=$MYSQL_HEALTH app=$APP_HEALTH nginx=$NGINX_HEALTH (${ELAPSED}s/${MAX_WAIT}s)"
  fi

  sleep 2
  ELAPSED=$((ELAPSED + 2))
done

echo ""

if [ "$MYSQL_HEALTH" != "healthy" ] || [ "$APP_HEALTH" != "healthy" ] || [ "$NGINX_HEALTH" != "healthy" ]; then
  fail "Stack did not become healthy within ${MAX_WAIT}s"
  echo ""
  echo "  Container status:"
  docker compose ps
  echo ""
  echo "  Recent logs:"
  docker compose logs --tail=20
  exit 1
fi

pass "mysql: healthy"
pass "app: healthy"
pass "nginx: healthy"
echo ""

# ─── Verify ───
echo "[4/4] Verifying full stack..."

PASS=0
FAIL_COUNT=0

verify() {
  local label="$1"
  local url="$2"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    pass "$label → $code"
    PASS=$((PASS + 1))
  else
    fail "$label → $code"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# MySQL table count
TABLE_COUNT=$(docker exec netperf-mysql mysql -u netperf -pnetperf_test_2026 netperf_app -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='netperf_app';" 2>/dev/null || echo "0")
if [ "$TABLE_COUNT" -ge 35 ] 2>/dev/null; then
  pass "MySQL schema: $TABLE_COUNT tables"
  PASS=$((PASS + 1))
else
  fail "MySQL schema: expected ≥35 tables, got $TABLE_COUNT"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Frontend
verify "Frontend (index.html)" "http://localhost:3013/"

# BFF routes
verify "BFF /health" "http://localhost:3013/api/bff/health"
verify "BFF /impact/headline" "http://localhost:3013/api/bff/impact/headline"
verify "BFF /impact/timeseries" "http://localhost:3013/api/bff/impact/timeseries"
verify "BFF /impact/top-talkers" "http://localhost:3013/api/bff/impact/top-talkers"
verify "BFF /impact/detections" "http://localhost:3013/api/bff/impact/detections"
verify "BFF /impact/alerts" "http://localhost:3013/api/bff/impact/alerts"
verify "BFF /impact/appliance-status" "http://localhost:3013/api/bff/impact/appliance-status"
verify "BFF /topology/fixtures" "http://localhost:3013/api/bff/topology/fixtures"
verify "BFF /blast-radius/fixtures" "http://localhost:3013/api/bff/blast-radius/fixtures"
verify "BFF /correlation/fixtures" "http://localhost:3013/api/bff/correlation/fixtures"

# tRPC
verify "tRPC /dashboard.stats" "http://localhost:3013/api/trpc/dashboard.stats"

# No auth blocking
AUTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:3013/api/bff/impact/headline" 2>/dev/null || echo "000")
if [ "$AUTH_CODE" != "401" ] && [ "$AUTH_CODE" != "403" ]; then
  pass "No auth blocking (no 401/403)"
  PASS=$((PASS + 1))
else
  fail "Auth blocking detected: $AUTH_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "========================================="
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}ALL $PASS CHECKS PASSED${NC}"
  echo ""
  echo "  Stack is ready at: http://localhost:3013"
  echo ""
  echo "  Surfaces:"
  echo "    Impact Deck:   http://localhost:3013/"
  echo "    Flow Theater:  http://localhost:3013/flow-theater"
  echo "    Blast Radius:  http://localhost:3013/blast-radius"
  echo "    Correlation:   http://localhost:3013/correlation"
  echo "    Topology:      http://localhost:3013/topology"
  echo "    Settings:      http://localhost:3013/settings"
  echo "    Help:          http://localhost:3013/help"
else
  echo -e "  ${RED}$FAIL_COUNT CHECKS FAILED${NC} ($PASS passed)"
  echo ""
  echo "  Run 'docker compose logs' for details."
fi
echo "========================================="
echo ""
echo "  Stop:    cd deploy/docker && docker compose down"
echo "  Restart: cd deploy/docker && docker compose restart"
echo "  Logs:    cd deploy/docker && docker compose logs -f"
echo "  Reset:   cd deploy/docker && docker compose down -v && ./up.sh"
echo ""
