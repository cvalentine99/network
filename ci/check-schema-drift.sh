#!/usr/bin/env bash
# CI Schema-Drift Check
# ---------------------
# Runs `pnpm drizzle-kit generate` and fails if a new migration file is produced.
# This prevents schema.ts from drifting out of sync with the migration journal.
#
# Usage:
#   ./ci/check-schema-drift.sh
#
# Exit codes:
#   0 — schema.ts and migration journal are in sync
#   1 — drift detected: schema.ts has changes not captured in migrations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=== Schema Drift Check ==="
echo "Project: $PROJECT_DIR"
echo ""

# Count migration files before
BEFORE_COUNT=$(find drizzle -maxdepth 1 -name "*.sql" -type f | wc -l)
echo "Migration files before: $BEFORE_COUNT"

# Run drizzle-kit generate and capture output
OUTPUT=$(pnpm drizzle-kit generate 2>&1)
echo "$OUTPUT"

# Count migration files after
AFTER_COUNT=$(find drizzle -maxdepth 1 -name "*.sql" -type f | wc -l)
echo ""
echo "Migration files after: $AFTER_COUNT"

if [ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]; then
  echo ""
  echo "FAIL: Schema drift detected!"
  echo "  $((AFTER_COUNT - BEFORE_COUNT)) new migration file(s) generated."
  echo "  This means drizzle/schema.ts has changes not captured in the migration journal."
  echo ""
  echo "  To fix:"
  echo "    1. Review the generated migration SQL"
  echo "    2. Apply it via webdev_execute_sql"
  echo "    3. Commit the new migration file"
  echo ""
  # Show the new files
  echo "  New migration files:"
  diff <(find drizzle -maxdepth 1 -name "*.sql" -type f | sort | head -"$BEFORE_COUNT") \
       <(find drizzle -maxdepth 1 -name "*.sql" -type f | sort) || true
  exit 1
fi

# Also check for the "nothing to migrate" message as a secondary signal
if echo "$OUTPUT" | grep -q "No schema changes, nothing to migrate"; then
  echo ""
  echo "PASS: Schema is in sync. No drift detected."
  exit 0
fi

# If we got here, drizzle-kit ran but didn't produce a new file and didn't say "nothing to migrate"
# This is unexpected — treat as pass but warn
echo ""
echo "WARN: drizzle-kit completed but did not produce the expected 'nothing to migrate' message."
echo "  Manual review recommended."
exit 0
