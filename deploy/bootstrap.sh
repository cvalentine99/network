#!/usr/bin/env bash
# ============================================================
# bootstrap.sh — One-command deployment from zero to running
# ============================================================
# Usage:  chmod +x deploy/bootstrap.sh && ./deploy/bootstrap.sh
#
# This script runs the full deployment pipeline:
#   1. install.sh  — system deps + pnpm install
#   2. migrate.sh  — apply database migrations
#   3. build.sh    — TypeScript check + Vite + esbuild
#   4. start.sh    — start production server (daemon mode)
#   5. health-check.sh — verify all endpoints respond
#
# Prerequisites:
#   - .env file exists with DATABASE_URL and other vars filled in
#   - MySQL server is reachable at the DATABASE_URL
#   - Ports are not blocked by firewall
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[BOOTSTRAP]${NC} $*"; }
fail() { echo -e "${RED}[BOOTSTRAP FAIL]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Network Performance Dashboard — Full Deployment${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ---------- Pre-flight ----------
if [ ! -f .env ]; then
  fail ".env file not found. Create it first:
  
  cp deploy/env.example .env
  \$EDITOR .env
  
Then re-run this script."
fi

# ---------- Step 1: Install ----------
log "STEP 1/5: Installing dependencies..."
echo ""
bash deploy/install.sh
echo ""

# ---------- Step 2: Migrate ----------
log "STEP 2/5: Applying database migrations..."
echo ""
bash deploy/migrate.sh
echo ""

# ---------- Step 3: Build ----------
log "STEP 3/5: Building for production..."
echo ""
bash deploy/build.sh
echo ""

# ---------- Step 4: Start ----------
log "STEP 4/5: Starting production server..."
echo ""
bash deploy/start.sh --daemon
echo ""

# ---------- Step 5: Health check ----------
log "STEP 5/5: Running health checks..."
sleep 3  # Give server a moment to fully initialize
echo ""
bash deploy/health-check.sh
echo ""

# ---------- Done ----------
PORT="${PORT:-3000}"
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  App URL:    http://localhost:$PORT${NC}"
echo -e "${GREEN}  Logs:       tail -f netperf.log${NC}"
echo -e "${GREEN}  Stop:       ./deploy/stop.sh${NC}"
echo -e "${GREEN}  Restart:    ./deploy/stop.sh && ./deploy/start.sh --daemon${NC}"
echo -e "${GREEN}  Health:     ./deploy/health-check.sh${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
