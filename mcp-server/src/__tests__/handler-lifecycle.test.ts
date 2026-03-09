/**
 * Handler integration tests — Task Lifecycle
 * Split from handler.test.ts. See handler-test-setup.ts for shared setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { StateManager as StateManagerType } from '../state/manager.js';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

let ctx: TestCtx;
let createMgr: TestCtx['createMgr'];
let call: TestCtx['call'];

beforeAll(async () => {
  ctx = await setupHandlerTest();
  createMgr = ctx.createMgr;
  call = ctx.call;
});

afterAll(() => {
  teardownHandlerTest(ctx);
});

// ─────────────────────────────────────────────────────────────────────────────
// Task Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Retry & VDB-1
// ─────────────────────────────────────────────────────────────────────────────

describe('Retry and VDB-1 detection', () => {
  it('harness_next returns VDB-1 warning when retryCount >= 3 and DoD fails', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'vdb1-warning-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    // Create output file that passes P2 pre-check (>=100 bytes) but fails DoD L4
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'scope-definition.toon'), 'x'.repeat(150), 'utf8');
    const res = await call(mgr, 'harness_next', {
      taskId,
      sessionToken: token,
      retryCount: 3,
    });
    expect(res.error).toBeDefined();
    expect(res.vdb1Warning).toBeDefined();
    expect(typeof res.vdb1Warning).toBe('string');
    expect((res.vdb1Warning as string)).toContain('VDB-1');
  });

  it('harness_next does not add VDB-1 warning when retryCount < 3', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'no-vdb1-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    // Create output file that passes P2 pre-check but fails DoD L4
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'scope-definition.toon'), 'x'.repeat(150), 'utf8');
    const res = await call(mgr, 'harness_next', {
      taskId,
      sessionToken: token,
      retryCount: 2,
    });
    expect(res.error).toBeDefined(); // DoD still fails (L4 content)
    expect(res.vdb1Warning).toBeUndefined();
  });

  it('harness_next blocks after 5 retry attempts with RLM-1 error', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'retry-limit-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    // Create output file that passes P2 pre-check but fails DoD
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'scope-definition.toon'), 'x'.repeat(150), 'utf8');
    // Increment counter 5 times (each call with retryCount >= 1 increments)
    for (let i = 0; i < 5; i++) {
      await call(mgr, 'harness_next', { taskId, sessionToken: token, retryCount: 1 });
    }
    // 6th call should hit the retry limit
    const res = await call(mgr, 'harness_next', { taskId, sessionToken: token, retryCount: 1 });
    expect(typeof res.error).toBe('string');
    expect((res.error as string).toLowerCase()).toContain('retry limit');
  });
});

describe('Task Lifecycle', () => {
  it('harness_start creates a task and returns taskId/sessionToken/docsDir/workflowDir', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'start-basic-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement here.',
    });
    expect(res.error).toBeUndefined();
    expect(typeof res.taskId).toBe('string');
    expect(typeof res.sessionToken).toBe('string');
    expect(typeof res.docsDir).toBe('string');
    expect(typeof res.workflowDir).toBe('string');
    expect(res.taskName).toBe('start-basic-task');
    expect(res.phase).toBe('scope_definition');
    // sessionToken should be a 64-char hex string
    expect(/^[0-9a-f]{64}$/.test(res.sessionToken as string)).toBe(true);
  });

  it('harness_start rejects an empty taskName', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: '',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string).toLowerCase()).toContain('taskname');
  });

  it('harness_start rejects a userIntent shorter than 20 characters', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'short-intent-task',
      userIntent: 'Too short',
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string).toLowerCase()).toContain('userintent');
  });

  it('harness_status returns task details with sessionToken when called with taskId', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'status-detail-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const statusRes = await call(mgr, 'harness_status', { taskId });
    expect(statusRes.error).toBeUndefined();
    expect(statusRes.taskId).toBe(taskId);
    expect(statusRes.taskName).toBe('status-detail-task');
    expect(typeof statusRes.sessionToken).toBe('string');
    expect((statusRes.sessionToken as string).length).toBe(64);
    expect(statusRes.phase).toBe('scope_definition');
  });

  it('harness_status returns task list when called without taskId', async () => {
    const mgr = createMgr();
    await call(mgr, 'harness_start', {
      taskName: 'list-task-alpha',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    await call(mgr, 'harness_start', {
      taskName: 'list-task-beta',
      userIntent: 'Another user intent that is long enough for the minimum length requirement.',
    });
    const res = await call(mgr, 'harness_status', {});
    expect(Array.isArray(res.tasks)).toBe(true);
    const tasks = res.tasks as Array<Record<string, unknown>>;
    const names = tasks.map((t) => t.taskName);
    expect(names).toContain('list-task-alpha');
    expect(names).toContain('list-task-beta');
    // List mode should NOT include sessionToken for security
    for (const t of tasks) {
      expect(t.sessionToken).toBeUndefined();
    }
  });
});
