/**
 * BFF Blast Radius Routes — /api/bff/blast-radius/*
 *
 * Slice 18: POST /api/bff/blast-radius/query
 * Returns the blast radius for a given device — all peer devices,
 * protocols, detections, and impact scores.
 *
 * In fixture mode (no live ExtraHop), returns deterministic fixture data.
 * In live mode (future), will query ExtraHop APIs for real peer data.
 *
 * Contract: browser calls /api/bff/blast-radius/query, never ExtraHop directly.
 */

import { Router } from 'express';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { BlastRadiusIntentSchema, BlastRadiusPayloadSchema } from '../../shared/blast-radius-validators';

const blastRadiusRouter = Router();

/**
 * Determine if we are in fixture mode (no live ExtraHop configured).
 */
function isFixtureMode(): boolean {
  return !process.env.EH_HOST || !process.env.EH_API_KEY;
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
 * Sentinel values route to specific fixtures for testing.
 */
function selectFixture(mode: string, value: string): { fixture: string; isError: boolean } {
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
 *
 * Accepts a BlastRadiusIntent and returns the blast radius payload.
 * In fixture mode, returns deterministic fixture data.
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

  if (isFixtureMode()) {
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
  } else {
    // Live mode — future integration point
    res.status(501).json({
      error: 'NOT_IMPLEMENTED',
      message: 'Live blast radius integration not yet implemented',
    });
  }
});

/**
 * GET /api/bff/blast-radius/fixtures
 *
 * Returns the list of available fixture files for testing/development.
 * Only available in fixture mode.
 */
blastRadiusRouter.get('/fixtures', (_req, res) => {
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
