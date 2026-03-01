/**
 * DoD gate tests: L4 AC→design mapping (IA-3), L4 AC→TC traceability (IA-4).
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

// ─── L4: AC→Design Mapping (IA-3) ────────────────

describe('L4 AC→design mapping check (IA-3)', () => {
  it('skips check for non-design_review phases', async () => {
    const state = makeMinimalState('planning', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(true);
    expect(check.evidence).toContain('not required');
  });

  it('fails when design-review.toon is missing', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('not found');
  });

  it('fails when design-review.toon lacks acDesignMapping key', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    const content = toonEncode({ phase: 'design_review', taskId: 'test', ts: new Date().toISOString(), decisions: [{ id: 'D-001', statement: 'Review content', rationale: 'Reason' }] });
    writeFileSync(join(docsDir, 'design-review.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_design_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('passes when design-review.toon has acDesignMapping key and no ACs defined', async () => {
    const state = makeMinimalState('design_review', tempDir, docsDir);
    state.acceptanceCriteria = [];
    const content = toonEncode({
      phase: 'design_review', taskId: 'test', ts: new Date().toISOString(),
      decisions: [{ id: 'D-001', statement: 'Review complete', rationale: 'All criteria reviewed' }],
      acDesignMapping: [{ acId: 'AC-1', designElement: 'InputValidator component' }],
      artifacts: [{ path: 'docs/design-review.toon', role: 'spec', summary: 'Design review artifact' }],
      next: { criticalDecisions: ['D-001'], readFiles: ['docs/design-review.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'design-review.toon'), content, 'utf8');
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
    const content = toonEncode({
      phase: 'design_review', taskId: 'test', ts: new Date().toISOString(),
      decisions: [{ id: 'D-001', statement: 'Review complete', rationale: 'Partial review' }],
      acDesignMapping: [{ acId: 'AC-1', designElement: 'InputValidator component only' }],
      artifacts: [{ path: 'docs/design-review.toon', role: 'spec', summary: 'Design review artifact' }],
      next: { criticalDecisions: ['D-001'], readFiles: ['docs/design-review.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'design-review.toon'), content, 'utf8');
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
    const content = toonEncode({
      phase: 'design_review', taskId: 'test', ts: new Date().toISOString(),
      decisions: [{ id: 'D-001', statement: 'Review complete for all ACs', rationale: 'Full review' }],
      acDesignMapping: [
        { acId: 'AC-1', designElement: 'InputValidator component' },
        { acId: 'AC-2', designElement: 'ErrorHandler component' },
      ],
      artifacts: [{ path: 'docs/design-review.toon', role: 'spec', summary: 'Design review artifact' }],
      next: { criticalDecisions: ['D-001'], readFiles: ['docs/design-review.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'design-review.toon'), content, 'utf8');
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

  it('fails when test-design.toon is missing', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('not found');
  });

  it('fails when test-design.toon lacks acTcMapping key', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'test-design.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'ac_tc_mapping')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('missing');
  });

  it('passes when test-design.toon has acTcMapping key', async () => {
    const state = makeMinimalState('test_design', tempDir, docsDir);
    const base = toonEncode({
      phase: 'test_design', taskId: 'test', ts: new Date().toISOString(),
      decisions: [
        { id: 'TD-001', statement: 'Test design decision one providing details', rationale: 'Reason one' },
        { id: 'TD-002', statement: 'Test design decision two providing details', rationale: 'Reason two' },
        { id: 'TD-003', statement: 'Test design decision three providing details', rationale: 'Reason three' },
        { id: 'TD-004', statement: 'Test design decision four providing details', rationale: 'Reason four' },
        { id: 'TD-005', statement: 'Test design decision five providing details', rationale: 'Reason five' },
      ],
      acTcMapping: [
        { acId: 'AC-1', testCases: ['TC-AC1-01', 'TC-AC1-02'] },
        { acId: 'AC-2', testCases: ['TC-AC2-01'] },
      ],
      artifacts: [{ path: 'docs/test-design.toon', role: 'spec', summary: 'Test design artifact' }],
      next: { criticalDecisions: ['TD-001'], readFiles: ['docs/test-design.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'test-design.toon'), base, 'utf8');
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
      artifacts: [{ path: 'docs/test-design.toon', role: 'spec', summary: 'Test design' }],
      next: { criticalDecisions: ['TD-001'], readFiles: ['docs/test-design.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'test-design.toon'), content, 'utf8');
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
      artifacts: [{ path: 'docs/test-design.toon', role: 'spec', summary: 'Test design' }],
      next: { criticalDecisions: ['TD-001'], readFiles: ['docs/test-design.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'test-design.toon'), content, 'utf8');
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
    const filePath = join(docsDir, 'requirements.toon');
    writeFileSync(filePath, 'Original content for hashing', 'utf8');
    const state = { ...makeMinimalState('test_design', tempDir, docsDir), artifactHashes: { [filePath]: 'deadbeef-fake-hash-that-will-not-match' } };
    const result = await runDoDChecks(state, docsDir);
    const check = result.checks.find(c => c.check === 'artifact_drift')!;
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain('ART-1');
  });
});
