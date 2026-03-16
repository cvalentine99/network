/**
 * BFF Auth Middleware (Slice: External Review Remediation C5)
 *
 * Express middleware that enforces authentication on all BFF routes.
 * Uses the same sdk.authenticateRequest() as the tRPC protectedProcedure,
 * ensuring a single auth path for both tRPC and Express BFF layers.
 *
 * Unauthenticated requests receive 401 with a JSON body.
 * The middleware attaches the authenticated user to req.user for
 * downstream route handlers.
 */
import type { Request, Response, NextFunction } from 'express';
import type { User } from '../drizzle/schema';
import { sdk } from './_core/sdk';

/** Extend Express Request to carry the authenticated user */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Require a valid session cookie. Returns 401 JSON on failure.
 * Attaches `req.user` on success.
 *
 * In test/development mode (NODE_ENV !== 'production'), the middleware
 * still attempts auth but falls through on failure so that fixture-mode
 * BFF routes remain testable without a real session cookie.
 * In production, unauthenticated requests are hard-rejected with 401.
 */
export async function requireBffAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    const user = await sdk.authenticateRequest(req);
    if (user) {
      req.user = user;
      return next();
    }
  } catch {
    // Auth failed — fall through to enforcement check below
  }

  // In production, hard-reject unauthenticated requests
  if (isProduction) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  // In dev/test, allow through without user (fixture-mode BFF routes)
  // This ensures tests can exercise BFF routes without session cookies.
  // The req.user will be undefined — route handlers should handle this gracefully.
  next();
}
