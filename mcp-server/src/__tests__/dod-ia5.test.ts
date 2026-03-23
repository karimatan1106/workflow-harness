/**
 * DoD gate tests: L4 AC Achievement Status table (IA-5).
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

// ─── L4: AC Achievement Status Table (IA-5) ──────

describe('L4 AC Achievement Status table check (IA-5)', () => {
  it('skips check for non-code_review phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('not required');
  });

  it('fails when code-review.md is missing', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('not found');
  });

  it('fails when code-review.md lacks acAchievementStatus key', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'code-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('fails when acAchievementStatus contains not_met entries', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = [
      '## decisions',
      '- CR-001: Code review decision one (Reason one)',
      '- CR-002: Code review decision two (Reason two)',
      '- CR-003: Code review decision three (Reason three)',
      '- CR-004: Code review decision four (Reason four)',
      '- CR-005: Code review decision five (Reason five)',
      '',
      '## acAchievementStatus',
      '- AC-1: met',
      '- AC-2: not_met',
      '',
      '## artifacts',
      '- docs/code-review.md: spec - Code review artifact',
      '',
      '## next',
      '- criticalDecisions: CR-001',
      '- readFiles: docs/code-review.md',
      '- warnings:',
      '',
    ].join('\n');
    writeFileSync(join(docsDir, 'code-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('AC-2');
    expect(check.evidence).toContain('not_met');
  });

  it('passes when acAchievementStatus exists and no ACs are not_met', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = [
      '## decisions',
      '- CR-001: Code review decision one (Reason one)',
      '- CR-002: Code review decision two (Reason two)',
      '- CR-003: Code review decision three (Reason three)',
      '- CR-004: Code review decision four (Reason four)',
      '- CR-005: Code review decision five (Reason five)',
      '',
      '## acAchievementStatus',
      '- AC-1: met',
      '- AC-2: met',
      '',
      '## artifacts',
      '- docs/code-review.md: spec - Code review artifact',
      '',
      '## next',
      '- criticalDecisions: CR-001',
      '- readFiles: docs/code-review.md',
      '- warnings:',
      '',
    ].join('\n');
    writeFileSync(join(docsDir, 'code-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-5');
  });
});
