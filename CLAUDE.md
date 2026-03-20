# Workflow Harness - Project Instructions

Authoritative instruction set. Violations are blocked by hooks.

## Workflow Enforcement
- コード変更タスクは即座に `/harness start` で開始。事前調査禁止。純粋な質問のみ直接回答可。
- Auto-Start: 「〜して」（変更依頼）→ 自動起動。「〜か？」（質問）→ 直接回答。

## Tool Delegation
- オーケストレーターの直接ツール使用禁止（Read/Edit/Write/Bash/Glob/Grep）。
- 許可: lifecycle MCP, TeamCreate, SendMessage, Task*, Agent, Skill, ToolSearch, AskUserQuestion。
- 編集はWorkerのみ。オーケストレーター/Coordinatorはファイル編集禁止。
- Worker内のAgent(Explore)は読み取り専用で許可。

## Core Constraints
- L1-L4決定的ゲートのみ。L5(LLM判断)はゲート使用禁止。(→ ADR-001)
- 全ソースファイル ≤200行 = 責務分離の指標。超過時は責務分割で対応。
- 1行に複数文を詰め込む圧縮禁止。可読性は行数制限より優先。
- TOON形式(.toon)で成果物生成。
- AC-N(受入基準)とRTM F-NNN(要件追跡)で意図を固定・追跡。

## Documentation Layers (→ ADR-004)
HowをCLAUDE.mdに書くとコードと乖離し二重管理になる。Howはコードかスキルファイルが担う。
- CLAUDE.md = What（ルール・制約）のみ。How（手順）を書かない。
- docs/adr/ADR-NNN.md = Why（判断の経緯）。イミュータブル（追記のみ、修正は新ADRで撤回）。
- スキルファイル/コード = How（手順・フロー・設定）。
- 新ルール追加時: ADR（Why）を必ず作成。Whyなきルールは追加しない。

## Forbidden Actions (hooks enforce)
- フェーズスキップ禁止。research中コード編集禁止。テスト前実装禁止。DoD失敗時の直接編集禁止。
- 禁止語: TODO, TBD, WIP, FIXME, 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き
- CAN-1: ≤400行→Write優先、>400行→Edit。Edit失敗→Read+Write。
- テンプレート自作禁止。

## Session Recovery
1. `harness_status` → taskId+sessionToken
2. `claude-progress.json` → 進捗
3. `git log -20`

## Cross-Platform Agent Discovery
@AGENTS.md — クロスプラットフォームエージェント(Codex/Cursor/Devin等)向けルール定義

## Reference (→ skill files for How)
- Phases/sizing: → workflow-phases.md
- Orchestrator protocol: → workflow-orchestrator.md
- Gates/intent accuracy: → workflow-gates.md
- Retry/rules: → workflow-rules.md
- Execution/bash: → workflow-execution.md
- Documents: → workflow-docs.md

## Architecture Decision Records (→ docs/adr/)
- ADR-001: L5(LLM判断)ゲート禁止
- ADR-002: フェーズ=コンテキスト圧縮の設計
- ADR-003: 3層ガード→2層ガードへの簡素化
- ADR-004: ドキュメント3層分離（Why/What/How）
