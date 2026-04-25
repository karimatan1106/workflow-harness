phase: research
task: workflow-harness-refactoring-v2
status: complete

## decisions

- R-1: tool-gate.jsの分割方針はPHASE_EXT/PHASE_BASH設定テーブル(66-128行, 62行分)をphase-config.jsに抽出する。残りのtool-gate.jsは175行以下になり200行制限を満たす。チェックロジック(checkL1/L2/L3)はtool-gate.jsに残す (設定データと判定ロジックの責務分離が自然な分割境界)
- R-2: JSON.parse散在の集約対象は3ファイル。loop-detector.js(22行目)、context-watchdog.js(118行目)、session-boundary.js(99行目)がstdin読み取り+パースを独自実装。hook-utils.jsのreadStdin+parseHookInputに統一する (重複排除)
- R-3: serena-query.py(276行)は完全削除可能。Serena MCPが.mcp.jsonに登録済み。削除時の参照元更新: tool-gate.js:67のBASH_COMMANDS.lsp、defs-stage1.tsのsubagentTemplate内indexer参照6箇所、package.json:15のpostinstallスクリプト (デッドコード除去)
- R-4: delegate-coordinator.ts(367行)は3ファイルに分割: coordinator-spawn.ts(spawnAsync+extractResult 76行)、coordinator-prompt.ts(buildCoordinatorPrompt+buildAllowedTools 43行)、delegate-coordinator.ts(本体 約180行)。lifecycle.ts(243行)は2ファイルに: lifecycle-start-status.ts(約115行)とlifecycle-next.ts(約128行)。dod-l1-l2.ts(221行)はspec関連50行をdod-spec.tsに分離。defs-stage1.ts(202行)はscope_definitionテンプレート93行をdefs-stage1a.tsに分離 (200行制限準拠)
- R-5: harness_approveのフェーズ遷移分離: approval.ts:110のsm.advancePhase(taskId)を削除し承認記録のみに限定。遷移はlifecycle.ts:169のharness_nextに一本化。戻り値からnextPhaseを削除しnextAction:"call harness_next"に変更 (責務分離、遷移ポイント単一化)
- R-6: skills/の"CLAUDE.md SecN"参照は6ファイル全てで陳腐化。現行CLAUDE.mdにセクション番号なし。各ファイルの参照を現行構造に更新: "CLAUDE.md Sec4"->".claude/rules/forbidden-actions.md"等 (ドキュメント整合性)
- R-7: workflow-rules.mdの禁止語リスト(12語)はforbidden-actions.mdと完全重複。1行参照に置き換える (重複排除、権威ソース一本化)

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/research.md, analysis, 5領域のコード調査結果と分割方針

## next

criticalDecisions: R-5(approve遷移分離)は承認フロー変更でapproval.tsとlifecycle.tsの両方に影響
readFiles: research.md, scope-definition.md
warnings: R-3(indexer削除)はdefs-stage1.tsのsubagentTemplateを大幅書き換え要、R-4の分割はimportパス変更でテスト修正要
