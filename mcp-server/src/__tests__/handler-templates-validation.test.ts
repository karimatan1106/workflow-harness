/**
 * Handler integration tests — Subagent Templates + Validation
 * Split from handler.test.ts. See handler-test-setup.ts for shared setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
    // requiredSections, minLines, bashCategories removed for context savings
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

    // hearing requires an output file that doesn't exist yet
    const res = await call(mgr, 'harness_pre_validate', {
      taskId,
      sessionToken: token,
    });

    expect(res.error).toBeUndefined();
    expect(typeof res.passed).toBe('boolean');
    expect(res.phase).toBe('hearing');
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

    const content = [
      '## decisions',
      '- HR-001: ユーザーの意図を正確に把握し、タスクの目的を確認した (ヒアリングの結果)',
      '- HR-002: ハンドラーレベルの統合テストカバレッジ向上を実施するという決定をした (品質向上の目的)',
      '- HR-003: 既存テストへの影響はなくテストスイート全体の合格率を維持する (リグレッション防止)',
      '- HR-004: 一時ディレクトリ使用によりファイルシステムへの影響は限定的 (リスク評価結果)',
      '- HR-005: scope_definitionフェーズで詳細なスコープ定義を行う (スコープ定義フェーズの開始)',
      '- HR-006: manager.ts、dod.ts、definitions.tsに依存している (依存関係分析)',
      '- HR-007: vitestフレームワークを使用してテストを実装する (テストフレームワーク選定)',
      '- HR-008: テスト実行環境は一時ディレクトリで隔離し他テストとの干渉を防ぐ (テスト隔離)',
      '- HR-009: セッション管理のトークン検証ロジックを重点的にテストする (セキュリティ検証)',
      '- HR-010: ハーネスのライフサイクル全体を通じた状態遷移の整合性を確認する (状態管理)',
      '',
      '## artifacts',
      '- docs/hearing.md: spec - Hearing artifact',
      '',
      '## next',
      '- criticalDecisions: HR-001, HR-002',
      '- readFiles: docs/hearing.md',
      '- warnings: No warnings identified',
      '- additionalContext: Integration test coverage improvement initiative',
    ].join('\n');

    writeFileSync(join(docsDir, 'hearing.md'), content, 'utf8');

    const res = await call(mgr, 'harness_pre_validate', {
      taskId,
      sessionToken: token,
    });

    expect(res.error).toBeUndefined();
    expect(res.phase).toBe('hearing');
    expect(res.passed).toBe(true);
    expect(res.retry).toBeUndefined();
  });
});
