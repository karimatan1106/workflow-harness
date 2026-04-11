# ADR-003: 3層ガード → 2層ガードへの簡素化

Status: accepted
Date: 2026-03-20

## Context
pre-tool-guard.shは3層（Orchestrator/Coordinator/Worker）でツールアクセスを制御していた。
Agent Teams導入により、Coordinator/Workerの区別がagent_idだけでは不可能になった。

## Decision
2層に簡素化する:
- Orchestrator（agent_id無し）: 制御ツールのみ
- Subagent（agent_id有り）: 全ツール許可

## Rationale
- Agent TeamsではCoordinatorもWorkerもagent_idを持つ → 区別不能
- 旧delegate_workのHARNESS_LAYER=worker環境変数はAgent Teamsで使われない
- Subagent内のツール制限はCLAUDE.mdの指示で十分（コード強制不要）
- hookが過剰にブロックしてデッドロックが発生していた（TeamCreate, WebFetch等）

## Supersedes
旧3層設計（Orchestrator/Coordinator/Worker分離）

## Consequences
- Subagentは全ツール使用可能 → CLAUDE.mdの指示に依存する部分が増える
- 緊急バイパス(TOOL_GUARD_DISABLE=true)を追加
- Agent Teams非対応の旧delegate_workフローは今後廃止
