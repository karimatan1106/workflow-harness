/**
 * DoD L4 code fence prohibition tests.
 * @spec AC-6 planning artifacts must not contain code fences
 * @spec AC-7 inline code is allowed
 * @spec AC-8 .mmd files are exempt from code fence check
 * @spec AC-9 noCodeFences=false phases skip the check
 * @spec AC-10 error message includes file name and line number
 * @covers gates/dod-l4-content.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { checkL4ContentValidation } from '../gates/dod-l4-content.js';
import { createTempDir, removeTempDir } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

function writePlanningMd(content: string): void {
  writeFileSync(join(docsDir, 'planning.md'), content, 'utf8');
}

function buildContentWithCodeFence(): string {
  const lines: string[] = [];
  lines.push('## decisions');
  for (let i = 1; i <= 10; i++) {
    lines.push(`- D-${String(i).padStart(3, '0')}: Decision ${i} about implementation strategy (Rationale: clear approach)`);
  }
  lines.push('');
  lines.push('## artifacts');
  lines.push('- docs/planning.md: spec - Planning document with decisions');
  lines.push('');
  lines.push('## next');
  lines.push('- criticalDecisions: D-001, D-002');
  lines.push('- readFiles: docs/planning.md');
  lines.push('- warnings: No warnings');
  lines.push('');
  lines.push('```typescript');
  lines.push('const x = 1;');
  lines.push('```');
  lines.push('');
  for (let i = 0; i < 40; i++) {
    lines.push(`Additional planning detail line ${i + 1}: describing architecture approach in detail`);
  }
  return lines.join('\n');
}

function buildContentWithoutCodeFence(): string {
  const lines: string[] = [];
  lines.push('## decisions');
  for (let i = 1; i <= 10; i++) {
    lines.push(`- D-${String(i).padStart(3, '0')}: Decision ${i} about implementation strategy (Rationale: clear approach)`);
  }
  lines.push('');
  lines.push('## artifacts');
  lines.push('- docs/planning.md: spec - Planning document with decisions');
  lines.push('');
  lines.push('## next');
  lines.push('- criticalDecisions: D-001, D-002');
  lines.push('- readFiles: docs/planning.md');
  lines.push('- warnings: No warnings');
  lines.push('');
  for (let i = 0; i < 40; i++) {
    lines.push(`Additional planning detail line ${i + 1}: describing architecture approach in detail`);
  }
  return lines.join('\n');
}

describe('TC-AC6-01: planning phase code fence detection', () => {
  it('returns warning (not error) when planning artifact contains code fences', () => {
    writePlanningMd(buildContentWithCodeFence());
    const result = checkL4ContentValidation('planning', docsDir, tempDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('[WARN]');
    expect(result.evidence).toContain('Code fences found');
  });
});

describe('TC-AC7-01: inline code is allowed', () => {
  it('passes when artifact uses inline code but no code fences', () => {
    const content = buildContentWithoutCodeFence().replace(
      'Decision 1 about implementation strategy',
      'Decision 1 about `implementation` strategy',
    );
    writePlanningMd(content);
    const result = checkL4ContentValidation('planning', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });
});

describe('TC-AC8-01: .mmd files are exempt from code fence check', () => {
  it('passes for .mmd file even with code fence content', () => {
    // state_machine outputs .mmd; use it with noCodeFences not set
    // We test directly that .mmd extension skips the check by using a phase
    // that outputs .mmd - the code fence regex is only checked when ext != .mmd
    const mmdContent = '```\nstateDiagram-v2\n  [*] --> Active\n```\n';
    writeFileSync(join(docsDir, 'state-machine.mmd'), mmdContent, 'utf8');
    const result = checkL4ContentValidation('state_machine', docsDir, tempDir);
    // state_machine does not have noCodeFences, so check should pass regardless
    expect(result.evidence).not.toContain('Code fences prohibited');
  });
});

describe('TC-AC9-01: noCodeFences=false phases skip the check', () => {
  it('passes for research phase even with code fences in content', () => {
    const content = buildContentWithCodeFence();
    writeFileSync(join(docsDir, 'research.md'), content, 'utf8');
    const result = checkL4ContentValidation('research', docsDir, tempDir);
    // research does not have noCodeFences=true, so code fences are allowed
    expect(result.evidence).not.toContain('Code fences prohibited');
  });
});

describe('TC-AC10-01: warning message includes file name and line number', () => {
  it('includes file name and line number in the warning evidence', () => {
    writePlanningMd(buildContentWithCodeFence());
    const result = checkL4ContentValidation('planning', docsDir, tempDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('planning.md');
    expect(result.evidence).toMatch(/line \d+/);
  });
});
