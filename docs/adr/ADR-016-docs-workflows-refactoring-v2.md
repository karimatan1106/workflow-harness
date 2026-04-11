# ADR-016: docs-workflows-refactoring-v2

Status: accepted
Date: 2026-03-28
TaskId: 5127ee0c-0fad-4088-a2bc-e7c590595738

## Intent (Why)
docs/workflows/ ディレクトリの追加リファクタリング。前回(ADR-010)で4カテゴリ(bugfix/feature/investigation/workflow-harness)に分類済み。さらなる整理・改善を実施する。

## Acceptance Criteria (What)
- AC-1: docs/workflows/ 直下に .md ファイルが存在しないこと [met]
- AC-2: docs/workflows/ 直下にカテゴリディレクトリ以外のタスクディレクトリが存在しないこと [met]
- AC-3: 重複ディレクトリ9件のルート側が削除されていること [met]
- AC-4: 未分類サブディレクトリ7件が適切なカテゴリに移動されていること [met]
- AC-5: 散在 .md ファイル19件が適切なカテゴリ配下に移動されていること [met]
- AC-6: 移動によるファイル消失がないこと（移動前後のファイル数が一致） [met]

## Scope
Files: (none)
Dirs: docs/workflows

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\docs-workflows-refactoring-v2
Completed phases: scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
