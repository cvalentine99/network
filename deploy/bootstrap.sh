#!/usr/bin/env bash
###############################################################################
# NetPerf NOC — One-Command Bootstrap (no Docker)
#
# Usage:  sudo ./bootstrap.sh
# Result: Full stack on http://localhost:3013
#
# What this does:
#   1. Installs MySQL 8 if missing
#   2. Creates database + user
#   3. Applies full schema (38 tables)
#   4. Verifies all tables exist
#   5. Installs Node.js 22 + pnpm if missing
#   6. Installs dependencies + builds production bundle (as invoking user)
#   7. Starts the app server on port 3020 (as invoking user)
#   8. Installs + configures nginx on port 3013 → 3020
#   9. Verifies the entire stack end-to-end
#
# Fails hard on any partial setup. No silent failures.
#
# Prereqs: Ubuntu 22.04+ with sudo access and internet
# Auth:    None (no Manus OAuth)
#
# NOTE: The schema includes 4 legacy tables (alerts, devices, interfaces,
#       performance_metrics) from the initial Drizzle migration. They are not
#       referenced by current application code but are retained for migration
#       compatibility. The active schema has 34 tables; total count is 38.
###############################################################################

set -euo pipefail

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass()  { echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { echo -e "  ${RED}✗ FATAL:${NC} $1"; exit 1; }
warn()  { echo -e "  ${YELLOW}!${NC} $1"; }
info()  { echo -e "  ${CYAN}→${NC} $1"; }

# ─── Must be root ───
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}This script must be run as root (sudo ./bootstrap.sh)${NC}"
  exit 1
fi

# ─── Detect the real invoking user (for non-root build/run) ───
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  RUN_USER="$SUDO_USER"
else
  RUN_USER="$(logname 2>/dev/null || echo 'root')"
fi
info "Invoking user detected as: $RUN_USER"

# Helper: run a command as the invoking user (not root)
run_as_user() {
  if [ "$RUN_USER" = "root" ]; then
    "$@"
  else
    su - "$RUN_USER" -s /bin/bash -c "cd $PROJECT_ROOT && $*"
  fi
}

# ─── Resolve project root ───
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  fail "Cannot find package.json at $PROJECT_ROOT. Run this script from deploy/ inside the project."
fi

# ─── Config ───
DB_NAME="netperf_app"
DB_USER="netperf"
DB_PASS="netperf_test_2026"
APP_PORT=3020
NGINX_PORT=3013
SCHEMA_FILE="$SCRIPT_DIR/full-schema.sql"
APP_LOG="/var/log/netperf-app.log"
PID_FILE="/tmp/netperf-app.pid"

EXPECTED_TABLES=38
PASS_COUNT=0
FAIL_COUNT=0

echo ""
echo "========================================="
echo "  NetPerf NOC — Full Stack Bootstrap"
echo "========================================="
echo ""

###############################################################################
# PHASE 0: Prerequisites check
###############################################################################
echo "[0/6] Prerequisites..."

# curl is required for health checks
if ! command -v curl &> /dev/null; then
  info "Installing curl..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl > /dev/null 2>&1
  pass "curl installed"
else
  pass "curl available"
fi

echo ""

###############################################################################
# PHASE 1: MySQL
###############################################################################
echo "[1/6] MySQL..."

if ! command -v mysql &> /dev/null; then
  info "Installing MySQL 8..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq mysql-server > /dev/null 2>&1
  pass "MySQL installed"
else
  pass "MySQL already installed"
fi

# Start MySQL if not running
if ! pgrep -x mysqld > /dev/null 2>&1; then
  systemctl start mysql 2>/dev/null || service mysql start 2>/dev/null
  sleep 2
fi

if ! pgrep -x mysqld > /dev/null 2>&1; then
  fail "MySQL failed to start"
fi
pass "MySQL running"

# Create database and user (idempotent)
mysql -e "
  CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
  GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
  FLUSH PRIVILEGES;
" 2>/dev/null || fail "Failed to create database/user"
pass "Database '${DB_NAME}' and user '${DB_USER}' ready"

# Verify connection
if ! mysql -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1" "$DB_NAME" > /dev/null 2>&1; then
  fail "Cannot connect to MySQL as ${DB_USER}"
fi
pass "MySQL connection verified"

echo ""

###############################################################################
# PHASE 2: Schema
###############################################################################
echo "[2/6] Schema..."

if [ ! -f "$SCHEMA_FILE" ]; then
  fail "Schema file not found: $SCHEMA_FILE"
fi

