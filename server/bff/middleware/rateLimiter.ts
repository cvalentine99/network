// server/bff/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // Suppress X-Forwarded-For warning — the main Express server handles trust proxy
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many requests, please try again later.' },
});
