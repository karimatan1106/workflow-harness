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

  it('fails when design-review.md lacks ## AC→設計マッピング section', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    writeFileSync(join(docsDir, 'design-review.md'), '## レビュー結果\nContent here.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('passes when design-review.md has ## AC→設計マッピング section and no ACs defined', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [];
    writeFileSync(join(docsDir, 'design-review.md'), '## AC→設計マッピング\nAC-1 maps to Component A design.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-3');
  });

  it('fails when defined ACs are not mentioned in the mapping section', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Validate input', status: 'open' },
      { id: 'AC-2', description: 'Handle errors', status: 'open' },
    ];
    writeFileSync(join(docsDir, 'design-review.md'), '## AC→設計マッピング\nOnly AC-1 maps to Component A.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('AC-2');
  });

  it('passes when all defined ACs are mentioned in the mapping section', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Validate input', status: 'open' },
      { id: 'AC-2', description: 'Handle errors', status: 'open' },
    ];
    const content = '## AC→設計マッピング\nAC-1: maps to InputValidator component.\nAC-2: maps to ErrorHandler component.\n';
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

  it('fails when test-design.md lacks ## AC→TC section', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## テスト方針', '## テストケース'], 6);
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('passes when test-design.md has ## AC→TC section', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## テスト方針', '## テストケース'], 6)
      + '\n## AC→TC 追跡マトリクス\nAC-1 → TC-AC1-01, TC-AC1-02\nAC-2 → TC-AC2-01\n';
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-4');
  });
});

// ─── L3: TC Coverage (CRV-1) ─────────────────────

describe('L3 TC coverage check (CRV-1)', () => {
  it('skips tc_coverage for non-test_design phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'tc_coverage')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('not required');
  });

  it('fails when TC count is less than AC count', async () => {
    const state = { ...makeMinimalState('test_design', tempDir, docsDir), requirementCount: 3 };
    const content = buildValidArtifact(['## サマリー', '## テスト方針', '## テストケース'], 6)
      + '\n## AC→TC 追跡マトリクス\nTC-AC1-01 validates first criterion.\nTC-AC2-01 validates second.\n';
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'tc_coverage')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('CRV-1');
  });

  it('passes when TC count meets or exceeds AC count', async () => {
    const state = { ...makeMinimalState('test_design', tempDir, docsDir), requirementCount: 2 };
    const content = buildValidArtifact(['## サマリー', '## テスト方針', '## テストケース'], 6)
      + '\n## AC→TC 追跡マトリクス\nTC-AC1-01, TC-AC2-01 are defined.\n';
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'tc_coverage')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('CRV-1');
  });
});

// ─── L4: Artifact Drift (ART-1) ──────────────────

describe('L4 artifact drift check (ART-1)', () => {
  it('skips artifact_drift for phases not in drift-check set', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'artifact_drift')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('not applicable');
  });

  it('passes when no artifact hashes are recorded', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'artifact_drift')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('skipped');
  });

  it('fails when an approved artifact has been modified', async () => {
    const filePath = join(docsDir, 'requirements.md');
    writeFileSync(filePath, 'Original content for hashing', 'utf8');
    const state = { ...makeMinimalState('test_design', tempDir, docsDir), artifactHashes: { [filePath]: 'deadbeef-fake-hash-that-will-not-match' } };
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'artifact_drift')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('ART-1');
  });
});
