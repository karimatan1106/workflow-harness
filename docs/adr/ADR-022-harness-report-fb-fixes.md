# ADR-022: harness-report-fb-fixes

Status: accepted
Date: 2026-03-30
TaskId: 1e5d5b52-88a4-4bb6-89c2-c4ce995cdf5f

## Intent (Why)
ハーネスレポートFB-1+5, FB-2, FB-4, FB-6の4件を修正する。delegate-coordinator.tsのreadonlyフェーズWrite/Edit制限、dod-helpers.tsのテストケース構造行除外、manager-write.tsのRTM重複IDチェック、manager-lifecycle.tsのgoBack時artifactHashクリア。

## Acceptance Criteria (What)
- AC-1: readonlyフェーズ(hearing, scope_definition, research等)でcoordinatorにWrite/Editが許可されないこと [met]
- AC-2: isStructuralLine()がテストケースID行(TC-001:等)を構造行として認識し、checkDuplicateLines()で重複誤検出されないこと [met]
- AC-3: applyAddRTM()が同一IDのRTMエントリ重複時に既存エントリを上書き(replace)し、重複エントリが生じないこと [met]
- AC-4: goBack()実行時にstate.artifactHashesが空オブジェクトにクリアされること [met]
- AC-5: 既存テストスイート(825+パス)が全てパスし、各修正に対応するユニットテストが追加されていること [met]
- AC-1: readonlyフェーズ(bashCategories=['readonly']のみ)でcoordinatorのdisallowedToolsにWrite,Editが追加される [met]
- AC-2: isStructuralLine()がテストケースID行(TC-001:, - TC-AC1-01:等)をtrueと判定する [met]
- AC-3: applyAddRTM()に既存IDと同一のエントリを渡すと上書き(upsert)される。新規IDはpushされる [met]
- AC-4: goBack()実行後にstate.artifactHashesが空オブジェクトになる [met]
- AC-5: 既存テストスイート全パス(リグレッションなし) [met]

## Scope
Files: workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts, workflow-harness/mcp-server/src/tools/handlers/coordinator-prompt.ts, workflow-harness/mcp-server/src/gates/dod-helpers.ts, workflow-harness/mcp-server/src/state/manager-write.ts, workflow-harness/mcp-server/src/state/manager-lifecycle.ts
Dirs: workflow-harness/mcp-server/src/tools/handlers, workflow-harness/mcp-server/src/gates, workflow-harness/mcp-server/src/state

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\harness-report-fb-fixes
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
