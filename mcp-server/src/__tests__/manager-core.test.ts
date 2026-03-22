/**
 * Tests for StateManager — createTask, loadTask
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StateManager as StateManagerType } from '../state/manager.js';

let TEMP_DIR: string;
let STATE_DIR: string;
let DOCS_DIR: string;
let StateManagerClass: typeof StateManagerType;

function createMgr(): StateManagerType { return new StateManagerClass(); }

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'mgr-core-test-'));
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

describe('createTask', () => {
  it('creates and returns a TaskState with the given name and intent', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-basic-task', 'This is a user intent that is long enough to pass the minimum length requirement.');
    expect(state.taskName).toBe('ct-basic-task');
    expect(state.userIntent).toContain('user intent');
    expect(state.version).toBe(4);
  });
  it('generates a valid UUID v4 for taskId', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-uuid-task', 'Intent that has sufficient length for the validator test run ok.');
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(state.taskId)).toBe(true);
  });
  it('starts in the first active phase for small tasks (hearing)', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-small-phase-task', 'Intent for small task with sufficient length text here ok.');
    expect(state.phase).toBe('hearing');
  });
  it('creates the workflow state file on disk', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-disk-task', 'Intent for the disk task with sufficient length here ok.');
    const expectedFile = join(STATE_DIR, 'workflows', `${state.taskId}_ct-disk-task`, 'workflow-state.toon');
    expect(existsSync(expectedFile)).toBe(true);
  });
  it('writes a valid TOON file with correct taskId', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-json-task', 'Intent for the json task with sufficient length here ok.');
    const loaded = mgr.loadTask(state.taskId);
    expect(loaded).not.toBeNull();
    expect(loaded!.taskId).toBe(state.taskId);
    expect(loaded!.taskName).toBe('ct-json-task');
  });
  it('sets stateIntegrity (HMAC) on the created state', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-hmac-task', 'Intent for the hmac task with sufficient length ok.');
    expect(typeof state.stateIntegrity).toBe('string');
    expect(state.stateIntegrity.length).toBeGreaterThan(0);
  });
  it('sets sessionToken as a 64-char hex string', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-session-task', 'Intent for session task with sufficient length text ok.');
    expect(/^[0-9a-f]{64}$/.test(state.sessionToken)).toBe(true);
  });
  it('sets docsDir and workflowDir referencing the task name and id', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-paths-task', 'Intent for paths task with sufficient length text here ok.');
    expect(state.docsDir).toContain('ct-paths-task');
    expect(state.workflowDir).toContain(state.taskId);
  });
  it('sets size to "small" when size=small is passed', () => {
    const mgr = createMgr();
    const state = mgr.createTask('ct-small-task', 'Intent for small task with sufficient length text here ok.', [], [], 'small');
    expect(state.size).toBe('small');
  });
  it('sets size to "large" for high risk scope (many auth files)', () => {
    const mgr = createMgr();
    const files = Array.from({ length: 10 }, (_, i) => `src/auth/file${i}.ts`);
    const state = mgr.createTask('ct-large-task', 'Intent for large task with security and infra scope files.', files, ['infra/terraform/']);
    expect(state.size).toBe('large');
  });
  it('stores provided files in scopeFiles', () => {
    const mgr = createMgr();
    const files = ['src/foo.ts', 'src/bar.ts'];
    const state = mgr.createTask('ct-scope-task', 'Intent for scope task with sufficient length text ok.', files);
    expect(state.scopeFiles).toEqual(files);
  });
  it('stores provided dirs in scopeDirs', () => {
    const mgr = createMgr();
    const dirs = ['src/', 'lib/'];
    const state = mgr.createTask('ct-scope-dir', 'Intent for scope-dir task with sufficient length ok.', [], dirs);
    expect(state.scopeDirs).toEqual(dirs);
  });
});

// ─── RC-2: skippedPhases regression tests ───────
describe('skippedPhases matches SIZE_SKIP_MAP', () => {
  it('small task: skippedPhases equals SIZE_SKIP_MAP.small', async () => {
    const { SIZE_SKIP_MAP } = await import('../phases/registry.js');
    const mgr = createMgr();
    const state = mgr.createTask('rc2-small', 'Intent for small task regression test for skippedPhases.', [], [], 'small');
    expect(state.size).toBe('small');
    expect(state.skippedPhases).toEqual(SIZE_SKIP_MAP.small);
  });
  it('large task: skippedPhases equals SIZE_SKIP_MAP.large (empty)', async () => {
    const { SIZE_SKIP_MAP } = await import('../phases/registry.js');
    const mgr = createMgr();
    const files = Array.from({ length: 10 }, (_, i) => `src/auth/file${i}.ts`);
    const state = mgr.createTask('rc2-large', 'Intent for large task regression test for skippedPhases.', files, ['infra/terraform/']);
    expect(state.size).toBe('large');
    expect(state.skippedPhases).toEqual(SIZE_SKIP_MAP.large);
  });
});

describe('loadTask', () => {
  it('loads and returns the state for an existing task', () => {
    const mgr = createMgr();
    const created = mgr.createTask('lt-load-task', 'Intent for load task with sufficient length text ok.');
    const loaded = mgr.loadTask(created.taskId);
    expect(loaded).not.toBeNull();
    expect(loaded!.taskId).toBe(created.taskId);
    expect(loaded!.taskName).toBe('lt-load-task');
  });
  it('returns null when taskId does not exist', () => {
    const mgr = createMgr();
    expect(mgr.loadTask('00000000-0000-4000-8000-nonexistent00')).toBeNull();
  });
  it('verifies HMAC and returns integrityWarning when state file is tampered with', () => {
    const mgr = createMgr();
    const state = mgr.createTask('lt-tamper-task', 'Intent for tamper task with sufficient length text.');
    const toonFile = join(STATE_DIR, 'workflows', `${state.taskId}_lt-tamper-task`, 'workflow-state.toon');
    const raw = readFileSync(toonFile, 'utf8');
    // Tamper: replace taskName value in the TOON content
    const tampered = raw.replace(/taskName: lt-tamper-task/, 'taskName: tampered-name');
    writeFileSync(toonFile, tampered);
    const result = mgr.loadTask(state.taskId);
    expect(result).not.toBeNull();
    expect((result as any).integrityWarning).toBe(true);
  });
});
