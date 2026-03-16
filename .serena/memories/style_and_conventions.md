# Style and Conventions

## TypeScript
- Strict mode enabled
- ES modules (type: module in package.json)
- Path aliases: @/* -> client/src/*, @shared/* -> shared/*
- Zod v4 for runtime validation
- Shared types in shared/ used by both client and server

## Code Style (Prettier)
- Semicolons: yes
- Trailing commas: es5
- Single quotes: no (double quotes)
- Print width: 80
- Tab width: 2
- Arrow parens: avoid

## Naming Conventions
- Files: kebab-case for shared types (topology-types.ts), PascalCase for React components (ForceGraph.tsx)
- Test files: sliceNN.test.ts or sliceNN-feature-name.test.ts
- Fixture files: feature.state.fixture.json (e.g. topology.populated.fixture.json)
- Types: PascalCase (TopologyNode, BlastRadiusPayload)
- Validators: PascalCase + Schema suffix (TopologyPayloadSchema)

## Architecture Patterns
- BFF routes in server/routes/*.ts
- tRPC procedures in server/routers.ts
- React hooks for data fetching in client/src/hooks/
- Shared validators enforce contracts between client and server
- Fixture-first development: every feature has populated, quiet, error, malformed fixtures

## Testing
- Vitest with node environment
- Tests in server/*.test.ts
- Schema validation tests, normalization tests, source code contract tests
- No mock data — deterministic fixtures only