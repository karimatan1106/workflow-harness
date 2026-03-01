/**
 * Tests for retry.ts: buildRetryPrompt, error classification (EAC-1).
 */

import { describe, it, expect } from 'vitest';
import { buildRetryPrompt, type RetryContext } from '../tools/retry.js';

function makeCtx(errorMessage: string, retryCount = 1, model: 'sonnet' | 'haiku' | 'opus' = 'sonnet'): RetryContext {
  return { phase: 'research', taskName: 'test-task', docsDir: '/tmp/docs', retryCount, errorMessage, model };
}

describe('buildRetryPrompt error classification (EAC-1)', () => {
  it('classifies file missing errors as FileNotFound', () => {
    const result = buildRetryPrompt(makeCtx('File missing: /tmp/docs/research.md'));
    expect(result.errorClass).toBe('FileNotFound');
  });

  it('classifies forbidden pattern errors as SyntaxError', () => {
    const result = buildRetryPrompt(makeCtx('Forbidden patterns found: TODO, WIP'));
    expect(result.errorClass).toBe('SyntaxError');
  });

  it('classifies duplicate line errors as SyntaxError', () => {
    const result = buildRetryPrompt(makeCtx('Duplicate lines (3+ times): some repeated line'));
    expect(result.errorClass).toBe('SyntaxError');
  });

  it('classifies bracket placeholder errors as SyntaxError', () => {
    const result = buildRetryPrompt(makeCtx('Bracket placeholders [#xxx#] found in content'));
    expect(result.errorClass).toBe('SyntaxError');
  });

  it('classifies section density errors as LogicError', () => {
    const result = buildRetryPrompt(makeCtx('Section density 20.0% < required 30%'));
    expect(result.errorClass).toBe('LogicError');
  });

  it('classifies missing required sections as LogicError', () => {
    const result = buildRetryPrompt(makeCtx('Missing required sections: ## サマリー'));
    expect(result.errorClass).toBe('LogicError');
  });

  it('classifies RTM status errors as LogicError', () => {
    const result = buildRetryPrompt(makeCtx('RTM entries not at required status: F-001 (pending)'));
    expect(result.errorClass).toBe('LogicError');
  });

  it('classifies unknown errors as Unknown', () => {
    const result = buildRetryPrompt(makeCtx('Some completely unrecognized error message xyz'));
    expect(result.errorClass).toBe('Unknown');
  });
});

describe('buildRetryPrompt model escalation', () => {
  it('suggests model escalation for haiku on retry 2+', () => {
    const result = buildRetryPrompt(makeCtx('File missing', 2, 'haiku'));
    expect(result.suggestModelEscalation).toBe(true);
    expect(result.suggestedModel).toBe('sonnet');
  });

  it('does not suggest escalation for sonnet', () => {
    const result = buildRetryPrompt(makeCtx('File missing', 2, 'sonnet'));
    expect(result.suggestModelEscalation).toBe(false);
  });

  it('suggests sonnet model on retry 3+ regardless of current model', () => {
    const result = buildRetryPrompt(makeCtx('File missing', 3, 'haiku'));
    expect(result.suggestedModel).toBe('sonnet');
  });

  it('includes error message in prompt code block', () => {
    const result = buildRetryPrompt(makeCtx('File missing: /some/path.md'));
    expect(result.prompt).toContain('File missing: /some/path.md');
  });
});
