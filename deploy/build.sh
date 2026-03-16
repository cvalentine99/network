#!/usr/bin/env bash
# ============================================================
# build.sh — Build the frontend and server for production
# ============================================================
# Usage:  ./deploy/build.sh
# Requires: pnpm installed, .env present (Vite reads VITE_* vars)
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[BUILD]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ---------- Load .env for VITE_* vars ----------
if [ -f .env ]; then
  set -a
  source .env
  set +a
  log ".env loaded (VITE_* vars available to Vite build)"
else
  warn ".env not found — Vite build will use defaults for VITE_* vars"
fi

# ---------- TypeScript check ----------
log "Running TypeScript type check..."
if npx tsc --noEmit 2>&1; then
  log "TypeScript — OK (zero errors)"
else
  fail "TypeScript errors found. Fix them before building."
fi

# ---------- Build ----------
log "Building frontend (Vite) and server (esbuild)..."
pnpm build

# ---------- Verify output ----------
if [ ! -f dist/index.js ]; then
  fail "Server bundle not found at dist/index.js"
fi

if [ ! -f dist/public/index.html ]; then
  fail "Frontend bundle not found at dist/public/index.html"
fi

SERVER_SIZE=$(du -sh dist/index.js | cut -f1)
CLIENT_SIZE=$(du -sh dist/public/ | cut -f1)

echo ""
log "=========================================="
log "  Build complete."
log "  Server bundle: dist/index.js ($SERVER_SIZE)"
log "  Client bundle: dist/public/ ($CLIENT_SIZE)"
log "  Next: ./deploy/start.sh"
log "=========================================="
