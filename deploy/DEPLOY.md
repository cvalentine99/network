# NetPerf NOC — Deployment Guide

This document covers standing up the full application stack on your own machine. The stack is: **nginx (port 3013) → Node.js app (port 3020) → MySQL**.

No Manus OAuth. No external service dependencies. All BFF routes serve fixture data until an ExtraHop appliance is configured via Settings.

---

## Deployment Options

| Method | Effort | Prereqs | Notes |
|--------|--------|---------|-------|
| **One-command bootstrap** | Lowest | Ubuntu 22/24 + sudo | Installs everything, verified in sandbox |
| **Manual steps** | Medium | Node 22, MySQL 8, pnpm, nginx | Full control, step-by-step |
| **Docker Compose** | Low | Docker + Docker Compose | **Untested — structurally complete but not validated in a real Docker environment** |

---

## Option A: One-Command Bootstrap (Recommended)

The `deploy/bootstrap.sh` script automates the entire setup. It installs MySQL, Node.js, pnpm, and nginx if missing, applies the schema, builds the app, and starts everything.

> **Important:** `bootstrap.sh` requires the **full project source tree**, not just the `deploy/` directory. It needs `package.json`, `server/`, `client/`, `fixtures/`, and `shared/` to build and run the app. If you only have the deploy bundle, you need the full source ZIP.

```bash
# Extract the full source ZIP first
unzip netperf-full-source.zip -d netperf-app
cd netperf-app

# Run bootstrap from the project root
sudo ./deploy/bootstrap.sh
```

You can also run it from the deploy/ directory — the script resolves the project root automatically:

```bash
cd netperf-app/deploy
sudo ./bootstrap.sh
```

The script:
- Detects the invoking user (`SUDO_USER`) and runs the build and app server as that user (not root)
- Installs MySQL 8 and creates the `netperf_app` database
- Applies all 38 tables from `deploy/full-schema.sql`
- Installs Node.js 22 and pnpm if missing
- Builds the production bundle (owned by the invoking user)
- Starts the app on port 3020 as the invoking user
- Configures nginx on port 3013 → 3020
- Runs 16 verification checks and fails hard on any failure

After completion, open **http://localhost:3013** in your browser.

### Security notes
- The app runs as the invoking user, not root
- The build output (`dist/`) is owned by the invoking user, not root
- Only system-level operations (apt-get, nginx config, MySQL setup) run as root

---

## Option B: Docker Compose

> **Disclaimer:** The Docker Compose stack is structurally complete but has **not been tested** in a real Docker environment. The sandbox used during development does not support Docker networking. Use at your own risk and report issues.

Files are in `deploy/docker/`:

```
deploy/docker/
├── Dockerfile              # Multi-stage build (builder → production)
├── docker-compose.yml      # Full stack: mysql + app + nginx
├── mysql-init/
│   ├── 01-schema.sql       # Auto-applied on first MySQL start
│   └── 02-verify.sql       # Table count verification
├── nginx.conf              # Reverse proxy config
├── up.sh                   # Start script with health checks
└── down.sh                 # Stop script
```

### Quick start

```bash
cd deploy/docker
docker compose up --build
# or: ./up.sh
```

Access at **http://localhost:3013**.

### Architecture

```
nginx:3013 → app:3020 → mysql:3306
```

- MySQL schema is auto-applied on first start via `/docker-entrypoint-initdb.d/`
- The app container runs as a non-root user (`netperf`, UID 1001)
- Health checks are configured for all three services
- The app container includes `curl` for health checks (installed explicitly since `node:22-slim` does not include it)

### Stop

```bash
docker compose down
# or: ./down.sh

# To also remove the MySQL data volume:
docker compose down -v
```

---

## Option C: Manual Deployment

### Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.x | `node -v` to check |
| pnpm | 9.x+ | `npm install -g pnpm` if missing |
| MySQL | 8.0+ | MariaDB 10.6+ also works |
| nginx | 1.18+ | Any recent version |
| curl | any | For validation checks |

### Step 1: MySQL Setup

Create the database and user. Adjust credentials if you prefer different ones (update `DATABASE_URL` in Step 3 accordingly).

```bash
# Start MySQL if not running
sudo systemctl start mysql
# or: sudo service mysql start

# Create database and user
sudo mysql -e "
  CREATE DATABASE IF NOT EXISTS netperf_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'netperf'@'localhost' IDENTIFIED BY 'netperf_test_2026';
  GRANT ALL PRIVILEGES ON netperf_app.* TO 'netperf'@'localhost';
  FLUSH PRIVILEGES;
"
```

Verify:

```bash
mysql -u netperf -pnetperf_test_2026 netperf_app -e "SELECT 'MySQL OK' AS status;"
```

### Step 2: Apply Schema

The file `deploy/full-schema.sql` contains all 38 tables (34 active + 4 legacy). Apply it:

```bash
mysql -u netperf -pnetperf_test_2026 netperf_app < deploy/full-schema.sql
```

Verify all tables exist:

```bash
mysql -u netperf -pnetperf_test_2026 netperf_app -e "
  SELECT COUNT(*) AS table_count
  FROM information_schema.tables
  WHERE table_schema='netperf_app';
"
# Expected: 38
```

> **Note on legacy tables:** The schema includes 4 legacy tables (`alerts`, `devices`, `interfaces`, `performance_metrics`) from the initial Drizzle migration. These are not referenced by current application code but are retained for migration compatibility. They may be safely dropped once all environments have been re-provisioned.

The `appliance_config` table will be empty. This is correct — the app renders a "not configured" quiet state until you configure an ExtraHop appliance via the Settings page.

### Step 3: Build the App

```bash
# Install dependencies
pnpm install

# Build production bundle
pnpm build
```

