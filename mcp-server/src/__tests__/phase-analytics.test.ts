/**
 * Tests for phase-analytics.ts — error analysis and errorHistory
 * TDD Red: passed filter, level real value, and errorHistory do not exist yet.
 * @spec docs/spec/features/workflow-harness.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskState } from '../state/types.js';

vi.mock('../tools/error-toon.js', () => ({
  readErrorToon: vi.fn(() => []),
}));
vi.mock('../tools/metrics.js', () => ({
  getTaskMetrics: vi.fn(() => null),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

import { buildAnalytics } from '../tools/phase-analytics.js';
import { readErrorToon } from '../tools/error-toon.js';

function makeTask(overrides: Partial<TaskState> = {}): TaskState {
  return {
    taskId: 'test-task-001',
    taskName: 'test-task',
    userIntent: 'test intent for analytics validation',
    currentPhase: 'test_impl',
    status: 'active',
    retryCount: {},
    proofLog: [],
    ...overrides,
  } as TaskState;
}

describe('buildErrorAnalysis via buildAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-AC3-01: excludes passed=true checks from failure count', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      {
        timestamp: '2026-03-25T10:00:00Z',
        phase: 'planning',
        retryCount: 1,
        errors: ['check_b failed'],
        checks: [
          { name: 'check_a', passed: true, message: 'all good' },
          { name: 'check_b', passed: false, message: 'validation failed' },
        ],
      },
    ]);

    const task = makeTask({ retryCount: { planning: 1 } });
    const result = buildAnalytics(task);
    const planningStats = result.errorAnalysis.find(e => e.phase === 'planning');

    expect(planningStats).toBeDefined();
    // check_a (passed=true) should NOT appear in failures
    const checkAFailure = planningStats!.failures.find(f => f.check === 'check_a');
    expect(checkAFailure).toBeUndefined();
    // check_b (passed=false) should appear in failures
    const checkBFailure = planningStats!.failures.find(f => f.check === 'check_b');
    expect(checkBFailure).toBeDefined();
    expect(checkBFailure!.count).toBe(1);
  });

  it('TC-AC3-02: uses actual check.level instead of hardcoded L1', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      {
        timestamp: '2026-03-25T10:00:00Z',
        phase: 'design',
        retryCount: 1,
        errors: ['check_c failed'],
        checks: [
          { name: 'check_c', passed: false, message: 'invalid format', level: 'L3' },
        ],
      },
    ]);

    const task = makeTask({ retryCount: { design: 1 } });
    const result = buildAnalytics(task);
    const designStats = result.errorAnalysis.find(e => e.phase === 'design');

    expect(designStats).toBeDefined();
    const checkCFailure = designStats!.failures.find(f => f.check === 'check_c');
    expect(checkCFailure).toBeDefined();
    // Should use actual level 'L3', not hardcoded 'L1'
    expect(checkCFailure!.level).toBe('L3');
  });
});

describe('errorHistory via buildAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-AC2-01: flattens all entries and all checks into errorHistory', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      {
        timestamp: '2026-03-25T10:00:00Z',
        phase: 'planning',
        retryCount: 1,
        errors: ['err1'],
        checks: [
          { name: 'chk1', passed: false, message: 'fail1' },
          { name: 'chk2', passed: true, message: 'ok1' },
          { name: 'chk3', passed: false, message: 'fail2' },
        ],
      },
      {
        timestamp: '2026-03-25T11:00:00Z',
        phase: 'design',
        retryCount: 2,
        errors: ['err2'],
        checks: [
          { name: 'chk4', passed: false, message: 'fail3' },
          { name: 'chk5', passed: true, message: 'ok2' },
          { name: 'chk6', passed: false, message: 'fail4' },
        ],
      },
    ]);

    const task = makeTask();
    const result = buildAnalytics(task);

    // errorHistory should exist on AnalyticsResult (does not exist yet - Red)
    expect(result.errorHistory).toBeDefined();
    expect(result.errorHistory).toHaveLength(6);

    // Verify first entry's first check
    const first = result.errorHistory![0];
    expect(first.phase).toBe('planning');
    expect(first.retryCount).toBe(1);
    expect(first.check).toBe('chk1');
    expect(first.passed).toBe(false);
    expect(first.evidence).toBe('fail1');

    // Verify second entry's checks
    const fourth = result.errorHistory![3];
    expect(fourth.phase).toBe('design');
    expect(fourth.retryCount).toBe(2);
    expect(fourth.check).toBe('chk4');
  });
});
