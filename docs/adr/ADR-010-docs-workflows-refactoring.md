# ADR-010: docs-workflows-refactoring

Status: accepted
Date: 2026-03-24
TaskId: 0963bf20-4201-494c-ad1b-32e6b476e97e

## Intent (Why)
docs/workflows ディレクトリのリファクタリング: 半角カタカナ重複削除、旧タスク削除、カテゴリ別サブディレクトリ整理、散在mdファイルのディレクトリ化

## Acceptance Criteria (What)
- AC-1: 全ての半角カタカナ重複ディレクトリペアで半角版が削除されていること [met]
- AC-2: 半角のみディレクトリが全角カタカナにリネームされていること [met]
- AC-3: 旧プロジェクト関連ディレクトリが全て削除されていること [met]
- AC-4: 残存ディレクトリがカテゴリ別サブディレクトリに配置されていること [met]
- AC-5: ルート散在.mdファイルが個別タスクディレクトリ化されていること [met]
- AC-6: docs/workflows/直下にタスクディレクトリが存在しないこと（カテゴリディレクトリのみ） [met]
- AC-7: ハーネスの既存機能に影響がないこと [met]

## Scope
Files: (none)
Dirs: docs/workflows

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\docs-workflows-refactoring
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
