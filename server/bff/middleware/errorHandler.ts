// server/bff/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';

export function errorHandler() {
  return (err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal server error';

    console.error(`[BFF Error] ${status}: ${message}`, err.stack ? err.stack.split('\n')[1] : '');

    res.status(status).json({
      error: message,
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
}
