// Tests for StateManager — recordTestFile/getTestInfo, recordKnownBug/getKnownBugs, listTasks
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StateManager as StateManagerType } from '../state/manager.js';

let TEMP_DIR: string;
let STATE_DIR: string;
let StateManagerClass: typeof StateManagerType;

function createMgr(): StateManagerType { return new StateManagerClass(); }

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'mgr-lifecycle-test-'));
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

describe('recordTestFile and getTestInfo', () => {
  it('records a test file path and retrieves it via getTestInfo', () => {
    const mgr = createMgr();
    const state = mgr.createTask('tf-record-task', 'Intent for testfile task with sufficient length text ok.');
    mgr.recordTestFile(state.taskId, 'src/__tests__/foo.test.ts');
    const info = mgr.getTestInfo(state.taskId);
    expect(info).not.toBeNull();
    expect(info!.testFiles).toContain('src/__tests__/foo.test.ts');
  });
  it('does not add duplicate test file entries', () => {
    const mgr = createMgr();
    const state = mgr.createTask('tf-dedup-task', 'Intent for nodup-testfile task with sufficient length text.');
    mgr.recordTestFile(state.taskId, 'src/__tests__/bar.test.ts');
    mgr.recordTestFile(state.taskId, 'src/__tests__/bar.test.ts');
    const info = mgr.getTestInfo(state.taskId);
    expect(info!.testFiles.filter(f => f === 'src/__tests__/bar.test.ts').length).toBe(1);
  });
  it('getTestInfo returns empty testFiles array when none recorded', () => {
    const mgr = createMgr();
    const state = mgr.createTask('tf-empty-task', 'Intent for empty-testfile task with sufficient length text.');
    const info = mgr.getTestInfo(state.taskId);
    expect(info).not.toBeNull();
    expect(info!.testFiles).toEqual([]);
  });
  it('getTestInfo returns null for non-existent taskId', () => {
    const mgr = createMgr();
    expect(mgr.getTestInfo('00000000-0000-4000-8000-nonexistent00')).toBeNull();
  });
  it('getTestInfo includes baseline when captured via recordBaseline', () => {
    const mgr = createMgr();
    const state = mgr.createTask('tf-baseline-task', 'Intent for baseline task with sufficient length text ok.');
    mgr.recordBaseline(state.taskId, 10, 9, ['failing-test-name']);
    const info = mgr.getTestInfo(state.taskId);
    expect(info!.baseline).not.toBeNull();
    expect(info!.baseline.totalTests).toBe(10);
    expect(info!.baseline.passedTests).toBe(9);
    expect(info!.baseline.failedTests).toContain('failing-test-name');
  });
});

describe('recordKnownBug and getKnownBugs', () => {
  it('records a known bug and retrieves it', () => {
    const mgr = createMgr();
    const state = mgr.createTask('kb-basic-task', 'Intent for bug task with sufficient length text here ok.');
    const result = mgr.recordKnownBug(state.taskId, { testName: 'test-should-work', description: 'This test fails due to a pre-existing flaky behavior in the system.', severity: 'medium', targetPhase: 'backlog' });
    expect(result).toBe(true);
    const bugs = mgr.getKnownBugs(state.taskId);
    expect(bugs).toHaveLength(1);
    expect(bugs[0].testName).toBe('test-should-work');
    expect(bugs[0].severity).toBe('medium');
    expect(typeof bugs[0].recordedAt).toBe('string');
  });
  it('returns empty array when no bugs recorded', () => {
    const mgr = createMgr();
    expect(mgr.getKnownBugs(mgr.createTask('kb-empty-task', 'Intent for nobug task with sufficient length text here ok.').taskId)).toEqual([]);
  });
  it('returns empty array for non-existent taskId', () => {
    expect(createMgr().getKnownBugs('00000000-0000-4000-8000-nonexistent00')).toEqual([]);
  });
  it('accumulates multiple bugs', () => {
    const mgr = createMgr();
    const state = mgr.createTask('kb-multi-task', 'Intent for multibug task with sufficient length text ok.');
    mgr.recordKnownBug(state.taskId, { testName: 'test-1', description: 'First known bug with full description.', severity: 'low' });
    mgr.recordKnownBug(state.taskId, { testName: 'test-2', description: 'Second known bug with full description.', severity: 'high' });
    const bugs = mgr.getKnownBugs(state.taskId);
    expect(bugs).toHaveLength(2);
    expect(bugs.map(b => b.testName)).toContain('test-1');
    expect(bugs.map(b => b.testName)).toContain('test-2');
  });
  it('stores optional issueUrl when provided', () => {
    const mgr = createMgr();
    const state = mgr.createTask('kb-url-task', 'Intent for issueurl task with sufficient length text ok.');
    mgr.recordKnownBug(state.taskId, { testName: 'test-with-issue', description: 'Bug with a linked issue tracker URL for tracking purposes.', severity: 'critical', issueUrl: 'https://github.com/example/repo/issues/42' });
    expect(mgr.getKnownBugs(state.taskId)[0].issueUrl).toBe('https://github.com/example/repo/issues/42');
  });
});

describe('listTasks', () => {
  it('returns active tasks in the list', () => {
    const mgr = createMgr();
    const state = mgr.createTask('list-active-task', 'Intent for list task with sufficient length text here ok.');
    const found = mgr.listTasks().find(t => t.taskId === state.taskId);
    expect(found).toBeDefined();
    expect(found!.taskName).toBe('list-active-task');
    expect(found!.phase).toBe(state.phase);
  });
  it('returns multiple active tasks', () => {
    const mgr = createMgr();
    const s1 = mgr.createTask('list-alpha-task', 'Intent for task-alpha with sufficient length text here ok.');
    const s2 = mgr.createTask('list-beta-task', 'Intent for task-beta with sufficient length text here ok.');
    const ids = mgr.listTasks().map(t => t.taskId);
    expect(ids).toContain(s1.taskId);
    expect(ids).toContain(s2.taskId);
  });
  it('only includes tasks with valid HMAC (tampered tasks are excluded)', () => {
    const mgr = createMgr();
    const state = mgr.createTask('list-tamper-task', 'Intent for hmac-list task with sufficient length text ok.');
    const stateFile = join(STATE_DIR, 'workflows', `${state.taskId}_list-tamper-task`, 'workflow-state.json');
    const raw = JSON.parse(readFileSync(stateFile, 'utf8'));
    raw.taskName = 'tampered-for-list-test';
    writeFileSync(stateFile, JSON.stringify(raw, null, 2));
    expect(mgr.listTasks().find(t => t.taskId === state.taskId)).toBeUndefined();
  });
});
