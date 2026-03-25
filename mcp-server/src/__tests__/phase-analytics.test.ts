/**
 * Tests for phase-analytics.ts -- error analysis, errorHistory, sorting, advice
 * @spec docs/spec/features/workflow-harness.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskState } from '../state/types.js';

vi.mock('../tools/error-toon.js', () => ({ readErrorToon: vi.fn(() => []) }));
vi.mock('../tools/metrics.js', () => ({ getTaskMetrics: vi.fn(() => null) }));
vi.mock('fs', () => ({ existsSync: vi.fn(() => false), readFileSync: vi.fn(() => '') }));

import { buildAnalytics } from '../tools/phase-analytics.js';
import { readErrorToon } from '../tools/error-toon.js';

function makeTask(overrides: Partial<TaskState> = {}): TaskState {
  return {
    taskId: 'test-task-001', taskName: 'test-task',
    userIntent: 'test intent', currentPhase: 'test_impl',
    status: 'active', retryCount: {}, proofLog: [],
    ...overrides,
  } as TaskState;
}

type Chk = { name: string; passed: boolean; message: string; level?: string };
function mkEntry(phase: string, retry: number, checks: Chk[]) {
  return {
    timestamp: '2026-03-26T10:00:00Z', phase, retryCount: retry,
    errors: checks.filter(c => !c.passed).map(c => `${c.name} failed`), checks,
  };
}

describe('buildErrorAnalysis via buildAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('TC-AC3-01: excludes passed=true checks from failure count', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      mkEntry('planning', 1, [
        { name: 'check_a', passed: true, message: 'all good' },
        { name: 'check_b', passed: false, message: 'validation failed' },
      ]),
    ]);
    const result = buildAnalytics(makeTask({ retryCount: { planning: 1 } }));
    const ps = result.errorAnalysis.find(e => e.phase === 'planning')!;
    expect(ps).toBeDefined();
    expect(ps.failures.find(f => f.check === 'check_a')).toBeUndefined();
    expect(ps.failures.find(f => f.check === 'check_b')!.count).toBe(1);
  });

  it('TC-AC3-02: uses actual check.level instead of hardcoded L1', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      mkEntry('design', 1, [
        { name: 'check_c', passed: false, message: 'invalid format', level: 'L3' },
      ]),
    ]);
    const result = buildAnalytics(makeTask({ retryCount: { design: 1 } }));
    const ds = result.errorAnalysis.find(e => e.phase === 'design')!;
    expect(ds.failures.find(f => f.check === 'check_c')!.level).toBe('L3');
  });
});

describe('errorHistory via buildAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('TC-AC2-01: flattens all entries and all checks into errorHistory', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      mkEntry('planning', 1, [
        { name: 'chk1', passed: false, message: 'fail1' },
        { name: 'chk2', passed: true, message: 'ok1' },
        { name: 'chk3', passed: false, message: 'fail2' },
      ]),
      mkEntry('design', 2, [
        { name: 'chk4', passed: false, message: 'fail3' },
        { name: 'chk5', passed: true, message: 'ok2' },
        { name: 'chk6', passed: false, message: 'fail4' },
      ]),
    ]);
    const result = buildAnalytics(makeTask());
    expect(result.errorHistory).toBeDefined();
    expect(result.errorHistory).toHaveLength(6);
    const first = result.errorHistory![0];
    expect(first.phase).toBe('planning');
    expect(first.retryCount).toBe(1);
    expect(first.check).toBe('chk1');
    expect(first.passed).toBe(false);
    expect(first.evidence).toBe('fail1');
    const fourth = result.errorHistory![3];
    expect(fourth.phase).toBe('design');
    expect(fourth.check).toBe('chk4');
  });
});

describe('buildErrorAnalysis sorting (AC-1)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('TC-AC1-01: failures array sorted by count descending', () => {
    const checks: Chk[] = [
      ...Array.from({ length: 2 }, () => ({ name: 'check_a', passed: false, message: 'f' })),
      ...Array.from({ length: 5 }, () => ({ name: 'check_b', passed: false, message: 'f' })),
      { name: 'check_c', passed: false, message: 'f' },
    ];
    vi.mocked(readErrorToon).mockReturnValue([mkEntry('planning', 1, checks)]);
    const result = buildAnalytics(makeTask({ retryCount: { planning: 1 } }));
    const ps = result.errorAnalysis.find(e => e.phase === 'planning')!;
    expect(ps).toBeDefined();
    expect(ps.failures[0].check).toBe('check_b');
    expect(ps.failures[0].count).toBeGreaterThanOrEqual(ps.failures[1].count);
    expect(ps.failures[2].check).toBe('check_c');
  });

  it('TC-AC1-02: same count L2+ check ranks above L1', () => {
    const checks: Chk[] = [
      ...Array.from({ length: 3 }, () => (
        { name: 'output_file_exists', passed: false, message: 'f', level: 'L1' }
      )),
      ...Array.from({ length: 3 }, () => (
        { name: 'section_structure', passed: false, message: 'f', level: 'L3' }
      )),
    ];
    vi.mocked(readErrorToon).mockReturnValue([mkEntry('design', 1, checks)]);
    const result = buildAnalytics(makeTask({ retryCount: { design: 1 } }));
    const ds = result.errorAnalysis.find(e => e.phase === 'design')!;
    expect(ds).toBeDefined();
    const l3Idx = ds.failures.findIndex(f => f.check === 'section_structure');
    const l1Idx = ds.failures.findIndex(f => f.check === 'output_file_exists');
    expect(l3Idx).toBeLessThan(l1Idx);
  });

  it('TC-AC1-03: empty errorEntries produces empty result', () => {
    vi.mocked(readErrorToon).mockReturnValue([]);
    const result = buildAnalytics(makeTask());
    expect(result.errorAnalysis).toEqual([]);
  });
});

describe('tdd_red_evidence advice (AC-3)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  function mkTddEntry(phase: string) {
    return mkEntry(phase, 1, [
      { name: 'tdd_red_evidence', passed: false, message: 'no red evidence' },
    ]);
  }

  it('TC-AC3-01n: generates advice when tdd_red_evidence fails 3+ times', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      mkTddEntry('test_design'), mkTddEntry('tdd_red'), mkTddEntry('test_impl'),
    ]);
    const task = makeTask({ retryCount: { test_design: 1, tdd_red: 1, test_impl: 1 } });
    const result = buildAnalytics(task);
    expect(result.advice.some(a => a.includes('tdd_red_evidence'))).toBe(true);
  });

  it('TC-AC3-02n: no advice when tdd_red_evidence fails <= 2 times', () => {
    vi.mocked(readErrorToon).mockReturnValue([
      mkTddEntry('test_design'), mkTddEntry('tdd_red'),
    ]);
    const task = makeTask({ retryCount: { test_design: 1, tdd_red: 1 } });
    const result = buildAnalytics(task);
    expect(result.advice.some(a => a.includes('tdd_red_evidence'))).toBe(false);
  });
});
