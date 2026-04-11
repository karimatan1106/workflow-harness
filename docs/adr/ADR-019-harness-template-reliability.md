# ADR-019: harness-template-reliability

Status: accepted
Date: 2026-03-29
TaskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff

## Intent (Why)
3タスク横断分析に基づくハーネス信頼性改善5件: FIX-1(hearingテンプレートにuserResponse TOONキー明示), FIX-2(testing→regression_test間のbaseline_capture未実行検出), FIX-3(artifact_drift検出時のre-approvalチェーン半自動化), FIX-4(テンプレートTOON/MD出力形式統一ガイダンス強化), FIX-5(completedフェーズ異常滞留アラート)

## Acceptance Criteria (What)
- AC-1: hearingテンプレートにuserResponseキーが含まれdod-l2-hearingチェック通過 [met]
- AC-2: hearingテンプレートにAskUserQuestion必須+選択肢2個以上の文言存在 [met]
- AC-3: testingテンプレートにbaseline_captureリマインド強調文追加 [met]
- AC-4: harness_backスキーマにcascadeオプショナルパラメータ追加+再承認実行 [met]
- AC-5: cascade-reapproveがPHASE_APPROVAL_GATESを参照し再承認対象を特定 [met]
- AC-6: cascade-reapproveがIA-1/IA-2/IA-6前提条件チェックをバイパスしない [met]
- AC-7: hearingテンプレートにSUMMARY_SECTION追加+definitions.tsで展開 [met]
- AC-8: completedフェーズ3600s超過滞留時に警告advice出力 [met]
- AC-9: goBack後にstate.approvalsから対象エントリ削除 [met]
- AC-10: cascade未指定時のharness_back動作が従来と同一 [met]

## Scope
Files: workflow-harness/mcp-server/src/phases/definitions-hearing.ts, workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/commands/harness-back.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts, workflow-harness/mcp-server/src/analytics/phase-analytics.ts
Dirs: workflow-harness/mcp-server/src/phases, workflow-harness/mcp-server/src/gates, workflow-harness/mcp-server/src/commands, workflow-harness/mcp-server/src/analytics

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\harness-template-reliability
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
