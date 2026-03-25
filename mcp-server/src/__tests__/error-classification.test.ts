/**
 * Tests for error-classification.ts -- recurring/cascading/one-off classification
 * TDD Red: error-classification.ts does not exist yet; all tests must fail.
 * @spec docs/workflows/harness-analytics-improvement/test-design.md
 */
import { describe, it, expect } from 'vitest';
import { classifyErrors } from '../analytics/error-classification.js';

describe('classifyErrors', () => {
  it('TC-AC4-01: classifies same check failing in 3+ phases as recurring', () => {
    const entries = [
      { phase: 'phase_1', checks: [{ name: 'chk_x', passed: false }] },
      { phase: 'phase_5', checks: [{ name: 'chk_x', passed: false }] },
      { phase: 'phase_9', checks: [{ name: 'chk_x', passed: false }] },
    ];

    const result = classifyErrors(entries);

    expect(result.recurring).toContain('chk_x');
    expect(result.oneOff).not.toContain('chk_x');
  });

  it('TC-AC4-02: classifies consecutive phase failures as cascading', () => {
    const entries = [
      { phase: 'phase_7', checks: [{ name: 'chk_y', passed: false }] },
      { phase: 'phase_8', checks: [{ name: 'chk_y', passed: false }] },
    ];

    const result = classifyErrors(entries);

    expect(result.cascading.length).toBeGreaterThanOrEqual(1);
    const cascadeEntry = result.cascading.find(c => c[0] === 'chk_y');
    expect(cascadeEntry).toBeDefined();
    expect(cascadeEntry).toContain('7');
    expect(cascadeEntry).toContain('8');
  });

  it('TC-AC4-03: classifies single occurrence as one-off', () => {
    const entries = [
      { phase: 'phase_3', checks: [{ name: 'chk_z', passed: false }] },
    ];

    const result = classifyErrors(entries);

    expect(result.oneOff).toContain('chk_z');
    expect(result.recurring).not.toContain('chk_z');
    expect(result.cascading.map(c => c[0])).not.toContain('chk_z');
  });

  it('TC-AC4-04: returns empty classification for empty input', () => {
    const result = classifyErrors([]);

    expect(result.recurring).toEqual([]);
    expect(result.cascading).toEqual([]);
    expect(result.oneOff).toEqual([]);
  });
});
