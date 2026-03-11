/**
 * CLI tests — add-invariant, update-invariant-status subcommands
 * Tests the CLI helper functions directly (not spawning a process).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateManager } from '../state/manager.js';
import { runCli } from '../cli.js';

let tempDir: string;
const origEnv = process.env.STATE_DIR;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'cli-test-'));
  process.env.STATE_DIR = tempDir;
});

afterEach(() => {
  process.env.STATE_DIR = origEnv;
  rmSync(tempDir, { recursive: true, force: true });
});

function createTestTask(): { taskId: string; sessionToken: string } {
  const sm = new StateManager();
  const state = sm.createTask('cli-test', 'CLI test intent with enough characters to pass validation');
  return { taskId: state.taskId, sessionToken: state.sessionToken };
}

describe('CLI add-invariant', () => {
  it('TC-AC2-01: adds invariant to task state', async () => {
    const { taskId, sessionToken } = createTestTask();
    const result = await runCli(['add-invariant', '--taskId', taskId, '--id', 'INV-1', '--description', 'Test invariant', '--sessionToken', sessionToken]);
    expect(result.success).toBe(true);
    expect(result.data?.added).toBe(true);

    const sm = new StateManager();
    const state = sm.loadTask(taskId);
    expect(state?.invariants).toHaveLength(1);
    expect(state?.invariants[0].id).toBe('INV-1');
    expect(state?.invariants[0].status).toBe('open');
  });
});

describe('CLI update-invariant-status', () => {
  it('TC-AC3-01: updates invariant status to held', async () => {
    const { taskId, sessionToken } = createTestTask();
    const sm = new StateManager();
    sm.addInvariant(taskId, { id: 'INV-1', description: 'Test', status: 'open' });

    const result = await runCli(['update-invariant-status', '--taskId', taskId, '--id', 'INV-1', '--status', 'held', '--sessionToken', sessionToken]);
    expect(result.success).toBe(true);

    const state = sm.loadTask(taskId);
    expect(state?.invariants[0].status).toBe('held');
  });

  it('TC-AC3-02: rejects invalid status value', async () => {
    const { taskId, sessionToken } = createTestTask();
    const sm = new StateManager();
    sm.addInvariant(taskId, { id: 'INV-1', description: 'Test', status: 'open' });

    const result = await runCli(['update-invariant-status', '--taskId', taskId, '--id', 'INV-1', '--status', 'invalid', '--sessionToken', sessionToken]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('status');
  });
});
