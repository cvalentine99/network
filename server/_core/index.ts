import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { healthRouter } from "../routes/health";
import { impactRouter } from "../routes/impact";
import { packetsRouter } from "../routes/packets";
import { traceRouter } from "../routes/trace";
import { blastRadiusRouter } from "../routes/blast-radius";
import { default as correlationRouter } from "../routes/correlation";
import topologyRouter from "../routes/topology";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startEtlScheduler } from "../etl-scheduler";
import { requireBffAuth } from "../bff-auth-middleware";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Security middleware (Rec 1) ───────────────────────────────────────
  // helmet sets secure HTTP headers: X-Content-Type-Options, X-Frame-Options,
  // X-XSS-Protection, Strict-Transport-Security, etc.
  // CSP is relaxed for Vite dev mode ('unsafe-inline', 'unsafe-eval') and
  // for the dashboard's inline styles/scripts.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
        },
      },
      // HSTS only when behind TLS-terminating proxy
      strictTransportSecurity: process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
    })
  );

  // ─── Rate limiting (Rec 2) ─────────────────────────────────────────
  // Applied to API routes only — static assets are not rate-limited.
  // In development mode, rate limits are generous to avoid blocking test suites.
  const isDev = process.env.NODE_ENV === 'development';
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDev ? 10000 : 120,   // generous in dev, strict in prod
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  const bffLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isDev ? 10000 : 60,    // generous in dev, strict in prod
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  app.use('/api/trpc', apiLimiter);
  app.use('/api/bff', bffLimiter);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // BFF routes (browser → BFF → ExtraHop; browser never contacts ExtraHop directly)
  // All BFF routes require authentication (audit C5)
  app.use('/api/bff', requireBffAuth);
  app.use('/api/bff/health', healthRouter);
  app.use('/api/bff/impact', impactRouter);
  app.use('/api/bff/packets', packetsRouter);
  app.use('/api/bff/trace', traceRouter);
  app.use('/api/bff/blast-radius', blastRadiusRouter);
  app.use('/api/bff/correlation', correlationRouter);
  app.use('/api/bff/topology', topologyRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start background ETL after server is listening
    startEtlScheduler();
  });
}

startServer().catch(console.error);
