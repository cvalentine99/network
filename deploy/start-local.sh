#!/usr/bin/env bash
# Local test deployment startup script
# Starts the production-built app against local MySQL
# The app runs on port 3020; nginx proxies 3013 → 3020

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# ─── Environment ───
export NODE_ENV=production
export PORT=3020
export DATABASE_URL="mysql://netperf:netperf_test_2026@localhost:3306/netperf_app"
export JWT_SECRET="local-test-jwt-secret-not-for-production"
export VITE_APP_ID="local-test"
export OAUTH_SERVER_URL=""
export OWNER_OPEN_ID="local-test-owner"
export BUILT_IN_FORGE_API_URL=""
export BUILT_IN_FORGE_API_KEY=""

echo "=== NetPerf NOC — Local Test Deployment ==="
echo "Project:    $PROJECT_DIR"
echo "Database:   mysql://netperf@localhost:3306/netperf_app"
echo "App port:   $PORT"
echo "Nginx port: 3013"
echo ""

# ─── Verify MySQL ───
echo "[1/5] Checking MySQL..."
if ! mysql -u netperf -pnetperf_test_2026 netperf_app -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='netperf_app';" 2>/dev/null; then
  echo "ERROR: Cannot connect to MySQL. Is it running?"
  echo "  sudo systemctl start mysql"
  echo "  Then apply schema: mysql -u netperf -pnetperf_test_2026 netperf_app < deploy/full-schema.sql"
  exit 1
fi
echo "MySQL: OK"
echo ""

# ─── Verify tables ───
echo "[2/5] Checking schema..."
TABLE_COUNT=$(mysql -u netperf -pnetperf_test_2026 netperf_app -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='netperf_app';" 2>/dev/null)
echo "Tables: $TABLE_COUNT"
if [ "$TABLE_COUNT" -lt 30 ]; then
  echo "WARNING: Expected 38 tables, found $TABLE_COUNT. Schema may be incomplete."
  echo "  Apply schema: mysql -u netperf -pnetperf_test_2026 netperf_app < deploy/full-schema.sql"
fi
echo ""

# ─── Verify build exists ───
echo "[3/5] Checking production build..."
if [ ! -f "$PROJECT_DIR/dist/index.js" ]; then
  echo "ERROR: dist/index.js not found. Run 'pnpm build' first."
  exit 1
fi
if [ ! -d "$PROJECT_DIR/dist/public" ]; then
  echo "ERROR: dist/public/ not found. Run 'pnpm build' first."
  exit 1
fi
echo "Build: OK"
echo ""

# ─── Start the app ───
echo "[4/5] Starting app server on port $PORT..."
node dist/index.js &
APP_PID=$!
echo "App PID: $APP_PID"

# Wait for the server to be ready
for i in $(seq 1 30); do
  if curl -sf http://localhost:$PORT/api/bff/health > /dev/null 2>&1; then
    echo "App server: READY"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: App server did not start within 30 seconds"
    kill $APP_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo ""

# ─── Verify BFF routes ───
echo "[5/5] Verifying BFF routes..."
PASS=0
FAIL=0
for route in health impact/headline impact/timeseries impact/top-talkers impact/detections impact/alerts impact/appliance-status topology/fixtures blast-radius/fixtures correlation/fixtures; do
  CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/bff/$route" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    printf "  %-35s %s\n" "/api/bff/$route" "200 OK"
    PASS=$((PASS + 1))
  else
    printf "  %-35s %s FAIL\n" "/api/bff/$route" "$CODE"
    FAIL=$((FAIL + 1))
  fi
done
echo ""
echo "Routes: $PASS passed, $FAIL failed"
echo ""

echo "=== Deployment Complete ==="
echo "App:    http://localhost:$PORT"
echo "Nginx:  http://localhost:3013 (if nginx is configured)"
echo "PID:    $APP_PID"
echo ""
echo "Open http://localhost:3013 in your browser."
echo "To stop: kill $APP_PID"
