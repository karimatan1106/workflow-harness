# ADR-011: harness-observability-logging

Status: accepted
Date: 2026-03-25
TaskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277

## Intent (Why)
ハーネスの運用品質メトリクスを構造化ログとして出力する。ツール権限遵守、委譲効率、処理速度、DoDリトライ率、コンテキストサイズの5軸を.agent/tool-trace.logに記録し、事後分析可能にする。

## Acceptance Criteria (What)
- AC-1: pre-tool-guard.shの全判定(ALLOW/BLOCK)がタイムスタンプ・層・ツール名と共に記録される [met]
- AC-2: Agent spawn(coordinator/worker)の開始・完了・失敗イベントとdurationMsが記録される [met]
- AC-3: 各フェーズの開始・完了時刻と所要時間が記録される [met]
- AC-4: DoD判定のPASS/FAILと失敗理由・リトライ回数が記録される [met]
- AC-5: 各層のファイル読み込みサイズ、委譲プロンプトサイズ、戻り値サイズが記録される [met]
- AC-6: ログはタスクのdocsDir内にTOON形式(observability-events.toon)で出力される [met]
- AC-7: ログ追記のオーバーヘッドがhook実行時間を50ms以上増加させない [met]
- AC-8: フェーズ×層×ツールの正解マトリクスが定義され、ログとの差分で違反検出が可能になる [met]

## Scope
Files: workflow-harness/hooks/pre-tool-guard.sh, workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts, workflow-harness/mcp-server/src/gates/dod-l1-l2.ts
Dirs: workflow-harness/hooks, workflow-harness/mcp-server/src/tools/handlers, workflow-harness/mcp-server/src/gates

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\harness-observability-logging
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
