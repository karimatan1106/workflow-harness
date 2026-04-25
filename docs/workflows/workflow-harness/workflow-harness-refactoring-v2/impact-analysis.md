phase: impact_analysis
task: workflow-harness-refactoring-v2
status: complete
summary: 5領域28ファイルの影響分析完了。Area5(approve遷移分離)が最高リスク(動作変更)、Area3(mcp-server分割)がimportパス変更で最多影響ファイル。全領域が相互独立で並列実行可能(defs-stage1.tsのみArea2→Area3の直列制約あり)。

## decisions

- IA-01: Area1(hooks)のphase-config.js抽出はtool-gate.js内部のrequireのみで完結し外部影響なし (hooksはスタンドアロンスクリプトで相互importがないため)
- IA-02: Area2(indexer削除)はserena-integration.test.tsの3アサーションも更新対象に含める (テストがserena-query.pyの存在を前提としたアサーションを持つため)
- IA-03: Area3(mcp-server分割)のimportパス変更は6消費ファイル+3テストファイルの計9ファイルに影響 (handler.ts 3箇所, dod.ts 1箇所, definitions.ts 1箇所, テスト3件)
- IA-04: Area5(approve遷移分離)はapproval.ts:110のsm.advancePhase削除が最高リスク変更 (動作変更を伴うためテスト2件の期待値修正が必須)
- IA-05: 5領域は相互依存なしで並列実装可能と確認 (grep結果からArea1-5間にimport/参照の交差がない)
- IA-06: Area4(skills参照更新)は6ファイル全てが同一パターンの置換で機械的に実行可能 (CLAUDE.md SecN を .claude/rules/具体ファイル名.md に置換)
- IA-07: defs-stage1.tsはArea2(serena参照削除)とArea3(テンプレート分離)の両方で変更されるため実行順序を規定: Area2を先にArea3で分割 (同一ファイルへの並列編集は競合リスクがあるため)

breakingChanges: harness_approveの戻り値からnextPhaseフィールドが削除されnextActionに変更。approve後に自動遷移していた呼び出し元は明示的にharness_nextを呼ぶ必要がある。オーケストレーター層が常にharness_nextを後続呼び出しするため外部互換性への影響はない。

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/impact-analysis.md, report, 5領域19ファイルの影響分析と7つの設計判断

## next

criticalDecisions: IA-04(approve遷移分離)は動作変更を伴う最高リスク変更。IA-07(defs-stage1.tsの編集順序)は並列実行制約。
readFiles: impact-analysis.md, scope-definition.md, research.md
warnings: defs-stage1.tsがArea2とArea3で重複変更対象のため直列実行必須
