/**
 * Tests for outlier-detection.ts -- IQR-based outlier detection
 * TDD Red: outlier-detection.ts does not exist yet; all tests must fail.
 * @spec docs/workflows/harness-analytics-improvement/test-design.md
 */
import { describe, it, expect } from 'vitest';
import { detectOutliers } from '../analytics/outlier-detection.js';

describe('detectOutliers', () => {
  it('TC-AC2-01: detects outlier exceeding Q3+1.5*IQR', () => {
    const timings: Record<string, { seconds: number }> = {
      phase_0: { seconds: 100 },
      phase_1: { seconds: 120 },
      phase_2: { seconds: 130 },
      phase_3: { seconds: 140 },
      phase_4: { seconds: 500 },
    };

    const result = detectOutliers(timings);

    expect(result.length).toBeGreaterThanOrEqual(1);
    const outlierPhases = result.map(r => r.phase);
    expect(outlierPhases).toContain('phase_4');
    const outlier = result.find(r => r.phase === 'phase_4')!;
    expect(outlier.isOutlier).toBe(true);
    expect(outlier.seconds).toBe(500);
    expect(outlier.iqrScore).toBeGreaterThan(0);
  });

  it('TC-AC2-02: returns empty array when data points < 4', () => {
    const timings: Record<string, { seconds: number }> = {
      phase_0: { seconds: 100 },
      phase_1: { seconds: 200 },
      phase_2: { seconds: 300 },
    };

    const result = detectOutliers(timings);

    expect(result).toEqual([]);
  });

  it('TC-AC2-03: returns empty array when all values identical (IQR=0)', () => {
    const timings: Record<string, { seconds: number }> = {
      phase_0: { seconds: 100 },
      phase_1: { seconds: 100 },
      phase_2: { seconds: 100 },
      phase_3: { seconds: 100 },
    };

    const result = detectOutliers(timings);

    expect(result).toEqual([]);
  });
});
