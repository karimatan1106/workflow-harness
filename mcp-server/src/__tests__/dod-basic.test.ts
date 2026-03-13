/**
 * DoD gate tests: phases with no output file, L1 file existence, L2 exit code.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDoDChecks } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState, buildValidArtifact } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── Phases with no output file ───────────────────

describe('runDoDChecks for phases with no output file', () => {
  it('passes all checks for "test_impl" which has no outputFile', async () => {
    const state = makeMinimalState('test_impl', tempDir, docsDir);
    // IFV-1: test_impl requires test-design.toon and test-selection.toon as inputs
    writeFileSync(join(docsDir, 'test-design.toon'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    writeFileSync(join(docsDir, 'test-selection.toon'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    // TDD-1: test_impl requires Red phase evidence (Red before Green)
    state.proofLog = [
      { phase: 'test_impl', timestamp: '2024-01-01T00:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: false, evidence: 'tests failed (Red phase)' },
      { phase: 'test_impl', timestamp: '2024-01-01T01:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: true, evidence: 'tests passing' },
    ];
    const result = await runDoDChecks(state, docsDir);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes all checks for "implementation" which has no outputFile', async () => {
    const state = makeMinimalState('implementation', tempDir, docsDir);
    // IFV-1: implementation requires planning.toon and test-design.toon as inputs
    writeFileSync(join(docsDir, 'planning.toon'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    writeFileSync(join(docsDir, 'test-design.toon'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    expect(result.passed).toBe(true);
  });

  it('always returns 24 check results', async () => {
    const state = makeMinimalState('refactoring', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    expect(result.checks).toHaveLength(24);
    expect(result.checks.map(c => c.level)).toEqual(['L1', 'L1', 'L1', 'L2', 'L3', 'L4', 'L3', 'L3', 'L3', 'L4', 'L4', 'L4', 'L4', 'L3', 'L3', 'L4', 'L4', 'L4', 'L4', 'L3', 'L4', 'L4', 'L2', 'L4']);
    expect(result.checks[2].check).toBe('spec_paths_exist');
    expect(result.checks[19].check).toBe('tc_coverage');
    expect(result.checks[20].check).toBe('artifact_drift');
    expect(result.checks[21].check).toBe('package_lock_sync');
    expect(result.checks[22].check).toBe('tdd_red_evidence');
    expect(result.checks[23].check).toBe('dead_references');
  });
});

// ─── L1: Input File Existence (IFV-1) ─────────────

describe('IFV-1 input files existence check', () => {
  it('fails input_files_exist when required input file is missing', async () => {
    // threat_modeling requires requirements.toon as input; do not create it
    const state = makeMinimalState('threat_modeling', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const ifv = result.checks.find(c => c.check === 'input_files_exist')!;
    expect(ifv.passed).toBe(false);
    expect(ifv.evidence).toContain('Missing input files');
  });

  it('passes input_files_exist when all input files exist', async () => {
    const state = makeMinimalState('threat_modeling', tempDir, docsDir);
    writeFileSync(join(docsDir, 'requirements.toon'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ifv = result.checks.find(c => c.check === 'input_files_exist')!;
    expect(ifv.passed).toBe(true);
    expect(ifv.evidence).toContain('All');
  });

  it('passes input_files_exist for phases with no required inputs', async () => {
    const state = makeMinimalState('refactoring', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const ifv = result.checks.find(c => c.check === 'input_files_exist')!;
    expect(ifv.passed).toBe(true);
    expect(ifv.evidence).toContain('No input files required');
  });
});

// ─── L1: File Existence ───────────────────────────

describe('L1 file existence check', () => {
  it('fails L1 when the expected output file is missing', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const l1 = result.checks.find(c => c.level === 'L1')!;
    expect(l1.passed).toBe(false);
    expect(l1.evidence).toContain('missing');
  });

  it('passes L1 when the expected output file exists', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l1 = result.checks.find(c => c.level === 'L1')!;
    expect(l1.passed).toBe(true);
    expect(l1.evidence).toContain('exists');
  });
});

// ─── L2: Exit Code ───────────────────────────────

describe('L2 exit code check', () => {
  it('passes L2 when there is no L2 proof entry for the current phase', async () => {
    const state = makeMinimalState('refactoring', tempDir, docsDir);
    state.proofLog = [];
    const result = await runDoDChecks(state, docsDir);
    const l2 = result.checks.find(c => c.level === 'L2')!;
    expect(l2.passed).toBe(true);
    expect(l2.evidence).toContain('No L2 proof required');
  });

  it('passes L2 when the most recent L2 proof for current phase has result=true', async () => {
    const state = makeMinimalState('build_check', tempDir, docsDir);
    state.proofLog = [
      { phase: 'build_check', timestamp: new Date().toISOString(), level: 'L2', check: 'exit_code_zero', result: true, evidence: 'exit code 0' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const l2 = result.checks.find(c => c.level === 'L2')!;
    expect(l2.passed).toBe(true);
  });

  it('fails L2 when the most recent L2 proof for current phase has result=false', async () => {
    const state = makeMinimalState('build_check', tempDir, docsDir);
    state.proofLog = [
      { phase: 'build_check', timestamp: new Date().toISOString(), level: 'L2', check: 'exit_code_zero', result: false, evidence: 'exit code 1: compilation failed' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const l2 = result.checks.find(c => c.level === 'L2')!;
    expect(l2.passed).toBe(false);
  });

  it('uses only the most recent L2 proof for the current phase', async () => {
    const state = makeMinimalState('build_check', tempDir, docsDir);
    state.proofLog = [
      { phase: 'build_check', timestamp: '2024-01-01T00:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: false, evidence: 'first attempt failed' },
      { phase: 'build_check', timestamp: '2024-01-01T01:00:00.000Z', level: 'L2', check: 'exit_code_zero', result: true, evidence: 'second attempt succeeded' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const l2 = result.checks.find(c => c.level === 'L2')!;
    expect(l2.passed).toBe(true);
  });

  it('ignores L2 proofs for other phases', async () => {
    const state = makeMinimalState('testing', tempDir, docsDir);
    state.proofLog = [
      { phase: 'build_check', timestamp: new Date().toISOString(), level: 'L2', check: 'exit_code_zero', result: false, evidence: 'unrelated phase failure' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const l2 = result.checks.find(c => c.level === 'L2')!;
    expect(l2.passed).toBe(true);
  });
});