This produces `dist/index.js` (server) and `dist/public/` (frontend assets).

### Step 4: Start the App Server

Set environment variables and start on port 3020:

```bash
NODE_ENV=production \
PORT=3020 \
DATABASE_URL="mysql://netperf:netperf_test_2026@localhost:3306/netperf_app" \
JWT_SECRET="local-test-jwt-secret-not-for-production" \
VITE_APP_ID="local-test" \
OAUTH_SERVER_URL="" \
OWNER_OPEN_ID="local-test-owner" \
OWNER_NAME="Local Tester" \
BUILT_IN_FORGE_API_URL="" \
BUILT_IN_FORGE_API_KEY="" \
node dist/index.js
```

You will see:

```
[OAuth] Initialized with baseURL:
[OAuth] ERROR: OAUTH_SERVER_URL is not configured! ...
Server running on http://localhost:3020/
```

The OAuth warning is expected and harmless — no routes require authentication.

To run in background:

```bash
# Same env vars as above, but backgrounded
NODE_ENV=production PORT=3020 DATABASE_URL="mysql://netperf:netperf_test_2026@localhost:3306/netperf_app" JWT_SECRET="local-test-jwt-secret-not-for-production" VITE_APP_ID="local-test" OAUTH_SERVER_URL="" OWNER_OPEN_ID="local-test-owner" OWNER_NAME="Local Tester" BUILT_IN_FORGE_API_URL="" BUILT_IN_FORGE_API_KEY="" node dist/index.js &
```

Verify the app responds:

```bash
curl -sf http://localhost:3020/api/bff/health | head -c 80
# Should return JSON with "status":"not_configured"
```

### Step 5: Configure nginx

Copy the provided config:

```bash
sudo cp deploy/nginx-netperf.conf /etc/nginx/sites-available/netperf
sudo ln -sf /etc/nginx/sites-available/netperf /etc/nginx/sites-enabled/netperf

# Optional: remove default site if it conflicts
# sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
# or: sudo service nginx reload
```

The config proxies port 3013 to the app on port 3020 with SSE support (for Flow Theater trace streaming) and WebSocket upgrade headers.

If you use a different app port, edit the `proxy_pass` line in `nginx-netperf.conf`.

### Step 6: Validate

Run these checks to confirm the full stack is working:

```bash
# nginx is listening
curl -sf -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3013/

# Frontend serves HTML
curl -sf http://localhost:3013/ | head -1
# Expected: <!doctype html>

# BFF routes respond through nginx
for route in health impact/headline impact/timeseries impact/top-talkers impact/detections impact/alerts impact/appliance-status topology/fixtures blast-radius/fixtures correlation/fixtures; do
  printf "  /api/bff/%-30s " "$route:"
  curl -sf -o /dev/null -w "%{http_code}\n" "http://localhost:3013/api/bff/$route"
done
# All should return 200

# tRPC endpoint
curl -sf -o /dev/null -w "tRPC: HTTP %{http_code}\n" "http://localhost:3013/api/trpc/dashboard.stats"

# No auth blocking
curl -sf -o /dev/null -w "No 401/403: HTTP %{http_code}\n" "http://localhost:3013/api/bff/impact/headline"
```

Then open **http://localhost:3013** in your browser. You should see the Impact Deck with fixture-backed KPI data, no login prompt.

---

## What You Should See

| Surface | URL Path | Expected State |
|---------|----------|----------------|
| Impact Deck | `/` | KPI strip, timeseries chart, top talkers, detections, alerts — all fixture-backed |
| Flow Theater | `/flow-theater` | Idle state, ready for hostname/device entry |
| Blast Radius | `/blast-radius` | Idle state, ready for query |
| Correlation | `/correlation` | Event feed with fixture data |
| Topology | `/topology` | Constellation view with fixture nodes |
| Settings | `/settings` | Appliance config form (empty = not configured) |
| Help | `/help` | Glossary, keyboard shortcuts, surface descriptions |

All surfaces render fixture data. No live ExtraHop connection is required or expected during this test phase.

---

## Schema Notes

The `deploy/full-schema.sql` file contains 38 `CREATE TABLE` statements:

- **34 active tables** — referenced by current application code (Drizzle ORM schema, BFF routes, tRPC procedures)
- **4 legacy tables** (`alerts`, `devices`, `interfaces`, `performance_metrics`) — from the initial Drizzle migration, not referenced by current code
- **1 table with no live data path yet** (`fact_device_activity`) — defined in `drizzle/schema.ts`, present in the schema, and referenced by the `getDeviceActivity()` helper in `server/db.ts` (called by the device detail tRPC procedure). However, no ETL or BFF route currently populates this table, so it will return empty results until live ExtraHop integration writes activity data into it.

---

## Stopping

```bash
# Find and kill the Node.js process
kill $(lsof -ti:3020) 2>/dev/null

# Stop nginx (optional)
sudo systemctl stop nginx
```

---

## Troubleshooting

**"Cannot connect to MySQL"** — Ensure MySQL is running: `sudo systemctl status mysql`

**"dist/index.js not found"** — Run `pnpm build` first.

**nginx returns 502 Bad Gateway** — The app on port 3020 is not running. Start it first.

**OAuth ERROR in console** — Expected and harmless. No routes require authentication.

**BFF routes return HTML instead of JSON** — You are hitting a route path that does not exist. The SPA fallback serves `index.html` for unknown paths. Check the route name (e.g., `/headline` not `/kpi`).

**Docker Compose issues** — The Docker stack is untested. If services fail to start, check `docker compose logs <service>` for details. Common issues: MySQL not ready before app starts (increase `start_period`), port conflicts on 3013/3020/3306.
