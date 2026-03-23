/**
 * DoD gate tests: TDD-1 (S2-16) Red phase evidence check.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDoDChecks } from '../gates/dod.js';
import { checkTDDRedEvidence } from '../gates/dod-l1-l2.js';
import { createTempDir, removeTempDir, makeMinimalState, buildValidArtifact } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── L2: TDD Red Evidence (TDD-1) ────────────────

describe('TDD-1 Red evidence check', () => {
  it('skips TDD Red check for non-test_impl phases', async () => {
    const state = makeMinimalState('implementation', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const tdd = result.checks.find(c => c.check === 'tdd_red_evidence')!;
    expect(tdd.passed).toBe(true);
    expect(tdd.evidence).toContain('not required');
  });

  it('fails TDD Red check when no L2 proof exists for test_impl', async () => {
    const state = makeMinimalState('test_impl', tempDir, docsDir);
    state.proofLog = [];
    const result = await runDoDChecks(state, docsDir);
    const tdd = result.checks.find(c => c.check === 'tdd_red_evidence')!;
    expect(tdd.passed).toBe(false);
    expect(tdd.evidence).toContain('TDD-1');
  });

  it('fails TDD Red check when all test_impl L2 proofs passed (no Red evidence)', async () => {
    const state = makeMinimalState('test_impl', tempDir, docsDir);
    state.proofLog = [
      { phase: 'test_impl', timestamp: new Date().toISOString(), level: 'L2', check: 'exit_code_zero', result: true, evidence: 'all tests passed' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const tdd = result.checks.find(c => c.check === 'tdd_red_evidence')!;
    expect(tdd.passed).toBe(false);
  });

  it('passes TDD Red check when at least one test_impl L2 proof failed', async () => {
    const state = makeMinimalState('test_impl', tempDir, docsDir);
    state.proofLog = [
      { phase: 'test_impl', timestamp: '2024-01-01T00:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: false, evidence: 'tests failed (Red)' },
      { phase: 'test_impl', timestamp: '2024-01-01T01:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: true, evidence: 'tests passing' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const tdd = result.checks.find(c => c.check === 'tdd_red_evidence')!;
    expect(tdd.passed).toBe(true);
    expect(tdd.evidence).toContain('TDD-1');
  });

  it('passes test_impl phase with Red evidence when all other checks pass', async () => {
    const state = makeMinimalState('test_impl', tempDir, docsDir);
    writeFileSync(join(docsDir, 'test-design.md'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    writeFileSync(join(docsDir, 'test-selection.md'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    state.proofLog = [
      { phase: 'test_impl', timestamp: '2024-01-01T00:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: false, evidence: 'tests failed (Red phase)' },
      { phase: 'test_impl', timestamp: '2024-01-01T01:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: true, evidence: 'tests passing' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const tdd = result.checks.find(c => c.check === 'tdd_red_evidence')!;
    expect(tdd.passed).toBe(true);
  });

});
