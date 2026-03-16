#!/usr/bin/env bash
# ============================================================
# stop.sh — Stop the production server
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log()  { echo -e "${GREEN}[STOP]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

if [ ! -f netperf.pid ]; then
  fail "No PID file found. Server may not be running."
fi

PID=$(cat netperf.pid)

if kill -0 "$PID" 2>/dev/null; then
  log "Stopping server (PID $PID)..."
  kill "$PID"
  sleep 2
  
  if kill -0 "$PID" 2>/dev/null; then
    log "Graceful shutdown timed out, forcing..."
    kill -9 "$PID" 2>/dev/null || true
  fi
  
  rm -f netperf.pid
  log "Server stopped."
else
  log "Process $PID not running. Cleaning up PID file."
  rm -f netperf.pid
fi
