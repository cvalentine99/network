# ============================================================
# Dockerfile — Network Performance Dashboard
# ============================================================
# Build:  docker build -f deploy/Dockerfile -t netperf-noc .
# Run:    docker run --env-file .env -p 3000:3000 netperf-noc
# ============================================================

# ---------- Stage 1: Install + Build ----------
FROM node:22-slim AS builder

RUN npm install -g pnpm

WORKDIR /app

# Copy package files first for layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build frontend (Vite) and server (esbuild)
RUN pnpm build

# ---------- Stage 2: Production image ----------
FROM node:22-slim AS runner

RUN npm install -g pnpm

WORKDIR /app

# Copy package files and install production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy migration files (for runtime migration if needed)
COPY drizzle/*.sql ./drizzle/
COPY drizzle/schema.ts ./drizzle/
COPY drizzle/relations.ts ./drizzle/

# Copy fixture data (for fixture mode)
COPY server/fixtures ./server/fixtures

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 netperf && \
    chown -R netperf:nodejs /app
USER netperf

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "dist/index.js"]
