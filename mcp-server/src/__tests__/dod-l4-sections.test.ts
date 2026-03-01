/**
 * DoD gate tests: L4 required TOON keys, RTM completeness, AC completeness.
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

// ─── L4: Required TOON Keys ────────────────────────

describe('L4 required sections check', () => {
  it('fails L4 when a required TOON key is missing', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    // Write a TOON without the 'artifacts' key (required by registry)
    const content = toonEncode({
      phase: 'research',
      taskId: 'test',
      ts: new Date().toISOString(),
      decisions: [
        { id: 'R-001', statement: 'Decision one for research', rationale: 'Reason one' },
        { id: 'R-002', statement: 'Decision two for research', rationale: 'Reason two' },
        { id: 'R-003', statement: 'Decision three for research', rationale: 'Reason three' },
        { id: 'R-004', statement: 'Decision four for research', rationale: 'Reason four' },
        { id: 'R-005', statement: 'Decision five for research', rationale: 'Reason five' },
      ],
      // 'artifacts' key is intentionally missing
      next: { criticalDecisions: ['R-001'], readFiles: ['docs/research.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('artifacts');
  });

  it('passes L4 when all required TOON keys are present and content is valid', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });

  it('fails L4 for planning phase when required TOON key is missing', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    // Write a spec.toon missing the 'next' key
    const content = toonEncode({
      phase: 'planning',
      taskId: 'test',
      ts: new Date().toISOString(),
      decisions: [
        { id: 'PL-001', statement: 'Decision one for planning phase', rationale: 'Reason one' },
        { id: 'PL-002', statement: 'Decision two for planning phase', rationale: 'Reason two' },
        { id: 'PL-003', statement: 'Decision three for planning phase', rationale: 'Reason three' },
        { id: 'PL-004', statement: 'Decision four for planning phase', rationale: 'Reason four' },
        { id: 'PL-005', statement: 'Decision five for planning phase', rationale: 'Reason five' },
      ],
      artifacts: [{ path: 'docs/spec.toon', role: 'spec', summary: 'Planning spec' }],
      // 'next' key is intentionally missing
    });
    writeFileSync(join(docsDir, 'spec.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('next');
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
