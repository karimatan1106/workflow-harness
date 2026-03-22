/**
 * N-58: State manager integration tests (real filesystem, no mocks).
 * Tests the full lifecycle: create task → write state → read state → cleanup.
 * This is the "testcontainers" equivalent for our fs-based state layer.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('State manager integration (real fs)', () => {
  let sm: InstanceType<typeof import('../../src/state/manager.js').StateManager>;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'state-integ-'));
    vi.stubEnv('STATE_DIR', tempDir);
    vi.resetModules();
    const { StateManager } = await import('../../src/state/manager.js');
    sm = new StateManager();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates task and returns valid state', () => {
    const task = sm.createTask('integ-test-n58', 'Test real filesystem state management');
    expect(task.taskId).toBeTruthy();
    expect(task.taskName).toBe('integ-test-n58');
    expect(task.phase).toBe('hearing');
  });

  it('persists and retrieves task via loadTask', () => {
    const task = sm.createTask('persist-test-n58', 'Verify persistence across loadTask calls');
    const retrieved = sm.loadTask(task.taskId);
    expect(retrieved).toBeDefined();
    expect(retrieved!.taskName).toBe('persist-test-n58');
    expect(retrieved!.taskId).toBe(task.taskId);
  });

  it('handles multiple task creation without corruption', () => {
    const tasks = [];
    for (let i = 0; i < 3; i++) {
      tasks.push(sm.createTask(`concurrent-n58-${i}`, `Task ${i} for concurrency test`));
    }
    const ids = new Set(tasks.map((t) => t.taskId));
    expect(ids.size).toBe(3);
    for (const t of tasks) {
      const loaded = sm.loadTask(t.taskId);
      expect(loaded).toBeDefined();
      expect(loaded!.taskId).toBe(t.taskId);
    }
  });

  it('listTasks includes created tasks', () => {
    const task = sm.createTask('list-test-n58', 'Verify listTasks includes this task');
    const all = sm.listTasks();
    expect(all.length).toBeGreaterThan(0);
    const found = all.find((t) => t.taskId === task.taskId);
    expect(found).toBeDefined();
    expect(found!.taskName).toBe('list-test-n58');
  });

  it('task state survives scope update', () => {
    const task = sm.createTask('scope-test-n58', 'Verify scope update persistence');
    const updated = sm.updateScope(task.taskId, ['src/foo.ts'], ['src/']);
    expect(updated).toBe(true);
    const loaded = sm.loadTask(task.taskId);
    expect(loaded!.scopeFiles).toContain('src/foo.ts');
    expect(loaded!.scopeDirs).toContain('src/');
  });
});
