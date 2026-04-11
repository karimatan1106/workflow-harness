# ADR-009: workflow-harness-refactoring

Status: accepted
Date: 2026-03-23
TaskId: a0e87be6-7db4-4213-9988-977dae15a4e1

## Intent (Why)
workflow-harnessのリファクタリング。vscode-ext/を削除し、hooks/mcp-server/indexer/skills等の無駄な部分を整理・統合する。

## Acceptance Criteria (What)
- AC-1: vscode-ext/ディレクトリが存在しないこと [met]
- AC-2: hooks/配下にバックアップファイル（.bak*, .disabled）が存在しないこと [met]
- AC-3: npm run build が成功すること [met]
- AC-4: 既存テストが全て通過すること [met]
- AC-5: .mcp.jsonにSerena MCPサーバーが登録されていること [met]
- AC-6: defs-a.tsのsize enumにsmall/mediumが含まれないこと [met]
- AC-7: coordinator.md/worker.mdのtools行にBashが含まれないこと [met]
- AC-8: workflow-orchestrator.mdにcoordinatorのテンプレート直接取得手順が記載されていること [met]

## Scope
Files: workflow-harness/mcp-server/src/tools/defs-a.ts, workflow-harness/mcp-server/src/tools/handlers/approval.ts, workflow-harness/mcp-server/src/phases/registry.ts, workflow-harness/mcp-server/src/phases/defs-stage1.ts, workflow-harness/mcp-server/src/phases/defs-stage2.ts, workflow-harness/STRUCTURE_REPORT.md, .claude/skills/workflow-harness/workflow-orchestrator.md, .claude/skills/workflow-harness/workflow-execution.md
Dirs: workflow-harness/vscode-ext, workflow-harness/hooks

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\workflow-harness-refactoring
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
