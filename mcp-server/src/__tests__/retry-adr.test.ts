/**
 * retry-adr.test.ts — Tests for N-02 ADR links in retry prompts.
 * Ensures buildRetryPrompt includes relevant ADR rationale.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../tools/adr.js', () => ({
  getActiveADRs: vi.fn(() => []),
}));

import { buildRetryPrompt, type RetryContext } from '../tools/retry.js';
import { getActiveADRs } from '../tools/adr.js';

const baseCtx: RetryContext = {
  phase: 'implementation',
  taskName: 'test-task',
  docsDir: 'docs/workflows/test-task',
  retryCount: 1,
  errorMessage: 'Forbidden patterns found: TODO',
  model: 'sonnet',
};

describe('N-02: ADR links in retry prompts', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('includes ADR rationale when active ADRs exist', () => {
    vi.mocked(getActiveADRs).mockReturnValue([
      {
        id: 'ADR-001', statement: 'No forbidden words in artifacts',
        rationale: 'Forbidden words cause validator failures and retry loops',
        context: 'Quality gates', status: 'accepted' as const,
        taskId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      },
    ]);
    const result = buildRetryPrompt(baseCtx);
    expect(result.prompt).toContain('ADR-001');
    expect(result.prompt).toContain('No forbidden words');
  });

  it('works normally when no ADRs exist (N-67: still includes ERROR_ADR_MAP refs)', () => {
    vi.mocked(getActiveADRs).mockReturnValue([]);
    const result = buildRetryPrompt(baseCtx);
    expect(result.prompt).toBeTruthy();
    // N-67: ERROR/WHY/FIX format now includes ADR refs from ERROR_ADR_MAP
    // even when ADR store is empty (map-based, not store-based)
    expect(result.prompt).toContain('ERROR:');
    expect(result.prompt).toContain('WHY:');
    expect(result.prompt).toContain('FIX:');
  });

  it('limits ADR links to maximum 3', () => {
    vi.mocked(getActiveADRs).mockReturnValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `ADR-${String(i + 1).padStart(3, '0')}`,
        statement: `Decision ${i + 1}`, rationale: `Rationale ${i + 1}`,
        context: 'ctx', status: 'accepted' as const,
        taskId: 't1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      })),
    );
    const result = buildRetryPrompt(baseCtx);
    // Should contain at most 3 ADR references
    const adrMatches = result.prompt.match(/ADR-\d{3}/g) ?? [];
    // Each ADR appears once in the id reference
    const uniqueAdrs = new Set(adrMatches);
    expect(uniqueAdrs.size).toBeLessThanOrEqual(3);
  });

  it('handles ADR store read errors gracefully', () => {
    vi.mocked(getActiveADRs).mockImplementation(() => { throw new Error('Store corrupted'); });
    const result = buildRetryPrompt(baseCtx);
    expect(result.prompt).toBeTruthy();
    expect(result.errorClass).toBeDefined();
  });

  it('only includes statement and rationale, not internal fields', () => {
    vi.mocked(getActiveADRs).mockReturnValue([
      {
        id: 'ADR-001', statement: 'VISIBLE_STATEMENT', rationale: 'VISIBLE_RATIONALE',
        context: 'HIDDEN_CONTEXT', status: 'accepted' as const,
        taskId: 'HIDDEN_TASK_ID', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      },
    ]);
    const result = buildRetryPrompt(baseCtx);
    expect(result.prompt).toContain('VISIBLE_STATEMENT');
    expect(result.prompt).toContain('VISIBLE_RATIONALE');
    expect(result.prompt).not.toContain('HIDDEN_CONTEXT');
    expect(result.prompt).not.toContain('HIDDEN_TASK_ID');
  });
});
