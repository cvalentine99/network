// server/bff/routes/health.ts
import { Router } from 'express';
import { getApplianceIdentity } from '../lib/ehClient';
import { cacheStats } from '../lib/cache';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  try {
    const identity = getApplianceIdentity();
    res.json({
      status: 'ok',
      bff: {
        uptime: process.uptime(),
        memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        cache: cacheStats(),
      },
      appliance: {
        version: identity.version,
        edition: identity.edition,
        platform: identity.platform,
        hostname: identity.hostname,
        captureName: identity.captureName,
        licensedModules: identity.licensedModules.length,
      },
    });
  } catch {
    res.status(503).json({ status: 'degraded', error: 'Appliance identity not available' });
  }
});
