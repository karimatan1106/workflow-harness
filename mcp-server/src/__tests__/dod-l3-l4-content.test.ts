/**
 * DoD gate tests: L3 artifact quality, L4 forbidden patterns, L4 bracket placeholders.
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

// ─── L3: Artifact Quality ─────────────────────────

describe('L3 artifact quality check', () => {
  it('passes L3 with a well-formed artifact meeting minLines and density', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析']);
    writeFileSync(join(docsDir, 'research.md'), content, 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l3 = result.checks.find(c => c.level === 'L3')!;
    expect(l3.passed).toBe(true);
  });

  it('fails L3 when a section has fewer than 5 content lines', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const lines = ['## サマリー'];
    lines.push('Line 1 of content in the summary section providing important information.');
    lines.push('Line 2 of content in the summary section providing additional details.');
    lines.push('');
    lines.push('## 調査結果');
    for (let i = 1; i <= 30; i++) {
      lines.push(`Result line ${i} with detailed investigation findings, analysis and observations for completeness.`);
    }
    lines.push('');
    lines.push('## 既存実装の分析');
    for (let i = 1; i <= 30; i++) {
      lines.push(`Analysis line ${i} with detailed examination of existing implementation patterns and approaches.`);
    }
    lines.push('');
    writeFileSync(join(docsDir, 'research.md'), lines.join('\n'), 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l3 = result.checks.find(c => c.level === 'L3')!;
    expect(l3.passed).toBe(false);
    expect(l3.evidence).toContain('サマリー');
  });
});

// ─── L4: Forbidden Patterns ───────────────────────

describe('L4 forbidden pattern detection', () => {
  it('fails L4 when artifact contains "TODO" outside a code fence', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\nTODO: This must be done later.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('TODO');
  });

  it('fails L4 when artifact contains Japanese forbidden word "未定"', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\nこの値は未定です。\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('未定');
  });

  it('fails L4 when artifact contains "TBD"', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\nTBD: Value not yet set.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('TBD');
  });

  it('does NOT fail L4 when forbidden word appears only inside a code fence', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\n```\n// TODO: remove this\n```\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT fail L4 when forbidden word is inside inline code', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\nUse `TODO` comments to mark placeholders.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });
});

// ─── L4: Bracket Placeholder Detection ───────────

describe('L4 bracket placeholder detection', () => {
  it('fails L4 when artifact contains a [#xxx#] placeholder', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\nThe value is [#insert-value-here#].\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(false);
    expect(l4.evidence).toContain('[#');
  });

  it('does NOT fail L4 for normal bracket usage like arrays or regex', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\nSee [RFC 1234](https://example.com) for reference.\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });

  it('does NOT fail L4 for bracket placeholders inside code fence', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const content = buildValidArtifact(['## サマリー', '## 調査結果', '## 既存実装の分析'], 6);
    writeFileSync(join(docsDir, 'research.md'), content + '\n```\n[#placeholder#]\n```\n', 'utf8');
    const result = await runDoDChecks(state, docsDir);
    const l4 = result.checks.find(c => c.level === 'L4')!;
    expect(l4.passed).toBe(true);
  });
});
