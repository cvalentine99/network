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

The `deploy/bootstrap.sh` script automates the entire setup. It installs MySQL, Node.js, pnpm, and nginx if missing, applies the schema, builds the app, creates a systemd service, and verifies everything.

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
- Verifies 12 critical tables including `fact_device_activity`
- Installs Node.js 22 and pnpm if missing
- Builds the production bundle (owned by the invoking user)
- Creates a **systemd service** (`netperf-app.service`) for automatic restart and boot persistence
- Configures nginx on port 3013 → 3020
- Runs 17 verification checks and fails hard on any failure

After completion, open **http://localhost:3013** in your browser.

### Service Management

The app runs as a systemd service, which means it auto-restarts on failure and survives reboots:

```bash
# Check status
sudo systemctl status netperf-app

# Stop the app
sudo systemctl stop netperf-app

# Start the app
sudo systemctl start netperf-app

# Restart the app
sudo systemctl restart netperf-app

# View live logs
sudo journalctl -u netperf-app -f

# View app log file
tail -f /var/log/netperf-app.log
```

### Security Notes
- The app runs as the invoking user, not root
- The build output (`dist/`) is owned by the invoking user, not root
- Only system-level operations (apt-get, nginx config, MySQL setup) run as root
- The systemd service runs the Node.js process as the invoking user

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

### Quick Start

```bash
cd deploy/docker
docker compose up --build
# or: ./up.sh
```

Access at **http://localhost:3013**.

### ExtraHop in Docker

To enable live ExtraHop integration, uncomment and set the environment variables in `docker-compose.yml`:

```yaml
environment:
  EH_HOST: "extrahop.lab.local"
  EH_API_KEY: "your-api-key-here"
  EH_VERIFY_SSL: "false"
  ETL_INTERVAL_MS: "300000"
```

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

Or use the convenience script:

```bash
./deploy/start-local.sh
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
for route in health impact/headline impact/timeseries impact/top-talkers impact/detections impact/alerts impact/appliance-status "impact/device-activity?id=1042" topology/fixtures blast-radius/fixtures correlation/fixtures; do
  printf "  /api/bff/%-45s " "$route:"
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

All surfaces render fixture data by default. To connect to a live ExtraHop appliance, see the **ExtraHop Live Integration** section below.

---

## Environment Variables

### Required (set by bootstrap.sh or docker-compose)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Runtime mode |
| `PORT` | `3020` | App server port |
| `DATABASE_URL` | `mysql://netperf:netperf_test_2026@localhost:3306/netperf_app` | MySQL connection string |
| `JWT_SECRET` | `local-test-jwt-secret-not-for-production` | Session signing key (no auth in local deploy) |
| `VITE_APP_ID` | `local-test` | OAuth app ID (unused in local deploy) |
| `OAUTH_SERVER_URL` | (empty) | OAuth server (unused in local deploy) |
| `OWNER_OPEN_ID` | `local-test-owner` | Owner identifier |
| `OWNER_NAME` | `Local Tester` | Owner display name |
| `BUILT_IN_FORGE_API_URL` | (empty) | Manus API URL (unused in local deploy) |
| `BUILT_IN_FORGE_API_KEY` | (empty) | Manus API key (unused in local deploy) |

### ExtraHop Integration (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `EH_HOST` | (none) | ExtraHop appliance hostname (e.g., `extrahop.lab.local`) |
| `EH_API_KEY` | (none) | ExtraHop API key (from ExtraHop Admin → API Access) |
| `EH_VERIFY_SSL` | `true` | Set to `false` for self-signed certs in lab environments |

### ETL Scheduler (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ETL_INTERVAL_MS` | `300000` (5 min) | Background ETL polling interval in milliseconds |

---

## ExtraHop Live Integration

The application supports two operating modes:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Fixture Mode** | No appliance configured in Settings | All BFF routes return deterministic fixture data |
| **Live Mode** | Appliance hostname + API key saved in Settings | All BFF routes call the ExtraHop REST API via `server/extrahop-client.ts` |

### Configuring Live Mode

