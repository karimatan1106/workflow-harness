/**
 * Handler integration tests — PHA-1 Parallel Phase Rollback Warning
 * Tests for S2-30: rollback candidates when parallel sub-phase fails 3+ times.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync } from 'node:fs';
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
// PHA-1: Parallel phase rollback warning
// ─────────────────────────────────────────────────────────────────────────────

describe('PHA-1 parallel sub-phase rollback candidates', () => {
  it('returns pha1Warning when retryCount >= 3 and a sub-phase is already completed', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'pha1-warning-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // Mark manual_test as completed directly (bypassing DoD for setup purposes)
    mgr.completeSubPhase(taskId, 'manual_test');

    // Call harness_complete_sub for security_scan WITHOUT creating the artifact (L1 fails)
    const res = await call(mgr, 'harness_complete_sub', {
      taskId,
      subPhase: 'security_scan',
      sessionToken: token,
      retryCount: 3,
    });

    expect(res.error).toBeDefined();
    expect(res.pha1Warning).toBeDefined();
    expect(typeof res.pha1Warning).toBe('string');
    expect((res.pha1Warning as string)).toContain('PHA-1');
    expect((res.pha1Warning as string)).toContain('manual_test');
    expect((res.pha1Warning as string)).toContain('security_scan');
  });

  it('does not return pha1Warning when retryCount < 3', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'pha1-no-warn-retry',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // Mark manual_test as completed to ensure there is a rollback candidate
    mgr.completeSubPhase(taskId, 'manual_test');

    // retryCount = 2 — below the PHA-1 threshold of 3
    const res = await call(mgr, 'harness_complete_sub', {
      taskId,
      subPhase: 'security_scan',
      sessionToken: token,
      retryCount: 2,
    });

    expect(res.error).toBeDefined(); // DoD still fails (no artifact)
    expect(res.pha1Warning).toBeUndefined();
  });

  it('does not return pha1Warning when no sub-phases are completed', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'pha1-no-completed-subs',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // No sub-phases completed — no rollback candidates
    const res = await call(mgr, 'harness_complete_sub', {
      taskId,
      subPhase: 'security_scan',
      sessionToken: token,
      retryCount: 3,
    });

    expect(res.error).toBeDefined(); // DoD fails (no artifact)
    expect(res.pha1Warning).toBeUndefined();
  });

  it('pha1Warning lists all completed sub-phases as rollback candidates', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'pha1-multi-rollback',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // Complete two sub-phases directly
    mgr.completeSubPhase(taskId, 'manual_test');
    mgr.completeSubPhase(taskId, 'performance_test');

    // Fail e2e_test DoD with retryCount >= 3
    const res = await call(mgr, 'harness_complete_sub', {
      taskId,
      subPhase: 'e2e_test',
      sessionToken: token,
      retryCount: 4,
    });

    expect(res.error).toBeDefined();
    expect(res.pha1Warning).toBeDefined();
    const warning = res.pha1Warning as string;
    expect(warning).toContain('PHA-1');
    expect(warning).toContain('manual_test');
    expect(warning).toContain('performance_test');
  });
});
