/**
 * N-26: Plankton routing — complexity-based model selection in buildRetryPrompt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../tools/adr.js', () => ({
  getActiveADRs: vi.fn(() => []),
}));

import { buildRetryPrompt, type RetryContext } from '../tools/retry.js';
import type { DoDCheckResult } from '../gates/dod-types.js';

function makeCtx(errorMessage: string, retryCount = 1): RetryContext {
  return { phase: 'implementation', taskName: 'test', docsDir: '/tmp', retryCount, errorMessage, model: 'sonnet' };
}

function makeChecks(level: 'L1' | 'L2' | 'L3' | 'L4', check: string): DoDCheckResult[] {
  return [{ level, check, passed: false, evidence: 'fail', fix: 'fix it' }];
}

describe('N-26: Plankton routing — complexity-based model selection', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('TC-R01: L4 errors + SyntaxError → haiku', () => {
    const result = buildRetryPrompt(makeCtx('Forbidden patterns found'), makeChecks('L4', 'artifact_quality'));
    expect(result.suggestedModel).toBe('haiku');
  });

  it('TC-R02: L3 errors + LogicError → sonnet', () => {
    const result = buildRetryPrompt(makeCtx('Section density too low'), makeChecks('L3', 'section_density'));
    expect(result.suggestedModel).toBe('sonnet');
  });

  it('TC-R03: L1 errors + FileNotFound → opus', () => {
    const result = buildRetryPrompt(makeCtx('File missing: /tmp/x.md'), makeChecks('L1', 'output_file_exists'));
    expect(result.suggestedModel).toBe('opus');
  });

  it('TC-R04: retryCount=0 + trivial → still haiku', () => {
    const result = buildRetryPrompt(makeCtx('Forbidden patterns found', 0), makeChecks('L4', 'artifact_quality'));
    expect(result.suggestedModel).toBe('haiku');
  });

  it('TC-R05: retryCount=5 + trivial → still haiku (complexity overrides count)', () => {
    const result = buildRetryPrompt(makeCtx('Forbidden patterns found', 5), makeChecks('L4', 'artifact_quality'));
    expect(result.suggestedModel).toBe('haiku');
  });
});