**Option 1: Via the Settings page (recommended)**

1. Navigate to **Settings** in the sidebar
2. Enter the ExtraHop appliance hostname (e.g., `extrahop.lab.local`)
3. Enter the ExtraHop API key (generated from ExtraHop Admin → API Access)
4. Optionally toggle SSL verification (disable for self-signed certs in lab environments)
5. Click **Save** — the configuration is stored in the `appliance_config` database table

**Option 2: Via systemd environment variables**

```bash
sudo systemctl edit netperf-app
```

Add under `[Service]`:

```ini
Environment=EH_HOST=extrahop.lab.local
Environment=EH_API_KEY=your-api-key-here
Environment=EH_VERIFY_SSL=false
```

Then restart:

```bash
sudo systemctl restart netperf-app
```

### How Live Mode Works

All BFF routes use the shared `server/extrahop-client.ts` client:

- **Authentication**: `ExtraHop apikey=<key>` header on every request
- **TTL Cache**: 30-second cache with max 500 entries to reduce API load
- **Error Handling**: `ExtraHopClientError` with codes: `NO_CONFIG`, `API_ERROR`, `TIMEOUT`, `NETWORK_ERROR`
- **Normalization**: `server/extrahop-normalizers.ts` transforms raw ExtraHop JSON into shared types

### ExtraHop API Endpoints Used

| BFF Route | ExtraHop API Call(s) |
|-----------|---------------------|
| `GET /api/bff/health` | `GET /api/v1/extrahop` (appliance probe) |
| `GET /api/bff/impact/headline` | `POST /api/v1/metrics` (net: bytes_in, bytes_out, pkts_in, pkts_out) |
| `GET /api/bff/impact/timeseries` | `POST /api/v1/metrics` (net: bytes_in, bytes_out, pkts_in, pkts_out) |
| `GET /api/bff/impact/top-talkers` | `POST /api/v1/metrics` (net: bytes_in, bytes_out) + `GET /api/v1/devices/{id}` |
| `GET /api/bff/impact/detections` | `GET /api/v1/detections` (time-filtered) |
| `GET /api/bff/impact/alerts` | `GET /api/v1/alerts` |
| `GET /api/bff/impact/appliance-status` | `GET /api/v1/extrahop` |
| `GET /api/bff/impact/device-detail` | `GET /api/v1/devices/{id}` + metrics + detections + alerts |
| `GET /api/bff/impact/detection-detail` | `GET /api/v1/detections/{id}` + participant devices |
| `GET /api/bff/impact/alert-detail` | `GET /api/v1/alerts/{id}` + associated detections/devices |
| `GET /api/bff/impact/device-activity` | `GET /api/v1/devices/{id}/activity` → normalize → upsert to DB |
| `POST /api/bff/topology/query` | `GET /api/v1/devices` + `POST /api/v1/metrics` + detections + alerts |
| `POST /api/bff/correlation/events` | `GET /api/v1/detections` + `GET /api/v1/alerts` (merged event stream) |
| `POST /api/bff/blast-radius/query` | `GET /api/v1/devices/{id}` + peers + metrics + detections |
| `POST /api/bff/trace/run` | 8-step SSE: device lookup + metrics + detections + alerts + peers |
| `POST /api/bff/packets/metadata` | `GET /api/v1/extrahop` (packet store probe) |
| `POST /api/bff/packets/download` | `POST /api/v1/packets/search` (binary PCAP proxy) |

### Network Requirements

- The **server** (Node.js) connects to ExtraHop — the browser never contacts ExtraHop directly
- HTTPS (port 443) from the server to the ExtraHop appliance
- If SSL verification is disabled, self-signed certs are accepted
- The ExtraHop API key must have read access to metrics, devices, detections, alerts, and packets

### Live Integration Status

All routes are wired with live ExtraHop API calls. However:

- **Live integration has not been tested against a real ExtraHop appliance** — this is deferred by contract
- All route implementations are validated against fixtures and schema validators
- The ExtraHop client, cache, and normalizers have 168 passing tests (55 + 113)
- Error handling covers NO_CONFIG, API_ERROR, TIMEOUT, and NETWORK_ERROR scenarios

