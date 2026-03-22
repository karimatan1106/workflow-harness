# Workflow Harness - Project Instructions

## Mission
10Mステップのコードベースでも、ユーザーの指示通りの修正を一度の実行で完遂する。
そのために30フェーズ・L1-L4決定的ゲート・RTM追跡による圧倒的なコンテキストエンジニアリングで意図精度を保証する。

Authoritative instruction set. Violations are blocked by hooks.

## Workflow Enforcement
- コード変更タスクは即座に `/workflow-harness start` で開始。事前調査禁止。純粋な質問のみ直接回答可。
- Auto-Start: 「〜して」（変更依頼）→ 自動起動。「〜か？」（質問）→ 直接回答。
- キーワード検出: プロンプト内の任意の位置に「ハーネス」が含まれる場合、他の一切の処理より先に harness_start を実行する。Explore/調査を先行させない。

## Tool Delegation (2層モデル)
- オーケストレーターの直接ツール使用制限（Write/Glob/Grep禁止）。
- 許可: lifecycle MCP, Agent, Skill, ToolSearch, AskUserQuestion, Read, Edit。
- Edit: Workerのedit-preview結果をOrchestratorが実行（リッチdiff表示用）。直接の調査目的でのRead使用は最小限に。
- Coordinator: 分析・タスク分解。結果はファイルに書き出し。
- Worker: ファイル操作実行。
- subagent間の文脈はファイルベースで中継。L1はファイルパスと1行サマリのみ保持。

## Core Constraints
- L1-L4決定的ゲートのみ。L5(LLM判断)はゲート使用禁止。(→ ADR-001)
- 全ソースファイル ≤200行 = 責務分離の指標。超過時は責務分割で対応。
- 1行に複数文を詰め込む圧縮禁止。可読性は行数制限より優先。
- TOON形式(.toon)で成果物生成。
- AC-N(受入基準)とRTM F-NNN(要件追跡)で意図を固定・追跡。

## Documentation Layers (→ ADR-004, ADR-005)
HowをCLAUDE.mdに書くとコードと乖離し二重管理になる。Howはコードかスキルファイルが担う。
判定基準(LLM目線): LLMに選択の余地を与えるか、与えないか。
- Why = この判断に従う理由。覆すな → docs/adr/ADR-NNN.md（イミュータブル）
- What = 達成すべきゴール。手段はLLMが選ぶ → CLAUDE.md、requirements
- How = この手段を使え。LLMの裁量なし → スキルファイル、コード、planning
- 新ルール追加時: ADR（Why）を必ず作成。Whyなきルールは追加しない。

## Forbidden Actions (hooks enforce)
- フェーズスキップ禁止。research中コード編集禁止。テスト前実装禁止。DoD失敗時の直接編集禁止。
  未完成の成果物が次フェーズに渡ると品質が連鎖劣化するため。
- 禁止語: TODO, TBD, WIP, FIXME, 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き
  未確定事項が成果物に残るとLLMが「仮置き」を正として扱い、下流で不具合化するため。
- テンプレート自作禁止。ハーネスが提供するテンプレートと乖離し、DoDゲートを通過できなくなるため。

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
- ADR-005: Why/What/How定義基準 — LLM目線
