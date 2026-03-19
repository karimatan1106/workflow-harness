/**
 * Handler integration tests — IA-2 AC count minimum, TOOL_DEFINITIONS
 * Split from handler-misc.test.ts for 200-line limit.
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
// IA-2: AC count minimum for requirements approval
// ─────────────────────────────────────────────────────────────────────────────

describe('IA-2 AC count requirement', () => {
  it('harness_approve rejects requirements with fewer than 3 ACs', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'ac-count-test',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    // Add only 2 ACs (less than minimum 3)
    await call(mgr, 'harness_add_ac', { taskId, id: 'AC-1', description: 'First criterion for test', sessionToken: token });
    await call(mgr, 'harness_add_ac', { taskId, id: 'AC-2', description: 'Second criterion for test', sessionToken: token });

    const res = await call(mgr, 'harness_approve', { taskId, type: 'requirements', sessionToken: token });
    expect(typeof res.error).toBe('string');
    expect((res.error as string)).toContain('at least 3 acceptance criteria');
    expect((res.error as string)).toContain('only 2 found');
  });

  it('harness_approve succeeds with exactly 3 ACs', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'ac-count-pass-test',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    for (let i = 1; i <= 3; i++) {
      await call(mgr, 'harness_add_ac', {
        taskId, id: `AC-${i}`, description: `Criterion ${i} for AC count test`, sessionToken: token,
      });
    }

    const res = await call(mgr, 'harness_approve', { taskId, type: 'requirements', sessionToken: token });
    expect(res.error).toBeUndefined();
    expect(res.approved).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TOOL_DEFINITIONS count
// ─────────────────────────────────────────────────────────────────────────────

describe('TOOL_DEFINITIONS', () => {
  it('has exactly 27 entries', () => {
    expect(ctx.TOOL_DEFINITIONS).toHaveLength(27);
  });

  it('does not contain harness_add_invariant', () => {
    const names = ctx.TOOL_DEFINITIONS.map((d: { name: string }) => d.name);
    expect(names).not.toContain('harness_add_invariant');
  });

  it('does not contain harness_update_invariant_status', () => {
    const names = ctx.TOOL_DEFINITIONS.map((d: { name: string }) => d.name);
    expect(names).not.toContain('harness_update_invariant_status');
  });

  it('contains harness_start as the first entry', () => {
    expect(ctx.TOOL_DEFINITIONS[0].name).toBe('harness_start');
  });

  it('contains harness_delegate_coordinator as the last entry', () => {
    const last = ctx.TOOL_DEFINITIONS[ctx.TOOL_DEFINITIONS.length - 1];
    expect(last.name).toBe('harness_delegate_coordinator');
  });

  it('all entries have a name and inputSchema', () => {
    for (const def of ctx.TOOL_DEFINITIONS) {
      expect(typeof def.name).toBe('string');
      expect(def.inputSchema).toBeDefined();
    }
  });
});
