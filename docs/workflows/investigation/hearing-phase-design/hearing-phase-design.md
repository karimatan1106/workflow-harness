# hearing フェーズ設計書

## 概要

scope_definition の前に hearing フェーズを追加し、Worker を Plan モード（planOnly: true）で起動してユーザーの意図を明確化する。Plan 承認後に scope_definition へ遷移する。

## 現状分析

### 初期フェーズの決定フロー
1. harness_start が createTaskState() を呼ぶ
2. createTaskState() 内で getActivePhases(size)[0] を取得 → 現在は scope_definition
3. この値が TaskState.phase の初期値になる

### フェーズ順序の定義箇所
- PHASE_NAMES (types-core.ts) — 型定義の配列（as const）
- PHASE_ORDER (registry.ts) — 実行順序の配列
- PHASE_REGISTRY (registry.ts) — PhaseConfig の Record

### planOnly/approvedPlan パターン（既存）
planning フェーズで既に 2-stage flow が実装されている:
- defs-c.ts に planOnly / approvedPlan パラメータ定義あり
- Orchestrator が Agent(Worker, planOnly: true) で起動 → プラン取得 → ユーザー承認 → Agent(Worker, approvedPlan: plan) で実行

hearing フェーズでもこの同じパターンを利用可能。

---

## 変更箇所一覧（15箇所、7ファイル変更 + 1ファイル新規作成）

### 1. types-core.ts — PhaseName 型に hearing を追加
ファイル: workflow-harness/mcp-server/src/state/types-core.ts (行26-58)
変更: PHASE_NAMES 配列の先頭に hearing を挿入
影響: PhaseName 型と PhaseNameSchema (Zod) が自動追従

### 2. types-core.ts — APPROVAL_GATES に hearing 追加
ファイル: workflow-harness/mcp-server/src/state/types-core.ts (行91-97)
変更: hearing: hearing エントリを追加
影響: ApprovalType 型が自動追従

### 3. registry.ts — PHASE_REGISTRY に hearing エントリ追加
ファイル: workflow-harness/mcp-server/src/phases/registry.ts (行8-10)
変更: Stage 0 コメント付きで hearing PhaseConfig を先頭に追加
設定値: stage: 0, model: opus, outputFile: hearing.toon, minLines: 20, approvalRequired: hearing, allowedTools: [Read, Glob, Grep, Write]

### 4. registry.ts — PHASE_ORDER に hearing を先頭追加
ファイル: workflow-harness/mcp-server/src/phases/registry.ts (行57)
変更: hearing を配列先頭に挿入
影響: getActivePhases/getNextPhase/advancePhase が自動的に hearing → scope_definition 遷移を実現

### 5. registry.ts — scope_definition の inputFiles を更新
ファイル: workflow-harness/mcp-server/src/phases/registry.ts (行10)
変更: inputFiles: [] → inputFiles: ['{docsDir}/hearing.toon']
理由: hearing の成果物を scope_definition に引き継ぐ

### 6. defs-stage0.ts（新規作成）— hearing の PhaseDefinition
ファイル: workflow-harness/mcp-server/src/phases/defs-stage0.ts
新規作成。内容: description, model(opus), subagentTemplate（意図分析/事前調査/プラン策定の3ステップ）
200行制限への配慮のため defs-stage1.ts ではなく新規ファイルを推奨

### 7. definitions.ts — DEFS_STAGE0 のインポートとマージ
ファイル: workflow-harness/mcp-server/src/phases/definitions.ts (行22, 34)
変更: import { DEFS_STAGE0 } + PHASE_DEFINITIONS に ...DEFS_STAGE0 追加

### 8. definitions.ts — OUTPUT_FILE_TO_PHASE に hearing.toon 追加
ファイル: workflow-harness/mcp-server/src/phases/definitions.ts (行50)
変更: hearing.toon: hearing エントリを追加

