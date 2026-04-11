# ADR-017: hearing-askuserquestion-rule

Status: accepted
Date: 2026-03-28
TaskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## Intent (Why)
hearingフェーズではhearing-workerエージェントタイプを使用し、AskUserQuestionツールで構造化された選択肢をユーザーに提示するルールを、ハーネスのスキルファイルまたはcoordinator委譲ロジックに明記する

## Acceptance Criteria (What)
- AC-1: workflow-phases.md に hearing フェーズセクションが存在すること [met]
- AC-2: hearing セクションに hearing-worker エージェント指定が明記されていること [met]
- AC-3: hearing セクションに AskUserQuestion ツール使用ルールが明記されていること [met]
- AC-4: workflow-phases.md が200行以下を維持していること [met]
- AC-5: hearing セクションの記述が他フェーズセクションと同一形式であること [met]

## Scope
Files: .claude/skills/workflow-harness/workflow-phases.md, .claude/skills/workflow-harness/workflow-operations.md, .claude/agents/coordinator.md
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\hearing-askuserquestion-rule
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
