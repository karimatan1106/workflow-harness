/**
 * progress-json.test.ts — Tests for G-16 structured progress recording.
 * Replaces plain text progress log with JSON format.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

const fsStore: Map<string, string> = new Map();

vi.mock('fs', () => ({
  default: {},
  existsSync: (p: string) => fsStore.has(p) || p.endsWith('docs/workflows/test-task'),
  readFileSync: (p: string, _enc: string) => {
    const v = fsStore.get(p);
    if (v === undefined) throw Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
    return v;
  },
  writeFileSync: (p: string, data: string, _enc?: string) => { fsStore.set(p, data); },
  appendFileSync: (p: string, data: string, _enc?: string) => {
    const existing = fsStore.get(p) ?? '';
    fsStore.set(p, existing + data);
  },
  mkdirSync: (_p: string, _opts?: any) => {},
}));

import { writeProgressJSON, readProgressJSON, type ProgressData } from '../state/progress-json.js';
import type { TaskState } from '../state/types.js';

function clearStore() { fsStore.clear(); }

function makeTaskState(overrides?: Partial<TaskState>): TaskState {
  return {
    taskId: 't1', taskName: 'test-task', version: 4,
    phase: 'implementation' as any, completedPhases: ['scope_definition', 'research'] as any,
    skippedPhases: [], size: 'small' as any, riskScore: 2 as any,
    userIntent: 'test intent for progress json',
    openQuestions: [], notInScope: [], scopeFiles: [], scopeDirs: [],
    plannedFiles: [], acceptanceCriteria: [], rtmEntries: [],
    proofLog: [], invariants: [], checkpoint: { phase: 'implementation' as any, timestamp: '' },
    docsDir: 'docs/workflows/test-task', workflowDir: '.claude/state/workflows/t1',
    sessionToken: 'tok', stateIntegrity: 'hmac',
    createdAt: '2026-03-10T00:00:00Z', updatedAt: '2026-03-10T01:00:00Z',
    ...overrides,
  } as TaskState;
}

describe('G-16: Progress JSON', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('writeProgressJSON creates a structured JSON file', () => {
    const state = makeTaskState();
    writeProgressJSON(state, 'research', 'implementation');
    const path = join('docs/workflows/test-task', 'claude-progress.json');
    const raw = fsStore.get(path);
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!);
    expect(data.taskId).toBe('t1');
    expect(data.taskName).toBe('test-task');
    expect(data.currentPhase).toBe('implementation');
  });

  it('writeProgressJSON includes completed phases and transition history', () => {
    const state = makeTaskState();
    writeProgressJSON(state, 'research', 'implementation');
    const path = join('docs/workflows/test-task', 'claude-progress.json');
    const data = JSON.parse(fsStore.get(path)!);
    expect(data.completedPhases).toEqual(['scope_definition', 'research']);
    expect(data.transitions.length).toBe(1);
    expect(data.transitions[0].from).toBe('research');
    expect(data.transitions[0].to).toBe('implementation');
  });

  it('writeProgressJSON appends to existing transitions', () => {
    const state = makeTaskState();
    writeProgressJSON(state, 'scope_definition', 'research');
    // Update state
    state.phase = 'implementation' as any;
    state.completedPhases = ['scope_definition', 'research'] as any;
    writeProgressJSON(state, 'research', 'implementation');
    const path = join('docs/workflows/test-task', 'claude-progress.json');
    const data = JSON.parse(fsStore.get(path)!);
    expect(data.transitions.length).toBe(2);
  });

  it('readProgressJSON returns parsed data', () => {
    const state = makeTaskState();
    writeProgressJSON(state, 'research', 'implementation');
    const data = readProgressJSON('docs/workflows/test-task');
    expect(data).toBeDefined();
    expect(data!.taskId).toBe('t1');
    expect(data!.currentPhase).toBe('implementation');
  });

  it('readProgressJSON returns undefined when file does not exist', () => {
    const data = readProgressJSON('nonexistent/path');
    expect(data).toBeUndefined();
  });

  it('writeProgressJSON includes remaining phase count', () => {
    const state = makeTaskState();
    writeProgressJSON(state, 'research', 'implementation');
    const path = join('docs/workflows/test-task', 'claude-progress.json');
    const data = JSON.parse(fsStore.get(path)!);
    expect(typeof data.completedCount).toBe('number');
    expect(data.completedCount).toBe(2);
  });
});