### 9. toon-skeletons-a.ts — TOON_SKELETON_HEARING 追加
ファイル: workflow-harness/mcp-server/src/phases/toon-skeletons-a.ts
変更: TOON_SKELETON_HEARING 定数を新規追加
セクション: サマリー / 意図分析(surfaceRequest, deepNeed, unclearPoints, assumptions) / 実装プラン(approach, estimatedScope, risks, questions) / decisions / artifacts / next

### 10. definitions-shared.ts — IDプレフィックスに hearing=HR 追加
ファイル: workflow-harness/mcp-server/src/phases/definitions-shared.ts (行48)
変更: hearing=HR を先頭に追加

### 11. dod-l4-delta.ts — DELTA_ENTRY_APPLICABLE_PHASES に hearing 追加
ファイル: workflow-harness/mcp-server/src/gates/dod-l4-delta.ts (行14)
変更: hearing を Set に追加

### 12. handler-shared.ts — PHASE_APPROVAL_GATES に hearing 追加
ファイル: workflow-harness/mcp-server/src/tools/handler-shared.ts
変更: hearing: hearing エントリと buildPhaseGuide への hearing ガイド追加

### 13. lifecycle.ts — NO_SKIP_PHASES に hearing 追加
ファイル: workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts (行125)
変更: Set に hearing を追加

### 14. defs-stage1.ts — scope_definition.inputFiles 更新
ファイル: workflow-harness/mcp-server/src/phases/defs-stage1.ts (行13)
変更: inputFiles: [] → inputFiles: ['{docsDir}/hearing.toon']

### 15. スキルファイル3件更新
- workflow-phases.md: Stage 0: hearing セクション追加
- workflow-orchestrator.md: Execution Flow に hearing の 2-stage flow 説明追加
- workflow-execution.md: フェーズ別subagent設定テーブルに hearing 行追加

---

## Orchestrator の hearing フェーズ実行フロー

hearing フェーズは planning フェーズと同じ 2-stage flow を採用:

1. harness_start(taskName, userIntent) → TaskState.phase = hearing
2. harness_get_subphase_template(phase=hearing, taskId) → テンプレート取得
3. Stage 1: Agent(Worker, planOnly: true, prompt=template) → readonly 調査 → hearing.toon 生成
4. hearing.toon の内容をユーザーに提示
5. harness_approve(taskId, type=hearing) → ユーザーがプランを承認
6. harness_next(taskId, sessionToken) → DoD 検証 → scope_definition へ遷移

却下フロー:
5a. ユーザーがフィードバック付きで却下
6a. フィードバックを含めて Worker を再起動
7a. 再度ユーザーに提示 → 承認まで繰り返し

---

## SIZE_SKIP_MAP への影響

推奨: 全サイズで hearing を必須とする（SIZE_SKIP_MAP 変更不要）
理由: 意図確認は全タスクサイズで重要。

---

## Worker タスク分解（並列実行用）

| Worker | タスク | 対象ファイル |
|--------|--------|-------------|
| W-1 | types-core.ts に hearing 追加 (PHASE_NAMES + APPROVAL_GATES) | types-core.ts |
| W-2 | registry.ts に hearing エントリ + PHASE_ORDER + scope_definition.inputFiles | registry.ts |
| W-3 | defs-stage0.ts 新規作成 + definitions.ts にインポート + OUTPUT_FILE_TO_PHASE | defs-stage0.ts, definitions.ts |
| W-4 | toon-skeletons-a.ts に TOON_SKELETON_HEARING 追加 | toon-skeletons-a.ts |
| W-5 | handler-shared.ts に hearing ゲート + lifecycle.ts NO_SKIP_PHASES | handler-shared.ts, lifecycle.ts |
| W-6 | dod-l4-delta.ts + definitions-shared.ts IDプレフィックス | dod-l4-delta.ts, definitions-shared.ts |
| W-7 | スキルファイル3件更新 | skills/*.md |

依存: W-1(型定義) → W-2〜W-6(並列可) / W-7(独立)
