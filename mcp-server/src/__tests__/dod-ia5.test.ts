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

  it('fails when code-review.md lacks ## AC Achievement Status section', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 設計-実装整合性', '## ユーザー意図との整合性'], 6);
    writeFileSync(join(docsDir, 'code-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('fails when AC Achievement Status contains not_met entries', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 設計-実装整合性', '## ユーザー意図との整合性'], 6)
      + '\n## AC Achievement Status\n| AC-1 | met |\n| AC-2 | not_met |\n';
    writeFileSync(join(docsDir, 'code-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('AC-2');
    expect(check.evidence).toContain('not_met');
  });

  it('passes when ## AC Achievement Status exists and no ACs are not_met', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 設計-実装整合性', '## ユーザー意図との整合性'], 6)
      + '\n## AC Achievement Status\n| AC-1 | met |\n| AC-2 | met |\n';
    writeFileSync(join(docsDir, 'code-review.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-5');
  });
});
