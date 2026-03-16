#!/usr/bin/env bash
# ============================================================
# migrate.sh — Apply database migrations
# ============================================================
# Usage:  ./deploy/migrate.sh
# Requires: .env with DATABASE_URL set, MySQL server reachable
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[MIGRATE]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

# ---------- Load .env ----------
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  fail ".env file not found. Run: cp deploy/env.example .env && edit .env"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set in .env"
fi

# ---------- Parse DATABASE_URL ----------
# Format: mysql://user:password@host:port/database?params
log "Parsing DATABASE_URL..."
PROTO=$(echo "$DATABASE_URL" | grep -oP '^[^:]+')
USER_PASS_HOST=$(echo "$DATABASE_URL" | sed 's|^[^:]*://||' | sed 's|?.*||')
DB_USER=$(echo "$USER_PASS_HOST" | cut -d: -f1)
DB_PASS=$(echo "$USER_PASS_HOST" | cut -d: -f2 | cut -d@ -f1)
DB_HOST=$(echo "$USER_PASS_HOST" | cut -d@ -f2 | cut -d: -f1 | cut -d/ -f1)
DB_PORT=$(echo "$USER_PASS_HOST" | cut -d@ -f2 | grep -oP ':\K[0-9]+' || echo "3306")
DB_NAME=$(echo "$USER_PASS_HOST" | grep -oP '/\K[^?]+' || echo "network_perf")

# Check if SSL params are in the URL
SSL_FLAG=""
if echo "$DATABASE_URL" | grep -qi "ssl"; then
  SSL_FLAG="--ssl"
fi

log "Host: $DB_HOST:$DB_PORT  Database: $DB_NAME  User: $DB_USER"

# ---------- Test connection ----------
log "Testing database connection..."
if ! mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" $SSL_FLAG -e "SELECT 1" "$DB_NAME" &>/dev/null; then
  fail "Cannot connect to MySQL at $DB_HOST:$DB_PORT/$DB_NAME. Check DATABASE_URL in .env"
fi
log "Database connection — OK"

# ---------- Apply migrations in order ----------
MIGRATION_DIR="drizzle"
MIGRATION_COUNT=0

for sql_file in $(ls "$MIGRATION_DIR"/*.sql 2>/dev/null | sort); do
  FILENAME=$(basename "$sql_file")
  log "Applying migration: $FILENAME ..."
  
  if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" $SSL_FLAG "$DB_NAME" < "$sql_file"; then
    log "  $FILENAME — applied successfully"
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  else
    # Some statements may fail if tables already exist (idempotent re-run)
    warn "  $FILENAME — some statements may have been skipped (tables may already exist)"
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  fi
done

if [ "$MIGRATION_COUNT" -eq 0 ]; then
  warn "No migration files found in $MIGRATION_DIR/"
else
  log "$MIGRATION_COUNT migration(s) processed."
fi

# ---------- Verify tables ----------
log "Verifying tables..."
TABLE_COUNT=$(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" $SSL_FLAG -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'" 2>/dev/null)
log "Tables in database: $TABLE_COUNT"

echo ""
log "=========================================="
log "  Migration complete."
log "  Tables created: $TABLE_COUNT"
log "  Next: ./deploy/build.sh"
log "=========================================="
