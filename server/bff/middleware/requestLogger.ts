// server/bff/middleware/requestLogger.ts
import type { Request, Response, NextFunction } from 'express';

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const elapsed = Date.now() - start;
      if (req.path !== '/api/health') {
        console.log(`[BFF] ${req.method} ${req.path} → ${res.statusCode} (${elapsed}ms)`);
      }
    });
    next();
  };
}
