# ADR-006: harness_record_proofブロック修正＋docsDir パス不一致修正

Status: accepted
Date: 2026-03-21
TaskId: d20100fe-b5bb-4b3f-b3b6-4ed8cd6f850f

## Intent (Why)
2つのバグ修正: (1) pre-tool-guard.shのis_lifecycle_mcp関数がharness_record_proof等のharness_*ツールをブロックしている。harness_*系は全てオーケストレーター許可すべき。(2) harness_startが返すdocsDirがプロジェクトルート相対(docs/workflows/...)だが、DoD検証はworkflow-harness/docs/workflows/...を見るためパス不一致が発生する。

## Acceptance Criteria (What)
- AC-1: 全 harness_* MCPツール(23種)が is_lifecycle_mcp チェックを通過する [open]
- AC-2: getDocsPath が resolveProjectPath 経由で絶対パスを返す [open]
- AC-3: DoD gates で resolveProjectPath を使う箇所が二重解決しない [open]
- AC-4: 既存テストが全て通過する [open]
- AC-5: 他プロジェクトでの workflow-harness 使用にリグレッションがない [open]

## Scope
Files: workflow-harness/hooks/pre-tool-guard.sh, workflow-harness/mcp-server/src/tools/harness-start.ts
Dirs: (none)

## Artifacts
docsDir: docs\workflows\harness_record_proofブロック修正＋docsDir パス不一致修正
Completed phases: scope_definition → research → requirements → planning → test_design → test_impl → implementation → build_check → testing → commit → push

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
