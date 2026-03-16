#!/usr/bin/env bash
# ============================================================
# start.sh — Start the production server
# ============================================================
# Usage:  ./deploy/start.sh           (foreground)
#         ./deploy/start.sh --daemon   (background with nohup)
# Requires: .env present, build completed (dist/ exists)
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[START]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ---------- Pre-flight checks ----------
if [ ! -f .env ]; then
  fail ".env not found. Run: cp deploy/env.example .env && edit .env"
fi

if [ ! -f dist/index.js ]; then
  fail "dist/index.js not found. Run: ./deploy/build.sh"
fi

if [ ! -f dist/public/index.html ]; then
  fail "dist/public/index.html not found. Run: ./deploy/build.sh"
fi

# ---------- Load .env ----------
set -a
source .env
set +a

export NODE_ENV=production
PORT="${PORT:-3000}"

log "Starting Network Performance Dashboard..."
log "  Port: $PORT"
log "  Mode: production"
log "  PID file: ./netperf.pid"

# ---------- Stop existing instance ----------
if [ -f netperf.pid ]; then
  OLD_PID=$(cat netperf.pid)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    log "Stopping existing instance (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 2
  fi
  rm -f netperf.pid
fi

# ---------- Start ----------
if [ "${1:-}" = "--daemon" ]; then
  log "Starting in daemon mode..."
  nohup node dist/index.js > netperf.log 2>&1 &
  echo $! > netperf.pid
  sleep 2
  
  if kill -0 "$(cat netperf.pid)" 2>/dev/null; then
    log "Server started (PID $(cat netperf.pid))"
    log "Logs: tail -f netperf.log"
    log "Stop: kill \$(cat netperf.pid)"
  else
    fail "Server failed to start. Check netperf.log"
  fi
else
  log "Starting in foreground mode (Ctrl+C to stop)..."
  echo $$ > netperf.pid
  exec node dist/index.js
fi

echo ""
log "=========================================="
log "  Server running at http://localhost:$PORT"
log "=========================================="
