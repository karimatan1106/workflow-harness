/**
 * Tests for analytics-toon.ts — writeAnalyticsToon errorHistory output
 * TDD Red: errorHistory output does not exist yet in writeAnalyticsToon.
 * @spec docs/spec/features/workflow-harness.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalyticsResult } from '../tools/phase-analytics.js';

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));
vi.mock('../state/toon-io-adapter.js', () => ({
  toonEncode: vi.fn((obj: unknown) => JSON.stringify(obj)),
}));

import { writeAnalyticsToon } from '../tools/analytics-toon.js';
import { writeFileSync } from 'fs';
import { toonEncode } from '../state/toon-io-adapter.js';

function makeAnalytics(overrides: Partial<AnalyticsResult> = {}): AnalyticsResult {
  return {
    errorAnalysis: [],
    bottlenecks: {},
    advice: [],
    ...overrides,
  } as AnalyticsResult;
}

describe('writeAnalyticsToon errorHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-AC2-02: includes errorHistory array in output', () => {
    const analytics = makeAnalytics({
      errorHistory: [
        {
          phase: 'planning',
          retryCount: 1,
          check: 'toon_safety',
          level: 'L2',
          passed: false,
          evidence: 'missing field',
        },
      ],
    } as Partial<AnalyticsResult>);

    writeAnalyticsToon('/tmp/test-docs', 'test-task', 'task-001', analytics);

    expect(toonEncode).toHaveBeenCalledTimes(1);
    const encodedArg = vi.mocked(toonEncode).mock.calls[0][0] as Record<string, unknown>;

    // errorHistory should be present in the encoded object
    expect(encodedArg.errorHistory).toBeDefined();
    expect(Array.isArray(encodedArg.errorHistory)).toBe(true);

    const history = encodedArg.errorHistory as Array<Record<string, unknown>>;
    expect(history).toHaveLength(1);
    expect(history[0].phase).toBe('planning');
    expect(history[0].retry).toBe(1);
    expect(history[0].check).toBe('toon_safety');
    expect(history[0].level).toBe('L2');
    expect(history[0].passed).toBe(false);
    expect(history[0].evidence).toBe('missing field');
  });

  it('TC-AC2-03: handles empty/undefined errorHistory without error', () => {
    const analytics = makeAnalytics();
    // errorHistory is undefined in the base analytics

    // Should not throw
    expect(() => {
      writeAnalyticsToon('/tmp/test-docs', 'test-task', 'task-002', analytics);
    }).not.toThrow();

    expect(toonEncode).toHaveBeenCalledTimes(1);
    const encodedArg = vi.mocked(toonEncode).mock.calls[0][0] as Record<string, unknown>;

    // errorHistory should default to empty array
    expect(encodedArg.errorHistory).toBeDefined();
    expect(encodedArg.errorHistory).toEqual([]);
  });
});
