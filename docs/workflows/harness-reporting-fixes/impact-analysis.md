# Impact Analysis: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: impact_analysis
size: small

## P1: checkTDDRedEvidence scopeFiles 拡張子チェック追加

修正対象: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts (167行)
修正関数: checkTDDRedEvidence (L76-96)

影響範囲分析:
- 直接呼び出し元: dod.ts L62 の runDoDChecks 内で checkTDDRedEvidence(state, phase) として呼び出し
- 間接呼び出し元: lifecycle-next.ts が runDoDChecks を呼び出し、harness_next MCP ツール経由で実行
- 影響するフェーズ: test_impl フェーズのみ (関数冒頭で phase !== 'test_impl' なら即 passed:true を返却)
- 他フェーズへの影響: なし。test_impl 以外は早期リターンで既存動作が保持される
- scopeFiles 参照の前例: dod-l4-dci.ts, dod-spec.ts が既に state.scopeFiles を参照しており、パターンとして一貫

変更内容: phase === 'test_impl' 通過後、proofLog チェック前に scopeFiles 全件の拡張子を検査。
全ファイルが .md/.mmd の場合は passed:true で免除する条件を追加。
scopeFiles が空配列の場合はフォールバックとして既存ロジック(proofLog検査)を実行。

後方互換性: scopeFiles にソースコード(.ts/.tsx/.js/.jsx等)が含まれる場合は既存ロジックと同一動作。
新条件は「全ファイルがドキュメント拡張子のみ」のケースでのみ発火する追加分岐。

テスト影響:
- 既存テスト (dod-tdd.test.ts 4ケース): makeMinimalState のデフォルト scopeFiles: [] は空配列のためフォールバック経由で既存ロジックが実行される。全ケースの pass/fail は変化しない。
- 新規テスト: scopeFiles が .md のみの場合の免除確認、混在(.md + .ts)の場合の非免除確認を追加。

## P2: ARTIFACT_QUALITY_RULES 全行ユニーク制約追記

修正対象: workflow-harness/mcp-server/src/phases/definitions-shared.ts (135行)
修正定数: ARTIFACT_QUALITY_RULES (L26-29)

影響範囲分析:
- ARTIFACT_QUALITY_RULES はテンプレートフラグメント文字列。buildSubagentPrompt 経由で全成果物生成フェーズの subagent プロンプトに注入される
- 全フェーズのテンプレートに自動反映されるため、個別フェーズの修正は不要
- バックエンド検証: dod-helpers.ts の checkDuplicateLines (L100-113) が非構造行の3回以上重複を既に検出。テンプレート側にはこの制約の記述が欠落していた
- テンプレート文字列の1行追加のみ。ロジック変更なし

変更内容: ARTIFACT_QUALITY_RULES の品質要件リストに「同一内容の行は2回まで(3回以上で DoD L4 失敗)」を追記。

後方互換性: テンプレートフラグメントへの文字列追記のみ。バックエンドの checkDuplicateLines の閾値(3回以上)との整合が取れる。既存の DoD 判定ロジックへの変更なし。
行数影響: 135行 + 1行 = 136行で200行制限内。

テスト影響:
- 既存テスト: テンプレート文字列の内容を検証するテストがある場合はスナップショット更新が必要。ただし handler-templates-validation.test.ts は新規追加ファイル。
- 新規テスト: ARTIFACT_QUALITY_RULES に全行ユニーク制約が含まれることを検証するケースを追加。

## 影響ファイル一覧

修正対象(2件):
- workflow-harness/mcp-server/src/gates/dod-l1-l2.ts: checkTDDRedEvidence に scopeFiles 拡張子チェック分岐を追加
- workflow-harness/mcp-server/src/phases/definitions-shared.ts: ARTIFACT_QUALITY_RULES に全行ユニーク制約を1行追記

テスト追加(2件):
- workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts: P1 の新規テストケース追加
- workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts: P2 の新規テストファイル作成

変更不要(確認済み):
- workflow-harness/mcp-server/src/gates/dod.ts: checkTDDRedEvidence の呼び出しシグネチャ変更なし(引数は state, phase のまま)
- workflow-harness/mcp-server/src/gates/dod-helpers.ts: checkDuplicateLines のロジック変更なし
- workflow-harness/mcp-server/src/state/types.ts: TaskState.scopeFiles は既存フィールド(string[])で型変更不要

## リスク評価

P1 リスク: 低。新規分岐は test_impl フェーズかつ scopeFiles 全件がドキュメント拡張子の場合のみ発火。空配列フォールバックにより既存動作を破壊しない。
P2 リスク: 極低。テンプレート文字列への1行追記のみ。ランタイムロジックへの変更なし。subagent の生成品質が向上する方向の変更。

## decisions

- IA-001: P1 の scopeFiles 拡張子チェックは proofLog チェックの前に配置し、ドキュメントのみタスクを早期免除する (proofLog が空の場合の「テスト失敗が必要」エラーメッセージをドキュメントタスクに表示させない)
- IA-002: scopeFiles が空配列の場合は既存ロジックにフォールバックする (空配列は既存タスクのデフォルト値であり、免除判定に使えない)
- IA-003: P1 の免除判定結果は evidence フィールドに scopeFiles の拡張子内訳を含めて返す (免除理由の可視性確保)
- IA-004: P2 の制約文言は checkDuplicateLines の閾値「3回以上」と一致させる (テンプレートとバックエンド検証の不整合防止)
- IA-005: 既存テストケース4件の期待値は変更しない (後方互換性の証明)
- IA-006: dod.ts の checkTDDRedEvidence 呼び出しシグネチャは変更不要と確認済み (state 引数から scopeFiles にアクセス可能)

## artifacts

- docs/workflows/harness-reporting-fixes/impact-analysis.md (spec): P1/P2 の影響範囲分析、リスク評価、後方互換性確認

## next

- criticalDecisions: IA-001(早期免除配置), IA-004(閾値整合)
- readFiles: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts, workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts, workflow-harness/mcp-server/src/__tests__/dod-test-helpers.ts
- warnings: P1 の scopeFiles 空配列フォールバックは必須。省略すると既存タスクが全て免除扱いになるリスクあり。
