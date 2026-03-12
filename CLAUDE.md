# Workflow Harness - Project Instructions

Authoritative instruction set. Violations are blocked by hooks.
**ワークフロー強制**: コード変更タスクは `/harness start <タスク名>` で開始。質問・調査は直接回答。

## Core Principles
- Phases = context compression. 各成果物が次フェーズへの完全な引き継ぎ。
- L1-L4決定的ゲートのみ。L5(LLM判断)はゲート使用禁止。
  - L1=file_exists L2=exit_code L3=numeric_threshold L4=regex_match → 全て決定的・再現可能
  - L5禁止理由(PSC-5): 検証容易性=改善能力。LLM判断は非決定的→再現不可→改善不可→品質劣化。
- 全ソースファイル≤200行=責務分離の指標。超過=責務混在→階層化/正規化/分解で対応（行数削減がゴールではない）。TOON形式(.toon)で成果物生成。
- AC-N(受入基準)とRTM F-NNN(要件追跡)で意図を固定・追跡。

## Phases: 14ステージ30フェーズ (→ skill: workflow-phases.md)
small(0-3)=~12: ドキュメント修正不要な小規模変更のみ。medium(4-7)=~22。large(8+)=30。Default: large。

## Forbidden Actions (hooks enforce)
- フェーズスキップ/research中コード編集/テスト前実装/直接編集(DoD失敗時)禁止
- 禁止語: TODO,TBD,WIP,FIXME,未定,未確定,要検討,検討中,対応予定,サンプル,ダミー,仮置き
- CAN-1: ≤400行→Write優先、>400行→Edit。Edit失敗→Read+Write。

## Orchestrator (→ skill: workflow-orchestrator.md)
harness_next→hasTemplate→harness_get_subphase_template→Task(template)→harness_next(DoD)
テンプレート自作禁止。報告: `[Phase] complete. Next: [next]. Remaining: [N] phases.`

## Retry (→ skill: workflow-rules.md)
DoD失敗→サブエージェント再起動(直接編集禁止)。retryCount渡す。5回→ユーザー確認。
3回同一エラー→VDB-1(バリデータバグ疑い)。

## Intent Accuracy (→ skill: workflow-gates.md)
IA-1~7: OPEN_QUESTIONS/AC-N≥3/NOT_IN_SCOPE/AC→設計/TC/code-review/最終検証

## Session Recovery
1. `harness_status` → taskId+sessionToken  2. `claude-progress.json` → 進捗  3. `git log -20`

## Cross-Platform Agent Discovery
@AGENTS.md — クロスプラットフォームエージェント(Codex/Cursor/Devin等)向けルール定義

## sessionToken: Layer1=全MCPツールに渡す。Layer2=testing系のみ渡す。
## Traceability: AC-N→open→met。F-NNN→pending→implemented→tested→verified。
## Quality: L3(chars/density/fields) + L4(禁止語/重複/必須キー) → skill: workflow-gates.md
## Bash: readonly/testing/impl/git/security。フェーズ別許可。→ skill: workflow-execution.md
