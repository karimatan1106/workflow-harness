/**
 * reflector-quality.test.ts — Tests for N-07 quality score filtering.
 * Ensures harmful-dominant lessons are excluded from prompt injection.
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

import {
  getLessonsForPhase, formatLessonsForPrompt, MIN_QUALITY_SCORE,
} from '../tools/reflector.js';
import { serializeStore } from '../tools/reflector-toon.js';

const REFLECTOR_PATH = join(TEST_STATE_DIR, 'reflector-log.toon');

function clearStore() { fsStore.clear(); }
function setReflectorStore(data: any) {
  fsStore.set(REFLECTOR_PATH, serializeStore(data));
}

describe('N-07: Reflector quality score filtering', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('MIN_QUALITY_SCORE is exported and equals 0.3', () => {
    expect(MIN_QUALITY_SCORE).toBe(0.3);
  });

  it('excludes lessons with qualityScore below threshold', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'bad pattern',
        lesson: 'harmful lesson', createdAt: new Date().toISOString(),
        hitCount: 5, helpfulCount: 0, harmfulCount: 5, category: 'failure',
      }],
      stashedFailures: [],
    });
    const lessons = getLessonsForPhase('research');
    expect(lessons.length).toBe(0);
  });

  it('retains lessons with qualityScore above threshold', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'good pattern',
        lesson: 'helpful lesson', createdAt: new Date().toISOString(),
        hitCount: 3, helpfulCount: 2, harmfulCount: 1, category: 'failure',
      }],
      stashedFailures: [],
    });
    const lessons = getLessonsForPhase('research');
    expect(lessons.length).toBe(1);
  });

  it('retains new lessons with no feedback (score 0.5)', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'new pattern',
        lesson: 'new lesson', createdAt: new Date().toISOString(),
        hitCount: 0, helpfulCount: 0, harmfulCount: 0, category: 'failure',
      }],
      stashedFailures: [],
    });
    const lessons = getLessonsForPhase('research');
    expect(lessons.length).toBe(1);
  });

  it('boundary: score=0.25 excluded, score=0.33 retained', () => {
    setReflectorStore({
      version: 3, nextLessonId: 3,
      lessons: [
        {
          id: 'L-001', phase: 'research', errorPattern: 'excluded pattern',
          lesson: 'excluded', createdAt: new Date().toISOString(),
          hitCount: 3, helpfulCount: 1, harmfulCount: 2, category: 'failure',
          // score = 1/(1+2+1) = 0.25 < 0.3 → excluded
        },
        {
          id: 'L-002', phase: 'research', errorPattern: 'retained pattern',
          lesson: 'retained', createdAt: new Date().toISOString(),
          hitCount: 5, helpfulCount: 2, harmfulCount: 3, category: 'failure',
          // score = 2/(2+3+1) = 0.333 >= 0.3 → retained
        },
      ],
      stashedFailures: [],
    });
    const lessons = getLessonsForPhase('research');
    expect(lessons.length).toBe(1);
    expect(lessons[0].id).toBe('L-002');
  });

  it('formatLessonsForPrompt excludes harmful lessons', () => {
    setReflectorStore({
      version: 3, nextLessonId: 3,
      lessons: [
        {
          id: 'L-001', phase: 'research', errorPattern: 'harmful pattern',
          lesson: 'harmful lesson', createdAt: new Date().toISOString(),
          hitCount: 5, helpfulCount: 0, harmfulCount: 5, category: 'failure',
        },
        {
          id: 'L-002', phase: 'research', errorPattern: 'good pattern',
          lesson: 'good lesson', createdAt: new Date().toISOString(),
          hitCount: 3, helpfulCount: 2, harmfulCount: 1, category: 'failure',
        },
      ],
      stashedFailures: [],
    });
    const output = formatLessonsForPrompt('research');
    expect(output).toContain('L-002');
    expect(output).not.toContain('L-001');
  });

  it('returns empty when all lessons below threshold', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'bad pattern',
        lesson: 'bad lesson', createdAt: new Date().toISOString(),
        hitCount: 10, helpfulCount: 0, harmfulCount: 10, category: 'failure',
      }],
      stashedFailures: [],
    });
    const lessons = getLessonsForPhase('research');
    expect(lessons.length).toBe(0);
    const output = formatLessonsForPrompt('research');
    expect(output).toBe('');
  });
});
