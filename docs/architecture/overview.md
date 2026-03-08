# ハーネスMCPサーバー アーキテクチャ概要

baseCommit: c01d689 | FR-1 | AC-1

## システム概要

workflow-harness は MCP (Model Context Protocol) サーバーとして動作するタスク管理ハーネスである。
30フェーズの厳密順序実行、L1-L4決定的ゲート検証、HMAC-SHA256状態整合性保証を提供する。

| 項目 | 値 |
|------|-----|
| サーバー名 | workflow-harness |
| バージョン | 0.1.0 |
| ランタイム | Node.js v22.15.0 |
| 言語 | TypeScript 5.9.3 |
| ソースファイル数 | 46 |
| 総行数 | 5,117 |
| ファイル行数上限 | 200行 (最大: defs-stage6.ts 197行) |
| SDK | @modelcontextprotocol/sdk |

ソース: `index.ts:13-17`, `package.json`

## 6サブシステム構成

### 1. phases (8ファイル) — フェーズ定義・遷移制御

30フェーズ+completedの定義、順序配列、サイズ別スキップマップ、リスク分類器、サブエージェントテンプレートを格納する。

| ファイル | 行数 | 役割 |
|---------|------|------|
| registry.ts | 171 | PHASE_REGISTRY, PHASE_ORDER, SIZE_SKIP_MAP, ヘルパー関数7種 |
| definitions.ts | 137 | PHASE_DEFINITIONS集約, buildSubagentPrompt |
| definitions-shared.ts | 58 | PhaseDefinition型, テンプレートフラグメント4種 |
| defs-stage1.ts | 193 | scope_definition, research, impact_analysis, requirements |
| defs-stage2.ts | 171 | threat_modeling, planning, state_machine, flowchart, ui_design |
| defs-stage3.ts | 129 | design_review, test_design, test_selection |
| defs-stage4.ts | 173 | test_impl, implementation, refactoring, build_check, code_review |
| defs-stage5.ts | 152 | testing, regression_test, acceptance_verification, manual_test, security_scan |
| defs-stage6.ts | 197 | performance_test, e2e_test, docs_update, commit, push, ci_verification, deploy, health_observation |
| risk-classifier.ts | 59 | calculateRiskScore, classifySize, analyzeScope |

### 2. gates (12ファイル) — DoD検証ゲート

22個の決定的チェック関数をL1-L4の4レベルで実装する。L5(LLM判断)は存在しない。

| ファイル | 役割 | ソース参照 |
|---------|------|-----------|
| dod.ts | オーケストレータ: runDoDChecks(22チェック呼出) | `dod.ts:24-59` |
| dod-types.ts | DoDCheckResult, DoDResult型定義 | `dod-types.ts:1-20` |
| dod-l1-l2.ts | L1(ファイル存在), L2(終了コード, TDD Red) | `dod-l1-l2.ts:11-80` |
| dod-l3.ts | L3(品質, RTM, AC, 鮮度, 不変条件, ベースライン) | `dod-l3.ts:13-135` |
| dod-l4-content.ts | L4: 禁止語・プレースホルダー・重複行 | `dod-l4-content.ts:39-68` |
| dod-l4-requirements.ts | L4: AC-N形式, notInScope, openQuestions, 意図一貫性 | `dod-l4-requirements.ts:25-124` |
| dod-l4-delta.ts | L4: decisions[]最低5件 | `dod-l4-delta.ts:20-66` |
| dod-l4-ia.ts | L4: IA-3/4/5マッピング, TC数カバレッジ | `dod-l4-ia.ts:12-123` |
| dod-l4-art.ts | L4: ART-1成果物ドリフト検知 | `dod-l4-art.ts:19-40` |
| dod-l4-commit.ts | L4: DEP-1 package.json/lock同期 | `dod-l4-commit.ts:16-36` |
| dod-l4-refs.ts | L4: DRV-1死参照検出 | `dod-l4-refs.ts:23-52` |
| dod-helpers.ts | 禁止語パターン, 構造行検出, 重複行検出 | `dod-helpers.ts:7-61` |

### 3. tools (15ファイル) — MCPツールハンドラ

21個のMCPツール定義とディスパッチ、セッション検証、スキルファイルルーティング、リトライシステム、Reflector-Curator-ACE学習パイプラインを実装する。

