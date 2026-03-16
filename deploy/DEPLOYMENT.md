# Network Performance Dashboard — Deployment Guide

**Version:** dfbd40c6  
**Date:** 2026-03-16  
**Stack:** Node.js 22 + Express 4 + tRPC 11 + React 19 + Vite 7 + MySQL 8 + Drizzle ORM

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Deployment Options](#2-deployment-options)
3. [Option A: One-Command Bootstrap (Bare Metal)](#3-option-a-one-command-bootstrap-bare-metal)
4. [Option B: Docker Compose (Recommended)](#4-option-b-docker-compose-recommended)
5. [Option C: Manual Step-by-Step](#5-option-c-manual-step-by-step)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [Database Schema](#7-database-schema)
8. [ExtraHop Appliance Configuration](#8-extrahop-appliance-configuration)
9. [Nginx and SSL](#9-nginx-and-ssl)
10. [Operations](#10-operations)
11. [Troubleshooting](#11-troubleshooting)
12. [File Manifest](#12-file-manifest)

---

## 1. Prerequisites

The following table lists the minimum requirements for deploying the application. All versions listed are the minimum tested; newer patch releases are expected to work.

| Requirement | Minimum Version | Purpose |
|---|---|---|
| Node.js | 20.x (22.x recommended) | Runtime for server and build tooling |
| pnpm | 9.x | Package manager (npm/yarn will not resolve the lockfile) |
| MySQL | 8.0 | Primary data store (TiDB also supported) |
| Docker + Compose | 24.x + 2.x | Only required for Docker deployment path |
| curl | any | Used by health-check script |
| bash | 4.x+ | All scripts use bash |

The application runs on a single port (default 3000) and serves both the API and the static frontend from the same Express process. There is no separate frontend server.

---

## 2. Deployment Options

Three deployment paths are provided, ordered from simplest to most manual.

| Option | Best For | Time to Deploy | Requires Docker |
|---|---|---|---|
| **A. One-Command Bootstrap** | Bare metal / VM with MySQL already running | ~3 minutes | No |
| **B. Docker Compose** | Clean machine, no MySQL installed | ~5 minutes | Yes |
| **C. Manual Step-by-Step** | Custom environments, debugging, CI pipelines | ~10 minutes | No |

All three paths produce the same result: a production Node.js process serving the dashboard on the configured port, connected to a MySQL database with the correct schema applied.

---

## 3. Option A: One-Command Bootstrap (Bare Metal)

This path assumes you have a running MySQL 8 instance and want to deploy directly on the host.

### Step 1: Extract and configure

```bash
unzip network-performance-app-deploy.zip -d network-performance-app
cd network-performance-app

# Create your environment file from the template
cp deploy/env.example .env

# Edit .env — at minimum set DATABASE_URL and JWT_SECRET
nano .env
```

### Step 2: Run bootstrap

```bash
chmod +x deploy/*.sh
./deploy/bootstrap.sh
```

The bootstrap script executes five stages in sequence: dependency installation, database migration, production build, server start (daemon mode), and health check verification. If any stage fails, the script stops immediately with an error message indicating what went wrong.

### Step 3: Verify

```bash
curl http://localhost:3000/
```

The server is running. The dashboard is accessible at `http://localhost:3000`.

---

## 4. Option B: Docker Compose (Recommended)

This path provisions MySQL, the application, and an Nginx reverse proxy in containers. The database schema is applied automatically on first start via MySQL's `docker-entrypoint-initdb.d` mechanism.

### Step 1: Extract and configure

```bash
unzip network-performance-app-deploy.zip -d network-performance-app
cd network-performance-app

cp deploy/env.example .env
nano .env
```

For Docker Compose, you can use the default `DATABASE_URL` since the compose file overrides it with the internal service connection. However, you must set `JWT_SECRET` and any Manus OAuth variables you need.

You may also set these Docker-specific variables in `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | `netperf_root_pass` | MySQL root password |
| `MYSQL_DATABASE` | `network_perf` | Database name |
| `MYSQL_USER` | `netperf` | Application DB user |
| `MYSQL_PASSWORD` | `netperf_pass` | Application DB password |

### Step 2: Build and start

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

Docker Compose will:
1. Start MySQL and wait for the health check to pass
2. Auto-apply both migration SQL files (`0000_amusing_nomad.sql` and `0001_free_junta.sql`) on first start
3. Build the application image (multi-stage: install → build → slim production image)
4. Start the application container once MySQL is healthy
5. Start Nginx once the application health check passes

### Step 3: Verify

```bash
# Check all containers are healthy
docker compose -f deploy/docker-compose.yml ps

# Check the app responds
curl http://localhost/

# View application logs
docker compose -f deploy/docker-compose.yml logs -f app
```

### Stopping and restarting

```bash
# Stop everything
docker compose -f deploy/docker-compose.yml down

# Stop and destroy data (fresh start)
docker compose -f deploy/docker-compose.yml down -v

# Restart just the app (after code changes)
docker compose -f deploy/docker-compose.yml up -d --build app
```

---

## 5. Option C: Manual Step-by-Step

Use this path when you need full control over each stage, or when integrating into a CI/CD pipeline.

### Step 1: Install system dependencies

```bash
# Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# MySQL client (for migration script)
sudo apt-get install -y mysql-client
```

### Step 2: Install project dependencies

```bash
cd network-performance-app
pnpm install --frozen-lockfile
```

### Step 3: Configure environment

```bash
cp deploy/env.example .env
nano .env
# Fill in DATABASE_URL, JWT_SECRET, and other required values
```

### Step 4: Apply database migrations

```bash
# Option A: Use the migration script
chmod +x deploy/migrate.sh
./deploy/migrate.sh

# Option B: Apply SQL files directly
mysql -h HOST -u USER -pPASS DATABASE < drizzle/0000_amusing_nomad.sql
mysql -h HOST -u USER -pPASS DATABASE < drizzle/0001_free_junta.sql
```

### Step 5: TypeScript check and build

```bash
# Type check (optional but recommended)
npx tsc --noEmit

# Build frontend + server
pnpm build
```

This produces:
- `dist/index.js` — server bundle (Express + tRPC + BFF routes)
- `dist/public/` — frontend bundle (React SPA)

### Step 6: Start the server

```bash
# Foreground (for debugging)
source .env && NODE_ENV=production node dist/index.js

# Background (daemon)
chmod +x deploy/start.sh
./deploy/start.sh --daemon
```

### Step 7: Health check

```bash
chmod +x deploy/health-check.sh
./deploy/health-check.sh
```

---

## 6. Environment Variables Reference

The following table documents every environment variable the application reads. Variables prefixed with `VITE_` are embedded into the frontend bundle at build time; all others are server-side only.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the server listens on |
| `NODE_ENV` | Yes | — | Must be `production` for deployed instances |
| `DATABASE_URL` | Yes | — | MySQL connection string: `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Yes | — | Session cookie signing secret (min 32 random chars) |
| `VITE_APP_ID` | Yes | — | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Yes | `https://api.manus.im` | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Yes | `https://id.manus.im` | Manus login portal URL (frontend) |
| `OWNER_OPEN_ID` | No | — | Owner's Manus OpenID for admin checks |
| `OWNER_NAME` | No | — | Owner display name |
| `BUILT_IN_FORGE_API_URL` | No | — | Server-side Forge API URL |
| `BUILT_IN_FORGE_API_KEY` | No | — | Server-side Forge API bearer token |
| `VITE_FRONTEND_FORGE_API_URL` | No | — | Frontend Forge API URL |
| `VITE_FRONTEND_FORGE_API_KEY` | No | — | Frontend Forge API bearer token |
| `EH_HOST` | No | — | ExtraHop appliance hostname (overrides DB config) |
| `EH_API_KEY` | No | — | ExtraHop API key (overrides DB config) |
| `ETL_INTERVAL_MS` | No | `300000` | ETL polling interval in milliseconds |
| `VITE_APP_TITLE` | No | `NetPerf NOC` | Browser tab title |
| `VITE_APP_LOGO` | No | — | Logo URL for the sidebar |

---

## 7. Database Schema

The application uses Drizzle ORM with MySQL. The schema is defined in `drizzle/schema.ts` and applied via two migration files.

| Migration | File | Tables Created | Purpose |
|---|---|---|---|
| 0000 | `0000_amusing_nomad.sql` | 1 (users) | Authentication and user management |
| 0001 | `0001_free_junta.sql` | 34 | Full ExtraHop data model: raw layer, dimension tables, fact tables, bridge tables, snapshot tables, appliance config |

The 34 domain tables follow a star-schema pattern:

- **Raw layer:** `raw_api_response` — stores raw ExtraHop API responses
- **Dimension tables:** `dim_device`, `dim_network`, `dim_protocol`, `dim_alert`, `dim_detection`, `dim_software`, `dim_tag`, `dim_appliance`, `dim_activity_group`, `dim_vlan`
- **Fact tables:** `fact_metric_l2`, `fact_metric_response`, `fact_metric_dns`, `fact_metric_custom`, `fact_detection_event`, `fact_alert_event`
- **Bridge tables:** `bridge_device_protocol`, `bridge_device_network`, `bridge_device_tag`, `bridge_device_activity_group`, `bridge_device_vlan`, `bridge_device_peer`
- **Snapshot tables:** `snap_device_software`, `snap_device_detail`, `snap_network_membership`, `snap_top_talker`
- **Config tables:** `appliance_config`, `etl_run_log`, `watchlist`
- **Correlation:** `correlation_event`

Drizzle relations are defined in `drizzle/relations.ts` with 20 relation definitions covering all foreign key paths.

---

## 8. ExtraHop Appliance Configuration

The application connects to an ExtraHop appliance for live network data. Configuration can be provided in two ways:

**Method 1: Environment variables** — Set `EH_HOST` and `EH_API_KEY` in `.env`. These override any database-stored configuration.

**Method 2: Settings page** — Navigate to `/settings` in the dashboard UI. The Appliance Settings page provides a form to enter the hostname, API key, and TLS verification toggle. Configuration is encrypted at rest using AES-256-GCM and stored in the `appliance_config` table.

The TLS verification toggle (`verifySsl`) controls whether the application verifies the ExtraHop appliance's TLS certificate. When disabled, HTTPS is still used — only certificate verification is bypassed. This is scoped narrowly to the ExtraHop connection using a per-request `https.Agent` and does not affect `NODE_TLS_REJECT_UNAUTHORIZED` globally. This is appropriate for self-signed lab appliances only.

When no appliance is configured, the application operates in **fixture mode**, serving deterministic fixture data from `server/fixtures/`. The sidebar displays a "FIXTURE MODE — DEMO DATA" indicator.

---

## 9. Nginx and SSL

The Docker Compose stack includes an Nginx reverse proxy with the following features:

- Rate limiting: 30 req/s for tRPC routes, 10 req/s for BFF routes (with burst allowance)
- SSE support: `proxy_buffering off` for Flow Theater trace streaming
- Static asset caching: 1-year immutable cache headers for `/assets/`
- WebSocket upgrade headers for future real-time features

To enable SSL, edit `deploy/nginx.conf`:
1. Uncomment the HTTPS redirect in the port 80 server block
2. Uncomment the port 443 server block
3. Mount your SSL certificates in `docker-compose.yml`

For Let's Encrypt:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

Then update the volume mounts in `docker-compose.yml` to point to the generated certificate files.

---

## 10. Operations

### Starting and stopping

```bash
# Bare metal
./deploy/start.sh --daemon    # Start in background
./deploy/stop.sh              # Stop gracefully
./deploy/start.sh             # Start in foreground (Ctrl+C to stop)

# Docker
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml down
```

### Health checks

```bash
# Bare metal
./deploy/health-check.sh

# Docker
docker compose -f deploy/docker-compose.yml ps
```

### Logs

```bash
# Bare metal
tail -f netperf.log

# Docker
docker compose -f deploy/docker-compose.yml logs -f app
docker compose -f deploy/docker-compose.yml logs -f db
docker compose -f deploy/docker-compose.yml logs -f nginx
```

### Database backup

```bash
# Bare metal
mysqldump -h HOST -u USER -pPASS DATABASE > backup_$(date +%Y%m%d).sql

# Docker
docker compose -f deploy/docker-compose.yml exec db \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" network_perf > backup_$(date +%Y%m%d).sql
```

### Updating the application

```bash
# 1. Pull new code
# 2. Install deps
pnpm install --frozen-lockfile

# 3. Apply any new migrations
./deploy/migrate.sh

# 4. Rebuild
./deploy/build.sh

# 5. Restart
./deploy/stop.sh && ./deploy/start.sh --daemon

# Docker: just rebuild
docker compose -f deploy/docker-compose.yml up -d --build app
```

---

## 11. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `ECONNREFUSED` on startup | MySQL not running or unreachable | Verify `DATABASE_URL` in `.env`, check MySQL is running |
| `401 Unauthorized` on all routes | Missing or invalid `JWT_SECRET` | Set a random 32+ char string in `.env` |
| Blank page in browser | Build not run, or `dist/public/` missing | Run `./deploy/build.sh` |
| `FIXTURE MODE` banner in sidebar | No ExtraHop appliance configured | Configure via `/settings` page or set `EH_HOST`/`EH_API_KEY` in `.env` |
| Port already in use | Another process on port 3000 | Change `PORT` in `.env` or stop the other process |
| Docker build fails at `pnpm install` | Missing `pnpm-lock.yaml` | Ensure the lockfile is included in the zip |
| Health check fails on BFF routes | Server not fully started | Wait 5 seconds and retry; check `netperf.log` for errors |
| `DatabaseUnavailableError` in UI | Database connection dropped | Check MySQL is running, verify `DATABASE_URL`, check network connectivity |
| SSL certificate errors to ExtraHop | Self-signed cert on appliance | Set `verifySsl: false` in Settings page (HTTPS still used) |

---

## 12. File Manifest

The `deploy/` directory contains the following files:

| File | Purpose | Executable |
|---|---|---|
| `bootstrap.sh` | One-command full deployment pipeline | Yes |
| `install.sh` | Install Node.js, pnpm, MySQL client, project deps | Yes |
| `migrate.sh` | Parse DATABASE_URL, test connection, apply SQL migrations | Yes |
| `build.sh` | TypeScript check + Vite frontend build + esbuild server bundle | Yes |
| `start.sh` | Start production server (foreground or `--daemon` mode) | Yes |
| `stop.sh` | Graceful shutdown of daemon process | Yes |
| `health-check.sh` | Verify all endpoints respond correctly | Yes |
| `env.example` | Environment variable template with documentation | No |
| `Dockerfile` | Multi-stage Docker image (build → slim production) | No |
| `docker-compose.yml` | Full stack: MySQL + App + Nginx with health checks | No |
| `nginx.conf` | Reverse proxy with rate limiting, SSE support, caching | No |
| `.dockerignore` | Excludes node_modules, .git, logs from Docker context | No |
| `DEPLOYMENT.md` | This document | No |
