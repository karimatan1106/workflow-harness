# Impact Analysis: workflow-harness-refactoring

## 1. vscode-ext/ 全削除

### 逆依存
| 参照元 | 行番号 | 種別 | 影響 |
|--------|--------|------|------|
| workflow-harness/STRUCTURE_REPORT.md | L38 | ディレクトリ一覧 | 修正必要 |
| workflow-harness/STRUCTURE_REPORT.md | L140-L148 | セクション2.6 | 削除必要 |
| workflow-state.toon (27a3413e) | L23, L34 | 過去タスク状態 | 変更不要(SD-07) |
| workflow-state.toon (a0e87be6) | L18, L22, L34, L36 | 現タスク状態 | 変更不要(SD-07) |

### テストファイル影響: なし
### 破壊的変更: なし (ランタイム依存ゼロ)
### リスク: 低


## 2. hooks/ バックアップファイル削除 (4件)

対象: pre-tool-guard.sh.bak2, .bak3, .disabled, test-guard.sh.bak4

### 逆依存: なし (Grep検索0件)
### テストファイル影響: なし
### 破壊的変更: なし (git履歴で復元可能)
### リスク: 低


## 3. subagentテンプレートMCP直接呼び出し（ドキュメント更新）

### 逆依存
| 参照元 | 行番号 | 内容 | 影響 |
|--------|--------|------|------|
| .claude/skills/workflow-harness/workflow-orchestrator.md | L27 | template取得フロー | 修正: coordinator直接呼出に変更 |
| .claude/skills/workflow-harness/workflow-orchestrator.md | L28 | Agent委譲記述 | 修正: coordinator自身がMCP呼出 |
| .claude/skills/workflow-harness/workflow-orchestrator.md | L101 | VERBATIM制約 | 修正: coordinator直接取得に文言変更 |
| .claude/skills/workflow-harness/workflow-orchestrator.md | L160 | ツール一覧表 | 変更不要 |
| .claude/skills/workflow-harness/workflow-execution.md | L71 | テンプレート取得説明 | 修正: coordinator直接取得に変更 |
| AGENTS.md | L38 | ツール一覧表 | 変更不要 |

hook整合性: tool-gate.js L48-L56でcoordinator(L2)は非ライフサイクルMCPを呼出可能。hook変更不要。

### テストファイル影響
.claude/hooks/test-guard.sh L157-L159: TC-O-16はorchestrator層ブロック確認。coordinator権限に影響なし。

### 破壊的変更: なし (ドキュメント変更のみ)
### リスク: 低


## 4. hearing DoD userResponse必須チェック追加

### 逆依存
| 参照元 | 行番号 | 内容 | 影響 |
|--------|--------|------|------|
| workflow-harness/mcp-server/src/phases/registry.ts | L10 | hearing: dodChecks=[] | 修正: チェック関数追加 |
| workflow-harness/mcp-server/src/state/types-core.ts | L164 | DoDCheck型定義 | 変更不要(型整備済み) |
| workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts | L164 | dodChecks結果返却 | 変更不要(汎用処理) |
| workflow-harness/mcp-server/src/tools/handlers/scope-nav.ts | L64 | dodChecks結果返却 | 変更不要(汎用処理) |

全31フェーズでdodChecks=[]。hearingが初の利用事例。dodChecks実行パスはlifecycle.ts/scope-nav.tsで既に実装済み。

### テストファイル影響: 新規テスト追加が必要
### 破壊的変更: なし (空配列への追加)
### リスク: 中 (初のdodChecks利用。実行パスは存在するが実績なし)


## 5. Serena MCPサーバー化（CLI廃止、.mcp.json追加）

### 逆依存
| 参照元 | 行番号 | 内容 | 影響 |
|--------|--------|------|------|
| workflow-harness/mcp-server/src/phases/defs-stage1.ts | L27-L52 | scope_definition Serena CLIコマンド | 修正: MCPツール形式に変更 |
| workflow-harness/mcp-server/src/phases/defs-stage1.ts | L131-L132 | impact_analysis Serena CLIコマンド | 修正: MCPツール形式に変更 |
| workflow-harness/hooks/tool-gate.js | L67 | lsp許可: serena-query.py | 修正: MCP許可パターンに変更 |
| .mcp.json (ルート) | - | Serenaエントリなし | 修正: serenaエントリ追加 |

### テストファイル影響
| テスト | パス | 影響 |
|--------|------|------|
| serena-integration.test.ts | src/__tests__/serena-integration.test.ts L71-107 | 修正必要: serena-query.py文字列マッチをMCPツール名に変更 |

### 破壊的変更: あり (CLI -> MCP移行)
### リスク: 中 (テンプレート全書換。defs-stage1.ts 202行で200行制限境界)