| ファイル | 役割 | ソース参照 |
|---------|------|-----------|
| handler.ts | switch文21分岐ディスパッチ | `handler.ts:19-54` |
| handler-shared.ts | respond/respondError, validateSession, PARALLEL_GROUPS, buildPhaseGuide | `handler-shared.ts:1-97` |
| defs-a.ts | 11ツール定義(start〜add_rtm) | `defs-a.ts:6-164` |
| defs-b.ts | 10ツール定義(record_feedback〜update_rtm_status) | `defs-b.ts:6-158` |
| handlers/lifecycle.ts | start, status, next | `handlers/lifecycle.ts:21-123` |
| handlers/approval.ts | approve(ART-1ハッシュ記録, IA検証) | `handlers/approval.ts:16-74` |
| handlers/scope-nav.ts | set_scope, complete_sub, back, reset | `handlers/scope-nav.ts:15-108` |
| handlers/recording.ts | proof, ac, rtm, feedback, baseline, test_result, test | `handlers/recording.ts:11-121` |
| handlers/query.ts | test_info, known_bug, subphase_template, pre_validate, ac/rtm_status | `handlers/query.ts:15-103` |
| retry.ts | classifyError(4分類), errorToImprovement(15パターン), buildRetryPrompt | `retry.ts:1-153` |
| reflector.ts | stashFailure, promoteStashedFailure, formatLessonsForPrompt | `reflector.ts:1-153` |
| reflector-types.ts | LessonV3型, v2→v3マイグレーション | `reflector-types.ts:1-70` |
| curator.ts | runCuratorCycle(stale剪定, fuzzyDedup, trim) | `curator.ts:1-140` |
| curator-helpers.ts | similarity計算, stale判定 | `curator-helpers.ts:1-98` |
| ace-context.ts | extractAndStoreBullets, getTopCrossTaskBullets | `ace-context.ts:1-103` |

### 4. state (7ファイル) — 状態管理・永続化

TaskState v4スキーマ、Zodバリデーション、HMAC署名付き永続化、読取・書込・不変条件操作を実装する。

| ファイル | 役割 | ソース参照 |
|---------|------|-----------|
| types.ts | TaskState interface(70フィールド) | `types.ts:52-121` |
| types-core.ts | PhaseName, TaskSize, RTMEntry, AcceptanceCriterion, Zod schemas | `types-core.ts:1-194` |
| types-invariant.ts | Invariant, InvariantStatus型 | `types-invariant.ts:1-23` |
| manager.ts | StateManager class(22 publicメソッド) | `manager.ts:23-196` |
| manager-read.ts | loadTaskFromDisk, listTasksFromDisk, buildTaskIndex | `manager-read.ts:1-91` |
| manager-write.ts | persistState, createTaskState, signAndPersist | `manager-write.ts:1-120` |
| manager-invariant.ts | invariant CRUD, retryCount, artifactHash | `manager-invariant.ts:1-58` |

### 5. utils (1ファイル) — セキュリティユーティリティ

| ファイル | 役割 | ソース参照 |
|---------|------|-----------|
| hmac.ts | HMAC-SHA256署名・検証・鍵生成・鍵ローテーション | `hmac.ts:1-85` |

### 6. entry (2ファイル) — エントリポイント

| ファイル | 役割 | ソース参照 |
|---------|------|-----------|
| index.ts | MCPサーバー起動(StdioServerTransport) | `index.ts:1-48` |
| cli.ts | CLI(add-invariant, update-invariant-status) | `cli.ts:1-109` |

## モジュール間依存グラフ

依存方向は一方向であり循環は存在しない。

```
index.ts → handler.ts → handlers/* → StateManager → manager-read/write/invariant → hmac.ts
                       → dod.ts → dod-l1-l2 / dod-l3 / dod-l4-*
         definitions.ts → reflector.ts → curator.ts → ace-context.ts
         handler-shared.ts → registry.ts
         manager.ts → registry.ts
```

ソース: `index.ts:7-11`(import), `handler.ts:7-15`(import), `manager.ts:6-19`(import)

## MCPプロトコル統合

サーバーは `@modelcontextprotocol/sdk` の `Server` クラスを使用し、`StdioServerTransport` で標準入出力経由の通信を行う。

- `ListToolsRequestSchema` ハンドラが21ツール定義を返却する (`index.ts:28-30`)
- `CallToolRequestSchema` ハンドラが `handleToolCall` のswitch文21分岐にディスパッチする (`index.ts:33-36`)
- 応答形式: `{ content: [{ type: 'text', text: JSON.stringify(obj) }] }` (`handler-shared.ts:11-13`)

## 設計制約

| 制約 | 根拠 | 実装箇所 |
|------|------|----------|
| 全ファイル200行以下 | コンテキスト圧縮・可読性維持 | 全46ファイルが遵守(最大197行) |
| L5(LLM判断)ゲート禁止 | 検証不能=改善不能(PSC-5) | `dod.ts`に22個の決定的チェックのみ |
| HMAC-SHA256状態整合性 | タスク状態の改竄防止 | `hmac.ts:1-85` |
| sessionToken二層ルール | Layer1:全ツール, Layer2:test系サブエージェントのみ | `handler-shared.ts:34-39` |
| TOON成果物形式 | JSONより40-50%効率的 | `definitions-shared.ts:31-40` |
