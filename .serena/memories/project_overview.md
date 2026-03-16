# Network Performance App

NOC-style network performance monitoring dashboard for ExtraHop appliance data.

Surfaces: Impact Deck, Flow Theater, Blast Radius, Correlation, Topology, Inspector.

Currently in frontend/BFF contract phase. All data flows through fixture-backed BFF routes.

Tech: React 19, TypeScript 5.9, Tailwind 4, Vite 7, wouter, Recharts, D3, shadcn/ui, Express 4, tRPC 11, Drizzle ORM, Vitest, pnpm 10.

BFF Pattern: Browser never contacts ExtraHop directly. All data goes through /api/bff/* routes.

Shared types in shared/ directory. Fixtures in fixtures/ directory. Tests in server/*.test.ts.