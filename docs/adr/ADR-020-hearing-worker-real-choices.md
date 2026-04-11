# ADR-020: hearing-worker-real-choices

Status: accepted
Date: 2026-03-29
TaskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e

## Intent (Why)
hearing-workerが実質1択の確認形式(「全決定委任(A)で進めてよいですか？」)を出す問題を修正。各質問に対して実質的に異なる選択肢を提示し、推奨案のみの確認形式を禁止する。hearing-worker.mdエージェント定義とdefs-stage0.tsテンプレートの両方を修正対象とする。

## Acceptance Criteria (What)
- AC-1: hearing-worker.mdに推奨案のみの確認形式禁止ルールが明記されていること [met]
- AC-2: hearing-worker.mdに各質問に実質的に異なる2案以上ルールが明記されていること [met]
- AC-3: hearing-worker.mdに各選択肢にメリット・デメリット明記ルールが明記されていること [met]
- AC-4: defs-stage0.tsのhearingテンプレートに具体的な選択肢品質ルールが含まれること [met]
- AC-5: 変更後のhearing-worker.mdが200行以下であること [met]
- AC-6: 変更後のdefs-stage0.tsが200行以下であること [met]
- AC-7: 既存テストが変更後も全てパスするか文言変更に合わせてテスト更新済みであること [met]

## Scope
Files: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\hearing-worker-real-choices
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
