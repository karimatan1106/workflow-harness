# ADR-012: harness-detailed-error-analytics

Status: accepted
Date: 2026-03-25
TaskId: 2c4adf0b-b9c5-4b7f-905d-b3fc213a0eee

## Intent (Why)
phase-analytics.toonのerrorAnalysisを詳細化する。現状はフェーズ×最頻失敗1件のみだが、全DoD失敗の履歴(phase,retry,check,level,evidence)を蓄積し、事後分析可能にする。lifecycle-next.tsのDoD失敗記録部分とanalytics生成ロジックの改善。

## Acceptance Criteria (What)
- AC-1: phase-errors.toonに全check結果(passed含む)が記録される。checksの各要素にname, passed, message, level, fix, exampleフィールドが含まれる [met]
- AC-2: phase-analytics.toonのerrorAnalysisに全check詳細(phase, retry, check, level, passed, evidence)が出力される。topFailureだけでなくerrorHistory配列として全entry全checksを展開する [met]
- AC-3: 既存テストが回帰なく通過する。failureカウントの変化はpassed=falseフィルタ追加による正しい方向の変化であり許容する [met]
- AC-4: lifecycle-next.tsが200行以下を維持する。checks mapping関数の外部化により行数制約を満たす [met]

## Scope
Files: workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts
Dirs: workflow-harness/mcp-server/src

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\harness-detailed-error-analytics
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
