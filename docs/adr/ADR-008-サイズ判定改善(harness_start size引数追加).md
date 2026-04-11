# ADR-008: サイズ判定改善(harness_start size引数追加)

Status: accepted
Date: 2026-03-22
TaskId: 4bdf73af-ba05-40ef-9920-467637f811de

## Intent (Why)
harness_startにオプショナルsize引数を追加し、デフォルトをlargeに変更する。オーケストレーターがuserIntentから設計書の要否を判断してサイズを指定できるようにする。現在のrisk-classifierベースの自動判定は廃止またはフォールバックに格下げする

## Acceptance Criteria (What)
- AC-1: harness_startにsize='small'を指定した場合、生成されるTaskStateのsizeが'small'であること [open]
- AC-2: harness_startにsize未指定の場合、生成されるTaskStateのsizeが'large'であること [open]
- AC-3: 既存の全テストが変更後も全件パスすること [open]
- AC-4: defs-a.tsのharness_start inputSchemaにsizeプロパティがenum: ['small','medium','large']で定義されていること [open]

## Scope
Files: workflow-harness/mcp-server/src/phases/risk-classifier.ts, workflow-harness/mcp-server/src/state/manager-write.ts, workflow-harness/mcp-server/src/tools/handlers/lifecycle.ts, workflow-harness/mcp-server/src/tools/tool-definitions.ts
Dirs: workflow-harness/mcp-server/src

## Artifacts
docsDir: docs\workflows\サイズ判定改善(harness_start size引数追加)
Completed phases: scope_definition → research → requirements → planning → test_design → test_impl → implementation → build_check → testing → commit → push

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
