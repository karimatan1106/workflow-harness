// Tests for StateManager — resetTask, goBack, sub-phase deps
// Split from manager-lifecycle.test.ts for 200-line limit.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StateManager as StateManagerType } from '../state/manager.js';

let TEMP_DIR: string;
let STATE_DIR: string;
let StateManagerClass: typeof StateManagerType;

function createMgr(): StateManagerType { return new StateManagerClass(); }

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'mgr-reset-test-'));
  STATE_DIR = join(TEMP_DIR, 'state');
  const DOCS_DIR = join(TEMP_DIR, 'docs');
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

describe('resetTask', () => {
  it('resets completedPhases to empty and sets the target phase', () => {
    const mgr = createMgr();
    const state = mgr.createTask('rt-reset-task', 'Intent for reset task with sufficient length text here ok.');
    mgr.advancePhase(state.taskId);
    mgr.advancePhase(state.taskId);
    const result = mgr.resetTask(state.taskId, 'scope_definition', 'Resetting to start');
    expect(result.success).toBe(true);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.phase).toBe('scope_definition');
    expect(loaded!.completedPhases).toEqual([]);
  });
  it('records reset history with reason and targetPhase', () => {
    const mgr = createMgr();
    const state = mgr.createTask('rt-history-task', 'Intent for history task with sufficient length text here ok.');
    mgr.resetTask(state.taskId, 'scope_definition', 'Testing reset reason value');
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.resetHistory).toHaveLength(1);
    expect(loaded!.resetHistory![0].reason).toBe('Testing reset reason value');
    expect(loaded!.resetHistory![0].targetPhase).toBe('scope_definition');
  });
  it('returns error for non-existent taskId', () => {
    expect(createMgr().resetTask('00000000-0000-4000-8000-nonexistent00', 'scope_definition', 'reason').success).toBe(false);
  });
  it('updates HMAC after reset so the state can still be loaded', () => {
    const mgr = createMgr();
    const state = mgr.createTask('rt-hmac-task', 'Intent for hmac-reset task with sufficient length text ok.');
    mgr.resetTask(state.taskId, 'scope_definition', 'reset');
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.stateIntegrity).not.toBe(state.stateIntegrity);
    expect(loaded).not.toBeNull();
  });
  it('clears subPhaseStatus on reset', () => {
    const mgr = createMgr();
    const state = mgr.createTask('rt-subphase-reset', 'Intent for subphase reset with sufficient length text ok.');
    mgr.completeSubPhase(state.taskId, 'threat_modeling');
    expect(mgr.loadTask(state.taskId)!.subPhaseStatus!['threat_modeling']?.status).toBe('completed');
    mgr.resetTask(state.taskId, 'scope_definition', 'clearing subs');
    const loaded = mgr.loadTask(state.taskId)!;
    // After reset, subPhaseStatus is empty (normalized away during TOON roundtrip)
    expect(loaded.subPhaseStatus === undefined || Object.keys(loaded.subPhaseStatus).length === 0).toBe(true);
  });
  it('clears retryCount on reset', () => {
    const mgr = createMgr();
    const state = mgr.createTask('rt-retry-reset', 'Intent for retryCount reset test with sufficient length text ok.');
    mgr.incrementRetryCount(state.taskId, 'planning');
    mgr.incrementRetryCount(state.taskId, 'research');
    expect(mgr.getRetryCount(state.taskId, 'planning')).toBe(1);
    mgr.resetTask(state.taskId, 'scope_definition' as any, 'clearing retry counts');
    const loaded = mgr.loadTask(state.taskId);
    // After reset, retryCount is empty (normalized away during TOON roundtrip)
    expect(loaded!.retryCount === undefined || Object.keys(loaded!.retryCount).length === 0).toBe(true);
  });
});

