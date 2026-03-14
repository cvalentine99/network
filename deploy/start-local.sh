#!/usr/bin/env bash
# Local test deployment startup script
# Starts the production-built app against local MySQL on port 3013 (via nginx)
# The app itself runs on port 3020; nginx proxies 3013 → 3020

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
export OAUTH_SERVER_URL="https://api.manus.im"
export OWNER_OPEN_ID="local-test-owner"
export BUILT_IN_FORGE_API_URL=""
export BUILT_IN_FORGE_API_KEY=""

echo "=== Local Test Deployment ==="
echo "Project:    $PROJECT_DIR"
echo "Database:   mysql://netperf@localhost:3306/netperf_app"
echo "App port:   $PORT"
echo "Nginx port: 3013"
echo ""

# ─── Verify MySQL ───
echo "[1/4] Checking MySQL..."
if ! mysql -u netperf -pnetperf_test_2026 netperf_app -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='netperf_app';" 2>/dev/null; then
  echo "ERROR: Cannot connect to MySQL. Is it running?"
  exit 1
fi
echo "MySQL: OK"
echo ""

# ─── Verify build exists ───
echo "[2/4] Checking production build..."
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
echo "[3/4] Starting app server on port $PORT..."
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

echo "[4/4] Verifying BFF routes..."
echo -n "  /api/bff/health: "
curl -sf http://localhost:$PORT/api/bff/health && echo " OK" || echo " FAIL"
echo -n "  /api/bff/impact/kpi: "
curl -sf http://localhost:$PORT/api/bff/impact/kpi | head -c 80 && echo " ...OK" || echo " FAIL"
echo ""

echo "=== Deployment Complete ==="
echo "App running on port $PORT (PID: $APP_PID)"
echo "Nginx will proxy port 3013 → $PORT"
echo ""
echo "To stop: kill $APP_PID"
