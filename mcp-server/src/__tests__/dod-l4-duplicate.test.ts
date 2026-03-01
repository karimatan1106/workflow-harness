/**
 * DoD gate tests: L4 duplicate line detection.
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

// ─── L4: Duplicate Line Detection ─────────────────

describe('L4 duplicate line detection', () => {
  it('fails L4 when the same non-structural line appears 3 or more times', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const baseContent = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    const dupLine = 'This exact duplicate line appears multiple times in the document and is problematic.';
    writeFileSync(join(docsDir, 'research.md'), baseContent + `\n${dupLine}\n${dupLine}\n${dupLine}\n`, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('3x');
  });

  it('does NOT fail L4 when a line appears only twice', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    const twiceLine = 'This line appears two times only which should be acceptable behavior.';
    writeFileSync(join(docsDir, 'research.md'), content + `\n${twiceLine}\n${twiceLine}\n`, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT flag heading lines as duplicates even when repeated', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const lines = [
      '## サマリー',
      'Summary line 1 providing overview of the task and its objectives.',
      'Summary line 2 providing context and background information.',
      'Summary line 3 providing scope and boundary information.',
      'Summary line 4 providing key decisions made during research.',
      'Summary line 5 providing recommended next steps for planning.',
      'Summary line 6 providing additional supporting details.',
      '',
      '## 調査結果',
      'Result line 1 with detailed investigation findings and observations.',
      'Result line 2 with more detailed investigation findings and analysis.',
      'Result line 3 with comprehensive investigation findings and recommendations.',
      'Result line 4 with final investigation findings and conclusions drawn.',
      'Result line 5 with additional investigation findings for completeness.',
      'Result line 6 with supplementary investigation findings for thoroughness.',
      '',
      '## 既存実装の分析',
      'Analysis line 1 with detailed examination of existing implementation patterns.',
      'Analysis line 2 with further examination of existing implementation approaches.',
      'Analysis line 3 with in-depth analysis of existing implementation decisions.',
      'Analysis line 4 with comprehensive analysis of existing implementation quality.',
      'Analysis line 5 with thorough analysis of existing implementation strengths.',
      'Analysis line 6 with complete analysis of existing implementation weaknesses.',
    ];
    writeFileSync(join(docsDir, 'research.md'), lines.join('\n'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT flag horizontal rules as duplicates', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\n---\n---\n---\n---\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });
});
