/**
 * DoD gate tests: DEP-1 (S3-9) package.json/lock sync check.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

import { checkPackageLockSync } from '../gates/dod-l4-commit.js';
import { createTempDir, removeTempDir } from './dod-test-helpers.js';

let tempDir: string;

beforeEach(() => {
  ({ tempDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

describe('DEP-1 package lock sync check (checkPackageLockSync)', () => {
  it('passes for non-commit phases', () => {
    const result = checkPackageLockSync('planning');
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('only applicable for commit phase');
  });

  it('passes when package.json or package-lock.json does not exist', () => {
    const result = checkPackageLockSync('commit', tempDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('sync check skipped');
  });

  it('passes when package.json and package-lock.json have similar mtimes', () => {
    const now = new Date();
    writeFileSync(join(tempDir, 'package.json'), '{}', 'utf8');
    writeFileSync(join(tempDir, 'package-lock.json'), '{}', 'utf8');
    utimesSync(join(tempDir, 'package-lock.json'), now, now);
    utimesSync(join(tempDir, 'package.json'), now, now);
    const result = checkPackageLockSync('commit', tempDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('DEP-1');
  });

  it('fails when package.json is newer than package-lock.json by more than 60 seconds', () => {
    const lockTime = new Date(Date.now() - 120_000); // 2 minutes ago
    const pkgTime = new Date();                       // now
    writeFileSync(join(tempDir, 'package.json'), '{}', 'utf8');
    writeFileSync(join(tempDir, 'package-lock.json'), '{}', 'utf8');
    utimesSync(join(tempDir, 'package-lock.json'), lockTime, lockTime);
    utimesSync(join(tempDir, 'package.json'), pkgTime, pkgTime);
    const result = checkPackageLockSync('commit', tempDir);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('DEP-1');
    expect(result.evidence).toContain('npm install');
  });

  it('passes when package-lock.json is newer than package.json', () => {
    const pkgTime = new Date(Date.now() - 120_000);
    const lockTime = new Date();
    writeFileSync(join(tempDir, 'package.json'), '{}', 'utf8');
    writeFileSync(join(tempDir, 'package-lock.json'), '{}', 'utf8');
    utimesSync(join(tempDir, 'package.json'), pkgTime, pkgTime);
    utimesSync(join(tempDir, 'package-lock.json'), lockTime, lockTime);
    const result = checkPackageLockSync('commit', tempDir);
    expect(result.passed).toBe(true);
  });
});
