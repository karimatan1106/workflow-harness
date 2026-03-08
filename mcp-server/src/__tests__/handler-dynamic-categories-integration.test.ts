/**
 * Dynamic categories integration tests - TDD Red phase
 * Tests AC-2 (fallback via template), AC-3 (dynamic via template),
 * AC-4 (projectTraits persistence in TaskState).
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

// --- AC-4: projectTraits persistence ---
describe('AC-4: projectTraits persistence via harness_set_scope', () => {
  it('TC-AC4-01: harness_set_scope with projectTraits persists to TaskState', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'dyn-cat-persist-test',
      userIntent: 'Test projectTraits persistence.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const freshToken = await advanceUntilPhase(mgr, taskId, token, 'scope_definition');

    await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: freshToken,
      files: ['src/dummy.ts'],
      projectTraits: { hasUI: true, hasAPI: false, hasDB: false, hasEvents: false, hasI18n: false, hasDesignSystem: false },
    });

    const status = await call(mgr, 'harness_status', { taskId });
    expect(status).toHaveProperty('projectTraits');
    const traits = (status as any).projectTraits;
    expect(traits.hasUI).toBe(true);
    expect(traits.hasAPI).toBe(false);
  });

  it('TC-AC4-02: harness_set_scope without projectTraits leaves it undefined', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'dyn-cat-no-traits-test',
      userIntent: 'Test projectTraits omission.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const freshToken = await advanceUntilPhase(mgr, taskId, token, 'scope_definition');

    await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: freshToken,
      files: ['src/dummy.ts'],
    });

    const status = await call(mgr, 'harness_status', { taskId });
    expect(status).not.toHaveProperty('projectTraits');
  });

  it('TC-AC4-03: all 6 projectTraits flags persist correctly', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'dyn-cat-all-flags-test',
      userIntent: 'Test all 6 projectTraits flags.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const freshToken = await advanceUntilPhase(mgr, taskId, token, 'scope_definition');

    const allTrue = {
      hasUI: true, hasAPI: true, hasDB: true,
      hasEvents: true, hasI18n: true, hasDesignSystem: true,
    };
    await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: freshToken,
      files: ['src/dummy.ts'],
      projectTraits: allTrue,
    });

    const status = await call(mgr, 'harness_status', { taskId });
    expect(status).toHaveProperty('projectTraits');
    const traits = (status as any).projectTraits;
    for (const [key, val] of Object.entries(allTrue)) {
      expect(traits[key]).toBe(val);
    }
  });
});

// --- AC-2/AC-3: docs_update template dynamic categories ---
describe('docs_update template dynamic categories via buildSubagentPrompt', () => {
  it('TC-AC2-03: no projectTraits task includes fallback 5 items in template', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'dyn-cat-fallback-tmpl-test',
      userIntent: 'Test fallback categories in docs_update template.',
    });
    const taskId = startRes.taskId as string;

    const res = await call(mgr, 'harness_get_subphase_template', {
      taskId,
      phase: 'docs_update',
    });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;

    expect(tmpl).toContain('docs/architecture/overview.md');
    expect(tmpl).toContain('docs/operations/');
    expect(tmpl).toContain('CHANGELOG.md');
    expect(tmpl).toContain('README.md');
    expect(tmpl).toContain('docs/workflows/');
  });

  it('TC-AC3-08: projectTraits={hasUI,hasAPI} template includes screens/api categories', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'dyn-cat-uiapi-tmpl-test',
      userIntent: 'Test dynamic categories with hasUI+hasAPI.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    const freshToken = await advanceUntilPhase(mgr, taskId, token, 'scope_definition');

    await call(mgr, 'harness_set_scope', {
      taskId,
      sessionToken: freshToken,
      files: ['src/dummy.ts'],
      projectTraits: { hasUI: true, hasAPI: true, hasDB: false, hasEvents: false, hasI18n: false, hasDesignSystem: false },
    });

    const res = await call(mgr, 'harness_get_subphase_template', {
      taskId,
      phase: 'docs_update',
    });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;

    expect(tmpl).toContain('docs/spec/screens/');
    expect(tmpl).toContain('docs/spec/api/');
    expect(tmpl).not.toContain('docs/spec/database/');
    expect(tmpl).not.toContain('docs/spec/events/');
  });
});
