#!/usr/bin/env bash
###############################################################################
# NetPerf NOC — One-Command Bootstrap (no Docker)
#
# Usage:  sudo ./bootstrap.sh
# Result: Full stack on http://localhost:3013
#
# What this does:
#   0. Checks prerequisites (curl, build-essential)
#   1. Installs MySQL 8 if missing
#   2. Creates database + user
#   3. Applies full schema (39 tables)
#   4. Verifies all tables exist
#   5. Installs Node.js 22 + pnpm if missing
#   6. Installs dependencies + builds production bundle (as invoking user)
#   7. Creates systemd service for the app (auto-restart on reboot)
#   8. Installs + configures nginx on port 3013 → 3020
#   9. Runs verification checks (fixture-mode only — does NOT prove live ExtraHop connectivity)
#
# Fails hard on any partial setup. Verification proves the stack runs in fixture mode.
# It does NOT prove live ExtraHop connectivity or production readiness.
#
# Prereqs: Ubuntu 22.04+ with sudo access and internet
# Auth:    None (no Manus OAuth)
#
# NOTE: The schema includes 4 legacy tables (alerts, devices, interfaces,
#       performance_metrics) from the initial Drizzle migration. They are not
#       referenced by current application code but are retained for migration
#       compatibility. The active schema has 35 tables; total count is 39.
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
# bootstrap.sh lives at <project>/deploy/bootstrap.sh
# It can be invoked as:
#   sudo ./deploy/bootstrap.sh          (from project root)
#   cd deploy && sudo ./bootstrap.sh    (from deploy/ dir)
#   sudo /absolute/path/to/bootstrap.sh (from anywhere)
# In all cases, SCRIPT_DIR is the deploy/ directory and PROJECT_ROOT is its parent.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo ""
  echo -e "${RED}ERROR: Cannot find package.json at $PROJECT_ROOT${NC}"
  echo ""
  echo "  This script must run from within the FULL project source tree."
  echo "  The deploy/ directory alone is not sufficient — bootstrap.sh needs"
  echo "  package.json, source code, and fixtures/ to build and run the app."
  echo ""
  echo "  Expected directory structure:"
  echo "    <project-root>/"
  echo "      package.json"
  echo "      server/"
  echo "      client/"
  echo "      fixtures/"
  echo "      deploy/"
  echo "        bootstrap.sh   ← you are here"
  echo ""
  echo "  If you only have the deploy/ bundle, you need the full source ZIP."
  echo "  Extract it, then run:  cd <project-root> && sudo ./deploy/bootstrap.sh"
  echo ""
  fail "Missing project source tree. See above for required structure."
fi

# Verify critical directories exist
for DIR_CHECK in server client fixtures shared; do
  if [ ! -d "$PROJECT_ROOT/$DIR_CHECK" ]; then
    fail "Missing required directory: $PROJECT_ROOT/$DIR_CHECK. Is this the full project source?"
  fi
done

# ─── Config ───
DB_NAME="netperf_app"
DB_USER="netperf"
DB_PASS="netperf_test_2026"
APP_PORT=3020
NGINX_PORT=3013
SCHEMA_FILE="$SCRIPT_DIR/full-schema.sql"
APP_LOG="/var/log/netperf-app.log"
SERVICE_NAME="netperf-app"

EXPECTED_TABLES=39
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
echo "[0/7] Prerequisites..."

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
echo "[1/7] MySQL..."

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
echo "[2/7] Schema..."

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
for TABLE in users appliance_config dim_appliance dim_device dim_alert dim_detection dim_network snap_topology snap_topology_node snap_topology_edge schema_version fact_device_activity; do
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
echo "[3/7] Node.js..."

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
echo "[4/7] Build..."

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
# PHASE 5: systemd service (replaces nohup for proper lifecycle management)
###############################################################################
echo "[5/7] App service..."

# Stop any existing instance (old nohup-style or systemd)
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  systemctl stop "$SERVICE_NAME" 2>/dev/null
  warn "Stopped existing $SERVICE_NAME service"
fi

