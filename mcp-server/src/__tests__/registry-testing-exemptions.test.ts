/**
 * @spec F-203 / AC-3
 * Registry testing/regression_test phase dodExemptions tests.
 *
 * Verifies that 'testing' and 'regression_test' phase configs include
 * 'exit_code_zero' in their dodExemptions list, so that checkL2ExitCode
 * skips exit-code validation for these phases (regression gate handles it).
 *
 * Currently FAILING (TDD Red):
 * - PHASE_REGISTRY.testing.dodExemptions is undefined
 * - PHASE_REGISTRY.regression_test.dodExemptions is undefined
 * - checkL2ExitCode does not exempt these phases yet
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PHASE_REGISTRY } from '../phases/registry.js';
import { checkL2ExitCode } from '../gates/dod-l1-l2.js';
import { createTempDir, removeTempDir, makeMinimalState } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

describe('registry testing dodExemptions', () => {
  it('TC-AC3-01: testing phase config の dodExemptions に exit_code_zero が含まれる', () => {
    const config = PHASE_REGISTRY.testing;
    expect(config).toBeDefined();
    expect(config.dodExemptions).toBeDefined();
    expect(config.dodExemptions).toContain('exit_code_zero');
  });

  it('TC-AC3-02: regression_test phase config の dodExemptions に exit_code_zero が含まれる', () => {
    const config = PHASE_REGISTRY.regression_test;
    expect(config).toBeDefined();
    expect(config.dodExemptions).toBeDefined();
    expect(config.dodExemptions).toContain('exit_code_zero');
  });

  it('TC-AC3-03: integration: testing phase で exitCode=1 の test_result があっても checkL2ExitCode が skip される', () => {
    const state = makeMinimalState('testing', tempDir, docsDir);
    state.proofLog = [
      {
        phase: 'testing',
        timestamp: new Date().toISOString(),
        level: 'L2',
        check: 'exit_code_zero',
        result: false,
        evidence: 'tests failed (exit code 1)',
      },
    ];
    const result = checkL2ExitCode(state);
    expect(result.passed).toBe(true);
    expect(result.evidence).toMatch(/exempt/i);
  });

  it('TC-AC3-04: integration: regression_test phase で exitCode=1 の test_result があっても checkL2ExitCode が skip される', () => {
    const state = makeMinimalState('regression_test', tempDir, docsDir);
    state.proofLog = [
      {
        phase: 'regression_test',
        timestamp: new Date().toISOString(),
        level: 'L2',
        check: 'exit_code_zero',
        result: false,
        evidence: 'tests failed (exit code 1)',
      },
    ];
    const result = checkL2ExitCode(state);
    expect(result.passed).toBe(true);
    expect(result.evidence).toMatch(/exempt/i);
  });
});
