/**
 * Handler integration tests — Subagent Templates + Validation
 * Split from handler.test.ts. See handler-test-setup.ts for shared setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encode as toonEncode } from '@toon-format/toon';
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
// Subagent Templates
// ─────────────────────────────────────────────────────────────────────────────

describe('Subagent Templates', () => {
  it('harness_get_subphase_template returns a template with placeholder substitution', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'template-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;

    const res = await call(mgr, 'harness_get_subphase_template', {
      taskId,
      phase: 'research',
    });

    expect(res.error).toBeUndefined();
    expect(res.phase).toBe('research');
    expect(typeof res.subagentTemplate).toBe('string');
    expect((res.subagentTemplate as string).length).toBeGreaterThan(0);
    expect(typeof res.model).toBe('string');
    expect(Array.isArray(res.requiredSections)).toBe(true);
    expect(typeof res.minLines).toBe('number');
    expect(Array.isArray(res.bashCategories)).toBe(true);
  });

  it('harness_get_subphase_template with taskId substitutes task name in template', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'my-substitution-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;

    const res = await call(mgr, 'harness_get_subphase_template', {
      taskId,
      phase: 'scope_definition',
    });

    expect(res.error).toBeUndefined();
    const template = res.subagentTemplate as string;
    // The template should contain the actual task name, not the placeholder
    expect(template).toContain('my-substitution-task');
    expect(template).not.toContain('{taskName}');
  });

  it('harness_get_subphase_template rejects an unknown phase', async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', {
      phase: 'nonexistent_phase_xyz',
    });

    expect(typeof res.error).toBe('string');
    expect((res.error as string).toLowerCase()).toContain('no definition found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation (harness_pre_validate)
// ─────────────────────────────────────────────────────────────────────────────

describe('Validation', () => {
  it('harness_pre_validate returns retry prompt on failure (missing output file)', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'pre-validate-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;

    // scope_definition requires an output file that doesn't exist yet
    const res = await call(mgr, 'harness_pre_validate', {
      taskId,
      sessionToken: token,
    });

    expect(res.error).toBeUndefined();
    expect(typeof res.passed).toBe('boolean');
    expect(res.phase).toBe('scope_definition');
    expect(Array.isArray(res.checks)).toBe(true);

    if (!res.passed) {
      const retry = res.retry as Record<string, unknown> | undefined;
      expect(retry).toBeDefined();
      expect(typeof retry!.retryPrompt).toBe('string');
      expect((retry!.retryPrompt as string).length).toBeGreaterThan(0);
      expect(typeof retry!.suggestModelEscalation).toBe('boolean');
    }
  });

  it('harness_pre_validate passes when output file exists', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'pre-validate-pass-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    const content = toonEncode({
      phase: 'scope_definition',
      taskId: 'test',
      ts: new Date().toISOString(),
      decisions: [
        { id: 'SD-001', statement: '対象ファイルはsrc/tools/handler.tsの単一ファイルであることが確認された', rationale: 'スコープ定義の結果' },
        { id: 'SD-002', statement: 'ハンドラーレベルの統合テストカバレッジ向上を実施するという決定をした', rationale: '品質向上の目的' },
        { id: 'SD-003', statement: '既存テストへの影響はなくテストスイート全体の合格率を維持するという制約がある', rationale: 'リグレッション防止' },
        { id: 'SD-004', statement: '一時ディレクトリ使用によりファイルシステムへの影響は限定的であるリスクを確認した', rationale: 'リスク評価結果' },
        { id: 'SD-005', statement: 'researchフェーズでhandler.tsの現在の構造と依存関係を調査するという次アクションを決定した', rationale: '調査フェーズの開始' },
        { id: 'SD-006', statement: 'manager.ts、dod.ts、definitions.tsに依存しているという依存関係を特定した', rationale: '依存関係分析' },
        { id: 'SD-007', statement: 'vitestフレームワークを使用してテストを実装する前提であることを確認した', rationale: 'テストフレームワーク選定' },
      ],
      artifacts: [{ path: 'docs/scope-definition.toon', role: 'spec', summary: 'Scope definition artifact' }],
      next: {
        criticalDecisions: ['SD-001', 'SD-002'],
        readFiles: ['docs/scope-definition.toon'],
        warnings: [],
      },
    });

    writeFileSync(join(docsDir, 'scope-definition.toon'), content, 'utf8');

    const res = await call(mgr, 'harness_pre_validate', {
      taskId,
      sessionToken: token,
    });

    expect(res.error).toBeUndefined();
    expect(res.phase).toBe('scope_definition');
    expect(res.passed).toBe(true);
    expect(res.retry).toBeUndefined();
  });
});
