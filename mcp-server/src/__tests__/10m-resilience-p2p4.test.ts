/**
 * P2+P4: Output file existence and size pre-checks before DoD validation.
 * Tests AC-2 (output file existence) and AC-4 (minimum size 100 bytes).
 * TDD Red phase - pre-checks are not yet implemented in lifecycle.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';
import { buildValidArtifact } from './dod-test-helpers.js';

let ctx: TestCtx;

beforeEach(async () => {
  ctx = await setupHandlerTest();
});

afterEach(() => {
  teardownHandlerTest(ctx);
});

async function createTaskAtPhase(targetPhase: string): Promise<{ taskId: string; sessionToken: string; docsDir: string }> {
  const mgr = ctx.createMgr();
  const startRes = await ctx.call(mgr, 'harness_start', {
    taskName: 'p2p4-test-task',
    userIntent: 'Testing output file pre-checks for P2 and P4 resilience features in the workflow harness',
  });
  const taskId = startRes.taskId as string;
  let sessionToken = startRes.sessionToken as string;
  const docsDir = startRes.docsDir as string;

  // Advance to target phase using advancePhase (bypasses DoD)
  sessionToken = await ctx.advanceUntilPhase(mgr, taskId, sessionToken, targetPhase);
  return { taskId, sessionToken, docsDir };
}

describe('P2: output file existence pre-check (AC-2)', () => {
  // TC-AC2-01: outputFile不在時にDoDチェック前に成果物不在エラー
  it('returns artifact-not-found error when outputFile does not exist', async () => {
    const mgr = ctx.createMgr();
    const { taskId, sessionToken } = await createTaskAtPhase('scope_definition');

    // Do NOT create the output file (scope-definition.md)
    const res = await ctx.call(mgr, 'harness_next', {
      taskId,
      sessionToken,
    });

    // P2 pre-check should catch missing file before DoD runs
    const resStr = JSON.stringify(res);
    expect(resStr).toContain('成果物ファイルが存在しません');
  });

  // TC-AC2-02: outputFile存在時は先行チェックを通過しDoDチェック実行
  it('passes pre-check when outputFile exists with sufficient content', async () => {
    const mgr = ctx.createMgr();
    const { taskId, sessionToken, docsDir } = await createTaskAtPhase('scope_definition');

    // Create valid output file with 100+ bytes
    const artifact = buildValidArtifact(['decisions', 'artifacts', 'next'], 6);
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'scope-definition.md'), artifact, 'utf8');

    const res = await ctx.call(mgr, 'harness_next', {
      taskId,
      sessionToken,
    });

    // Should not get artifact-not-found error
    const resStr = JSON.stringify(res);
    expect(resStr).not.toContain('成果物ファイルが存在しません');
  });

  // TC-AC2-03: outputFile定義がないフェーズでは先行チェックスキップ
  it('skips pre-check for phases without outputFile definition', async () => {
    const mgr = ctx.createMgr();
    const startRes = await ctx.call(mgr, 'harness_start', {
      taskName: 'p2p4-no-output-test',
      userIntent: 'Testing that phases without outputFile skip the pre-check validation entirely',
    });
    const taskId = startRes.taskId as string;
    let sessionToken = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;

    // Advance to test_impl which has no outputFile
    mkdirSync(docsDir, { recursive: true });

    // Create required input files along the way
    writeFileSync(join(docsDir, 'scope-definition.md'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    writeFileSync(join(docsDir, 'research.md'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    writeFileSync(join(docsDir, 'test-design.md'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');
    writeFileSync(join(docsDir, 'test-selection.md'), buildValidArtifact(['decisions', 'artifacts', 'next'], 6), 'utf8');

    sessionToken = await ctx.advanceUntilPhase(mgr, taskId, sessionToken, 'test_impl');

    const res = await ctx.call(mgr, 'harness_next', {
      taskId,
      sessionToken,
    });

    // test_impl has no outputFile - pre-check should be skipped entirely
    const resStr = JSON.stringify(res);
    expect(resStr).not.toContain('成果物ファイルが存在しません');
  });

});

describe('P4: output file size pre-check (AC-4)', () => {
  // TC-AC4-01: 100バイト未満でサイズ不足エラー
  it('returns size-insufficient error for files under 100 bytes', async () => {
    const mgr = ctx.createMgr();
    const { taskId, sessionToken, docsDir } = await createTaskAtPhase('scope_definition');

    // Create a file with only 50 bytes
    mkdirSync(docsDir, { recursive: true });
    const smallContent = 'x'.repeat(50);
    writeFileSync(join(docsDir, 'scope-definition.md'), smallContent, 'utf8');

    const res = await ctx.call(mgr, 'harness_next', {
      taskId,
      sessionToken,
    });

    const resStr = JSON.stringify(res);
    expect(resStr).toContain('空または不完全です');
  });

  // TC-AC4-02: ちょうど100バイトでサイズチェック通過
  it('passes size check for files with exactly 100 bytes', async () => {
    const mgr = ctx.createMgr();
    const { taskId, sessionToken, docsDir } = await createTaskAtPhase('scope_definition');

    mkdirSync(docsDir, { recursive: true });
    const exactContent = 'x'.repeat(100);
    writeFileSync(join(docsDir, 'scope-definition.md'), exactContent, 'utf8');

    const res = await ctx.call(mgr, 'harness_next', {
      taskId,
      sessionToken,
    });

    const resStr = JSON.stringify(res);
    expect(resStr).not.toContain('空または不完全です');
  });

  // TC-AC4-03: 0バイト(空ファイル)でサイズ不足エラー
  it('returns size-insufficient error for empty files with 0 bytes', async () => {
    const mgr = ctx.createMgr();
    const { taskId, sessionToken, docsDir } = await createTaskAtPhase('scope_definition');

    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'scope-definition.md'), '', 'utf8');

    const res = await ctx.call(mgr, 'harness_next', {
      taskId,
      sessionToken,
    });

    const resStr = JSON.stringify(res);
    expect(resStr).toContain('空または不完全です');
    expect(resStr).toContain('0 bytes');
  });
});
