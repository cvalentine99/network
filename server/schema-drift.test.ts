/**
 * Schema Drift Check — CI Gate Test
 *
 * Verifies that drizzle/schema.ts is in sync with the migration journal.
 * If this test fails, it means someone changed schema.ts without generating
 * a corresponding migration via `pnpm drizzle-kit generate`.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = join(__dirname, '..');
const DRIZZLE_DIR = join(PROJECT_ROOT, 'drizzle');

describe('Schema Drift Check', () => {
  it('drizzle/schema.ts matches migration journal (no pending changes)', () => {
    // Count migration files before
    const sqlFilesBefore = readdirSync(DRIZZLE_DIR).filter(f => f.endsWith('.sql'));
    const countBefore = sqlFilesBefore.length;

    // Run drizzle-kit generate
    const output = execSync('pnpm drizzle-kit generate 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 30_000,
    });

    // Count migration files after
    const sqlFilesAfter = readdirSync(DRIZZLE_DIR).filter(f => f.endsWith('.sql'));
    const countAfter = sqlFilesAfter.length;

    // If a new file was generated, schema.ts drifted
    expect(countAfter).toBe(countBefore);

    // Also verify the "nothing to migrate" message
    expect(output).toContain('No schema changes, nothing to migrate');
  });

  // TEST-H3: Dynamic migration count instead of hardcoded value
  it('migration files exist and follow naming convention', () => {
    const sqlFiles = readdirSync(DRIZZLE_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // At least the initial migrations should exist
    expect(sqlFiles.length).toBeGreaterThanOrEqual(1);
    // All migration files should follow the NNNN_ naming convention
    for (const file of sqlFiles) {
      expect(file).toMatch(/^\d{4}_/);
    }
  });

  it('meta snapshot files match migration count', () => {
    const metaDir = join(DRIZZLE_DIR, 'meta');
    const snapshots = readdirSync(metaDir).filter(f => f.endsWith('_snapshot.json'));
    const sqlFiles = readdirSync(DRIZZLE_DIR).filter(f => f.endsWith('.sql'));

    // Should have one snapshot per migration
    expect(snapshots.length).toBe(sqlFiles.length);
  });

  it('ci/check-schema-drift.sh exists and is executable', () => {
    const { statSync } = require('fs');
    const scriptPath = join(PROJECT_ROOT, 'ci', 'check-schema-drift.sh');
    const stat = statSync(scriptPath);

    // Check file exists
    expect(stat.isFile()).toBe(true);

    // Check executable bit (owner execute = 0o100)
    expect(stat.mode & 0o100).toBeTruthy();
  });

  it('ci/check-schema-drift.sh passes when schema is in sync', () => {
    const output = execSync('./ci/check-schema-drift.sh 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 30_000,
    });

    expect(output).toContain('PASS: Schema is in sync');
  });
});
