# ADR-025: prompt-format-hybrid-rule

Status: accepted
Date: 2026-04-08
TaskId: f40dd84a-47c9-468b-91b5-15737fa54c65

## Intent (Why)
subagent/MCP向けプロンプトのハイブリッド形式（トップレベルTOON + 中身Markdown）をworkflow-delegation.mdまたは適切なスキルファイルにルールとして適用する。入力形式が出力形式に伝染する問題を防止し、プロンプト品質を標準化する。

## Acceptance Criteria (What)
- AC-1: workflow-delegation.mdに## Prompt Format Rulesセクションが追加され、トップレベルTOON+中身Markdownのハイブリッド形式ルールが定義されている [met]
- AC-2: Agent委譲プロンプトとMCP toolパラメータの両方に対する形式ルールが記載されている [met]
- AC-3: 出力形式伝染防止ルール(Constraints内にFormat指定明記)が含まれている [met]
- AC-4: 長文閾値ルール(20行超→ファイル参照)とセクション間空行ルールが含まれている [met]
- AC-5: 変更後のworkflow-delegation.mdが200行以下を維持している [met]
- AC-1: workflow-delegation.mdに## Prompt Format Rulesセクションが追加され、トップレベルTOON+中身Markdownのハイブリッド形式ルールが定義されている [met]
- AC-2: Agent委譲プロンプトとMCP toolパラメータの両方に対する形式ルールが記載されている [met]
- AC-3: 出力形式伝染防止ルール(Constraints内にFormat指定明記)が含まれている [met]
- AC-4: 長文閾値ルール(20行超→ファイル参照)とセクション間空行ルールが含まれている [met]
- AC-5: 変更後のworkflow-delegation.mdが200行以下を維持している [met]

## Scope
Files: .claude/skills/workflow-harness/workflow-delegation.md
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\prompt-format-hybrid-rule
Completed phases: scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
