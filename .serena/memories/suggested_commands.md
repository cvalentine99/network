# Suggested Commands

## Development
pnpm dev — Start dev server (tsx watch)
pnpm build — Build for production (vite + esbuild)
pnpm start — Run production build

## Testing
pnpm test — Run all Vitest tests (vitest run)
npx vitest run server/sliceNN.test.ts — Run specific slice tests

## Type Checking
npx tsc --noEmit — Full TypeScript check

## Formatting
pnpm format — Prettier format all files

## Database
pnpm db:push — Generate and apply Drizzle migrations

## System
git, ls, cd, grep, find, cat, head, tail, wc — Standard Linux utils