/**
 * Handler integration tests — Parallel Phases
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

    // IFV-1: threat_modeling requires requirements.toon as input
    const requirementsContent = toonEncode({
      phase: 'requirements',
      taskId: 'test',
      ts: new Date().toISOString(),
      decisions: [
        { id: 'REQ-001', statement: 'System must authenticate users with JWT tokens', rationale: 'Security requirement' },
        { id: 'REQ-002', statement: 'System must log all access events for audit', rationale: 'Compliance requirement' },
        { id: 'REQ-003', statement: 'System must encrypt data at rest and in transit', rationale: 'Security requirement' },
        { id: 'REQ-004', statement: 'System must handle rate limiting for all endpoints', rationale: 'Performance requirement' },
        { id: 'REQ-005', statement: 'System must validate all input before processing', rationale: 'Security requirement' },
      ],
      acceptanceCriteria: [
        { id: 'AC-1', criterion: 'System authenticates users correctly' },
        { id: 'AC-2', criterion: 'System logs all access events' },
        { id: 'AC-3', criterion: 'System encrypts sensitive data' },
      ],
      notInScope: [{ item: 'Mobile application development is excluded' }],
      openQuestions: [],
      artifacts: [{ path: 'docs/requirements.toon', role: 'spec', summary: 'Requirements definition' }],
      next: { criticalDecisions: ['REQ-001'], readFiles: ['docs/requirements.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'requirements.toon'), requirementsContent, 'utf8');

    // Create valid threat-model.toon artifact with decisions[] and required keys
    const threatModelContent = toonEncode({
      phase: 'threat_modeling',
      taskId: 'test',
      ts: new Date().toISOString(),
      decisions: [
        { id: 'TM-001', statement: 'JWTトークン漏洩リスクが主要な脅威として特定された。HMAC-SHA256署名を適用する', rationale: 'セキュリティ要件に基づく' },
        { id: 'TM-002', statement: 'セッション固定攻撃への対策として認証成功時にセッションIDを再生成する', rationale: 'OWASP推奨事項' },
        { id: 'TM-003', statement: 'SQLインジェクション攻撃はパラメータ化クエリの徹底で完全に防止する', rationale: 'セキュリティベストプラクティス' },
        { id: 'TM-004', statement: 'ブルートフォース攻撃にはアカウントロックアウト機構と1000req/min制限で対処する', rationale: 'レート制限ポリシー' },
        { id: 'TM-005', statement: 'planningフェーズで認証フローの詳細設計を実施し脅威対策を組み込む', rationale: '設計フェーズへの引き継ぎ' },
        { id: 'TM-006', statement: 'CSRF攻撃に対してはSameSite属性とCSRFトークンの二重防御を採用する', rationale: 'クロスサイト攻撃対策' },
        { id: 'TM-007', statement: 'XSS攻撃はHTTPOnly属性のCookieとContent-Security-Policyヘッダーで防止する', rationale: 'フロントエンドセキュリティ' },
        { id: 'TM-008', statement: 'APIキー漏洩リスクには環境変数管理とシークレットローテーションで対策する', rationale: 'シークレット管理ポリシー' },
      ],
      artifacts: [{ path: 'docs/threat-model.toon', role: 'spec', summary: 'Threat modeling artifact' }],
      next: { criticalDecisions: ['TM-001', 'TM-002'], readFiles: ['docs/threat-model.toon'], warnings: [] },
    });
    writeFileSync(join(docsDir, 'threat-model.toon'), threatModelContent, 'utf8');

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

    // Create an invalid threat-model.toon (too short, missing required keys)
    writeFileSync(join(docsDir, 'threat-model.toon'), 'phase: threat_modeling\ntaskId: test\n', 'utf8');

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
