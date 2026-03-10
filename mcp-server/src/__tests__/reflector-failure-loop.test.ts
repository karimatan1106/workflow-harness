/**
 * reflector-failure-loop.test.ts — Tests for G-08 failure→prevention rule loop.
 * When a failure pattern recurs 2+ times, the reflector auto-generates a prevention
 * rule that gets injected into subsequent subagent prompts.
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
  stashFailure, promoteStashedFailure,
  getLessonsForPhase, formatLessonsForPrompt,
  extractErrorPattern, getPreventionRules,
} from '../tools/reflector.js';

const REFLECTOR_PATH = join(TEST_STATE_DIR, 'reflector-log.json');

function clearStore() { fsStore.clear(); }
function setReflectorStore(data: object) {
  fsStore.set(REFLECTOR_PATH, JSON.stringify(data));
}
function getReflectorStore(): any {
  const v = fsStore.get(REFLECTOR_PATH);
  if (!v) throw new Error('reflector store not found');
  return JSON.parse(v);
}

describe('G-08: Prevention rule generation', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('generates a prevention rule when same error pattern fails 2+ times', () => {
    // First failure cycle
    stashFailure('t1', 'research', 'Forbidden patterns found: TODO', 1);
    promoteStashedFailure('t1', 'research', 2);
    // Second failure cycle with same pattern
    stashFailure('t2', 'research', 'Forbidden patterns found: TODO', 1);
    promoteStashedFailure('t2', 'research', 2);

    const store = getReflectorStore();
    const lesson = store.lessons.find((l: any) => l.errorPattern.includes('Forbidden patterns'));
    expect(lesson).toBeDefined();
    expect(lesson.helpfulCount).toBeGreaterThanOrEqual(2);
    expect(lesson.preventionRule).toBeTruthy();
  });

  it('prevention rule contains actionable instruction', () => {
    // Use identical error message so they map to the same errorPattern
    stashFailure('t1', 'research', 'Section density 20.0% < required 30%', 1);
    promoteStashedFailure('t1', 'research', 2);
    stashFailure('t2', 'research', 'Section density 20.0% < required 30%', 1);
    promoteStashedFailure('t2', 'research', 2);

    const store = getReflectorStore();
    const lesson = store.lessons.find((l: any) => l.errorPattern.includes('Section density'));
    expect(lesson).toBeDefined();
    expect(lesson!.preventionRule).toContain('禁止');
  });

  it('getPreventionRules returns rules for a phase', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'Forbidden patterns found',
        lesson: 'lesson text', preventionRule: 'TODOを使用禁止。代わりに具体的な計画を記載すること。',
        createdAt: new Date().toISOString(),
        hitCount: 3, helpfulCount: 2, harmfulCount: 1, category: 'failure',
      }],
      stashedFailures: [],
    });
    const rules = getPreventionRules('research');
    expect(rules.length).toBe(1);
    expect(rules[0]).toContain('禁止');
  });

  it('getPreventionRules returns empty array for phase with no rules', () => {
    const rules = getPreventionRules('implementation');
    expect(rules).toEqual([]);
  });

  it('formatLessonsForPrompt includes prevention rules section', () => {
    setReflectorStore({
      version: 3, nextLessonId: 2,
      lessons: [{
        id: 'L-001', phase: 'research', errorPattern: 'Forbidden patterns found',
        lesson: 'lesson text', preventionRule: 'TODOを使用禁止。',
        createdAt: new Date().toISOString(),
        hitCount: 3, helpfulCount: 2, harmfulCount: 1, category: 'failure',
      }],
      stashedFailures: [],
    });
    const output = formatLessonsForPrompt('research');
    expect(output).toContain('禁止');
    expect(output).toContain('L-001');
  });
});

describe('G-08: Error pattern extraction robustness', () => {
  it('extracts forbidden pattern correctly', () => {
    expect(extractErrorPattern('Forbidden patterns found: TODO, WIP')).toContain('Forbidden patterns found');
  });

  it('extracts section density pattern', () => {
    expect(extractErrorPattern('Section density 20.0% < required 30%')).toContain('Section density');
  });

  it('extracts missing sections pattern', () => {
    expect(extractErrorPattern('Missing required sections: ## Summary')).toContain('Missing required sections');
  });

  it('truncates unknown patterns to 80 chars', () => {
    const longError = 'A'.repeat(200);
    expect(extractErrorPattern(longError).length).toBeLessThanOrEqual(80);
  });
});