# Check if schema already applied
CURRENT_TABLES=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")

if [ "$CURRENT_TABLES" -ge "$EXPECTED_TABLES" ] 2>/dev/null; then
  pass "Schema already applied ($CURRENT_TABLES tables)"
else
  info "Applying schema from $SCHEMA_FILE..."
  mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SCHEMA_FILE" 2>/dev/null \
    || fail "Schema application failed"

  CURRENT_TABLES=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")
  pass "Schema applied ($CURRENT_TABLES tables)"
fi

# Hard check: must have at least EXPECTED_TABLES
if [ "$CURRENT_TABLES" -lt "$EXPECTED_TABLES" ] 2>/dev/null; then
  fail "Expected ≥${EXPECTED_TABLES} tables, got ${CURRENT_TABLES}. Schema is incomplete."
fi

# Verify critical tables (active schema + legacy tables the app may touch)
for TABLE in users appliance_config dim_appliance dim_device dim_alert dim_detection dim_network snap_topology snap_topology_node snap_topology_edge schema_version; do
  EXISTS=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='${TABLE}';" 2>/dev/null || echo "0")
  if [ "$EXISTS" -eq 1 ]; then
    pass "Table '${TABLE}' exists"
  else
    fail "Critical table '${TABLE}' is missing"
  fi
done

echo ""

###############################################################################
# PHASE 3: Node.js + pnpm
###############################################################################
echo "[3/6] Node.js..."

if ! command -v node &> /dev/null; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
  pass "Node.js installed"
else
  NODE_VER=$(node --version)
  pass "Node.js already installed: $NODE_VER"
fi

if ! command -v pnpm &> /dev/null; then
  info "Installing pnpm..."
  npm install -g pnpm > /dev/null 2>&1
  pass "pnpm installed"
else
  pass "pnpm already installed"
fi

echo ""

###############################################################################
# PHASE 4: Build (as invoking user, not root)
###############################################################################
echo "[4/6] Build..."

cd "$PROJECT_ROOT"

# Ensure the invoking user owns the project directory
if [ "$RUN_USER" != "root" ]; then
  chown -R "$RUN_USER":"$(id -gn "$RUN_USER")" "$PROJECT_ROOT"
fi

if [ ! -d "node_modules" ]; then
  info "Installing dependencies (as $RUN_USER)..."
  run_as_user pnpm install --frozen-lockfile 2>&1 | tail -3
  pass "Dependencies installed"
else
  pass "Dependencies already installed"
fi

info "Building production bundle (as $RUN_USER)..."
run_as_user pnpm build 2>&1 | tail -5

if [ ! -f "dist/index.js" ]; then
  fail "Build failed: dist/index.js not found"
fi

# Verify dist/ is owned by the invoking user (not root)
DIST_OWNER=$(stat -c '%U' dist/index.js)
if [ "$DIST_OWNER" = "root" ] && [ "$RUN_USER" != "root" ]; then
  warn "dist/ owned by root, fixing ownership to $RUN_USER..."
  chown -R "$RUN_USER":"$(id -gn "$RUN_USER")" dist/
fi
pass "Production build complete (owned by $RUN_USER)"

echo ""

###############################################################################
# PHASE 5: App server (as invoking user, not root)
###############################################################################
echo "[5/6] App server..."

# Kill any existing instance
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null
    sleep 1
    warn "Killed previous app server (PID $OLD_PID)"
  fi
  rm -f "$PID_FILE"
fi

# Also kill anything on the app port
fuser -k ${APP_PORT}/tcp 2>/dev/null || true
sleep 1

# Ensure log file is writable by the invoking user
touch "$APP_LOG"
if [ "$RUN_USER" != "root" ]; then
  chown "$RUN_USER":"$(id -gn "$RUN_USER")" "$APP_LOG"
fi

# NOTE: Do NOT chown the PID file before writing — fs.protected_regular=2 on
# Ubuntu 22.04+ prevents root from writing to files in /tmp owned by other users.
# We write the PID as root first, then chown afterward.
rm -f "$PID_FILE"

