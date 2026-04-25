# ADR-031: fix-hook-layer-detection

Status: accepted
Date: 2026-04-18
TaskId: 2f56774f-5ed7-47cc-b2a0-4670422f1946

## Intent (Why)
tool-gate.js の detectLayer() が agent_id を opaque hex ではなく "worker" prefix で判定していたため、全 subagent が coordinator 扱いされ docs/workflows/ への書き込みが block されるバグを修正する。agent_id 存在 = subagent = worker layer で扱うように修正し、回帰テストを追加、ADR-030 として経緯を記録する。

## Acceptance Criteria (What)
- AC-1: opaque hex agent_id を入力した detectLayer() は 'worker' を返す [met]
- AC-2: HARNESS_LAYER=worker 環境変数が設定されているとき detectLayer() は 'worker' を返す [met]
- AC-3: agent_id が不在 (L1 orchestrator 呼び出し) のとき detectLayer() は 'orchestrator' を返す [met]
- AC-4: subagent (agent_id 存在) から docs/workflows/ 配下への Write が checkWriteEdit で block されない [met]
- AC-5: 回帰テスト tool-gate.test.js が存在し AC-1〜AC-3 の不変条件を検証している [met]

## Scope
Files: workflow-harness/hooks/tool-gate.js, docs/adr/ADR-030-hook-layer-detection.md
Dirs: workflow-harness/hooks/__tests__

## Artifacts
docsDir: C:\ツール\Workflow\docs\workflows\fix-hook-layer-detection
Completed phases: hearing → scope_definition → research → impact_analysis → requirements → threat_modeling → planning → state_machine → flowchart → ui_design → design_review → test_design → test_selection → test_impl → implementation → refactoring → build_check → code_review → testing → regression_test → acceptance_verification → manual_test → security_scan → performance_test → e2e_test → docs_update → commit → push → ci_verification → deploy → health_observation

## Notes
Auto-generated on task completion. This record is immutable.
To revise a decision, create a new ADR that supersedes this one.
