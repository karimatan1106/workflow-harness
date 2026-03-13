/**
 * DoD gate tests: L3 artifact quality, L4 forbidden patterns, L4 bracket placeholders.
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

/** Build a valid TOON artifact with extra additionalNotes content for pattern tests. */
function buildToonWithNote(note: string): string {
  return toonEncode({
    phase: 'research',
    taskId: 'test-task-id',
    ts: new Date().toISOString(),
    decisions: [
      { id: 'D-001', statement: 'Decision one for research: providing real substantive information about the topic in detail', rationale: 'Rationale one: context and reasoning for decision in the artifact content' },
      { id: 'D-002', statement: 'Decision two for research: providing real substantive information about the topic in detail', rationale: 'Rationale two: context and reasoning for decision in the artifact content' },
      { id: 'D-003', statement: 'Decision three for research: providing real substantive information about the topic in detail', rationale: 'Rationale three: context and reasoning for decision in the artifact content' },
      { id: 'D-004', statement: 'Decision four for research: providing real substantive information about the topic in detail', rationale: 'Rationale four: context and reasoning for decision in the artifact content' },
      { id: 'D-005', statement: 'Decision five for research: providing real substantive information about the topic in detail', rationale: 'Rationale five: context and reasoning for decision in the artifact content' },
      { id: 'D-006', statement: 'Decision six for research: providing real substantive information about the topic in detail', rationale: 'Rationale six: context and reasoning for decision in the artifact content' },
    ],
    artifacts: [{ path: 'docs/output.toon', role: 'spec', summary: 'Primary output artifact for this phase containing all decisions' }],
    next: { criticalDecisions: ['D-001', 'D-002', 'D-003'], readFiles: ['docs/output.toon'], warnings: ['No warnings for this test artifact'] },
    additionalNotes: note,
  });
}

// ─── L3: Artifact Quality ─────────────────────────

describe('L3 artifact quality check', () => {
  it('passes L3 with a well-formed TOON artifact meeting content and density', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next']);
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l3 = result.checks.find(c => c.level === 'L3')!;
    expect(l3.passed).toBe(true);
  });

  it('passes L3 parse check even with minimal fields (content validated by L4)', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const minimal = toonEncode({ phase: 'research' });
    writeFileSync(join(docsDir, 'research.toon'), minimal, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l3 = result.checks.find(c => c.level === 'L3')!;
    // L3 only checks TOON parsability now — content checks moved to L4
    expect(l3.passed).toBe(true);
    // But L4 should catch missing required keys (decisions, artifacts, next)
    const l4 = result.checks.find(c => c.check === 'delta_entry_format')!;
    expect(l4.passed).toBe(false);
  });
});

// ─── L4: Forbidden Patterns ───────────────────────

describe('L4 forbidden pattern detection', () => {
  it('fails L4 when artifact TOON value contains "TODO"', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('This item requires TODO work before completion.'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('TODO');
  });

  it('fails L4 when artifact TOON value contains Japanese forbidden word "未定"', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('この値は未定です。後で決定する。'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('未定');
  });

  it('fails L4 when artifact TOON value contains "TBD"', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('Value is TBD and not yet determined.'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('TBD');
  });

  it('passes L4 when TOON artifact contains no forbidden patterns', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('passes L4 when forbidden word is inside an inline backtick in TOON value', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    // The inline backtick stripping in extractNonCodeLines removes `TODO` from line
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('Use `TODO` comments to mark placeholders in code.'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });
});

// ─── L4: Bracket Placeholder Detection ───────────

describe('L4 bracket placeholder detection', () => {
  it('fails L4 when artifact TOON value contains a [#xxx#] placeholder', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('The value is [#insert-value-here#].'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('[#');
  });

  it('does NOT fail L4 for normal text without bracket placeholders', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('See RFC-1234 for reference documentation.'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT fail L4 when bracket placeholder is inside an inline backtick', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    // Inline backtick stripping in extractNonCodeLines removes `[#placeholder#]` from line
    writeFileSync(join(docsDir, 'research.toon'), buildToonWithNote('Use `[#placeholder#]` pattern in templates.'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.check === 'content_validation')!;
    expect(l4.passed).toBe(true);
  });
});
