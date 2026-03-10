/**
 * metrics.test.ts — Tests for G-18 harness metrics collection module.
 * Records phase timing, retry counts, DoD failure patterns, task completion.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

const TEST_STATE_DIR = '.claude/state';

// ── In-memory fs store ─────────────────────────────────────────────────────
const fsStore: Map<string, string> = new Map();

vi.mock('fs', () => ({
  default: {},
  existsSync: (p: string) => fsStore.has(p),
  readFileSync: (p: string, _enc: string) => {
    const v = fsStore.get(p);
    if (v === undefined) throw Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
    return v;
  },
  writeFileSync: (p: string, data: string, _enc?: string) => { fsStore.set(p, data); },
  mkdirSync: (_p: string, _opts?: any) => {},
}));

import {
  loadMetrics, recordPhaseStart, recordPhaseEnd,
  recordRetry, recordDoDFailure, recordTaskCompletion,
  getTaskMetrics, getAggregateMetrics,
} from '../tools/metrics.js';

const METRICS_PATH = join(TEST_STATE_DIR, 'metrics.json');

function clearStore() { fsStore.clear(); }
function getMetricsStore(): any {
  const v = fsStore.get(METRICS_PATH);
  if (!v) throw new Error('metrics store not found');
  return JSON.parse(v);
}

describe('Metrics store lifecycle', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('loadMetrics returns empty store when no file exists', () => {
    const store = loadMetrics();
    expect(store.version).toBe(1);
    expect(store.tasks).toEqual({});
    expect(store.aggregate.totalTasks).toBe(0);
  });

  it('loadMetrics loads existing store from disk', () => {
    fsStore.set(METRICS_PATH, JSON.stringify({
      version: 1,
      tasks: { 't1': { taskName: 'test', phases: {}, retries: 0, dodFailures: 0, startedAt: '', completedAt: null } },
      aggregate: { totalTasks: 1, completedTasks: 0, totalRetries: 0, totalDoDFailures: 0, phaseTimings: {} },
    }));
    const store = loadMetrics();
    expect(store.tasks['t1']).toBeDefined();
    expect(store.aggregate.totalTasks).toBe(1);
  });
});

describe('Phase timing', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('recordPhaseStart records start timestamp for a phase', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    const store = getMetricsStore();
    expect(store.tasks['t1']).toBeDefined();
    expect(store.tasks['t1'].phases['research']).toBeDefined();
    expect(store.tasks['t1'].phases['research'].startedAt).toBeTruthy();
  });

  it('recordPhaseEnd records end timestamp and calculates duration', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    // Simulate time passing
    recordPhaseEnd('t1', 'research');
    const store = getMetricsStore();
    const phase = store.tasks['t1'].phases['research'];
    expect(phase.endedAt).toBeTruthy();
    expect(typeof phase.durationMs).toBe('number');
    expect(phase.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('recordPhaseEnd without prior start creates entry with 0 duration', () => {
    recordPhaseEnd('t1', 'research');
    // Should not crash; creates minimal entry
    const store = getMetricsStore();
    expect(store.tasks['t1'].phases['research'].durationMs).toBe(0);
  });
});

describe('Retry tracking', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('recordRetry increments retry count for task and aggregate', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    recordRetry('t1', 'research', 'File missing');
    recordRetry('t1', 'research', 'File missing');
    const store = getMetricsStore();
    expect(store.tasks['t1'].retries).toBe(2);
    expect(store.aggregate.totalRetries).toBe(2);
  });

  it('recordRetry records phase-level retry details', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    recordRetry('t1', 'research', 'Section density too low');
    const store = getMetricsStore();
    expect(store.tasks['t1'].phases['research'].retries).toBe(1);
  });
});

describe('DoD failure tracking', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('recordDoDFailure increments failure count and records pattern', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    recordDoDFailure('t1', 'research', ['File missing', 'Section density']);
    const store = getMetricsStore();
    expect(store.tasks['t1'].dodFailures).toBe(1);
    expect(store.aggregate.totalDoDFailures).toBe(1);
    expect(store.tasks['t1'].phases['research'].dodFailurePatterns).toContain('File missing');
  });
});

describe('Task completion', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('recordTaskCompletion marks task as completed and updates aggregate', () => {
    recordPhaseStart('t1', 'test-task', 'scope_definition');
    recordTaskCompletion('t1');
    const store = getMetricsStore();
    expect(store.tasks['t1'].completedAt).toBeTruthy();
    expect(store.aggregate.completedTasks).toBe(1);
  });
});

describe('Query functions', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('getTaskMetrics returns metrics for a specific task', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    recordRetry('t1', 'research', 'err');
    const metrics = getTaskMetrics('t1');
    expect(metrics).toBeDefined();
    expect(metrics!.retries).toBe(1);
  });

  it('getTaskMetrics returns undefined for non-existent task', () => {
    const metrics = getTaskMetrics('nonexistent');
    expect(metrics).toBeUndefined();
  });

  it('getAggregateMetrics returns aggregate stats', () => {
    recordPhaseStart('t1', 'test-task', 'research');
    recordTaskCompletion('t1');
    const agg = getAggregateMetrics();
    expect(agg.totalTasks).toBe(1);
    expect(agg.completedTasks).toBe(1);
  });
});
