# server/_core — Manus Platform Template (DO NOT MODIFY)

This directory is **Manus platform boilerplate** — it is generated and maintained by the
Manus web application framework, not by the network-performance-app project team.

## What lives here

| File | Purpose |
|---|---|
| `context.ts` | tRPC context builder (injects `ctx.user`) |
| `cookies.ts` | Session cookie configuration |
| `env.ts` | Environment variable accessor (`ENV.cookieSecret`, etc.) |
| `index.ts` | Express server bootstrap and route registration |
| `llm.ts` | LLM helper (`invokeLLM`) |
| `oauth.ts` | Manus OAuth callback handler |
| `sdk.ts` | Manus SDK client |
| `systemRouter.ts` | Built-in system tRPC routes |
| `trpc.ts` | tRPC router/procedure factories |
| `vite.ts` | Vite dev/prod middleware |
| `notification.ts` | Owner notification helper |
| `map.ts` | Google Maps proxy |
| `imageGeneration.ts` | Image generation helper |
| `dataApi.ts` | External data API helper |
| `voiceTranscription.ts` | Audio transcription helper |

## Why we do not modify these files

1. The project README explicitly warns: *"Anything under `server/_core` is framework-level — avoid editing unless you are extending the infrastructure."*
2. Platform updates may overwrite local changes without warning.
3. Security-sensitive defaults (JWT handling, OAuth flow) are managed by the platform team.

## Audit note (M3)

The comprehensive codebase audit flagged `env.ts` line 3 (`cookieSecret: process.env.JWT_SECRET ?? ""`)
as an empty-string fallback risk. This is a platform-level default — `JWT_SECRET` is always injected
at runtime by the Manus deployment system. Our application-level guard is in `server/crypto.ts`,
which throws on empty `JWT_SECRET` before any encryption operation.

If you need to add application-specific server utilities, create them in `server/` (not `server/_core/`).
