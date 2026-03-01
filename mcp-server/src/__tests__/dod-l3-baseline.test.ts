/**
 * DoD gate tests: L3 baseline required check for regression_test phase.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { runDoDChecks } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── L3: Baseline Required for Regression Test ───

describe('L3 baseline required check', () => {
  it('fails when no baseline is captured at regression_test phase', async () => {
    const state = makeMinimalState('regression_test', tempDir, docsDir);
    state.baseline = undefined;
    const result = await runDoDChecks(state, docsDir);
    const bl = result.checks.find(c => c.check === 'baseline_required')!;
    expect(bl.passed).toBe(false);
    expect(bl.evidence).toContain('No baseline');
  });

  it('passes when baseline is captured at regression_test phase', async () => {
    const state = makeMinimalState('regression_test', tempDir, docsDir);
    state.baseline = { capturedAt: new Date().toISOString(), totalTests: 10, passedTests: 10, failedTests: [] };
    const result = await runDoDChecks(state, docsDir);
    const bl = result.checks.find(c => c.check === 'baseline_required')!;
    expect(bl.passed).toBe(true);
    expect(bl.evidence).toContain('10 total');
  });

  it('skips baseline check for non-regression_test phases', async () => {
    const state = makeMinimalState('testing', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const bl = result.checks.find(c => c.check === 'baseline_required')!;
    expect(bl.passed).toBe(true);
    expect(bl.evidence).toContain('not required');
  });
});
