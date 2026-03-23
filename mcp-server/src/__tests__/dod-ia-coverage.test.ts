/**
 * DoD gate tests: L3 TC coverage (CRV-1), L4 artifact drift (ART-1).
 * Split from dod-ia.test.ts for 200-line limit.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode as toonEncode } from '@toon-format/toon';

import { runDoDChecks } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
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
    const content = toonEncode({
      phase: 'test_design', taskId: 'test', ts: new Date().toISOString(),
      decisions: [
        { id: 'TD-001', statement: 'Decision one', rationale: 'Reason one' },
        { id: 'TD-002', statement: 'Decision two', rationale: 'Reason two' },
        { id: 'TD-003', statement: 'Decision three', rationale: 'Reason three' },
        { id: 'TD-004', statement: 'Decision four', rationale: 'Reason four' },
        { id: 'TD-005', statement: 'Decision five', rationale: 'Reason five' },
      ],
      acTcMapping: [
        { acId: 'AC-1', testCases: ['TC-AC1-01'] },
        { acId: 'AC-2', testCases: ['TC-AC2-01'] },
      ],
      artifacts: [{ path: 'docs/test-design.md', role: 'spec', summary: 'Test design' }],
      next: { criticalDecisions: ['TD-001'], readFiles: ['docs/test-design.md'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'test-design.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'tc_coverage')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('CRV-1');
  });

  it('passes when TC count meets or exceeds AC count', async () => {
    const state = { ...makeMinimalState('test_design', tempDir, docsDir), requirementCount: 2 };
    const content = toonEncode({
      phase: 'test_design', taskId: 'test', ts: new Date().toISOString(),
      decisions: [
        { id: 'TD-001', statement: 'Decision one', rationale: 'Reason one' },
        { id: 'TD-002', statement: 'Decision two', rationale: 'Reason two' },
        { id: 'TD-003', statement: 'Decision three', rationale: 'Reason three' },
        { id: 'TD-004', statement: 'Decision four', rationale: 'Reason four' },
        { id: 'TD-005', statement: 'Decision five', rationale: 'Reason five' },
      ],
      acTcMapping: [
        { acId: 'AC-1', testCases: ['TC-AC1-01'] },
        { acId: 'AC-2', testCases: ['TC-AC2-01'] },
      ],
      artifacts: [{ path: 'docs/test-design.md', role: 'spec', summary: 'Test design' }],
      next: { criticalDecisions: ['TD-001'], readFiles: ['docs/test-design.md'], warnings: [] },
    });
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
