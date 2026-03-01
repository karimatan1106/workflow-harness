/**
 * Handler integration tests — Parallel Phases
 * Split from handler.test.ts. See handler-test-setup.ts for shared setup.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
// Parallel Phases
// ─────────────────────────────────────────────────────────────────────────────

describe('Parallel Phases', () => {
  it('harness_next advances normally through phases in a parallel group', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'parallel-phases-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    let token = startRes.sessionToken as string;

    // Advance to requirements, add ACs, approve, then advance one more
    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    // IA-2: Add minimum 3 acceptance criteria before approving requirements
    for (let i = 1; i <= 3; i++) {
      await call(mgr, 'harness_add_ac', {
        taskId,
        id: `AC-${i}`,
        description: `Acceptance criterion ${i} for parallel phase testing`,
        sessionToken: token,
      });
    }

    const approveRes = await call(mgr, 'harness_approve', {
      taskId,
      type: 'requirements',
      sessionToken: token,
    });
    expect(approveRes.error).toBeUndefined();

    // After requirements approval, we should be at the next active phase
    const statusAfterApprove = await call(mgr, 'harness_status', { taskId });
    token = statusAfterApprove.sessionToken as string;
    const phaseAfterApprove = statusAfterApprove.phase as string;

    // The phase after requirements for a small task is 'planning'
    // (small skips threat_modeling); for a large task it's 'threat_modeling'.
    expect(phaseAfterApprove).not.toBe('requirements');
    expect(phaseAfterApprove).not.toBe('scope_definition');

    // The advance response for approval includes nextPhase
    expect(typeof approveRes.nextPhase).toBe('string');
  });

  it('harness_complete_sub marks a sub-phase complete after DoD passes', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'complete-sub-task',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // IFV-1: threat_modeling requires requirements.md as input
    writeFileSync(join(docsDir, 'requirements.md'), [
      '## サマリー', '', 'Requirements for the task.', '', '## 受入基準', '',
      'AC-1: System must authenticate users.', 'AC-2: System must log all access.', 'AC-3: System must encrypt data.',
      '', '## NOT_IN_SCOPE', '', 'No out-of-scope items.', '', '## OPEN_QUESTIONS', '', 'なし',
    ].join('\n'), 'utf8');

    // Create valid threat-model.md artifact with Delta Entry and required sections
    const artifact = [
      '## サマリー',
      '',
      '- [TM-001][finding] 認証トークンの漏洩リスクが主要な脅威として特定された',
      '- [TM-002][decision] JWTトークンにはHMAC-SHA256署名を適用する方針とした',
      '- [TM-003][risk] セッション固定攻撃への対策が必要である',
      '- [TM-004][constraint] 外部認証プロバイダのレート制限が1000req/minである',
      '- [TM-005][next] planningフェーズで認証フローの詳細設計を実施する',
      '',
      '## 脅威シナリオ',
      '',
      '攻撃者がネットワーク傍受によりJWTトークンを取得するシナリオを想定する。',
      'HTTPS強制により通信路の暗号化を確保し、トークン漏洩を防止する。',
      'クロスサイトスクリプティング攻撃によるトークン窃取への対策も必要である。',
      'HTTPOnly属性のCookieを使用してJavaScriptからのアクセスを防止する。',
      'CSRF攻撃に対してはSameSite属性とCSRFトークンの二重防御を採用する。',
      'SQLインジェクション攻撃はパラメータ化クエリの徹底で完全に防止する。',
      'ブルートフォース攻撃にはアカウントロックアウト機構で対処する。',
      'ディレクトリトラバーサル攻撃には入力パスの正規化で対策する。',
      'セッションハイジャック攻撃にはIPバインドとUA検証で検出する。',
      'APIキー漏洩リスクには環境変数管理とシークレットローテーションで対策する。',
      '',
      '## リスク評価',
      '',
      'トークン漏洩リスクはHTTPS強制とHTTPOnly Cookieにより低減される。',
      'セッション固定攻撃は認証成功時のセッションID再生成で対策する。',
      '権限昇格リスクはロールベースアクセス制御の厳密な実装で軽減する。',
      'SQLインジェクションリスクはパラメータ化クエリの使用で排除する。',
      '依存パッケージの脆弱性は定期的なnpm auditで継続監視する。',
      'DoS攻撃のリスクはレートリミッターとWAFの導入により軽減される。',
      'ファイルアップロード機能のリスクはMIMEタイプ検証とサイズ制限で対策する。',
      'ログインジェクション攻撃は出力エンコーディングの徹底で防止される。',
      'オープンリダイレクト攻撃はホワイトリスト方式のURL検証で排除する。',
      'サーバーサイドリクエストフォージェリはURLスキーム制限で防止する。',
      '',
      '## セキュリティ要件',
      '',
      'すべてのAPIエンドポイントでJWT検証ミドルウェアを適用すること。',
      'パスワードはbcryptでハッシュ化し、平文保存を禁止する。',
      'ログイン試行回数を制限し、ブルートフォース攻撃を防止する。',
      'セキュリティヘッダーを全レスポンスに付与する設定を実装する。',
      'エラーメッセージに内部情報を含めないようサニタイズすること。',
      'アクセスログには認証情報を含めず監査証跡として保全する。',
      'トークンの有効期限を15分に設定しリフレッシュトークンで延長する。',
      'Content-Security-Policyヘッダーでインラインスクリプトを禁止する。',
      'Strict-Transport-Securityヘッダーを設定してHTTPS接続を強制する。',
      'X-Content-Type-Optionsヘッダーでコンテンツスニッフィングを防止する。',
      'APIレスポンスにX-Frame-Optionsヘッダーを付与してクリックジャッキングを防ぐ。',
      'データベース接続にはTLSを使用し通信を暗号化する。',
      'サーバーサイドのバリデーションをクライアントサイドと独立して実装する。',
      'セキュリティパッチの適用を自動化するCI/CDパイプラインを構築する。',
      '入力値のサニタイズ処理を全APIエンドポイントに適用する。',
    ].join('\n');
    writeFileSync(join(docsDir, 'threat-model.md'), artifact, 'utf8');
    writeFileSync(
      join(docsDir, 'threat_modeling.toon'),
      'phase: threat_modeling\ntaskId: toon-test\nts: "2026-03-01T00:00:00Z"\ndecisions[1]{id,statement,rationale}:\n  TM-001,Threat model completed,Security analysis done\n',
      'utf8',
    );

    const res = await call(mgr, 'harness_complete_sub', {
      taskId,
      subPhase: 'threat_modeling',
      sessionToken: token,
    });

    expect(res.error).toBeUndefined();
    expect(res.subPhase).toBe('threat_modeling');
    expect(res.completed).toBe(true);
    expect(Array.isArray(res.remainingSubPhases)).toBe(true);
    expect(typeof res.allSubPhasesComplete).toBe('boolean');
  });

  it('harness_complete_sub returns DoD error when artifact is invalid', async () => {
    const mgr = createMgr();
    const startRes = await call(mgr, 'harness_start', {
      taskName: 'complete-sub-fail',
      userIntent: 'This user intent is long enough to pass the minimum length requirement.',
    });
    const taskId = startRes.taskId as string;
    const token = startRes.sessionToken as string;
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // Create an invalid threat-model.md (missing required sections, too short)
    writeFileSync(join(docsDir, 'threat-model.md'), '## サマリー\n\nShort content.', 'utf8');

    const res = await call(mgr, 'harness_complete_sub', {
      taskId,
      subPhase: 'threat_modeling',
      sessionToken: token,
    });

    // Should fail DoD and return error with retry info
    expect(res.error).toBeDefined();
    expect(res.errors).toBeDefined();
    expect(res.retry).toBeDefined();
    expect(res.retry.retryPrompt).toBeDefined();
  });
});