# Start the app as the invoking user (not root)
if [ "$RUN_USER" != "root" ]; then
  su - "$RUN_USER" -s /bin/bash -c "
    cd $PROJECT_ROOT && \
    DATABASE_URL='mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}' \
    NODE_ENV=production \
    PORT=${APP_PORT} \
    JWT_SECRET='local-test-jwt-secret-not-for-production' \
    VITE_APP_ID='local-test' \
    OAUTH_SERVER_URL='' \
    OWNER_OPEN_ID='local-test-owner' \
    OWNER_NAME='Local Tester' \
    BUILT_IN_FORGE_API_URL='' \
    BUILT_IN_FORGE_API_KEY='' \
    nohup node dist/index.js > $APP_LOG 2>&1 &
  "
  # Wait briefly for node to fork, then capture the actual node PID (not the bash wrapper)
  sleep 1
  NODE_PID=$(pgrep -f 'node dist/index.js' -u "$RUN_USER" | tail -1)
  if [ -z "$NODE_PID" ]; then
    fail "Node process did not start"
  fi
  echo "$NODE_PID" > "$PID_FILE"
  chown "$RUN_USER":"$(id -gn "$RUN_USER")" "$PID_FILE"
else
  DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}" \
  NODE_ENV=production \
  PORT=${APP_PORT} \
  JWT_SECRET="local-test-jwt-secret-not-for-production" \
  VITE_APP_ID="local-test" \
  OAUTH_SERVER_URL="" \
  OWNER_OPEN_ID="local-test-owner" \
  OWNER_NAME="Local Tester" \
  BUILT_IN_FORGE_API_URL="" \
  BUILT_IN_FORGE_API_KEY="" \
  nohup node dist/index.js > "$APP_LOG" 2>&1 &
  echo $! > "$PID_FILE"
fi

APP_PID=$(cat "$PID_FILE")

# Wait for health
info "Waiting for app to start (PID $APP_PID, user $RUN_USER)..."
TRIES=0
MAX_TRIES=30
while [ $TRIES -lt $MAX_TRIES ]; do
  if curl -sf http://localhost:${APP_PORT}/api/bff/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
  TRIES=$((TRIES + 1))
done

if ! curl -sf http://localhost:${APP_PORT}/api/bff/health > /dev/null 2>&1; then
  echo "  Last 20 lines of app log:"
  tail -20 "$APP_LOG"
  fail "App server did not become healthy within ${MAX_TRIES}s"
fi
pass "App server running on port ${APP_PORT} (PID $APP_PID, user $RUN_USER)"

