# ADR-014: agent-delegation-prompt-templates

Status: accepted
Date: 2026-03-28
TaskId: dd7e439b-4097-4736-b78c-0673274da7e0

## Intent (Why)
Worker/Coordinator/hearing-workerへの委譲時プロンプトにWhy/What/How/Constraintsの4層テンプレートを導入し、DoDリトライを削減する。3つのハーネス評価レポートの失敗パターン(test_design 5回リトライ、decisions欠落、tdd_red_evidence API誤用、重複行パターン等)を全てテンプレートに反映する。

## Acceptance Criteria (What)
- AC-1: workflow-delegation.mdが新規作成され、4層テンプレート(Why/What/How/Constraints)が3種(coordinator/worker-write/worker-verify)定義されている [met]
- AC-2: 約20の委譲対象フェーズのパラメータ表が存在し、各フェーズのOutput spec(必須セクション+中身の書き方)が定義されている [met]
- AC-3: workflow-phases.mdの全フェーズにステージ共通Why(8個)+フェーズ固有補足が追加されている [met]
- AC-4: coordinator.md/worker.md/hearing-worker.mdにPrompt Contract(テンプレート構造の参照+判断の軸としてWhy/Contextを使う指示)が追記されている [met]
- AC-5: 3つのハーネス評価レポートの失敗パターン(decisions欠落、tdd_red_evidence API誤用、重複行、TOON/Markdown不整合等)がテンプレートのConstraintsまたはHowに反映されている [met]
- AC-6: 全変更ファイルが200行以下を維持している [met]

## Scope
Files: .claude/skills/workflow-harness/workflow-phases.md, .claude/skills/workflow-harness/workflow-delegation.md, .claude/agents/coordinator.md, .claude/agents/worker.md, .claude/agents/hearing-worker.md, .claude/rules/tool-delegation.md
Dirs: .claude/skills/workflow-harness, .claude/agents, .claude/rules

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\agent-delegation-prompt-templates
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
