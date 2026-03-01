/**
 * DoD gate tests: L4 AC Achievement Status table (IA-5).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode as toonEncode } from '@toon-format/toon';

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

  it('fails when code-review.toon is missing', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('not found');
  });

  it('fails when code-review.toon lacks acAchievementStatus key', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'code-review.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('fails when acAchievementStatus contains not_met entries', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = toonEncode({
      phase: 'code_review', taskId: 'test', ts: new Date().toISOString(),
      decisions: [
        { id: 'CR-001', statement: 'Code review decision one', rationale: 'Reason one' },
        { id: 'CR-002', statement: 'Code review decision two', rationale: 'Reason two' },
        { id: 'CR-003', statement: 'Code review decision three', rationale: 'Reason three' },
        { id: 'CR-004', statement: 'Code review decision four', rationale: 'Reason four' },
        { id: 'CR-005', statement: 'Code review decision five', rationale: 'Reason five' },
      ],
      acAchievementStatus: [
        { acId: 'AC-1', status: 'met' },
        { acId: 'AC-2', status: 'not_met' },
      ],
      artifacts: [{ path: 'docs/code-review.toon', role: 'spec', summary: 'Code review artifact' }],
      next: { criticalDecisions: ['CR-001'], readFiles: ['docs/code-review.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'code-review.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('AC-2');
    expect(check.evidence).toContain('not_met');
  });

  it('passes when acAchievementStatus exists and no ACs are not_met', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    const content = toonEncode({
      phase: 'code_review', taskId: 'test', ts: new Date().toISOString(),
      decisions: [
        { id: 'CR-001', statement: 'Code review decision one', rationale: 'Reason one' },
        { id: 'CR-002', statement: 'Code review decision two', rationale: 'Reason two' },
        { id: 'CR-003', statement: 'Code review decision three', rationale: 'Reason three' },
        { id: 'CR-004', statement: 'Code review decision four', rationale: 'Reason four' },
        { id: 'CR-005', statement: 'Code review decision five', rationale: 'Reason five' },
      ],
      acAchievementStatus: [
        { acId: 'AC-1', status: 'met' },
        { acId: 'AC-2', status: 'met' },
      ],
      artifacts: [{ path: 'docs/code-review.toon', role: 'spec', summary: 'Code review artifact' }],
      next: { criticalDecisions: ['CR-001'], readFiles: ['docs/code-review.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'code-review.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_achievement_table')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('IA-5');
  });
});
