/**
 * gc.test.ts — Tests for G-15 garbage collection module.
 * Detects stale docs, orphaned workflow dirs, and expired state files.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

const TEST_STATE_DIR = '.claude/state';
const fsStore: Map<string, string> = new Map();
const statStore: Map<string, { mtimeMs: number; isDirectory: boolean }> = new Map();

vi.mock('fs', () => ({
  default: {},
  existsSync: (p: string) => fsStore.has(p) || statStore.has(p),
  readFileSync: (p: string, _enc: string) => {
    const v = fsStore.get(p);
    if (v === undefined) throw Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
    return v;
  },
  writeFileSync: (p: string, data: string, _enc?: string) => { fsStore.set(p, data); },
  mkdirSync: (_p: string, _opts?: any) => {},
  readdirSync: (p: string) => {
    const entries: string[] = [];
    for (const key of fsStore.keys()) {
      if (key.startsWith(p + '/') || key.startsWith(p + '\\')) {
        const rest = key.slice(p.length + 1);
        const first = rest.split(/[/\\]/)[0];
        if (!entries.includes(first)) entries.push(first);
      }
    }
    return entries;
  },
  statSync: (p: string) => {
    const s = statStore.get(p);
    if (s) return { mtimeMs: s.mtimeMs, isDirectory: () => s.isDirectory };
    return { mtimeMs: Date.now(), isDirectory: () => false };
  },
}));

import {
  runGCScan, type GCReport, type GCCandidate,
} from '../tools/gc.js';
import { serializeStore as serializeReflectorStore } from '../tools/reflector-toon.js';
import { serializeMetrics } from '../tools/metrics-toon-io.js';

function clearStore() { fsStore.clear(); statStore.clear(); }

describe('G-15: Garbage collection scan', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('runGCScan returns empty report when no state files exist', () => {
    const report = runGCScan(TEST_STATE_DIR);
    expect(report.candidates).toEqual([]);
    expect(report.totalCandidates).toBe(0);
  });

  it('detects stale reflector lessons older than 30 days with low hitCount', () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    fsStore.set(join(TEST_STATE_DIR, 'reflector-log.toon'), serializeReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'old error',
        lesson: 'old lesson', createdAt: old,
        hitCount: 0, helpfulCount: 0, harmfulCount: 0, category: 'failure',
      }],
      stashedFailures: [],
    }));
    const report = runGCScan(TEST_STATE_DIR);
    expect(report.candidates.length).toBeGreaterThanOrEqual(1);
    expect(report.candidates[0].type).toBe('stale_lesson');
  });

  it('does not flag active lessons with high hitCount', () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    fsStore.set(join(TEST_STATE_DIR, 'reflector-log.toon'), serializeReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'active error',
        lesson: 'useful lesson', createdAt: old,
        hitCount: 5, helpfulCount: 4, harmfulCount: 1, category: 'failure',
      }],
      stashedFailures: [],
    }));
    const report = runGCScan(TEST_STATE_DIR);
    const staleLessons = report.candidates.filter(c => c.type === 'stale_lesson');
    expect(staleLessons.length).toBe(0);
  });

  it('detects expired stashed failures older than 7 days', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    fsStore.set(join(TEST_STATE_DIR, 'reflector-log.toon'), serializeReflectorStore({
      version: 3, nextLessonId: 1, lessons: [],
      stashedFailures: [{
        phase: 'research', taskId: 'old-task',
        errorPattern: 'err', errorMessage: 'msg',
        retryCount: 1, createdAt: old,
      }],
    }));
    const report = runGCScan(TEST_STATE_DIR);
    const expired = report.candidates.filter(c => c.type === 'expired_stash');
    expect(expired.length).toBe(1);
  });

  it('detects stale metrics entries older than 90 days', () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    fsStore.set(join(TEST_STATE_DIR, 'metrics.toon'), serializeMetrics({
      version: 1,
      tasks: { 'old-task': { taskName: 'old', phases: {}, retries: 0, dodFailures: 0, startedAt: old, completedAt: old } },
      aggregate: { totalTasks: 1, completedTasks: 1, totalRetries: 0, totalDoDFailures: 0, phaseTimings: {} },
    }));
    const report = runGCScan(TEST_STATE_DIR);
    const staleMetrics = report.candidates.filter(c => c.type === 'stale_metrics');
    expect(staleMetrics.length).toBe(1);
  });

  it('report includes scan timestamp and summary', () => {
    const report = runGCScan(TEST_STATE_DIR);
    expect(report.scannedAt).toBeTruthy();
    expect(typeof report.totalCandidates).toBe('number');
  });
});
