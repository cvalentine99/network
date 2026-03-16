# Architecture — Network Performance Dashboard

## Data Path Overview

The application uses a **single truthful data path** from the ExtraHop appliance to the browser. There are exactly two modes of operation, and they are mutually exclusive.

### Live Mode

When an ExtraHop appliance is configured (hostname + API key stored in `appliance_config` table), all data flows through this path:

```
Browser → BFF Route (Express) → ehRequest() → ExtraHop REST API → Normalize → JSON Response
```

The `ehRequest()` function in `server/extrahop-client.ts` is the **sole gateway** to the ExtraHop appliance. It reads the hostname and API key from the database (encrypted at rest via AES-256-GCM), constructs the URL as `https://${config.hostname}${path}`, and issues the request with a per-request undici Agent for TLS control.

### Fixture Mode

When no appliance is configured (no row in `appliance_config` or empty hostname/apiKey), the system enters fixture mode. Fixture mode serves deterministic JSON payloads from the `fixtures/` directory. This mode exists for contract-verified frontend development and testing.

The `isFixtureMode()` function in `server/extrahop-client.ts` determines the mode:

1. If environment variables `EXTRAHOP_HOSTNAME` and `EXTRAHOP_API_KEY` are set, it returns `false` (live mode).
2. Otherwise, it queries the `appliance_config` table. If no valid config exists, it returns `true` (fixture mode).

This is a **database-config-based check**, not a `NODE_ENV` check.

## SSRF Verification

No Server-Side Request Forgery (SSRF) vectors exist in the BFF routes. The verification evidence:

| Check | Result |
|-------|--------|
| All BFF routes use `ehRequest()` / `ehRequestBinary()` | 46 calls, zero direct `fetch()` |
| URL construction uses DB config only | `const url = \`https://${config.hostname}${path}\`` (lines 285, 389) |
| User-controlled params flow into URL construction | Zero matches |
| User-controlled params used for | ExtraHop API path segments, query params, request bodies — all Zod-validated |

The hostname is never derived from `req.query`, `req.params`, or `req.body`. It is always read from the encrypted `appliance_config` database row.

## TLS Handling

TLS verification is controlled per-request, scoped exclusively to ExtraHop appliance connections:

- `server/extrahop-client.ts` creates an `undici.Agent` with `connect: { rejectUnauthorized: config.verifySsl }` for each request.
- `server/routers.ts` `testConnection` uses the same `getUndiciAgent()` pattern.
- No global `NODE_TLS_REJECT_UNAUTHORIZED` is set anywhere in the codebase.
- No `@ts-ignore` is used on any fetch call.

## Authentication

### tRPC Routes

All tRPC procedures use `protectedProcedure` (requires authenticated session via Manus OAuth). The only exceptions are `publicProcedure` routes in `systemRouter` (health check) and `authRouter` (login/logout).

### BFF Routes

All `/api/bff/*` routes are protected by `requireBffAuth` middleware (`server/bff-auth-middleware.ts`). This middleware:

- Enforces authentication in **all environments** (no `NODE_ENV` bypass).
- Exempts `/api/bff/health` (status endpoint used by the DataSourceBadge).
- In fixture mode (determined by `isFixtureMode()`), allows requests with a fixture-mode header for testing. This does NOT bypass auth in live mode.

### Fixture-Mode Test Bypass

When `isFixtureMode()` returns `true`, the BFF auth middleware allows requests that include the `x-fixture-mode: true` header. This enables integration tests to call BFF routes without a real OAuth session. The bypass is:

- Only active when no ExtraHop appliance is configured (fixture mode).
- Not available in live mode regardless of any header.
- Not gated by `NODE_ENV`.

## Encryption

API keys for ExtraHop appliances are encrypted at rest using AES-256-GCM (`server/crypto.ts`). The encryption key is derived from `JWT_SECRET` via PBKDF2 with a static salt. The static salt is documented as acceptable for lab use with a strong `JWT_SECRET`.

## Schema

The database schema is defined in `drizzle/schema.ts` (35 tables). The authoritative migration chain is:

- `drizzle/0000_amusing_nomad.sql` — users table
- `drizzle/0001_free_junta.sql` — all 34 application tables
- `drizzle/0002_unique_speed_demon.sql` — polled_at default alignment

`drizzle-kit generate` reports zero pending changes, confirming schema.ts and the migration journal are in sync.

## Framework Plumbing (Do Not Delete)

The following files under `server/_core/` are platform framework wiring and must be preserved:

- `notification.ts` — Manus notification service client, imported by `systemRouter.ts`
- `systemRouter.ts` — provides `system.health` and `system.notifyOwner` tRPC procedures
- `oauth.ts`, `context.ts`, `trpc.ts`, `env.ts` — OAuth, tRPC context, and environment wiring