---

## Background ETL Scheduler

When a live ExtraHop appliance is configured, the server starts a background ETL job that periodically polls device activity data from ExtraHop and upserts it into the `fact_device_activity` table. This pre-populates the Activity Timeline in the Device Inspector.

### How It Works

Each ETL cycle:
1. Queries all known devices from the `dim_device` table
2. For each device, calls `GET /api/v1/devices/{id}/activity` on the ExtraHop appliance
3. Normalizes the response via `normalizeDeviceActivity()`
4. Upserts records into `fact_device_activity` (batches of 50, ON DUPLICATE KEY UPDATE)
5. Reports status via the health endpoint (`/api/bff/health` → `etl` field)

### Error Isolation

Failures are isolated per-device. If one device's activity fetch fails, the cycle continues with the remaining devices. The health endpoint reports `lastRunDevicesFailed` count.

### Health Endpoint ETL Status

The `/api/bff/health` response includes an `etl` field (null when ETL is not running):

```json
{
  "etl": {
    "running": true,
    "lastRunAt": "2026-03-15T10:00:00.000Z",
    "lastRunDurationMs": 4523,
    "lastRunDevicesPolled": 42,
    "lastRunDevicesSucceeded": 40,
    "lastRunDevicesFailed": 2,
    "lastRunRecordsUpserted": 320,
    "totalRuns": 15,
    "totalErrors": 3,
    "intervalMs": 300000,
    "nextRunAt": "2026-03-15T10:05:00.000Z"
  }
}
```

### Device Activity Route

`GET /api/bff/impact/device-activity?id=<deviceId>&limit=50`

Returns raw activity rows for the Activity Timeline component. In live mode, fetches fresh data from ExtraHop and upserts to DB. Falls back to DB if ExtraHop is unreachable. In fixture mode, returns fixture data.

---

## Schema Notes

The `deploy/full-schema.sql` file contains 38 `CREATE TABLE` statements:

- **34 active tables** — referenced by current application code (Drizzle ORM schema, BFF routes, tRPC procedures)
- **4 legacy tables** (`alerts`, `devices`, `interfaces`, `performance_metrics`) — from the initial Drizzle migration, not referenced by current code

The `fact_device_activity` table is populated by the background ETL scheduler (when ExtraHop is configured) and by on-demand fetches in the device-detail route. In fixture mode, it remains empty and the device inspector shows fixture-backed activity data.

The `appliance_config` table will be empty on fresh install. This is correct — the app renders a "not configured" quiet state until you configure an ExtraHop appliance via the Settings page.

---

## Stopping

```bash
# If using systemd (bootstrap.sh)
sudo systemctl stop netperf-app

# If using manual start
kill $(lsof -ti:3020) 2>/dev/null

# Stop nginx (optional)
sudo systemctl stop nginx
```

---

## Troubleshooting

**"Cannot connect to MySQL"** — Ensure MySQL is running: `sudo systemctl status mysql`

**"dist/index.js not found"** — Run `pnpm build` first.

**nginx returns 502 Bad Gateway** — The app on port 3020 is not running. Start it first: `sudo systemctl start netperf-app`

**OAuth ERROR in console** — Expected and harmless. No routes require authentication.

**BFF routes return HTML instead of JSON** — You are hitting a route path that does not exist. The SPA fallback serves `index.html` for unknown paths. Check the route name (e.g., `/headline` not `/kpi`).

**App doesn't start after reboot** — Check that the systemd service is enabled: `sudo systemctl enable netperf-app`

**ETL not running** — Check the health endpoint: `curl -s http://localhost:3013/api/bff/health | python3 -m json.tool`. The `etl` field should show `running: true`. If null, no ExtraHop appliance is configured.

**Docker Compose issues** — The Docker stack is untested. If services fail to start, check `docker compose logs <service>` for details. Common issues: MySQL not ready before app starts (increase `start_period`), port conflicts on 3013/3020/3306.
