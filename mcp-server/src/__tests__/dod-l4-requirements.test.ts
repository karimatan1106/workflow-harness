/**
 * DoD gate tests: L4 AC format validation (IA-2), L4 NOT_IN_SCOPE section validation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runDoDChecks } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState, buildValidRequirementsToon } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── L4: AC Format Validation (IA-2) ─────────────

describe('L4 AC format validation', () => {
  it('fails when requirements.toon has fewer than 3 acceptanceCriteria entries', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = buildValidRequirementsToon({ acCount: 2 });
    writeFileSync(join(docsDir, 'requirements.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const acFmt = result.checks.find(c => c.check === 'ac_format')!;
    expect(acFmt.passed).toBe(false);
    expect(acFmt.evidence).toContain('only 2');
  });

  it('passes when requirements.toon has 3 or more acceptanceCriteria entries', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = buildValidRequirementsToon({ acCount: 3 });
    writeFileSync(join(docsDir, 'requirements.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const acFmt = result.checks.find(c => c.check === 'ac_format')!;
    expect(acFmt.passed).toBe(true);
    expect(acFmt.evidence).toContain('3');
  });

  it('skips AC format check for non-requirements phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const acFmt = result.checks.find(c => c.check === 'ac_format')!;
    expect(acFmt.passed).toBe(true);
    expect(acFmt.evidence).toContain('not required');
  });
});

// ─── L4: NOT_IN_SCOPE Section Validation ─────────

describe('L4 NOT_IN_SCOPE section validation', () => {
  it('fails when requirements.toon lacks notInScope key', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = buildValidRequirementsToon({ hasNotInScope: false });
    writeFileSync(join(docsDir, 'requirements.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const nis = result.checks.find(c => c.check === 'not_in_scope_section')!;
    expect(nis.passed).toBe(false);
    expect(nis.evidence).toContain('missing');
  });

  it('passes when requirements.toon contains notInScope key', async () => {
    const state = makeMinimalState('requirements', tempDir, docsDir);
    const content = buildValidRequirementsToon({ hasNotInScope: true });
    writeFileSync(join(docsDir, 'requirements.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const nis = result.checks.find(c => c.check === 'not_in_scope_section')!;
    expect(nis.passed).toBe(true);
  });
});

// ─── L4: Intent Consistency (CIC-1) ──────────────

describe('L4 intent consistency check (CIC-1)', () => {
  it('fails when 3+ userIntent keywords are absent from requirements.toon', async () => {
    const state = { ...makeMinimalState('requirements', tempDir, docsDir), userIntent: 'postgresql kubernetes elasticsearch microservice containerization orchestration' };
    // content does NOT include these keywords
    const content = buildValidRequirementsToon({ acCount: 3 });
    writeFileSync(join(docsDir, 'requirements.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ic = result.checks.find(c => c.check === 'intent_consistency')!;
    expect(ic.passed).toBe(false);
    expect(ic.evidence).toContain('未反映');
  });

  it('fails when requirements.toon line count is below userIntent depth threshold', async () => {
    const longIntent = 'authentication authorization validation sanitization performance security availability '.repeat(3);
    const state = { ...makeMinimalState('requirements', tempDir, docsDir), userIntent: longIntent };
    // Very short content that won't meet the line count threshold
    const shortContent = 'phase: requirements\ntaskId: x\nts: "2026"\ndecisions[5]{id,statement,rationale}:\n  REQ-001,authentication authorization validation sanitization performance security availability details,r\n  REQ-002,st2,r2\n  REQ-003,st3,r3\n  REQ-004,st4,r4\n  REQ-005,st5,r5\nacceptanceCriteria[3]{id,criterion}:\n  AC-1,c1\n  AC-2,c2\n  AC-3,c3\nnotInScope[1]{item}:\n  none\nopenQuestions[0]{id,question}:\n';
    writeFileSync(join(docsDir, 'requirements.toon'), shortContent, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ic = result.checks.find(c => c.check === 'intent_consistency')!;
    expect(ic.passed).toBe(false);
    expect(ic.evidence).toContain('不十分な詳細度');
  });

  it('passes when keywords are present and requirements.toon has sufficient lines', async () => {
    const state = { ...makeMinimalState('requirements', tempDir, docsDir), userIntent: 'performance security availability scalability testability maintainability' };
    const content = buildValidRequirementsToon({ acCount: 3, userIntent: 'performance security availability scalability testability maintainability' });
    writeFileSync(join(docsDir, 'requirements.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const ic = result.checks.find(c => c.check === 'intent_consistency')!;
    expect(ic.passed).toBe(true);
  });
});