# Also kill any stray node processes on the app port
fuser -k ${APP_PORT}/tcp 2>/dev/null || true
sleep 1

# Ensure log file is writable by the invoking user
touch "$APP_LOG"
if [ "$RUN_USER" != "root" ]; then
  chown "$RUN_USER":"$(id -gn "$RUN_USER")" "$APP_LOG"
fi

# Write systemd service file
cat > /etc/systemd/system/${SERVICE_NAME}.service <<SYSTEMD_EOF
[Unit]
Description=NetPerf NOC Dashboard
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=${RUN_USER}
Group=$(id -gn "$RUN_USER")
WorkingDirectory=${PROJECT_ROOT}
ExecStart=/usr/bin/node ${PROJECT_ROOT}/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=append:${APP_LOG}
StandardError=append:${APP_LOG}

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}
Environment=JWT_SECRET=local-test-jwt-secret-not-for-production
Environment=VITE_APP_ID=local-test
Environment=OAUTH_SERVER_URL=
Environment=OWNER_OPEN_ID=local-test-owner
Environment=OWNER_NAME=Local Tester
Environment=BUILT_IN_FORGE_API_URL=
Environment=BUILT_IN_FORGE_API_KEY=

# ExtraHop configuration (uncomment and set when connecting to a real appliance)
# SECURITY NOTE: EH_VERIFY_SSL=false keeps HTTPS but skips TLS certificate verification.
# This accepts self-signed certs. Use only in lab environments with trusted networks.
# For production, use EH_VERIFY_SSL=true with a valid TLS certificate.
# Environment=EH_HOST=extrahop.lab.local
# Environment=EH_API_KEY=your-api-key-here
# Environment=EH_VERIFY_SSL=false

# ETL scheduler configuration
# Environment=ETL_INTERVAL_MS=300000

# Process limits
LimitNOFILE=65536
TimeoutStartSec=30
TimeoutStopSec=10

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

# Reload systemd, enable and start the service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME" > /dev/null 2>&1
systemctl start "$SERVICE_NAME"

# Wait for health
info "Waiting for app to start..."
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

APP_PID=$(systemctl show -p MainPID --value "$SERVICE_NAME")
pass "App server running on port ${APP_PORT} (PID $APP_PID, user $RUN_USER, systemd-managed)"

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
echo "[6/7] nginx..."

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

    # Proxy all requests to the Node.js app
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

        # SSE support (Flow Theater trace streaming)
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
# PHASE 7: VERIFICATION
###############################################################################
echo "[7/7] Verification..."
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
verify "BFF /health"                "http://localhost:${NGINX_PORT}/api/bff/health"
verify "BFF /impact/headline"       "http://localhost:${NGINX_PORT}/api/bff/impact/headline"
verify "BFF /impact/timeseries"     "http://localhost:${NGINX_PORT}/api/bff/impact/timeseries"
verify "BFF /impact/top-talkers"    "http://localhost:${NGINX_PORT}/api/bff/impact/top-talkers"
verify "BFF /impact/detections"     "http://localhost:${NGINX_PORT}/api/bff/impact/detections"
verify "BFF /impact/alerts"         "http://localhost:${NGINX_PORT}/api/bff/impact/alerts"
verify "BFF /impact/appliance-status" "http://localhost:${NGINX_PORT}/api/bff/impact/appliance-status"
verify "BFF /impact/device-activity" "http://localhost:${NGINX_PORT}/api/bff/impact/device-activity?id=1042"
# NOTE: /fixtures endpoints are gated behind NODE_ENV=development in production.
# These checks verify fixture-mode availability only.
verify "BFF /topology/query"        "http://localhost:${NGINX_PORT}/api/bff/topology/query" 
verify "BFF /blast-radius/query"    "http://localhost:${NGINX_PORT}/api/bff/blast-radius/query"
verify "BFF /correlation/events"    "http://localhost:${NGINX_PORT}/api/bff/correlation/events"

# tRPC via nginx
verify "tRPC via nginx" "http://localhost:${NGINX_PORT}/api/trpc/dashboard.stats"

