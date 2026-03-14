/**
 * ace-reflector-curator.test.ts — AC-4 and AC-5 coverage for Curator and cross-task knowledge.
 * Split from ace-reflector.test.ts to maintain 200-line file limit.
 * Uses vi.mock to intercept fs calls so no real files are written.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

const TEST_STATE_DIR = '.claude/state';
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

import { runCuratorCycle } from '../tools/curator.js';
import { extractAndStoreBullets, getTopCrossTaskBullets } from '../tools/ace-context.js';
import { computeQualityScore, computePatternSimilarity } from '../tools/curator-helpers.js';
import { serializeBullets } from '../tools/ace-context-toon.js';
import { serializeStore, parseStore } from '../tools/reflector-toon.js';

const REFLECTOR_TOON_PATH = join(TEST_STATE_DIR, 'reflector-log.toon');
const ACE_PATH = join(TEST_STATE_DIR, 'ace-context.toon');

function clearStore() { fsStore.clear(); }

function setReflectorStore(data: any) {
  fsStore.set(REFLECTOR_TOON_PATH, serializeStore(data));
}

function getReflectorStore(): any {
  const toon = fsStore.get(REFLECTOR_TOON_PATH);
  if (toon) return parseStore(toon);
  throw new Error(`reflector store not found`);
}

// ══════════════════════════════════════════════════════════════════════════
// AC-4: Curatorのquality scoreベース刈り込み
// ══════════════════════════════════════════════════════════════════════════
describe('AC-4: Curatorのquality scoreベース刈り込み', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('TC-AC4-01: computeQualityScore(helpful,harmful)がhelpful/(helpful+harmful+1)を返す', () => {
    expect(computeQualityScore(2, 1)).toBeCloseTo(0.5, 5);
    expect(computeQualityScore(0, 5)).toBeCloseTo(0, 5);
    expect(computeQualityScore(10, 0)).toBeCloseTo(10 / 11, 3);
  });

  it('TC-AC4-02: curator trimがquality score昇順（低品質から）削除する', () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const lessons = Array.from({ length: 40 }, (_, i) => {
      const a = alphabet[Math.floor(i / 26) % 26];
      const b = alphabet[i % 26];
      return {
        id: `L-${String(i + 1).padStart(3, '0')}`,
        phase: 'research',
        errorPattern: `${a}${b}xx-missing-field-error`,
        lesson: `lesson for ${a}${b}`,
        createdAt: new Date().toISOString(),
        hitCount: 10, helpfulCount: 8, harmfulCount: 2, category: 'failure',
      };
    });
    lessons.push({
      id: 'L-041', phase: 'research', errorPattern: 'zzz-worst-quality-error', lesson: 'bad',
      createdAt: new Date().toISOString(), hitCount: 5, helpfulCount: 0, harmfulCount: 5, category: 'failure',
    });
    setReflectorStore({ version: 3, nextLessonId: 42, lessons, stashedFailures: [] });

    runCuratorCycle('task-x', 'test-task');

    const stored = getReflectorStore();
    expect(stored.lessons.length).toBe(40);
    expect(stored.lessons.find((l: any) => l.errorPattern === 'zzz-worst-quality-error')).toBeUndefined();
  });

  it('TC-AC4-03: 類似度0.7以上のlessonがfuzzy dedupで統合される', () => {
    const sim = computePatternSimilarity('connection timeout in phase', 'connection timeout at phase');
    expect(sim).toBeGreaterThanOrEqual(0.7);

    const lessons = [
      { id: 'L-001', phase: 'research', errorPattern: 'connection timeout in phase', lesson: 'lesson-a', createdAt: new Date().toISOString(), hitCount: 2, helpfulCount: 1, harmfulCount: 1, category: 'failure' },
      { id: 'L-002', phase: 'research', errorPattern: 'connection timeout at phase', lesson: 'lesson-b', createdAt: new Date().toISOString(), hitCount: 3, helpfulCount: 2, harmfulCount: 1, category: 'failure' },
    ];
    setReflectorStore({ version: 3, nextLessonId: 3, lessons, stashedFailures: [] });

    runCuratorCycle('task-y', 'test-task');

    const stored = getReflectorStore();
    expect(stored.lessons.length).toBe(1);
    expect(stored.lessons[0].harmfulCount).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// AC-5: cross-task knowledge
// ══════════════════════════════════════════════════════════════════════════
describe('AC-5: cross-task knowledge', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('TC-AC5-01: quality score>=0.6のlessonがace-context.toonに昇格される', () => {
    const lessons = [
      { id: 'L-001', phase: 'research', errorPattern: 'timeout', lesson: 'increase timeout', createdAt: new Date().toISOString(), hitCount: 5, helpfulCount: 4, harmfulCount: 1, category: 'failure' as const },
      { id: 'L-002', phase: 'research', errorPattern: 'other', lesson: 'other fix', createdAt: new Date().toISOString(), hitCount: 5, helpfulCount: 0, harmfulCount: 5, category: 'failure' as const },
    ];
    extractAndStoreBullets(lessons);
    const raw = fsStore.get(ACE_PATH);
    expect(raw).toBeDefined();
    const stored = getTopCrossTaskBullets(100);
    expect(stored.length).toBe(1);
    expect(stored[0].helpfulCount).toBe(4);
  });

  it('TC-AC5-02: getTopCrossTaskBullets(5)が上位5件を返す', () => {
    const bullets = Array.from({ length: 10 }, (_, i) => ({
      id: `L-${String(i + 1).padStart(3, '0')}`,
      content: `content-${i}`, category: 'failure' as const,
      phase: 'research', createdAt: new Date().toISOString(),
      helpfulCount: i + 1, harmfulCount: 0,
    }));
    fsStore.set(ACE_PATH, serializeBullets(bullets));

    const result = getTopCrossTaskBullets(5);
    expect(result.length).toBe(5);
    const scores = result.map((b: any) => b.helpfulCount / (b.helpfulCount + b.harmfulCount + 1));
    expect(scores[0]).toBeGreaterThanOrEqual(scores[4]);
  });

  it('TC-AC5-03: ace-context.ts操作がfsエラー時にthrowしない', () => {
    fsStore.set(ACE_PATH, 'INVALID TOON {{{{');
    const lessons = [
      { id: 'L-001', phase: 'r', errorPattern: 'e', lesson: 'l', createdAt: '', hitCount: 5, helpfulCount: 5, harmfulCount: 0, category: 'failure' as const },
    ];
    expect(() => extractAndStoreBullets(lessons)).not.toThrow();
    fsStore.set(ACE_PATH, 'NOT TOON');
    const result = getTopCrossTaskBullets(5);
    expect(Array.isArray(result)).toBe(true);
  });

  it('TC-AC5-04: runCuratorCycle後にgetTopCrossTaskBulletsで昇格件数が1件以上になる', () => {
    // helpfulCount=3, harmfulCount=0 → quality=3/4=0.75 > PROMOTE_THRESHOLD(0.6)
    const lesson = {
      id: 'L-001',
      phase: 'implementation',
      errorPattern: 'test-error',
      lesson: 'test lesson content',
      createdAt: new Date().toISOString(),
      hitCount: 3,
      helpfulCount: 3,
      harmfulCount: 0,
      category: 'failure' as const,
    };
    const store = {
      version: 3,
      nextLessonId: 2,
      lessons: [lesson],
      stashedFailures: [],
    };
    setReflectorStore(store);

    runCuratorCycle('test-task', 'TestTask');

    const bullets = getTopCrossTaskBullets(10);
    expect(bullets.length).toBeGreaterThanOrEqual(1);
    expect(['failure', 'strategy', 'constraint']).toContain(bullets[0].category);
  });
});
