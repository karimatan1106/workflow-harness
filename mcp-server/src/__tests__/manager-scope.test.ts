/**
 * Tests for StateManager — advancePhase, approveGate, completeSubPhase, updateScope
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StateManager as StateManagerType } from '../state/manager.js';

let TEMP_DIR: string;
let STATE_DIR: string;
let DOCS_DIR: string;
let StateManagerClass: typeof StateManagerType;

function createMgr(): StateManagerType { return new StateManagerClass(); }

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'mgr-scope-test-'));
  STATE_DIR = join(TEMP_DIR, 'state');
  DOCS_DIR = join(TEMP_DIR, 'docs');
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });
  vi.stubEnv('STATE_DIR', STATE_DIR);
  vi.stubEnv('DOCS_DIR', DOCS_DIR);
  vi.resetModules();
  const mod = await import('../state/manager.js');
  StateManagerClass = mod.StateManager;
});

afterAll(() => {
  vi.unstubAllEnvs();
  if (TEMP_DIR) rmSync(TEMP_DIR, { recursive: true, force: true });
});

describe('advancePhase', () => {
  it('moves the task to the next phase', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ap-advance-task', 'Intent for advance task with sufficient length text ok.');
    const initialPhase = state.phase;
    const result = mgr.advancePhase(state.taskId);
    expect(result.success).toBe(true);
    expect(result.nextPhase).toBeDefined();
    expect(result.nextPhase).not.toBe(initialPhase);
  });
  it('adds the previous phase to completedPhases', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ap-complete-task', 'Intent for complete task with sufficient length text ok.');
    const initialPhase = state.phase;
    mgr.advancePhase(state.taskId);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.completedPhases).toContain(initialPhase);
  });
  it('returns error for non-existent taskId', () => {
    const mgr = createMgr();
    const result = mgr.advancePhase('00000000-0000-4000-8000-nonexistent00');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
  it('persists the phase change to disk', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ap-persist-task', 'Intent for persist task with sufficient length text ok.');
    mgr.advancePhase(state.taskId);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.phase).not.toBe(state.phase);
  });
  it('updates the HMAC after phase advance', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ap-hmac-task', 'Intent for hmac-advance task with sufficient length text.');
    const oldIntegrity = state.stateIntegrity;
    mgr.advancePhase(state.taskId);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.stateIntegrity).not.toBe(oldIntegrity);
  });
});

describe('approveGate', () => {
  it('records an approval for the given type', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ag-approve-task', 'Intent for approve task with sufficient length text ok.');
    const result = mgr.approveGate(state.taskId, 'requirements');
    expect(result.success).toBe(true);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.approvals?.requirements).toBeDefined();
    expect(typeof loaded!.approvals!.requirements.approvedAt).toBe('string');
  });
  it('returns error for non-existent taskId', () => {
    const mgr = createMgr();
    expect(mgr.approveGate('00000000-0000-4000-8000-nonexistent00', 'design').success).toBe(false);
  });
  it('can record multiple different approvals on the same task', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ag-multi-task', 'Intent for multi-approve task with sufficient length text.');
    mgr.approveGate(state.taskId, 'requirements');
    mgr.approveGate(state.taskId, 'design');
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.approvals?.requirements).toBeDefined();
    expect(loaded!.approvals?.design).toBeDefined();
  });
});

describe('completeSubPhase', () => {
  it('marks a sub-phase as completed', () => {
    const mgr = createMgr();
    const state = mgr.createTask('csp-sub-task', 'Intent for sub-phase task with sufficient length text ok.');
    const result = mgr.completeSubPhase(state.taskId, 'threat_modeling');
    expect(result.success).toBe(true);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.subPhaseStatus?.threat_modeling?.status).toBe('completed');
    expect(loaded!.subPhaseStatus?.threat_modeling?.completedAt).toBeDefined();
  });
  it('can complete multiple sub-phases independently', () => {
    const mgr = createMgr();
    const state = mgr.createTask('csp-multi-task', 'Intent for multi-sub task with sufficient length text ok.');
    mgr.completeSubPhase(state.taskId, 'threat_modeling');
    mgr.completeSubPhase(state.taskId, 'planning');
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.subPhaseStatus?.threat_modeling?.status).toBe('completed');
    expect(loaded!.subPhaseStatus?.planning?.status).toBe('completed');
  });
  it('returns error for non-existent taskId', () => {
    const mgr = createMgr();
    expect(mgr.completeSubPhase('00000000-0000-4000-8000-nonexistent00', 'planning').success).toBe(false);
  });
});

describe('updateScope', () => {
  it('replaces scope when addMode is false (default)', () => {
    const mgr = createMgr();
    const state = mgr.createTask('us-replace-task', 'Intent for scope task with sufficient length text here ok.', ['old.ts']);
    mgr.updateScope(state.taskId, ['new.ts'], ['newdir/'], undefined, false);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.scopeFiles).toEqual(['new.ts']);
    expect(loaded!.scopeDirs).toEqual(['newdir/']);
  });
  it('merges scope when addMode is true', () => {
    const mgr = createMgr();
    const state = mgr.createTask('us-merge-task', 'Intent for merge-scope task with sufficient length text.', ['a.ts']);
    mgr.updateScope(state.taskId, ['b.ts'], ['lib/'], undefined, true);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.scopeFiles).toContain('a.ts');
    expect(loaded!.scopeFiles).toContain('b.ts');
    expect(loaded!.scopeDirs).toContain('lib/');
  });
  it('does not create duplicate entries when merging the same file', () => {
    const mgr = createMgr();
    const state = mgr.createTask('us-dedup-task', 'Intent for dedup-scope task with sufficient length text.', ['a.ts']);
    mgr.updateScope(state.taskId, ['a.ts'], [], undefined, true);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.scopeFiles.filter(f => f === 'a.ts').length).toBe(1);
  });
  it('sets scopeGlob when provided', () => {
    const mgr = createMgr();
    const state = mgr.createTask('us-glob-task', 'Intent for glob task with sufficient length text here ok.');
    mgr.updateScope(state.taskId, [], [], 'src/**/*.ts');
    expect(mgr.loadTask(state.taskId)!.scopeGlob).toBe('src/**/*.ts');
  });
  it('returns false for non-existent taskId', () => {
    const mgr = createMgr();
    expect(mgr.updateScope('00000000-0000-4000-8000-nonexistent00', [], [])).toBe(false);
  });
});
