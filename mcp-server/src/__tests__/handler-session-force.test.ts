/**
 * Handler integration tests — Session & Security + Force Transition
 * Split from handler.test.ts. See handler-test-setup.ts for shared setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
// Session & Security
// ─────────────────────────────────────────────────────────────────────────────

describe('Session & Security', () => {
  it('harness_next rejects an invalid sessionToken', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'invalid-token-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;

    const res = await call(mgr, 'harness_next', {
      taskId,
      sessionToken: 'definitely-not-the-right-token',
      forceTransition: true,
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string).toLowerCase()).toContain('invalid sessiontoken');
  });

  it('harness_set_scope rejects empty scope (no files, no dirs, no glob)', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'empty-scope-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const res = await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: token,
      // no files, dirs, or glob
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string).toLowerCase()).toContain('at least one');
  });

  it('harness_set_scope accepts addMode parameter and merges scope', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'scope-addmode-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
      files: ['src/existing.ts'],
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    // First set scope with addMode=false (default): should replace
    const replaceRes = await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: token,
      files: ['src/new-file.ts'],
      addMode: false,
    });
    expect(replaceRes.error).toBeUndefined();

    // Then add with addMode=true: should merge
    const addRes = await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: token,
      files: ['src/another-file.ts'],
      addMode: true,
    });
    expect(addRes.error).toBeUndefined();

    // Load task and verify both files are present
    const status = await call(mgr, 'harness_status', { taskId });
    const scopeFiles = status.scopeFiles as string[];
    expect(scopeFiles).toContain('src/new-file.ts');
    expect(scopeFiles).toContain('src/another-file.ts');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Force Transition
// ─────────────────────────────────────────────────────────────────────────────

describe('Force Transition', () => {
  it('harness_next with forceTransition=true skips DoD checks and advances phase', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'force-transition-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    // scope_definition has L1 check for output file — with forceTransition it should skip
    const res = await call(mgr, 'harness_next', {
      taskId,
      sessionToken: token,
      forceTransition: true,
    });

    expect(res.error).toBeUndefined();
    expect(res.nextPhase).toBeDefined();
    expect(res.nextPhase).not.toBe('scope_definition');
    // dodChecks should be empty when force-transitioning
    expect(Array.isArray(res.dodChecks)).toBe(true);
    expect((res.dodChecks as unknown[]).length).toBe(0);
  });
});