describe('goBack', () => {
  it('clears retryCount on goBack', () => {
    const mgr = createMgr();
    const state = mgr.createTask('gb-retry-clear', 'Intent for goBack retryCount clear test with sufficient length.');
    mgr.advancePhase(state.taskId);
    mgr.incrementRetryCount(state.taskId, 'research');
    expect(mgr.getRetryCount(state.taskId, 'research')).toBe(1);
    const result = mgr.goBack(state.taskId, 'scope_definition' as any);
    expect(result.success).toBe(true);
    const loaded = mgr.loadTask(state.taskId);
    // After goBack, retryCount is empty (normalized away during TOON roundtrip)
    expect(loaded!.retryCount === undefined || Object.keys(loaded!.retryCount).length === 0).toBe(true);
  });

  it('TC-AC4-01: goBack clears artifactHashes to empty object', () => {
    const mgr = createMgr();
    const state = mgr.createTask('gb-artifact-clear', 'Intent for goBack artifactHashes clear test with enough length.');
    mgr.advancePhase(state.taskId);
    // Set artifactHashes via internal state mutation before goBack
    const loaded1 = mgr.loadTask(state.taskId)!;
    (loaded1 as any).artifactHashes = { phase1: 'hash1' };
    mgr.saveTask(loaded1);
    const result = mgr.goBack(state.taskId, 'scope_definition' as any);
    expect(result.success).toBe(true);
    const loaded2 = mgr.loadTask(state.taskId);
    expect(loaded2!.artifactHashes === undefined || Object.keys(loaded2!.artifactHashes).length === 0).toBe(true);
  });

  it('TC-AC4-02: goBack clears retryCount to empty (regression)', () => {
    const mgr = createMgr();
    const state = mgr.createTask('gb-retry-regress', 'Intent for goBack retryCount regression test with enough length.');
    mgr.advancePhase(state.taskId);
    mgr.incrementRetryCount(state.taskId, 'research');
    const result = mgr.goBack(state.taskId, 'scope_definition' as any);
    expect(result.success).toBe(true);
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded!.retryCount === undefined || Object.keys(loaded!.retryCount).length === 0).toBe(true);
  });

  it('TC-AC4-03: goBack slices completedPhases correctly', () => {
    const mgr = createMgr();
    const state = mgr.createTask('gb-completed-slice', 'Intent for goBack completedPhases slice test with enough length.');
    mgr.advancePhase(state.taskId);
    mgr.advancePhase(state.taskId);
    mgr.advancePhase(state.taskId);
    const loaded1 = mgr.loadTask(state.taskId)!;
    const secondPhase = loaded1.completedPhases[1];
    const result = mgr.goBack(state.taskId, secondPhase as any);
    expect(result.success).toBe(true);
    const loaded2 = mgr.loadTask(state.taskId);
    expect(loaded2!.completedPhases).toHaveLength(1);
    expect(loaded2!.phase).toBe(secondPhase);
  });
});

describe('sub-phase dependency enforcement', () => {
  it('blocks planning completion when threat_modeling is not completed', () => {
    const mgr = createMgr();
    const state = mgr.createTask('dep-block-task', 'Intent for dependency blocking test with enough length ok.');
    const result = mgr.completeSubPhase(state.taskId, 'planning');
    expect(result.success).toBe(false);
    expect(result.error).toContain('threat_modeling');
    expect(result.error).toContain('planning');
  });
  it('allows planning completion after threat_modeling is completed', () => {
    const mgr = createMgr();
    const state = mgr.createTask('dep-allow-task', 'Intent for dependency allow test with enough length text ok.');
    expect(mgr.completeSubPhase(state.taskId, 'threat_modeling').success).toBe(true);
    expect(mgr.completeSubPhase(state.taskId, 'planning').success).toBe(true);
  });
  it('allows sub-phases with no dependencies to complete freely', () => {
    const mgr = createMgr();
    const state = mgr.createTask('dep-free-task', 'Intent for no-dependency sub-phase test with enough length ok.');
    expect(mgr.completeSubPhase(state.taskId, 'state_machine').success).toBe(true);
  });
});
