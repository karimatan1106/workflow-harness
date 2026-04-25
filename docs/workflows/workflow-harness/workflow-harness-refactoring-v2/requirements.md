phase: requirements
task: workflow-harness-refactoring-v2
status: complete

## decisions

- REQ-1: hooks/tool-gate.jsからPHASE_EXT/PHASE_BASH設定テーブル(62行分)をphase-config.jsに抽出し、tool-gate.jsを175行以下にする (設定データとロジックの責務分離)
- REQ-2: loop-detector.js, context-watchdog.js, session-boundary.jsの3ファイルでJSON.parse+stdin読み取りをhook-utils.jsのreadStdin/parseHookInputに統一する (重複排除)
- REQ-3: indexer/ディレクトリ(serena-query.py, requirements.txt, setup.sh, .venv)を完全削除し、defs-stage1.tsのserena参照とpackage.jsonのpostinstallを更新する (デッドコード除去)
- REQ-4: mcp-server/src/の200行超4ファイルを責務分割する。delegate-coordinator.ts->3ファイル、lifecycle.ts->2ファイル、dod-l1-l2.ts->dod-spec.ts分離、defs-stage1.ts->defs-stage1a.ts分離 (200行制限準拠)
- REQ-5: harness_approveのadvancePhase呼び出しを削除し承認記録のみに限定。遷移はharness_nextに一本化、戻り値からnextPhaseを削除 (責務分離)
- REQ-6: skills/の6ファイルで"CLAUDE.md SecN"参照を現行の.claude/rules/配下ファイルパスに更新する (ドキュメント整合性)
- REQ-7: workflow-rules.mdの禁止語リスト(12語)をforbidden-actions.mdへの1行参照に置き換える (権威ソース一本化)
- REQ-8: defs-stage1.tsはArea2(indexer参照削除)を先にArea3(テンプレート分離)で分割する直列制約を設ける (同一ファイル並列編集回避)

## acceptanceCriteria

- AC-1: tool-gate.jsが200行未満でphase-config.jsに設定が抽出されている
- AC-2: loop-detector.js, context-watchdog.js, session-boundary.jsにJSON.parseが存在しない(全てhook-utils使用)
- AC-3: indexer/ディレクトリが削除されている(serena-query.py, requirements.txt, setup.sh, .venv)
- AC-4: mcp-server/src/の非テストファイルが全て200行未満(delegate-coordinator, lifecycle, dod-l1-l2, defs-stage1を分割済み)
- AC-5: harness_approveがadvancePhaseを呼ばず、戻り値にnextPhaseフィールドがない
- AC-6: skills/ファイルにCLAUDE.md Sec参照が存在しない
- AC-7: workflow-rules.mdの禁止語リストがforbidden-actions.mdへの参照に置き換えられている
- AC-8: npm run buildが成功する
- AC-9: 全テストが通過する

## notInScope

- hooks/pre-tool-guard.sh: v1で修正済み
- hooks/block-dangerous-commands.js: 既にparseHookInput使用済み
- hooks/test-guard.sh(263行): テストファイルのため200行制限対象外
- mcp-server/src/のテストファイル: 実装追従更新のみ、テストロジック変更はスコープ外

## openQuestions

(none)

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/requirements.md, spec, AC-1~AC-9の受入基準定義と8つの要件決定

## next

criticalDecisions: REQ-5(approve遷移分離)は動作変更を伴う最高リスク変更。REQ-8(defs-stage1.tsの編集順序)は並列実行制約。
readFiles: requirements.md, impact-analysis.md
warnings: Area5のテスト期待値修正が必須。importパス変更で9ファイル影響。
