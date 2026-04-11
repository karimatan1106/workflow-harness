# ADR-023: cleanup-delegate-remnants

Status: accepted
Date: 2026-04-08
TaskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Intent (Why)
harness_delegate_coordinator削除後の残骸クリーンアップ: tool-gate.js allowlistからharness_delegate_coordinator削除、dist/の古いファイル再ビルドで除去、stream-progress-tracker.tsのJSDocコメント修正

## Acceptance Criteria (What)
- AC-1: tool-gate.js の HARNESS_LIFECYCLE allowlist から harness_delegate_coordinator が削除されていること [met]
- AC-2: stream-progress-tracker.ts の JSDoc から coordinator subprocess 参照が修正されていること [met]
- AC-3: dist/ から delegate-coordinator.js, delegate-work.js, coordinator-spawn.js が除去されていること [met]
- AC-4: 既存テストが全てパスすること（リグレッションなし） [met]
- AC-5: harness_delegate_coordinator への参照がソースコード内に残存しないこと [met]

## Scope
Files: workflow-harness/hooks/tool-gate.js, workflow-harness/mcp-server/src/streaming/stream-progress-tracker.ts
Dirs: (none)

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\cleanup-delegate-remnants
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
