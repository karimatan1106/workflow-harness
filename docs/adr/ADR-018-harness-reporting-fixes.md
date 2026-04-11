# ADR-018: harness-reporting-fixes

Status: accepted
Date: 2026-03-29
TaskId: 80980f59-a211-46af-bd52-19d5e623790d

## Intent (Why)
レポーティング分析結果に基づくハーネス改善2件: (1) test_implフェーズのtdd_red_evidenceをscopeFilesが.md/.mmdのみの場合に免除するロジック追加、(2) harness_get_subphase_templateが返すテンプレートに全行ユニーク制約を標準注入

## Acceptance Criteria (What)
- AC-1: scopeFilesが全て.md/.mmdの場合、test_implフェーズのcheckTDDRedEvidenceがpassed:trueを返すこと [met]
- AC-2: scopeFilesに.ts/.js等のコードファイルが含まれる場合、既存のcheckTDDRedEvidenceロジックが変更されないこと [met]
- AC-3: ARTIFACT_QUALITY_RULESに全行ユニーク制約が追記されていること [met]
- AC-4: 既存テストが全てパスすること（回帰なし） [met]
- AC-5: dod-l1-l2.tsとdefinitions-shared.tsが200行以下を維持していること [met]

## Scope
Files: workflow-harness/mcp-server/src/lifecycle/lifecycle-next.ts, workflow-harness/mcp-server/src/templates/subphase-templates.ts
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\harness-reporting-fixes
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
