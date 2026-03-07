/**
 * Handler integration tests — Ambiguous expressions, retryCount
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
// PF-4/UI-2: Ambiguous expression detection in userIntent
// ─────────────────────────────────────────────────────────────────────────────

describe('harness_start ambiguous expressions', () => {
  it('rejects userIntent with ambiguous word "とか"', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'ambiguous-test',
      userIntent: 'ログイン画面とかを修正してほしい。エラーメッセージの表示を改善する。',
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string)).toContain('ambiguous');
    expect((res.error as string)).toContain('とか');
  });

  it('rejects userIntent with ambiguous word "いい感じ"', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'ambiguous-test-2',
      userIntent: 'ダッシュボードをいい感じに整えてほしいです。見た目を改善する。',
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string)).toContain('いい感じ');
  });

  it('rejects userIntent with ambiguous word "適当に"', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'ambiguous-test-3',
      userIntent: 'テストコードを適当に追加してほしい。カバレッジを上げたい。',
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string)).toContain('適当に');
  });

  it('rejects userIntent with multiple ambiguous words', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'multi-ambiguous',
      userIntent: 'なんかいい感じにログイン画面を修正して。バリデーションなどを追加。',
    });
    expect(typeof res.error).toBe('string');
    expect((res.error as string)).toContain('いい感じ');
    expect((res.error as string)).toContain('なんか');
  });

  it('accepts userIntent without ambiguous expressions', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'clear-intent',
      userIntent: 'ログイン画面のメールアドレスバリデーションに正規表現チェックを追加し、不正形式の場合にエラーメッセージを表示する',
    });
    expect(res.error).toBeUndefined();
    expect(typeof res.taskId).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RLM-1: Retry count management
// ─────────────────────────────────────────────────────────────────────────────

describe('StateManager retryCount methods', () => {
  it('incrementRetryCount starts at 1 and increments', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'retry-test',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = res.taskId as string;

    expect(mgr.getRetryCount(taskId, 'scope_definition')).toBe(0);
    expect(mgr.incrementRetryCount(taskId, 'scope_definition')).toBe(1);
    expect(mgr.incrementRetryCount(taskId, 'scope_definition')).toBe(2);
    expect(mgr.getRetryCount(taskId, 'scope_definition')).toBe(2);
  });

  it('resetRetryCount clears the counter', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_start', {
      taskName: 'retry-reset-test',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = res.taskId as string;

    mgr.incrementRetryCount(taskId, 'research');
    mgr.incrementRetryCount(taskId, 'research');
    expect(mgr.getRetryCount(taskId, 'research')).toBe(2);
    mgr.resetRetryCount(taskId, 'research');
    expect(mgr.getRetryCount(taskId, 'research')).toBe(0);
  });

  it('incrementRetryCount returns -1 for non-existent task', () => {
    const mgr = createMgr();
    expect(mgr.incrementRetryCount('non-existent-id', 'research')).toBe(-1);
  });
});
