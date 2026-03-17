/**
 * Environment variable configuration with startup validation.
 *
 * Rec 1: JWT_SECRET is validated at import time — server will not start
 * with a weak or missing secret in production.
 */

const jwtSecret = process.env.JWT_SECRET ?? "";

// Validate JWT_SECRET at startup (Rec 1)
if (process.env.NODE_ENV === "production" && jwtSecret.length < 32) {
  console.error(
    "[FATAL] JWT_SECRET must be at least 32 characters in production. " +
    "Generate one with: openssl rand -hex 32"
  );
  process.exit(1);
}

if (jwtSecret.length > 0 && jwtSecret.length < 16) {
  console.warn(
    "[WARN] JWT_SECRET is shorter than 16 characters. " +
    "This is insecure. Generate a strong secret: openssl rand -hex 32"
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: jwtSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

// SEC-C1: Validate JWT_SECRET at startup — refuse to start with weak/missing secret in production
if (ENV.isProduction && (!ENV.cookieSecret || ENV.cookieSecret.length < 32)) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters in production');
  process.exit(1);
}
if (!ENV.cookieSecret) {
  console.warn('[SECURITY] JWT_SECRET is not set. Using empty secret is only acceptable in development.');
}
