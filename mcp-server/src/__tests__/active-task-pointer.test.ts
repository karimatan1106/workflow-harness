// Tests for active-task pointer file (single source of truth for hook phase detection)
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StateManager as StateManagerType } from '../state/manager.js';

let TEMP_DIR: string;
let STATE_DIR: string;
let StateManagerClass: typeof StateManagerType;

function createMgr(): StateManagerType { return new StateManagerClass(); }

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'active-task-pointer-test-'));
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

describe('writeActiveTaskPointer', () => {
  it('writes active-task.toon with taskId, taskName, phase fields', () => {
    const mgr = createMgr();
    const state = mgr.createTask('pointer-test-task', 'Intent for active-task pointer test with sufficient text length here.');
    mgr.writeActiveTaskPointer(state.taskId, state.taskName, state.phase);
    const pointerPath = join(STATE_DIR, 'active-task.toon');
    expect(existsSync(pointerPath)).toBe(true);
    const content = readFileSync(pointerPath, 'utf8');
    expect(content).toContain(`taskId: ${state.taskId}`);
    expect(content).toContain(`taskName: ${state.taskName}`);
    expect(content).toContain(`phase: ${state.phase}`);
    expect(content).toContain('updatedAt:');
  });

  it('overwrites the pointer on subsequent writes', () => {
    const mgr = createMgr();
    const state = mgr.createTask('pointer-test-overwrite', 'Intent for active-task pointer overwrite test with enough text length.');
    mgr.writeActiveTaskPointer(state.taskId, state.taskName, 'requirements');
    mgr.writeActiveTaskPointer(state.taskId, state.taskName, 'implementation');
    const pointerPath = join(STATE_DIR, 'active-task.toon');
    const content = readFileSync(pointerPath, 'utf8');
    expect(content).toContain('phase: implementation');
    expect(content).not.toContain('phase: requirements');
  });

  it('advancePhase updates the active-task pointer to the new phase', () => {
    const mgr = createMgr();
    const state = mgr.createTask('pointer-advance-task', 'Intent for advancePhase pointer update test with sufficient text length.');
    mgr.writeActiveTaskPointer(state.taskId, state.taskName, state.phase);
    const result = mgr.advancePhase(state.taskId);
    expect(result.success).toBe(true);
    const pointerPath = join(STATE_DIR, 'active-task.toon');
    const content = readFileSync(pointerPath, 'utf8');
    expect(content).toContain(`phase: ${result.nextPhase}`);
  });
});
