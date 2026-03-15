# ─── Stage 1: Build ───
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests first for layer caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build production bundle
RUN pnpm build

# ─── Stage 2: Production ───
FROM node:22-slim AS production

WORKDIR /app

# Install curl for healthcheck (node:22-slim does not include it)
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm for production install
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Copy fixtures (BFF routes load these at runtime via readFileSync + process.cwd())
COPY --from=builder /app/fixtures ./fixtures

# Copy shared types (some routes import from shared/)
COPY --from=builder /app/shared ./shared

# Copy drizzle schema (needed for db connection)
COPY --from=builder /app/drizzle ./drizzle

# Create non-root user for running the app
RUN groupadd --gid 1001 netperf && \
    useradd --uid 1001 --gid netperf --shell /bin/sh --create-home netperf && \
    chown -R netperf:netperf /app

# No OAuth — all surfaces accessible without authentication
ENV NODE_ENV=production
ENV PORT=3020
ENV OAUTH_SERVER_URL=""
ENV VITE_APP_ID="local-test"
ENV JWT_SECRET="local-test-jwt-secret-not-for-production"
ENV OWNER_OPEN_ID="local-test-owner"
ENV OWNER_NAME="Local Tester"
ENV BUILT_IN_FORGE_API_URL=""
ENV BUILT_IN_FORGE_API_KEY=""

# ExtraHop configuration (override at runtime via docker-compose or -e flags)
# ENV EH_HOST=extrahop.lab.local
# ENV EH_API_KEY=your-api-key-here
# ENV EH_VERIFY_SSL=false

# ETL scheduler configuration (default: 5 minutes)
# ENV ETL_INTERVAL_MS=300000

EXPOSE 3020

# Run as non-root
USER netperf

# Health check: BFF health route
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3020/api/bff/health || exit 1

CMD ["node", "dist/index.js"]
