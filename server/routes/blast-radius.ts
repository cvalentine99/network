/**
 * BFF Blast Radius Routes — /api/bff/blast-radius/*
 *
 * Slice 18: POST /api/bff/blast-radius/query
 * Returns the blast radius for a given device — all peer devices,
 * protocols, detections, and impact scores.
 *
 * DECONTAMINATION (Slice 28):
 *   - Live mode already returns 501 NOT_IMPLEMENTED (was honest)
 *   - Sentinel routing gated behind NODE_ENV !== 'production'
 *   - Fixture listing endpoint gated behind NODE_ENV !== 'production'
 *   - No fixture file is ever loaded when EH_HOST + EH_API_KEY are configured
 */

import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { BlastRadiusIntentSchema, BlastRadiusPayloadSchema } from '../../shared/blast-radius-validators';

const blastRadiusRouter = Router();

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Determine if we are in fixture mode (no live ExtraHop configured).
 */
function isFixtureMode(): boolean {
  const host = process.env.EH_HOST;
  const key = process.env.EH_API_KEY;
  return !host || !key || host === '' || key === '' || key === 'REPLACE_ME';
}

/**
 * Load a blast radius fixture file.
 * Returns the parsed JSON or null if not found/invalid.
 */
function loadFixture(name: string): any | null {
  try {
    const fixturePath = join(process.cwd(), 'fixtures', 'blast-radius', name);
    if (!existsSync(fixturePath)) return null;
    const raw = readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Select the appropriate fixture based on entry mode and value.
 * Sentinel values are ONLY used in dev/test, never in production.
 */
function selectFixture(mode: string, value: string): { fixture: string; isError: boolean } {
  // Sentinel routing: only in dev/test
  if (isDev) {
    // Error sentinel: unknown device
    if (value === 'unknown.invalid' || value === '0' || value === '0.0.0.0') {
      return { fixture: 'blast-radius.error.fixture.json', isError: true };
    }

    // Quiet sentinel: idle device
    if (value === 'quiet.lab.local' || value === '9999' || value === '10.1.20.254') {
      return { fixture: 'blast-radius.quiet.fixture.json', isError: false };
    }

    // Transport error sentinel
    if (value === 'transport.fail' || value === '99999') {
      return { fixture: 'blast-radius.transport-error.fixture.json', isError: true };
    }
  }

  // Entry-mode-specific fixtures
  switch (mode) {
    case 'hostname':
      return { fixture: 'blast-radius.hostname-entry.fixture.json', isError: false };
    case 'ip-address':
      return { fixture: 'blast-radius.ip-entry.fixture.json', isError: false };
    case 'device-id':
    default:
      return { fixture: 'blast-radius.populated.fixture.json', isError: false };
  }
}

/**
 * POST /api/bff/blast-radius/query
 */
blastRadiusRouter.post('/query', (req, res) => {
  // Validate the request body
  const parseResult = BlastRadiusIntentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'INVALID_BLAST_RADIUS_INTENT',
      message: 'Invalid blast radius query intent',
      details: parseResult.error.issues,
    });
    return;
  }

  const intent = parseResult.data;

  // ── LIVE MODE GATE ──
  if (!isFixtureMode()) {
    res.status(501).json({
      error: 'LIVE_NOT_IMPLEMENTED',
      message: 'Live blast radius integration not yet implemented. ExtraHop API calls are not wired.',
      code: 'LIVE_NOT_IMPLEMENTED',
    });
    return;
  }

  // ── FIXTURE MODE ──
  const { fixture: fixtureName, isError } = selectFixture(intent.mode, intent.value);
  const fixtureData = loadFixture(fixtureName);

  if (!fixtureData) {
    res.status(500).json({
      error: 'FIXTURE_NOT_FOUND',
      message: `Fixture not found: ${fixtureName}`,
    });
    return;
  }

  // Error fixtures return the error shape
  if (isError && fixtureData.error) {
    res.status(fixtureData.error.status || 500).json({
      error: fixtureData.error.code,
      message: fixtureData.error.message,
    });
    return;
  }

  // Validate the payload before returning
  const payloadResult = BlastRadiusPayloadSchema.safeParse(fixtureData.payload);
  if (!payloadResult.success) {
    res.status(500).json({
      error: 'FIXTURE_VALIDATION_FAILED',
      message: 'Fixture payload failed schema validation',
      details: payloadResult.error.issues,
    });
    return;
  }

  res.json(payloadResult.data);
});

/**
 * GET /api/bff/blast-radius/fixtures
 *
 * Returns the list of available fixture files for testing/development.
 * NOT available in production.
 */
blastRadiusRouter.get('/fixtures', (_req, res) => {
  if (!isDev) {
    res.status(404).json({ error: 'Not available in production' });
    return;
  }

  if (!isFixtureMode()) {
    res.json({ fixtures: [], mode: 'live' });
    return;
  }

  const fixtureDir = join(process.cwd(), 'fixtures', 'blast-radius');
  if (!existsSync(fixtureDir)) {
    res.json({ fixtures: [], mode: 'fixture' });
    return;
  }

  try {
    const files = readdirSync(fixtureDir).filter((f: string) => f.endsWith('.fixture.json'));
    res.json({ fixtures: files, mode: 'fixture' });
  } catch {
    res.json({ fixtures: [], mode: 'fixture' });
  }
});

export { blastRadiusRouter };