# Verify the app can actually talk to MySQL
DB_CHECK=$(curl -sf http://localhost:${APP_PORT}/api/trpc/dashboard.stats 2>/dev/null || echo "FAIL")
if echo "$DB_CHECK" | grep -q '"result"'; then
  pass "App ↔ MySQL connection verified (tRPC dashboard.stats responds)"
else
  warn "App started but tRPC dashboard.stats did not return expected result. DB connection may be degraded."
  warn "Response: $(echo "$DB_CHECK" | head -c 200)"
fi

echo ""

###############################################################################
# PHASE 6: nginx
###############################################################################
echo "[6/6] nginx..."

if ! command -v nginx &> /dev/null; then
  info "Installing nginx..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -qq nginx > /dev/null 2>&1
  pass "nginx installed"
else
  pass "nginx already installed"
fi

# Write nginx config inline (self-contained — no external file dependency)
# Handles both Ubuntu (sites-available) and other distros (conf.d)
if [ -d /etc/nginx/sites-available ]; then
  NGINX_SITE_FILE="/etc/nginx/sites-available/netperf"
  cat > "$NGINX_SITE_FILE" <<NGINX_EOF
server {
    listen ${NGINX_PORT};
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
NGINX_EOF
  ln -sf "$NGINX_SITE_FILE" /etc/nginx/sites-enabled/netperf
  rm -f /etc/nginx/sites-enabled/default
elif [ -d /etc/nginx/conf.d ]; then
  cat > /etc/nginx/conf.d/netperf.conf <<NGINX_EOF
server {
    listen ${NGINX_PORT};
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
NGINX_EOF
  # Remove default config if it conflicts
  rm -f /etc/nginx/conf.d/default.conf
else
  fail "Cannot find nginx config directory (/etc/nginx/sites-available or /etc/nginx/conf.d)"
fi

# Test config
if ! nginx -t 2>/dev/null; then
  nginx -t 2>&1
  fail "nginx config test failed"
fi

# Restart nginx
systemctl restart nginx 2>/dev/null || service nginx restart 2>/dev/null || nginx -s reload 2>/dev/null
sleep 1

if ! curl -sf http://localhost:${NGINX_PORT}/ > /dev/null 2>&1; then
  # Try starting nginx directly if systemctl failed
  nginx 2>/dev/null || true
  sleep 1
fi

pass "nginx configured on port ${NGINX_PORT} → ${APP_PORT}"

echo ""

###############################################################################
# VERIFICATION
###############################################################################
echo "========================================="
echo "  Verification"
echo "========================================="
echo ""

verify() {
  local label="$1"
  local url="$2"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    pass "$label → HTTP $code"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label → HTTP $code"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# MySQL
TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';" 2>/dev/null || echo "0")
if [ "$TABLE_COUNT" -ge "$EXPECTED_TABLES" ] 2>/dev/null; then
  pass "MySQL: $TABLE_COUNT tables"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} MySQL: expected ≥${EXPECTED_TABLES}, got $TABLE_COUNT"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# App direct
verify "App /health (direct)" "http://localhost:${APP_PORT}/api/bff/health"

# App ↔ MySQL (tRPC route that touches the database)
verify "App ↔ MySQL (tRPC)" "http://localhost:${APP_PORT}/api/trpc/dashboard.stats"

# Frontend via nginx
verify "Frontend via nginx" "http://localhost:${NGINX_PORT}/"

# BFF routes via nginx
verify "BFF /health" "http://localhost:${NGINX_PORT}/api/bff/health"
verify "BFF /impact/headline" "http://localhost:${NGINX_PORT}/api/bff/impact/headline"
verify "BFF /impact/timeseries" "http://localhost:${NGINX_PORT}/api/bff/impact/timeseries"
verify "BFF /impact/top-talkers" "http://localhost:${NGINX_PORT}/api/bff/impact/top-talkers"
verify "BFF /impact/detections" "http://localhost:${NGINX_PORT}/api/bff/impact/detections"
verify "BFF /impact/alerts" "http://localhost:${NGINX_PORT}/api/bff/impact/alerts"
verify "BFF /impact/appliance-status" "http://localhost:${NGINX_PORT}/api/bff/impact/appliance-status"
verify "BFF /topology/fixtures" "http://localhost:${NGINX_PORT}/api/bff/topology/fixtures"
verify "BFF /blast-radius/fixtures" "http://localhost:${NGINX_PORT}/api/bff/blast-radius/fixtures"
verify "BFF /correlation/fixtures" "http://localhost:${NGINX_PORT}/api/bff/correlation/fixtures"

# tRPC via nginx
verify "tRPC via nginx" "http://localhost:${NGINX_PORT}/api/trpc/dashboard.stats"

# No auth blocking
AUTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:${NGINX_PORT}/api/bff/impact/headline" 2>/dev/null || echo "000")
if [ "$AUTH_CODE" != "401" ] && [ "$AUTH_CODE" != "403" ]; then
  pass "No auth blocking (no 401/403)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} Auth blocking detected: HTTP $AUTH_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "========================================="
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}ALL $PASS_COUNT CHECKS PASSED${NC}"
  echo ""
  echo "  Stack is ready at: http://localhost:${NGINX_PORT}"
  echo ""
  echo "  Surfaces:"
  echo "    Impact Deck:   http://localhost:${NGINX_PORT}/"
  echo "    Flow Theater:  http://localhost:${NGINX_PORT}/flow-theater"
  echo "    Blast Radius:  http://localhost:${NGINX_PORT}/blast-radius"
  echo "    Correlation:   http://localhost:${NGINX_PORT}/correlation"
  echo "    Topology:      http://localhost:${NGINX_PORT}/topology"
  echo "    Settings:      http://localhost:${NGINX_PORT}/settings"
  echo "    Help:          http://localhost:${NGINX_PORT}/help"
else
  echo -e "  ${RED}$FAIL_COUNT CHECKS FAILED${NC} ($PASS_COUNT passed)"
  echo ""
  echo "  App log: $APP_LOG"
  echo "  nginx log: /var/log/nginx/error.log"
  exit 1
fi
echo "========================================="
echo ""
echo "  Management:"
echo "    Stop app:     kill \$(cat $PID_FILE)"
echo "    App log:      tail -f $APP_LOG"
echo "    Restart:      sudo $SCRIPT_DIR/bootstrap.sh"
echo "    Stop nginx:   sudo systemctl stop nginx"
echo "    Reset DB:     mysql -u $DB_USER -p'$DB_PASS' -e 'DROP DATABASE $DB_NAME;' && sudo $SCRIPT_DIR/bootstrap.sh"
echo ""
echo "  Notes:"
echo "    - App runs as user '$RUN_USER' (not root)"
echo "    - 4 legacy tables (alerts, devices, interfaces, performance_metrics) exist but are unused"
echo "    - All BFF routes serve fixture data until an ExtraHop appliance is configured"
echo "    - No Manus OAuth — all surfaces are accessible without login"
echo ""
