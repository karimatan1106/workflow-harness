# Workflow Harness - Project Instructions

## Mission
10Mステップのコードベースでも、ユーザーの指示通りの修正を一度の実行で完遂する。
そのために30フェーズ・L1-L4決定的ゲート・RTM追跡による圧倒的なコンテキストエンジニアリングで意図精度を保証する。

Authoritative instruction set. Violations are blocked by hooks.

## What (→ .claude/rules/)
ポリシー・制約は .claude/rules/ に分割配置。常にコンテキストに読み込まれる。
- workflow-enforcement.md — ワークフロー起動ルール
- tool-delegation.md — 2層モデル、ツール権限
- core-constraints.md — L1-L4ゲート、200行制限、TOON形式
- forbidden-actions.md — 禁止アクション、禁止語
- documentation-layers.md — Why/What/How 3層分離
- session-recovery.md — セッション復帰手順

## How (→ skill files)
フェーズ別の実行手順はスキルファイルが担う。条件付き読み込み（P5: コンテキスト最小）。
- Phases/sizing: → workflow-phases.md
- Orchestrator protocol: → workflow-orchestrator.md
- Gates/intent accuracy: → workflow-gates.md
- Retry/rules: → workflow-rules.md
- Execution/bash: → workflow-execution.md
- Documents: → workflow-docs.md

## Why (→ docs/adr/)
設計判断の理由はADRに記録。イミュータブル。
- ADR-001: L5(LLM判断)ゲート禁止
- ADR-002: フェーズ=コンテキスト圧縮の設計
- ADR-003: 3層ガード→2層ガードへの簡素化
- ADR-004: ドキュメント3層分離（Why/What/How）
- ADR-005: Why/What/How定義基準 — LLM目線

## Cross-Platform Agent Discovery
@AGENTS.md — クロスプラットフォームエージェント(Codex/Cursor/Devin等)向けルール定義
