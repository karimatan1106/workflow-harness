/**
 * first-pass-improvement.test.ts — Content verification tests for harness first-pass improvements.
 * TDD Red: Tests verify planned content exists in coordinator.md, worker.md, defs-stage4.ts.
 * @spec docs/workflows/harness-first-pass-improvement/test-design.md
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../..');

function readTarget(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

function countLines(relPath: string): number {
  return readTarget(relPath).split('\n').length;
}

describe('AC-1: Phase Output Rules in coordinator.md', () => {
  const content = () => readTarget('.claude/agents/coordinator.md');

  it('TC-AC1-01: Phase Output Rules section exists', () => {
    expect(content()).toContain('## Phase Output Rules');
  });

  it('TC-AC1-02: decisions quantitative rule (5 or more)', () => {
    expect(content()).toMatch(/decisions.*5件以上/);
  });

  it('TC-AC1-03: artifacts enumeration rule', () => {
    expect(content()).toMatch(/artifacts.*列挙/);
  });

  it('TC-AC1-04: next field must not be empty', () => {
    expect(content()).toMatch(/next.*空欄禁止/);
  });
});

describe('AC-2: Edit Completeness in worker.md', () => {
  const content = () => readTarget('.claude/agents/worker.md');

  it('TC-AC2-01: Edit Completeness section exists', () => {
    expect(content()).toContain('## Edit Completeness');
  });

  it('TC-AC2-02: partial application prohibition', () => {
    expect(content()).toMatch(/部分適用.*禁止/);
  });

  it('TC-AC2-03: all-or-nothing principle', () => {
    expect(content()).toContain('全件適用');
  });
});

describe('AC-3: Baseline/RTM in defs-stage4.ts', () => {
  const content = () => readTarget('workflow-harness/mcp-server/src/phases/defs-stage4.ts');

  it('TC-AC3-01: harness_capture_baseline in implementation template', () => {
    expect(content()).toContain('harness_capture_baseline');
  });

  it('TC-AC3-02: harness_update_rtm_status in code_review template', () => {
    expect(content()).toContain('harness_update_rtm_status');
  });
});

describe('AC-4: 200-line limit', () => {
  it('TC-AC4-01: coordinator.md is 200 lines or fewer', () => {
    expect(countLines('.claude/agents/coordinator.md')).toBeLessThanOrEqual(200);
  });

  it('TC-AC4-02: worker.md is 200 lines or fewer', () => {
    expect(countLines('.claude/agents/worker.md')).toBeLessThanOrEqual(200);
  });

  it('TC-AC4-03: defs-stage4.ts is 200 lines or fewer', () => {
    expect(countLines('workflow-harness/mcp-server/src/phases/defs-stage4.ts')).toBeLessThanOrEqual(200);
  });
});
