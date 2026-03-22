/**
 * Handler integration tests — Approval Gates
 * Split from handler.test.ts. See handler-test-setup.ts for shared setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

let ctx: TestCtx;
let createMgr: TestCtx['createMgr'];
let call: TestCtx['call'];
let advanceUntilPhase: TestCtx['advanceUntilPhase'];

beforeAll(async () => {
  ctx = await setupHandlerTest();
  createMgr = ctx.createMgr;
  call = ctx.call;
  advanceUntilPhase = ctx.advanceUntilPhase;
});

afterAll(() => {
  teardownHandlerTest(ctx);
});

// ─────────────────────────────────────────────────────────────────────────────
// Approval Gates
// ─────────────────────────────────────────────────────────────────────────────

describe('Approval Gates', () => {
  // Use advanceUntilPhase to avoid hardcoding phase counts (which vary by task size).
  // Tasks created with no files have risk score 0 → size "small".
  // Small-task active phases omit impact_analysis, so requirements is reached after 2 advances.
  // advanceUntilPhase handles both sizes transparently.

  it('harness_next blocks when approval is required but not given (requirements gate)', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'approval-gate-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    // Advance until we reach requirements phase
    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    // Verify we are now at requirements
    const status = await call(mgr, 'harness_status', { taskId });
    expect(status.phase).toBe('requirements');

    // Attempt to advance without approval — should be blocked
    const nextRes = await call(mgr, 'harness_next', {
      taskId,
      sessionToken: token,
    });
    expect(typeof nextRes.error).toBe('string');
    expect((nextRes.error as string).toLowerCase()).toContain('approval');
  });

  it('harness_approve records approval and advances phase', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'approve-advance-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    // Advance to requirements
    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    const status = await call(mgr, 'harness_status', { taskId });
    expect(status.phase).toBe('requirements');

    // IA-2: Add minimum 3 acceptance criteria before approving requirements
    for (let i = 1; i <= 3; i++) {
      await call(mgr, 'harness_add_ac', {
        taskId,
        id: `AC-${i}`,
        description: `Acceptance criterion ${i} for testing approval gate functionality`,
        sessionToken: token,
      });
    }

    // Approve the requirements gate
    const approveRes = await call(mgr, 'harness_approve', {
      taskId,
      type: 'requirements',
      sessionToken: token,
    });
    expect(approveRes.error).toBeUndefined();
    expect(approveRes.approved).toBe(true);
    expect(approveRes.approvalType).toBe('requirements');
    expect(approveRes.previousPhase).toBe('requirements');
    // After approval the phase should have advanced past requirements
    expect(approveRes.nextPhase).not.toBe('requirements');
  });

  it('harness_approve rejects wrong approval type for current phase', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'wrong-type-approval-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    // Advance to requirements
    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    // Attempt to approve with wrong type (design instead of requirements)
    const approveRes = await call(mgr, 'harness_approve', {
      taskId,
      type: 'design',
      sessionToken: token,
    });
    expect(typeof approveRes.error).toBe('string');
    expect((approveRes.error as string).toLowerCase()).toContain('does not match');
  });

  it('harness_approve accepts test_design as a valid approval type (verifies enum coverage)', async () => {
    // test_design is a valid approval type - verify the handler recognizes it at the
    // test_design gate phase by reaching test_design and approving with the correct type.
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'test-design-gate-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    // Advance until test_design phase
    token = await advanceUntilPhase(mgr, taskId, token, 'test_design');

    const status = await call(mgr, 'harness_status', { taskId });
    expect(status.phase).toBe('test_design');

    // Approve with test_design type — should succeed
    const approveRes = await call(mgr, 'harness_approve', {
      taskId,
      type: 'test_design',
      sessionToken: token,
    });
    expect(approveRes.error).toBeUndefined();
    expect(approveRes.approved).toBe(true);
    expect(approveRes.approvalType).toBe('test_design');
    expect(approveRes.previousPhase).toBe('test_design');
  });
});
