/**
 * N-28: ERROR_ADR_MAP — error pattern to ADR ID mapping in retry prompts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../tools/adr.js', () => ({
  getActiveADRs: vi.fn(() => []),
}));

import { ERROR_ADR_MAP, buildRetryPrompt, type RetryContext } from '../tools/retry.js';
import { getActiveADRs } from '../tools/adr.js';

const baseCtx: RetryContext = {
  phase: 'implementation', taskName: 'test', docsDir: '/tmp',
  retryCount: 1, errorMessage: '', model: 'sonnet',
};

describe('N-28: ERROR_ADR_MAP', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('maps Forbidden patterns to ADR IDs', () => {
    expect(ERROR_ADR_MAP['Forbidden patterns']).toContain('ADR-FORBIDDEN');
  });

  it('prioritizes mapped ADR in retry prompt for matching error', () => {
    vi.mocked(getActiveADRs).mockReturnValue([
      {
        id: 'ADR-OTHER', statement: 'Other', rationale: 'r',
        context: 'c', status: 'accepted' as const,
        taskId: 't', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      },
      {
        id: 'ADR-FORBIDDEN', statement: 'No forbidden words', rationale: 'quality',
        context: 'c', status: 'accepted' as const,
        taskId: 't', createdAt: '2026-01-01', updatedAt: '2026-01-01',
      },
    ]);
    const result = buildRetryPrompt({ ...baseCtx, errorMessage: 'Forbidden patterns found: TODO' });
    const adrIdx = result.prompt.indexOf('ADR-FORBIDDEN');
    const otherIdx = result.prompt.indexOf('ADR-OTHER');
    expect(adrIdx).toBeGreaterThan(-1);
    // ADR-FORBIDDEN should appear before ADR-OTHER (prioritized)
    expect(adrIdx).toBeLessThan(otherIdx);
  });

  it('falls back to generic when error has no mapped ADR', () => {
    vi.mocked(getActiveADRs).mockReturnValue([]);
    const result = buildRetryPrompt({ ...baseCtx, errorMessage: 'Unknown weird error' });
    expect(result.prompt).toContain('改善要求');
    expect(result.prompt).not.toContain('ADR-');
  });
});
