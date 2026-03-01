/**
 * DoD gate tests: L4 required sections, RTM completeness, AC completeness.
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

// ─── L4: Required Sections ────────────────────────

describe('L4 required sections check', () => {
  it('fails L4 when a required section header is missing', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const lines = [
      '## サマリー',
      'Summary content line 1 providing an overview of the research findings.',
      'Summary content line 2 providing context for the research task.',
      'Summary content line 3 providing scope information for the research.',
      'Summary content line 4 providing key objectives of the research.',
      'Summary content line 5 providing expected outcomes of the research.',
      'Summary content line 6 providing next steps after research completion.',
      '',
      '## 調査結果',
      'Result line 1 with detailed investigation findings and observations.',
      'Result line 2 with more detailed investigation findings and analysis.',
      'Result line 3 with comprehensive investigation findings and recommendations.',
      'Result line 4 with final investigation findings and conclusions drawn.',
      'Result line 5 with additional investigation findings for completeness.',
      'Result line 6 with supplementary investigation findings for thoroughness.',
      '',
    ];
    writeFileSync(join(docsDir, 'research.md'), lines.join('\n'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('既存実装の分析');
  });

  it('passes L4 when all required sections are present and content is valid', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });

  it('fails L4 for planning phase when required sections are missing', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const incompleteContent = buildValidArtifact(['## サマリー', '## 概要'], 6);
    writeFileSync(join(docsDir, 'spec.md'), incompleteContent, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('実装計画');
  });
});

// ─── RTM Completeness Check ─────────────────────

describe('RTM completeness check', () => {
  it('passes when there are no RTM entries', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    state.rtmEntries = [];
    const result = await runDoDChecks(state, docsDir);
    const rtm = result.checks.find(c => c.check === 'rtm_completeness')!;
    expect(rtm.passed).toBe(true);
    expect(rtm.evidence).toContain('skipped');
  });

  it('passes when all RTM entries meet required status at code_review', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    state.rtmEntries = [
      { id: 'F-001', requirement: 'Validate input', status: 'implemented', designRef: '', codeRef: 'src/a.ts', testRef: '' },
      { id: 'F-002', requirement: 'Handle errors', status: 'verified', designRef: '', codeRef: 'src/b.ts', testRef: '' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const rtm = result.checks.find(c => c.check === 'rtm_completeness')!;
    expect(rtm.passed).toBe(true);
  });

  it('fails when an RTM entry is still pending at code_review', async () => {
    const state = makeMinimalState('code_review', tempDir, docsDir);
    state.rtmEntries = [
      { id: 'F-001', requirement: 'Validate input', status: 'implemented', designRef: '', codeRef: 'src/a.ts', testRef: '' },
      { id: 'F-002', requirement: 'Handle errors', status: 'pending', designRef: '', codeRef: '', testRef: '' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const rtm = result.checks.find(c => c.check === 'rtm_completeness')!;
    expect(rtm.passed).toBe(false);
    expect(rtm.evidence).toContain('F-002');
  });

  it('skips RTM check for phases not in RTM_CHECK_PHASES', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    state.rtmEntries = [
      { id: 'F-001', requirement: 'Test req', status: 'pending', designRef: '', codeRef: '', testRef: '' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const rtm = result.checks.find(c => c.check === 'rtm_completeness')!;
    expect(rtm.passed).toBe(true);
    expect(rtm.evidence).toContain('not required');
  });
});

// ─── AC Completeness Check ──────────────────────

describe('AC completeness check', () => {
  it('passes when there are no acceptance criteria', async () => {
    const state = makeMinimalState('acceptance_verification', tempDir, docsDir);
    state.acceptanceCriteria = [];
    const result = await runDoDChecks(state, docsDir);
    const ac = result.checks.find(c => c.check === 'ac_completeness')!;
    expect(ac.passed).toBe(true);
    expect(ac.evidence).toContain('skipped');
  });

  it('passes when all ACs are met at acceptance_verification', async () => {
    const state = makeMinimalState('acceptance_verification', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Input validated correctly', status: 'met' },
      { id: 'AC-2', description: 'Error messages shown', status: 'met' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const ac = result.checks.find(c => c.check === 'ac_completeness')!;
    expect(ac.passed).toBe(true);
  });

  it('fails when an AC is still open at acceptance_verification', async () => {
    const state = makeMinimalState('acceptance_verification', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Input validated correctly', status: 'met' },
      { id: 'AC-2', description: 'Error messages shown', status: 'open' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const ac = result.checks.find(c => c.check === 'ac_completeness')!;
    expect(ac.passed).toBe(false);
    expect(ac.evidence).toContain('AC-2');
  });

  it('fails when an AC has status not_met at acceptance_verification', async () => {
    const state = makeMinimalState('acceptance_verification', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Input validated correctly', status: 'not_met' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const ac = result.checks.find(c => c.check === 'ac_completeness')!;
    expect(ac.passed).toBe(false);
    expect(ac.evidence).toContain('AC-1');
  });

  it('skips AC check for phases not in AC_CHECK_PHASES', async () => {
    const state = makeMinimalState('implementation', tempDir, docsDir);
    state.acceptanceCriteria = [
      { id: 'AC-1', description: 'Not yet verified', status: 'open' },
    ];
    const result = await runDoDChecks(state, docsDir);
    const ac = result.checks.find(c => c.check === 'ac_completeness')!;
    expect(ac.passed).toBe(true);
    expect(ac.evidence).toContain('not required');
  });
});
