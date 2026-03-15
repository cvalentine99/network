# NetPerf NOC — Local Test Deployment Guide

This document covers standing up the full application stack on your own machine for testing. The stack is: **nginx (port 3013) → Node.js app (port 3020) → MySQL**.

No Manus OAuth. No external service dependencies. All BFF routes serve fixture data until an ExtraHop appliance is configured via Settings.

---

## Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 22.x | `node -v` to check |
| pnpm | 9.x+ | `npm install -g pnpm` if missing |
| MySQL | 8.0+ | MariaDB 10.6+ also works |
| nginx | 1.18+ | Any recent version |
| curl | any | For validation checks |

---

## Step 1: MySQL Setup

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

---

## Step 2: Apply Schema

The file `deploy/full-schema.sql` contains all 38 tables. Apply it:

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

Key tables to confirm:

```bash
mysql -u netperf -pnetperf_test_2026 netperf_app -e "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='netperf_app'
  AND table_name IN ('users','appliance_config','dim_appliance','snap_topology','devices','alerts','dim_detection','interfaces','performance_metrics','schema_version')
  ORDER BY table_name;
"
```

The `appliance_config` table will be empty. This is correct — the app renders a "not configured" quiet state until you configure an ExtraHop appliance via the Settings page.

---

## Step 3: Build the App

```bash
# Install dependencies
pnpm install

# Build production bundle
pnpm build
```

This produces `dist/index.js` (server) and `dist/public/` (frontend assets).

---

## Step 4: Start the App Server

Set environment variables and start on port 3020:

```bash
NODE_ENV=production \
PORT=3020 \
DATABASE_URL="mysql://netperf:netperf_test_2026@localhost:3306/netperf_app" \
JWT_SECRET="local-test-jwt-secret-not-for-production" \
VITE_APP_ID="local-test" \
OAUTH_SERVER_URL="" \
OWNER_OPEN_ID="local-test-owner" \
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
NODE_ENV=production PORT=3020 DATABASE_URL="mysql://netperf:netperf_test_2026@localhost:3306/netperf_app" JWT_SECRET="local-test-jwt-secret-not-for-production" VITE_APP_ID="local-test" OAUTH_SERVER_URL="" OWNER_OPEN_ID="local-test-owner" BUILT_IN_FORGE_API_URL="" BUILT_IN_FORGE_API_KEY="" node dist/index.js &
```

Verify the app responds:

```bash
curl -sf http://localhost:3020/api/bff/health | head -c 80
# Should return JSON with "status":"not_configured"
```

---

## Step 5: Configure nginx

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

---

## Step 6: Validate

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

## Alternatively: Use the Start Script

The `deploy/start-local.sh` script automates Steps 4 and 6 (it does not install MySQL or nginx). Edit the `DATABASE_URL` line if your credentials differ, then:

```bash
chmod +x deploy/start-local.sh
./deploy/start-local.sh
```

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
