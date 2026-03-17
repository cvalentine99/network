/**
 * BFF Auth Middleware
 *
 * Express middleware that enforces authentication on all BFF routes.
 * Uses the same sdk.authenticateRequest() as the tRPC protectedProcedure,
 * ensuring a single auth path for both tRPC and Express BFF layers.
 *
 * SECURITY: Auth is enforced in ALL environments when running in live mode.
 * In fixture mode (no ExtraHop appliance configured), auth is bypassed
 * because there is no sensitive data to protect — only deterministic fixtures.
 *
 * Unauthenticated requests in live mode receive 401 with a JSON body.
 * The middleware attaches the authenticated user to req.user for
 * downstream route handlers.
 *
 * HOSTILE-REPAIR (2026-03-16): Removed NODE_ENV !== 'production' bypass.
 * Auth bypass based on environment variable is a security defect.
 * Fixture-mode bypass is acceptable because fixture data is deterministic
 * and contains no real network telemetry.
 */
import type { Request, Response, NextFunction } from 'express';
import type { User } from '../drizzle/schema';
import { sdk } from './_core/sdk';
import { isFixtureModeSync } from './extrahop-client';

/** Extend Express Request to carry the authenticated user */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Require a valid session cookie in live mode. Returns 401 JSON on failure.
 * Attaches `req.user` on success.
 *
 * In fixture mode, auth is bypassed — fixture data is deterministic and
 * contains no real network telemetry. This allows integration tests to
 * exercise BFF routes without requiring authentication infrastructure.
 *
 * Enforced in live mode in ALL environments — no dev/test bypass.
 */
export async function requireBffAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Fixture mode: bypass auth — no real data to protect
  // BE-C2: Set synthetic user so downstream handlers always find req.user
  if (isFixtureModeSync()) {
    req.user = {
      id: 0,
      openId: 'fixture-user',
      name: 'Fixture User',
      email: 'fixture@localhost',
      loginMethod: 'fixture',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as User;
    return next();
  }

  // Live mode: require authentication
  try {
    const user = await sdk.authenticateRequest(req);
    if (user) {
      req.user = user;
      return next();
    }
  } catch {
    // Auth failed — fall through to 401 below
  }

  // Hard-reject unauthenticated requests in live mode
  res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
}
