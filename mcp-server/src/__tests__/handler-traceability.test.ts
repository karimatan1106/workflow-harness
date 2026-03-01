/**
 * Handler integration tests — AC Status Updates + RTM Status Updates
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
// AC Status Updates
// ─────────────────────────────────────────────────────────────────────────────

describe('AC Status Updates', () => {
  it('harness_update_ac_status updates an existing acceptance criterion', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'ac-update-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    // Add an AC first
    const addRes = await call(mgr, 'harness_add_ac', {
      taskId, id: 'AC-1',
      description: 'The system must validate user input correctly.',
      sessionToken: token,
    });
    expect(addRes.error).toBeUndefined();

    // Update the AC status to 'met'
    const updateRes = await call(mgr, 'harness_update_ac_status', {
      taskId, id: 'AC-1', status: 'met',
      testCaseId: 'test-input-validation',
      sessionToken: token,
    });
    expect(updateRes.error).toBeUndefined();
    expect(updateRes.updated).toBe(true);
    expect(updateRes.id).toBe('AC-1');
    expect(updateRes.status).toBe('met');
    expect(updateRes.testCaseId).toBe('test-input-validation');
  });

  it('harness_update_ac_status fails for non-existent AC id', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'ac-missing-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const updateRes = await call(mgr, 'harness_update_ac_status', {
      taskId,
      id: 'AC-999',
      status: 'met',
      sessionToken: token,
    });
    expect(typeof updateRes.error).toBe('string');
    expect((updateRes.error as string)).toContain('AC-999');
  });

  it('harness_update_ac_status rejects invalid status value', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'ac-invalid-status-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const updateRes = await call(mgr, 'harness_update_ac_status', {
      taskId,
      id: 'AC-1',
      status: 'invalid_status',
      sessionToken: token,
    });
    expect(typeof updateRes.error).toBe('string');
    expect((updateRes.error as string).toLowerCase()).toContain('status');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RTM Status Updates
// ─────────────────────────────────────────────────────────────────────────────

describe('RTM Status Updates', () => {
  it('harness_update_rtm_status updates an existing RTM entry', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'rtm-update-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    // Add an RTM entry first
    const addRes = await call(mgr, 'harness_add_rtm', {
      taskId, id: 'F-001',
      requirement: 'Input validation must reject empty strings.',
      sessionToken: token,
    });
    expect(addRes.error).toBeUndefined();

    // Update RTM status to 'implemented' with codeRef
    const updateRes = await call(mgr, 'harness_update_rtm_status', {
      taskId, id: 'F-001', status: 'implemented',
      codeRef: 'src/validator.ts', sessionToken: token,
    });
    expect(updateRes.error).toBeUndefined();
    expect(updateRes.updated).toBe(true);
    expect(updateRes.id).toBe('F-001');
    expect(updateRes.status).toBe('implemented');
    expect(updateRes.codeRef).toBe('src/validator.ts');
  });

  it('harness_update_rtm_status fails for non-existent RTM id', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'rtm-missing-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const updateRes = await call(mgr, 'harness_update_rtm_status', {
      taskId,
      id: 'F-999',
      status: 'implemented',
      sessionToken: token,
    });
    expect(typeof updateRes.error).toBe('string');
    expect((updateRes.error as string)).toContain('F-999');
  });

  it('harness_update_rtm_status rejects invalid status value', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'rtm-invalid-status-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const updateRes = await call(mgr, 'harness_update_rtm_status', {
      taskId,
      id: 'F-001',
      status: 'invalid_status',
      sessionToken: token,
    });
    expect(typeof updateRes.error).toBe('string');
    expect((updateRes.error as string).toLowerCase()).toContain('status');
  });

  it('harness_update_rtm_status supports codeRef and testRef optional fields', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'rtm-refs-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    await call(mgr, 'harness_add_rtm', {
      taskId, id: 'F-002',
      requirement: 'Validation error messages must be localized.',
      sessionToken: token,
    });

    // Update with both codeRef and testRef
    const updateRes = await call(mgr, 'harness_update_rtm_status', {
      taskId,
      id: 'F-002',
      status: 'tested',
      codeRef: 'src/i18n/validator.ts',
      testRef: 'src/__tests__/validator.test.ts',
      sessionToken: token,
    });
    expect(updateRes.error).toBeUndefined();
    expect(updateRes.updated).toBe(true);
    expect(updateRes.codeRef).toBe('src/i18n/validator.ts');
    expect(updateRes.testRef).toBe('src/__tests__/validator.test.ts');
  });
});
