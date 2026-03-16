#!/usr/bin/env bash
# ============================================================
# install.sh — Install system dependencies and project packages
# ============================================================
# Usage:  chmod +x install.sh && ./install.sh
# Requires: Ubuntu 22.04+ or Debian 12+, sudo access
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INSTALL]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ---------- 1. Check OS ----------
log "Checking operating system..."
if ! grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null; then
  warn "This script is tested on Ubuntu 22.04+ / Debian 12+. Your OS may work but is untested."
fi

# ---------- 2. Node.js 22.x ----------
log "Checking Node.js..."
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 20 ]; then
    fail "Node.js 20+ required. Found: $(node --version). Install via https://nodejs.org/"
  fi
  log "Node.js $(node --version) — OK"
else
  log "Node.js not found. Installing Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  log "Node.js $(node --version) installed."
fi

# ---------- 3. pnpm ----------
log "Checking pnpm..."
if ! command -v pnpm &>/dev/null; then
  log "Installing pnpm..."
  npm install -g pnpm
fi
log "pnpm $(pnpm --version) — OK"

# ---------- 4. MySQL client (for migration script) ----------
log "Checking MySQL client..."
if ! command -v mysql &>/dev/null; then
  log "Installing MySQL client..."
  sudo apt-get update -qq && sudo apt-get install -y mysql-client
fi
log "MySQL client — OK"

# ---------- 5. Project dependencies ----------
log "Installing project dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
log "Dependencies installed."

# ---------- 6. Env file check ----------
if [ ! -f .env ]; then
  warn ".env file not found!"
  warn "Copy the template and fill in your values:"
  warn "  cp deploy/env.example .env"
  warn "  \$EDITOR .env"
else
  log ".env file found — OK"
fi

echo ""
log "=========================================="
log "  Installation complete."
log "  Next steps:"
log "    1. cp deploy/env.example .env  (if not done)"
log "    2. Edit .env with your database and auth credentials"
log "    3. ./deploy/migrate.sh"
log "    4. ./deploy/build.sh"
log "    5. ./deploy/start.sh"
log "=========================================="
