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

    const content = [
      '## サマリー',
      '',
      '- [SD-001][finding] 対象ファイルはsrc/tools/handler.tsの単一ファイルである',
      '- [SD-002][decision] ハンドラーレベルの統合テストカバレッジ向上を実施する',
      '- [SD-003][constraint] 既存テストへの影響はなくテストスイート全体の合格率を維持する',
      '- [SD-004][risk] 一時ディレクトリ使用によりファイルシステムへの影響は限定的である',
      '- [SD-005][next] researchフェーズでhandler.tsの現在の構造と依存関係を調査する',
      '- [SD-006][dependency] manager.ts、dod.ts、definitions.tsに依存している',
      '- [SD-007][assumption] vitestフレームワークを使用してテストを実装する前提である',
      '',
      '## スコープ定義',
      '',
      '対象ファイルは src/tools/handler.ts の単一ファイルです。',
      'このファイルにはすべてのツールディスパッチロジックが含まれています。',
      '変更の目的はハンドラーレベルの統合テストカバレッジ向上です。',
      '影響する主要関数は handleToolCall と TOOL_DEFINITIONS の2つです。',
      '変更規模は小さく、既存ファイルへの修正は行いません。',
      '新規テストファイル handler.test.ts を src/__tests__/ に作成します。',
      'テストは vitest フレームワークを使用して実装します。',
      '既存の manager.test.ts と同じパターンで一時ディレクトリを使用します。',
      '',
      '## 影響範囲',
      '',
      '影響を受けるファイルは src/__tests__/handler.test.ts の新規作成のみです。',
      '依存するファイルには manager.ts、dod.ts、definitions.ts があります。',
      'テスト実行時は一時ディレクトリを使用するためファイルシステムへの影響は限定的です。',
      '既存テストへの影響はなく、テストスイート全体の合格率は維持されます。',
      'ビルド設定への変更は不要で、tsconfig.json も修正しません。',
      'package.json の依存関係追加も必要ありません。',
      'CI/CD パイプラインへの変更も発生しません。',
      '型定義ファイルへの変更も不要です。',
      '',
      '## スコープ外',
      '',
      'このタスクでは UI 関連の変更は一切行いません。',
      'データベース関連の変更も対象外で、スキーマ修正は含まれません。',
      '外部 API との連携変更もスコープ外です。',
      'インフラ設定の変更はこのタスクでは行いません。',
      'パフォーマンスの最適化も今回のスコープには含まれません。',
      'セキュリティポリシーの変更もスコープ外となります。',
      'ドキュメント更新はテスト追加完了後の別タスクで対応します。',
      'リファクタリングも別タスクで実施予定のためスコープ外です。',
    ].join('\n');

    writeFileSync(join(docsDir, 'scope-definition.md'), content, 'utf8');
    writeFileSync(
      join(docsDir, 'scope_definition.toon'),
      'phase: scope_definition\ntaskId: toon-test\nts: "2026-03-01T00:00:00Z"\ndecisions[1]{id,statement,rationale}:\n  SD-001,Scope defined,Initial scope analysis\n',
      'utf8',
    );

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
