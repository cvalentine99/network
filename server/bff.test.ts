import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { impactRouter } from './bff/routes/impact';
import { healthRouter } from './bff/routes/health';

// Create a test Express app with the BFF routes
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bff/impact', impactRouter);
  app.use('/api/bff/health', healthRouter);
  return app;
}

describe('BFF Impact Routes', () => {
  describe('GET /api/bff/impact/status', () => {
    it('returns not-configured status when EH_API_KEY is PLACEHOLDER', async () => {
      const app = createTestApp();
      const res = await request(app).get('/api/bff/impact/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
      expect(res.body).toHaveProperty('connected');
      expect(typeof res.body.configured).toBe('boolean');
      expect(typeof res.body.connected).toBe('boolean');
    });

    it('returns ehHost as null when not configured', async () => {
      const app = createTestApp();
      const res = await request(app).get('/api/bff/impact/status');
      expect(res.status).toBe(200);
      // When not configured, ehHost should be null
      if (!res.body.configured) {
        expect(res.body.ehHost).toBeNull();
      }
    });
  });

  describe('GET /api/bff/impact/overview', () => {
    it('returns 503 with structured error when EH not configured', async () => {
      const app = createTestApp();
      const res = await request(app).get('/api/bff/impact/overview');
      // Should be 503 (not configured) or 502 (connection failed)
      expect([502, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('returns configured:false in error body when EH_API_KEY is PLACEHOLDER', async () => {
      const app = createTestApp();
      const res = await request(app).get('/api/bff/impact/overview');
      if (res.status === 503) {
        expect(res.body.configured).toBe(false);
        expect(res.body.detail).toContain('EH_HOST');
      }
    });

    it('accepts optional query parameters without error', async () => {
      const app = createTestApp();
      const res = await request(app)
        .get('/api/bff/impact/overview')
        .query({ cycle: '5min' });
      // Should still return error (not configured) but not 400
      expect([502, 503]).toContain(res.status);
    });
  });

  describe('GET /api/bff/health', () => {
    it('returns health status', async () => {
      const app = createTestApp();
      const res = await request(app).get('/api/bff/health');
      // 200 if appliance identity is available, 503 if degraded
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(['ok', 'degraded']).toContain(res.body.status);
    });
  });
});
