/**
 * Verification tests for ADR-032 existence and content (AC-5, AC-6, AC-7).
 * Expected to fail (TDD Red) until ADR-032-rust-backend-default.md is created
 * and all three Rust-backend vitest files are placed under __tests__/.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const ADR_PATH = join(
  __dirname,
  '../../../docs/adr/ADR-032-rust-backend-default.md',
);

const TESTS_DIR = __dirname;
const VITEST_FILES = [
  join(TESTS_DIR, 'skill-rust-backend-structure.test.ts'),
  join(TESTS_DIR, 'skill-rust-backend-api.test.ts'),
  join(TESTS_DIR, 'adr-032-existence.test.ts'),
];

describe('ADR-032 existence and content', () => {
  it('TC-AC5-01: ADR-032-rust-backend-default.md exists under docs/adr/', () => {
    expect(existsSync(ADR_PATH)).toBe(true);
  });

  it('TC-AC5-02: ADR-032 contains Status/Context/Decision/Consequences sections', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toContain('Status: Accepted');
    expect(content).toContain('## Context');
    expect(content).toContain('## Decision');
    expect(content).toContain('## Consequences');
  });

  it('TC-AC6-01: ADR-032 references ADR-006', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    expect(content).toContain('ADR-006');
  });

  it('TC-AC6-02: ADR-032 expresses extension of ADR-006 (substring)', () => {
    const content = readFileSync(ADR_PATH, 'utf-8');
    const hasExtension =
      content.includes('延長線') ||
      content.includes('extends') ||
      content.includes('踏襲');
    expect(hasExtension).toBe(true);
  });

  it('TC-AC7-01: All three Rust-backend vitest files exist under __tests__/', () => {
    for (const file of VITEST_FILES) {
      expect(existsSync(file)).toBe(true);
    }
  });
});
