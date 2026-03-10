/**
 * ace-reflector.test.ts — AC-1 through AC-5 coverage for ACE integration.
 * Uses vi.mock to intercept fs calls so no real files are written.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

// The modules resolve STATE_DIR at import time; we use the default '.claude/state'.
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

// ── Import modules AFTER mock is set up ────────────────────────────────────
import {
  loadStore, stashFailure, promoteStashedFailure,
  getLessonsForPhase, formatLessonsForPrompt,
} from '../tools/reflector.js';
import { runCuratorCycle } from '../tools/curator.js';
import { extractAndStoreBullets, getTopCrossTaskBullets } from '../tools/ace-context.js';
import { computeQualityScore, computePatternSimilarity } from '../tools/curator-helpers.js';

// Paths must match what the modules compute (Windows uses backslashes via path.join)
const REFLECTOR_PATH = join(TEST_STATE_DIR, 'reflector-log.json');
const ACE_PATH = join(TEST_STATE_DIR, 'ace-context.json');

function clearStore() { fsStore.clear(); }

function setReflectorStore(data: object) {
  fsStore.set(REFLECTOR_PATH, JSON.stringify(data));
}

function getReflectorStore(): any {
  const v = fsStore.get(REFLECTOR_PATH);
  if (!v) throw new Error(`reflector store not found at ${REFLECTOR_PATH}. Keys: ${[...fsStore.keys()].join(', ')}`);
  return JSON.parse(v);
}

// ══════════════════════════════════════════════════════════════════════════
// AC-1: ReflectorLessonのACEフィールド追加
// ══════════════════════════════════════════════════════════════════════════
describe('AC-1: ReflectorLessonのACEフィールド追加', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('TC-AC1-01: 新規lessonがid/helpfulCount/harmfulCount/category付きで生成される', () => {
    stashFailure('t1', 'research', 'connection timeout error', 1);
    promoteStashedFailure('t1', 'research', 2);
    const store = getReflectorStore();
    const lesson = store.lessons[0];
    expect(lesson.id).toMatch(/^L-\d{3}$/);
    expect(lesson.helpfulCount).toBe(1);
    expect(lesson.harmfulCount).toBe(0);
    expect(lesson.category).toBe('failure');
  });

  it('TC-AC1-02: v2 storeがv3形式に透過的にマイグレーションされる', () => {
    fsStore.set(REFLECTOR_PATH, JSON.stringify({
      version: 2,
      lessons: [
        { phase: 'research', errorPattern: 'timeout', lesson: 'increase timeout', createdAt: new Date().toISOString(), hitCount: 2 },
      ],
      stashedFailures: [],
    }));
    const store = loadStore();
    expect(store.version).toBe(3);
    expect(store.nextLessonId).toBeDefined();
    store.lessons.forEach((l: any) => {
      expect(l.helpfulCount).toBe(0);
      expect(l.harmfulCount).toBe(0);
      expect(l.category).toBe('failure');
      expect(l.id).toMatch(/^L-\d{3}$/);
    });
  });

  it('TC-AC1-03: nextLessonIdが採番ごとにインクリメントされる', () => {
    for (let i = 0; i < 3; i++) {
      stashFailure(`t${i}`, `phase${i}`, `unique error pattern number ${i} xyzabc`, 1);
      promoteStashedFailure(`t${i}`, `phase${i}`, 2);
    }
    const store = getReflectorStore();
    expect(store.lessons[0].id).toBe('L-001');
    expect(store.lessons[1].id).toBe('L-002');
    expect(store.lessons[2].id).toBe('L-003');
    expect(store.nextLessonId).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// AC-2: helpful/harmful更新ロジック
// ══════════════════════════════════════════════════════════════════════════
describe('AC-2: helpful/harmful更新ロジック', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('TC-AC2-01: stashFailure()で同一パターンのharmfulCountがインクリメントされる', () => {
    // Create lesson
    stashFailure('t1', 'research', 'connection timeout error', 1);
    promoteStashedFailure('t1', 'research', 2);
    // Second stash with same phase/pattern triggers harmfulCount on existing lesson
    stashFailure('t2', 'research', 'connection timeout error', 1);
    const store = getReflectorStore();
    expect(store.lessons.length).toBe(1);
    expect(store.lessons[0].harmfulCount).toBe(1);
  });

  it('TC-AC2-02: promoteStashedFailure()でhelpfulCountがインクリメントされる', () => {
    stashFailure('t1', 'research', 'connection timeout error', 1);
    promoteStashedFailure('t1', 'research', 2);
    // Second cycle: stash then promote same pattern
    stashFailure('t2', 'research', 'connection timeout error', 1);
    promoteStashedFailure('t2', 'research', 2);
    const store = getReflectorStore();
    expect(store.lessons[0].helpfulCount).toBeGreaterThanOrEqual(2);
  });

  it('TC-AC2-03: hitCountがhelpfulCount+harmfulCountと一致する', () => {
    stashFailure('t1', 'research', 'connection timeout error', 1);
    promoteStashedFailure('t1', 'research', 2);
    stashFailure('t2', 'research', 'connection timeout error', 1);
    const store = getReflectorStore();
    const lesson = store.lessons[0];
    expect(lesson.hitCount).toBe(lesson.helpfulCount + lesson.harmfulCount);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// AC-3: ACE形式プロンプト注入
// ══════════════════════════════════════════════════════════════════════════
describe('AC-3: ACE形式プロンプト注入', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('TC-AC3-01: formatLessonsForPrompt()が[L-001][failure] phase: pattern → lesson形式で出力する', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'timeout',
        lesson: 'increase timeout to 60s', createdAt: new Date().toISOString(),
        hitCount: 1, helpfulCount: 1, harmfulCount: 0, category: 'failure',
      }],
      stashedFailures: [],
    });
    const output = formatLessonsForPrompt('research');
    expect(output).toMatch(/\[L-001\]\[failure\] research: timeout → increase timeout to 60s/);
  });

  it('TC-AC3-02: getLessonsForPhase()がquality score降順で返す', () => {
    // Scores: 4/(4+1+1)=0.67, 2/(2+1+1)=0.50, 1/(1+1+1)=0.33
    // N-07: score < 0.3 は除外されるため全てMIN_QUALITY_SCORE以上のレッスンを使用
    setReflectorStore({
      version: 3, nextLessonId: 4,
      lessons: [
        { id: 'L-002', phase: 'research', errorPattern: 'err-b', lesson: 'b', createdAt: new Date().toISOString(), hitCount: 2, helpfulCount: 1, harmfulCount: 1, category: 'failure' },
        { id: 'L-001', phase: 'research', errorPattern: 'err-a', lesson: 'a', createdAt: new Date().toISOString(), hitCount: 5, helpfulCount: 4, harmfulCount: 1, category: 'failure' },
        { id: 'L-003', phase: 'research', errorPattern: 'err-c', lesson: 'c', createdAt: new Date().toISOString(), hitCount: 3, helpfulCount: 2, harmfulCount: 1, category: 'failure' },
      ],
      stashedFailures: [],
    });
    const lessons = getLessonsForPhase('research');
    const scores = lessons.map((l: any) =>
      l.helpfulCount === 0 && l.harmfulCount === 0
        ? 0.5
        : l.helpfulCount / (l.helpfulCount + l.harmfulCount + 1)
    );
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
  });

  it('TC-AC3-03: helpfulCount=0/harmfulCount=0のquality scoreが0.5である', () => {
    expect(computeQualityScore(0, 0)).toBe(0.5);
  });
});

// AC-4 and AC-5 tests moved to ace-reflector-curator.test.ts to maintain 200-line limit
