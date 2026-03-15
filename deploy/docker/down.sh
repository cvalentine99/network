#!/usr/bin/env bash
###############################################################################
# NetPerf NOC — Teardown
# Usage: ./down.sh         (stop containers, keep data)
#        ./down.sh --reset (stop containers, delete data volumes)
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ "${1:-}" = "--reset" ]; then
  echo "Stopping and removing all containers + volumes..."
  docker compose down -v
  echo "Done. All data wiped. Run ./up.sh to start fresh."
else
  echo "Stopping containers (data preserved)..."
  docker compose down
  echo "Done. Run 'docker compose up -d' to restart, or ./up.sh to rebuild."
fi
