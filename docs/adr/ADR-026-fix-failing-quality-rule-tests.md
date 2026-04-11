# ADR-026: fix-failing-quality-rule-tests

Status: accepted
Date: 2026-04-09
TaskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Intent (Why)
既存テスト失敗10件を修正: first-pass-improvement.test.ts(7件)のcoordinator.md/worker.md品質ルール不足、hearing-worker-rules.test.ts(3件)のAskUserQuestion品質ルール不足。テストが期待するルールテキストをagent定義ファイルに追加する。

## Acceptance Criteria (What)
- AC-1: coordinator.mdにPhase Output Rulesセクションが追加され、decisions 5件以上・artifacts列挙・next空欄禁止のルールが記載されている [met]
- AC-2: worker.mdにEdit Completenessセクションが追加され、部分適用禁止・全件適用ルールが記載されている [met]
- AC-3: hearing-worker.mdにAskUserQuestion Quality Rulesセクションが追加され、確認のみ質問禁止・2以上異なるアプローチ・メリットデメリット記載ルールが含まれている [met]
- AC-4: first-pass-improvement.test.tsの7件の失敗テストが全てPASSする [met]
- AC-5: hearing-worker-rules.test.tsの3件の失敗テストが全てPASSする [met]

## Scope
Files: .claude/agents/coordinator.md, .claude/agents/worker.md, .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/__tests__/first-pass-improvement.test.ts, workflow-harness/mcp-server/src/__tests__/hearing-worker-rules.test.ts
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\fix-failing-quality-rule-tests
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