## 6. small/medium関連デッドコード削除

### 逆依存
| 参照元 | 行番号 | 内容 | 影響 |
|--------|--------|------|------|
| registry.ts | L94-L98 | SIZE_SKIP_MAP: small=[], medium=[] | 削除候補 |
| registry.ts | L100-L104 | SIZE_MINLINES_FACTOR: small=0.6, medium=1.0 | 削除候補 |
| registry.ts | L106-L109 | getActivePhases(size) | large固定前提に |
| registry.ts | L146-L153 | getPhaseConfig(phase, size) | large固定前提に |
| types-core.ts | L60 | TaskSize型 | 修正候補: largeのみに |
| types-core.ts | L174 | TaskSizeSchema | 修正候補 |
| defs-a.ts | L17 | harness_start size引数enum | 修正候補 |
| lifecycle.ts | L48 | size強制large | 変更不要(既にlarge固定) |
| manager-write.ts | L12, L67 | SIZE_SKIP_MAP import/使用 | 修正 |
| dod-l4-delta.ts | L13 | DELTA_ENTRY_MIN_MAP: small=3 | 修正候補 |

### テストファイル影響
| テスト | パス | 影響 |
|--------|------|------|
| invariant-dogfooding.test.ts | L2,L14,L21-L23,L30 | 修正必要: SIZE_SKIP_MAP.small/mediumテスト |
| manager-core.test.ts | L111-L125 | 修正必要: small/medium skippedPhasesテスト |
| size-argument.test.ts | L66-L101 | 修正必要: small/medium riskScoreテスト |
| handler-parallel.test.ts | L67 | 修正必要: small skipコメント |
| 10m-resilience-p1.test.ts | L73 | 修正必要: smallタスクskippedPhasesテスト |

### 破壊的変更: あり (API変更。ただしlifecycle.ts L48で既にlarge固定のため実動作変更なし)
### リスク: 中 (影響範囲広い: 型定義+API定義+5テストファイル。論理的リスクは低)


## 7-9. 実施済み項目

coordinator/workerからBash削除、harness_approve hearing enum追加、manager-read.ts型エラー修正: 全て実施済み。影響分析不要。


## 影響を受けないモジュール一覧

- hooks/hook-utils.js, block-dangerous-commands.js, context-watchdog.js, loop-detector.js, session-boundary.js
- phases/defs-stage2.ts, defs-stage4.ts, defs-stage5.ts, defs-stage6.ts
- gates/dod-l1-l2.ts, dod-l4-content.ts, dod-l4-art.ts, dod-l4-commit.ts, dod-l4-refs.ts, dod-l4-toon.ts
- state/manager-lifecycle.ts, manager-records.ts
- tools/handler.ts, handlers/delegate-coordinator.ts, handlers/approval.ts


## リスク評価サマリ

| 項目 | リスク | 破壊的変更 | 影響テスト数 | 理由 |
|------|--------|-----------|-------------|------|
| 1. vscode-ext削除 | 低 | なし | 0 | ランタイム依存ゼロ |
| 2. hookバックアップ削除 | 低 | なし | 0 | 参照ゼロ |
| 3. テンプレート直接取得 | 低 | なし | 0 | ドキュメント変更のみ |
| 4. hearing DoD追加 | 中 | なし | 0(新規追加) | 初のdodChecks利用 |
| 5. Serena MCP化 | 中 | あり(CLI廃止) | 1 | テンプレート全書換 |
| 6. dead code削除 | 中 | あり(API) | 5 | 型/テスト修正多 |


## decisions

- IA-01: vscode-ext削除とhookバックアップ削除は低リスク。独立して並列実行可能
- IA-02: hearing dodChecks追加は初活用のため、DoD実行パスの動作確認テストを先行すべき
- IA-03: Serena MCP化はserena-integration.test.tsの修正が必須。defs-stage1.tsの200行制限に注意
- IA-04: small/mediumデッドコード削除は5テストファイルの修正が必要。最も工数が大きい
- IA-05: 項目1-3は並列実行可能。項目4-6は順序依存なし
- IA-06: 破壊的変更2件(Serena CLI廃止、size API変更)は内部APIのため外部互換性問題なし

## artifacts

- docs/workflows/workflow-harness-refactoring/impact-coord.md: 影響分析

## next

- requirementsフェーズでAC-N/RTM F-NNNを定義
- 実装優先順: 低リスク群(1,2,3) -> 中リスク群(4,5,6)
- テスト修正対象: serena-integration.test.ts, invariant-dogfooding.test.ts, manager-core.test.ts, size-argument.test.ts, handler-parallel.test.ts, 10m-resilience-p1.test.ts
