/**
 * DoD gate tests: L4 AC→design mapping (IA-3), L4 AC→TC traceability (IA-4).
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

// ─── L4: AC→Design Mapping (IA-3) ────────────────

describe('L4 AC→design mapping check (IA-3)', () => {
  it('skips check for non-design_review phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('not required');
  });

  it('fails when design-review.md is missing', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('not found');
  });

  it('fails when design-review.md lacks acDesignMapping section', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    const content = '## decisions\n- D-001: Review content (Reason)\n';
    writeFileSync(join(docsDir, 'design-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('passes when design-review.md has acDesignMapping section and no ACs defined', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [];
    const content = [
      '## decisions',
      '- D-001: Review complete (All criteria reviewed)',
      '',
      '## acDesignMapping',
      '- AC-1: InputValidator component',
      '',
      '## artifacts',
      '- docs/design-review.md: spec - Design review artifact',
      '',
      '## next',
      '- criticalDecisions: D-001',
      '- readFiles: docs/design-review.md',
      '- warnings:',
      '',
    ].join('\n');
    writeFileSync(join(docsDir, 'design-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-3');
  });

  it('fails when defined ACs are not mentioned in the acDesignMapping', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Validate input', status: 'open' },
      { id: 'AC-2', description: 'Handle errors', status: 'open' },
    ];
    const content = [
      '## decisions',
      '- D-001: Review complete (Partial review)',
      '',
      '## acDesignMapping',
      '- AC-1: InputValidator component only',
      '',
      '## artifacts',
      '- docs/design-review.md: spec - Design review artifact',
      '',
      '## next',
      '- criticalDecisions: D-001',
      '- readFiles: docs/design-review.md',
      '- warnings:',
      '',
    ].join('\n');
    writeFileSync(join(docsDir, 'design-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('AC-2');
  });

  it('passes when all defined ACs are mentioned in the acDesignMapping', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Validate input', status: 'open' },
      { id: 'AC-2', description: 'Handle errors', status: 'open' },
    ];
    const content = [
      '## decisions',
      '- D-001: Review complete for all ACs (Full review)',
      '',
      '## acDesignMapping',
      '- AC-1: InputValidator component',
      '- AC-2: ErrorHandler component',
      '',
      '## artifacts',
      '- docs/design-review.md: spec - Design review artifact',
      '',
      '## next',
      '- criticalDecisions: D-001',
      '- readFiles: docs/design-review.md',
      '- warnings:',
      '',
    ].join('\n');
    writeFileSync(join(docsDir, 'design-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(true);
  });
});

// ─── L4: AC→TC Traceability Mapping (IA-4) ───────

describe('L4 AC→TC traceability mapping check (IA-4)', () => {
  it('skips check for non-test_design phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('not required');
  });

  it('fails when test-design.md is missing', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('not found');
  });

  it('fails when test-design.md lacks acTcMapping key', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('passes when test-design.md has acTcMapping key', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const content = [
      '## decisions',
      '- TD-001: Test design decision one providing details (Reason one)',
      '- TD-002: Test design decision two providing details (Reason two)',
      '- TD-003: Test design decision three providing details (Reason three)',
      '- TD-004: Test design decision four providing details (Reason four)',
      '- TD-005: Test design decision five providing details (Reason five)',
      '',
      '## acTcMapping',
      '- AC-1: TC-AC1-01, TC-AC1-02',
      '- AC-2: TC-AC2-01',
      '',
      '## artifacts',
      '- docs/test-design.md: spec - Test design artifact',
      '',
      '## next',
      '- criticalDecisions: TD-001',
      '- readFiles: docs/test-design.md',
      '- warnings:',
      '',
    ].join('\n');
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-4');
  });
});
