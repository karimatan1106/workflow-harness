/**
 * TDD Red tests for classifyComplexity (AC-1: Tier C retry error classification).
 * classifyComplexity does not exist yet — all tests fail at import time.
 */

import { describe, it, expect } from 'vitest';
import { classifyComplexity, buildRetryPrompt, type RetryContext } from '../tools/retry.js';
import type { DoDCheckResult } from '../gates/dod-types.js';

function makeChecks(...levels: Array<{ level: DoDCheckResult['level']; check: string; passed: boolean }>): DoDCheckResult[] {
  return levels.map(l => ({ ...l, evidence: 'test evidence' }));
}

describe('classifyComplexity', () => {
  it('TC-AC1-01: L4 errors (density/formatting) → trivial', () => {
    const checks = makeChecks(
      { level: 'L4', check: 'forbidden_patterns', passed: false },
      { level: 'L4', check: 'duplicate_lines', passed: false },
    );
    expect(classifyComplexity(checks, 'SyntaxError')).toBe('trivial');
  });

  it('TC-AC1-02: L3 errors (missing section) → moderate', () => {
    const checks = makeChecks(
      { level: 'L3', check: 'required_sections', passed: false },
    );
    expect(classifyComplexity(checks, 'LogicError')).toBe('moderate');
  });

  it('TC-AC1-03: L1 errors (file missing) → critical', () => {
    const checks = makeChecks(
      { level: 'L1', check: 'output_file_exists', passed: false },
    );
    expect(classifyComplexity(checks, 'FileNotFound')).toBe('critical');
  });

  it('TC-AC1-04: buildRetryPrompt output contains complexity tag [TRIVIAL]', () => {
    const ctx: RetryContext = {
      phase: 'research',
      taskName: 'test-task',
      docsDir: '/tmp/docs',
      retryCount: 1,
      errorMessage: 'Forbidden patterns found: TODO',
      model: 'sonnet',
    };
    const checks = makeChecks(
      { level: 'L4', check: 'forbidden_patterns', passed: false },
    );
    const result = buildRetryPrompt(ctx, checks);
    expect(result.prompt).toContain('[TRIVIAL]');
  });

  it('TC-AC1-05: mixed errors → highest severity (critical) wins', () => {
    const checks = makeChecks(
      { level: 'L4', check: 'duplicate_lines', passed: false },
      { level: 'L3', check: 'content_lines', passed: false },
      { level: 'L1', check: 'output_file_exists', passed: false },
    );
    expect(classifyComplexity(checks, 'FileNotFound')).toBe('critical');
  });
});
