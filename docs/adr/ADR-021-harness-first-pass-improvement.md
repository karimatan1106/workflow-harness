# ADR-021: harness-first-pass-improvement

Status: accepted
Date: 2026-03-29
TaskId: ce320677-d107-4cc9-ad90-978291c61666

## Intent (Why)
ハーネスの1発通過率を改善する。coordinator委譲テンプレートにフェーズ別必須出力ルール(decisions 5件以上等)を追加、Worker edit部分適用問題の回避ルール追加、baseline/RTM手順漏れ防止をフェーズテンプレートに組み込む。

## Acceptance Criteria (What)
- AC-1: coordinator.mdにフェーズ別必須出力ルール(Phase Output Rules)セクションが追加され、decisionsセクション5件以上等の定量ルールが明記されていること [met]
- AC-2: worker.mdにEdit Completeness rule(部分適用禁止、all-or-nothing原則)が追加されていること [met]
- AC-3: defs-stage4.tsのcode_reviewテンプレートにbaseline記録およびRTMステータス更新の手順指示が追加されていること [met]
- AC-4: 全変更ファイルが200行以下であること [met]
- AC-5: 既存テスト(843件)が変更後も全てパスすること [met]

## Scope
Files: .claude/agents/coordinator.md, .claude/agents/worker.md, workflow-harness/mcp-server/src/phases/defs-stage4.ts
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\harness-first-pass-improvement
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
