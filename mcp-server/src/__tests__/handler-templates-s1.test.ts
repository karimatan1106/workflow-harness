/**
 * Sprint 1 template content validation tests
 * Verifies S1-6, S1-10, S1-14, S1-16, S1-17 in subagent templates.
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

describe('Sprint 1 template content validation', () => {
  it('research template contains init.sh generation instruction (S1-10)', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'research' });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).toContain('init.sh');
  });

  it('research template contains implicit constraints section (S1-16)', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'research' });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).toContain('暗黙の制約');
  });

  it('research template contains version-specific behavior section (S1-17)', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'research' });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).toContain('バージョン');
    expect(tmpl).toContain('node --version');
  });

  it('research template contains JSONL output prevention instruction (S1-14)', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'research' });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).toContain('JSONL');
  });

  it('refactoring template contains /simplify procedure with 3 quality dimensions (S1-6)', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'refactoring' });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).toContain('simplify');
    expect(tmpl).toContain('code quality');
    expect(tmpl).toContain('code efficiency');
    expect(tmpl).toContain('CLAUDE.md compliance');
  });
});
