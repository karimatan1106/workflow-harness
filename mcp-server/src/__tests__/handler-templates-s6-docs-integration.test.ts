/**
 * docs_update template rewrite - integration tests
 * Verifies AC-5 (TC-AC5-04): buildSubagentPrompt output has no forbidden headers.
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

describe('docs_update buildSubagentPrompt integration', () => {
  it('TC-AC5-04: final prompt via buildSubagentPrompt has no forbidden headers', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'docs-integration-test',
      userIntent: 'Integration test for docs_update template rewrite verification.',
    });
    const taskId = startRes.taskId as string;

    const res = await call(mgr, 'harness_get_subphase_template', {
      taskId,
      phase: 'docs_update',
    });

    expect(res.error).toBeUndefined();
    const prompt = res.subagentTemplate as string;

    expect(prompt).not.toContain('## タスク情報');
    expect(prompt).not.toContain('=== タスク情報');
    expect(prompt).not.toContain('## 入力');
    expect(prompt).not.toContain('=== 入力');
    expect(prompt).not.toContain('## 出力');
    expect(prompt).not.toContain('=== 出力');
  });

  it('final prompt contains compact header with inputFiles and outputFile', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'docs-header-test',
      userIntent: 'Integration test to verify compact header in docs_update prompt.',
    });
    const taskId = startRes.taskId as string;

    const res = await call(mgr, 'harness_get_subphase_template', {
      taskId,
      phase: 'docs_update',
    });

    expect(res.error).toBeUndefined();
    const prompt = res.subagentTemplate as string;

    // Compact header should contain in: and out: lines
    expect(prompt).toContain('in:');
    expect(prompt).toContain('out:');
    expect(prompt).toContain('planning.md');
    expect(prompt).toContain('requirements.md');
    expect(prompt).not.toContain('code-review.md');
    expect(prompt).toContain('docs-update.md');
  });
});
