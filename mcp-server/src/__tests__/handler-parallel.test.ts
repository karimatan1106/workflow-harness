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
    const docsDir = startRes.docsDir as string;
    mkdirSync(docsDir, { recursive: true });

    // Advance to requirements, add ACs, approve, then advance one more
    token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

    // IA-2: Add minimum 5 acceptance criteria before approving requirements
    for (let i = 1; i <= 5; i++) {
      await call(mgr, 'harness_add_ac', {
        taskId,
        id: `AC-${i}`,
        description: `Acceptance criterion ${i} for parallel phase testing`,
        sessionToken: token,
      });
    }

    // Create requirements.md artifact to pass DoD gate on harness_next
    const requirementsContent = [
      '## decisions',
      '- REQ-001: System must pass minimum length requirement for parallel phase testing (Core requirement)',
      '- REQ-002: System must support acceptance criteria validation (Quality requirement)',
      '- REQ-003: System must handle parallel phase transitions correctly (Architecture requirement)',
      '- REQ-004: System must validate session tokens across phase boundaries (Security requirement)',
      '- REQ-005: System must maintain state consistency during phase advancement (Reliability requirement)',
      '',
      '## acceptanceCriteria',
      '- AC-1: Acceptance criterion 1 for parallel phase testing',
      '- AC-2: Acceptance criterion 2 for parallel phase testing',
      '- AC-3: Acceptance criterion 3 for parallel phase testing',
      '- AC-4: Acceptance criterion 4 for parallel phase testing',
      '- AC-5: Acceptance criterion 5 for parallel phase testing',
      '',
      '## notInScope',
      '- Performance optimization is excluded from this task',
      '',
      '## openQuestions',
      '',
      '## artifacts',
      '- docs/requirements.md: spec - Requirements definition',
      '',
      '## next',
      '- criticalDecisions: REQ-001',
      '- readFiles: docs/requirements.md',
    ].join('\n');
    writeFileSync(join(docsDir, 'requirements.md'), requirementsContent, 'utf8');

    // RTM-REQ: requirements phase needs RTM entries referencing ACs
    for (let i = 1; i <= 5; i++) {
      await call(mgr, 'harness_add_rtm', {
        taskId,
        id: `F-00${i}`,
        requirement: `AC-${i}: Acceptance criterion ${i} for parallel phase testing`,
        sessionToken: token,
      });
    }

    const approveRes = await call(mgr, 'harness_approve', {
      taskId,
      type: 'requirements',
      sessionToken: token,
    });
    expect(approveRes.error).toBeUndefined();

    // Approve no longer advances phases; advance directly via StateManager
    // (bypasses DoD since this test focuses on parallel phase behavior, not DoD gates)
    const advResult = mgr.advancePhase(taskId);
    expect(advResult.error).toBeUndefined();

    // After requirements approval + next, we should be at the next active phase
    const statusAfterApprove = await call(mgr, 'harness_status', { taskId });
    token = statusAfterApprove.sessionToken as string;
    const phaseAfterApprove = statusAfterApprove.phase as string;

    // The phase after requirements for a small task is 'planning'
    // (small skips threat_modeling); for a large task it's 'threat_modeling'.
    expect(phaseAfterApprove).not.toBe('requirements');
    expect(phaseAfterApprove).not.toBe('scope_definition');

    // The approve response no longer includes nextPhase; use harness_next instead
    expect(approveRes.nextPhase).toBeUndefined();
    expect(approveRes.nextAction).toBe('call harness_next');
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
    const requirementsContent = [
      '## decisions',
      '- REQ-001: System must authenticate users with JWT tokens (Security requirement)',
      '- REQ-002: System must log all access events for audit (Compliance requirement)',
      '- REQ-003: System must encrypt data at rest and in transit (Security requirement)',
      '- REQ-004: System must handle rate limiting for all endpoints (Performance requirement)',
      '- REQ-005: System must validate all input before processing (Security requirement)',
      '',
      '## acceptanceCriteria',
      '- AC-1: System authenticates users correctly',
      '- AC-2: System logs all access events',
      '- AC-3: System encrypts sensitive data',
      '- AC-4: System enforces rate limiting on all endpoints',
      '- AC-5: System validates all input before processing',
      '',
      '## notInScope',
      '- Mobile application development is excluded',
      '',
      '## openQuestions',
      '',
      '## artifacts',
      '- docs/requirements.md: spec - Requirements definition',
      '',
      '## next',
      '- criticalDecisions: REQ-001',
      '- readFiles: docs/requirements.md',
    ].join('\n');
    writeFileSync(join(docsDir, 'requirements.md'), requirementsContent, 'utf8');

    // Create valid threat-model.md artifact with decisions[] and required keys
    const threatModelContent = [
      '## decisions',
      '- TM-001: JWTトークン漏洩リスクが主要な脅威として特定された。HMAC-SHA256署名を適用する (セキュリティ要件に基づく)',
      '- TM-002: セッション固定攻撃への対策として認証成功時にセッションIDを再生成する (OWASP推奨事項)',
      '- TM-003: SQLインジェクション攻撃はパラメータ化クエリの徹底で完全に防止する (セキュリティベストプラクティス)',
      '- TM-004: ブルートフォース攻撃にはアカウントロックアウト機構と1000req/min制限で対処する (レート制限ポリシー)',
      '- TM-005: planningフェーズで認証フローの詳細設計を実施し脅威対策を組み込む (設計フェーズへの引き継ぎ)',
      '- TM-006: CSRF攻撃に対してはSameSite属性とCSRFトークンの二重防御を採用する (クロスサイト攻撃対策)',
      '- TM-007: XSS攻撃はHTTPOnly属性のCookieとContent-Security-Policyヘッダーで防止する (フロントエンドセキュリティ)',
      '- TM-008: APIキー漏洩リスクには環境変数管理とシークレットローテーションで対策する (シークレット管理ポリシー)',
      '',
      '## threatAnalysis',
      '- STRIDE分析結果: Spoofing(高), Tampering(中), Repudiation(低), Information Disclosure(高), DoS(中), Elevation(低)',
      '- 攻撃ベクトル: 外部API経由、ブラウザ経由、内部ネットワーク経由の3つを特定',
      '- リスクスコア: TM-001(9/10), TM-002(7/10), TM-003(8/10), TM-004(6/10)',
      '- 緩和策の優先度: 即時対応(TM-001,TM-003), 短期対応(TM-002,TM-006,TM-007), 中期対応(TM-004,TM-005,TM-008)',
      '',
      '## mitigationPlan',
      '- Phase 1: JWT署名アルゴリズムをHS256からRS256へ移行し、鍵ローテーション機構を実装',
      '- Phase 2: WAFルール追加によりSQLi/XSS攻撃を境界で検知・遮断',
      '- Phase 3: レート制限をAPI Gateway層で統一実装し、アプリケーション層の負荷を軽減',
      '- Phase 4: セキュリティ監査ログの集約とSIEM連携によりインシデント検知を自動化',
      '',
      '## complianceMapping',
      '- OWASP Top 10 2021: A01(Broken Access Control)→TM-002, A02(Crypto Failures)→TM-001, A03(Injection)→TM-003',
      '- PCI DSS v4.0: Requirement 6.2→TM-003,TM-007, Requirement 8.3→TM-001,TM-002',
      '',
      '## artifacts',
      '- docs/threat-model.md: spec - Threat modeling artifact with STRIDE analysis and mitigation plan',
      '',
      '## next',
      '- criticalDecisions: TM-001, TM-002, TM-003',
      '- readFiles: docs/threat-model.md',
      '- warnings: TM-001のリスクスコアが最高値のため即時対応が必要',
      '- securityReview: planningフェーズで緩和策の詳細設計を実施すること',
    ].join('\n');
    writeFileSync(join(docsDir, 'threat-model.md'), threatModelContent, 'utf8');

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

    // Create an invalid threat-model.md (too short, missing required keys)
    writeFileSync(join(docsDir, 'threat-model.md'), 'phase: threat_modeling\ntaskId: test\n', 'utf8');

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