# Auth check — WARNING: no authentication means anyone with network access can reach all routes
AUTH_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:${NGINX_PORT}/api/bff/impact/headline" 2>/dev/null || echo "000")
if [ "$AUTH_CODE" != "401" ] && [ "$AUTH_CODE" != "403" ]; then
  echo -e "  ${YELLOW}⚠${NC} No auth blocking (no 401/403) — SECURITY WARNING: all routes are publicly accessible"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} Auth blocking detected: HTTP $AUTH_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Health body check — verify health endpoint reports actual status
HEALTH_STATUS=$(curl -sf "http://localhost:${NGINX_PORT}/api/bff/health" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unreachable")
if [ "$HEALTH_STATUS" = "ok" ]; then
  pass "Health: status=ok (appliance connected)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [ "$HEALTH_STATUS" = "degraded" ]; then
  echo -e "  ${YELLOW}⚠${NC} Health: status=degraded (credentials configured but appliance unreachable)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [ "$HEALTH_STATUS" = "not_configured" ]; then
  echo -e "  ${YELLOW}⚠${NC} Health: status=not_configured — running in FIXTURE MODE (demo data)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} Health: unexpected status='$HEALTH_STATUS'"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "========================================="
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}ALL $PASS_COUNT CHECKS PASSED${NC}"
  echo ""
  if [ "$HEALTH_STATUS" = "not_configured" ]; then
    echo -e "  Stack is ${YELLOW}RUNNING IN FIXTURE MODE${NC} at: http://localhost:${NGINX_PORT}"
    echo "  Configure an ExtraHop appliance via Settings or env vars for live data."
  elif [ "$HEALTH_STATUS" = "degraded" ]; then
    echo -e "  Stack is ${YELLOW}RUNNING IN DEGRADED MODE${NC} at: http://localhost:${NGINX_PORT}"
    echo "  Credentials configured but appliance is unreachable."
  else
    echo -e "  Stack is running at: http://localhost:${NGINX_PORT}"
  fi
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
echo "    Status:       sudo systemctl status $SERVICE_NAME"
echo "    Stop:         sudo systemctl stop $SERVICE_NAME"
echo "    Start:        sudo systemctl start $SERVICE_NAME"
echo "    Restart:      sudo systemctl restart $SERVICE_NAME"
echo "    Logs:         sudo journalctl -u $SERVICE_NAME -f"
echo "    App log:      tail -f $APP_LOG"
echo "    Re-bootstrap: sudo $SCRIPT_DIR/bootstrap.sh"
echo "    Stop nginx:   sudo systemctl stop nginx"
echo "    Reset DB:     mysql -u $DB_USER -p'$DB_PASS' -e 'DROP DATABASE $DB_NAME;' && sudo $SCRIPT_DIR/bootstrap.sh"
echo ""
echo "  ExtraHop Integration:"
echo "    To connect to a live ExtraHop appliance, edit the systemd service:"
echo "      sudo systemctl edit $SERVICE_NAME"
echo "    Add under [Service]:"
echo "      Environment=EH_HOST=extrahop.lab.local"
echo "      Environment=EH_API_KEY=your-api-key-here"
echo "      Environment=EH_VERIFY_SSL=false"
echo "    Then restart:"
echo "      sudo systemctl restart $SERVICE_NAME"
echo ""
echo "    Or configure via the Settings page in the browser."
echo ""
echo "  Notes:"
echo "    - App runs as user '$RUN_USER' (not root) via systemd"
echo "    - App auto-restarts on failure and on system reboot"
echo "    - 4 legacy tables (alerts, devices, interfaces, performance_metrics) exist but are unused"
echo "    - All BFF routes serve fixture data until an ExtraHop appliance is configured"
echo "    - No Manus OAuth — all surfaces are accessible without login"
echo "    - Background ETL scheduler activates when ExtraHop is configured (requires app restart)
    - SECURITY: No authentication — all routes are publicly accessible on this port
    - SECURITY: EH_VERIFY_SSL=false keeps HTTPS but skips cert verification — use only in lab environments"
echo ""
