# Fresh Deployment Bundle Audit — Slice 27b

Audit started: reading every file from scratch, no assumptions.

## File Inventory

| File | Size | Purpose |
|------|------|---------|
| deploy/bootstrap.sh | 19K | One-command bare-metal installer |
| deploy/DEPLOY.md | 11K | Deployment guide |
| deploy/full-schema.sql | 22K | Complete MySQL schema (38 tables) |
| deploy/nginx-netperf.conf | 662B | Bare-metal nginx config |
| deploy/start-local.sh | 3.6K | Manual start helper |
| deploy/docker/Dockerfile | 2.1K | Multi-stage Docker build |
| deploy/docker/docker-compose.yml | 2.6K | Full Docker stack |
| deploy/docker/mysql-init/01-schema.sql | 21K | Docker MySQL auto-init schema |
| deploy/docker/mysql-init/02-verify.sql | 1.1K | Docker MySQL verification |
| deploy/docker/nginx.conf | 653B | Docker nginx config |
| deploy/docker/up.sh | 6.0K | Docker start script |
| deploy/docker/down.sh | 759B | Docker stop script |

## bootstrap.sh Audit

### FINDINGS:

