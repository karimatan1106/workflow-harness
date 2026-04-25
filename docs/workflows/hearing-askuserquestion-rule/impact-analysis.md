# Impact Analysis: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md (78 lines) に hearing フェーズセクション(約3行)を追加する変更の影響を分析する。変更対象は単一のドキュメントファイルのみ。ランタイムへの影響はゼロ。破壊的変更なし。

## change-scope

- target: .claude/skills/workflow-harness/workflow-phases.md
- change-type: documentation addition (insert 3 lines at L11)
- lines-before: 78
- lines-after: approximately 81
- 200-line-limit: 81/200 (59% headroom remaining)

## dependency-analysis

### direct-dependencies

workflow-phases.md は以下から参照される:

- workflow-execution.md: フェーズ実行順序の参照元。hearing の追加は既存フェーズの順序を変更しないため影響なし。
- workflow-gates.md: DoD ゲート定義の参照元。hearing の DoD は新規追加であり既存ゲートに干渉しない。
- workflow-delegation.md: Phase Parameter Table に hearing 行は既に存在 (L97)。整合性が向上する。
- CLAUDE.md (workflow-harness): フェーズ一覧の権威仕様。本変更で hearing が正式に記載される。

### reverse-dependencies

- hearing-worker.md: 変更なし。hearing フェーズの実行エージェント定義は独立している。
- hook スクリプト群: 変更なし。hook は workflow-phases.md を直接パースしない。
- coordinator.md / worker.md: 変更なし。エージェント定義は phases ファイルに依存しない。

### affected-tests

- テスト対象コード変更なし。vitest --related の対象外。
- ドキュメント整合性は DoD ゲート (L1/L3/L4) で検証される。

## risk-assessment

- runtime-risk: none (documentation-only change)
- breaking-change-risk: none (additive change, no existing content modified)
- regression-risk: none (no code execution paths affected)
- integration-risk: none (workflow-delegation.md already has hearing entry)
- file-size-risk: none (81 lines, well under 200 limit)

## positive-impacts

- workflow-phases.md の Phase Work Descriptions セクションが全フェーズを網羅するようになる
- LLM がフェーズ作業内容を参照する際に hearing の情報が欠落しなくなる
- workflow-delegation.md の Phase Parameter Table との整合性が確保される
- 新規セッションで hearing フェーズの存在と作業内容が自明になる

## decisions

- D-001: 影響範囲は workflow-phases.md 単一ファイルに限定する -- research の D-006 に従い、他ファイルは変更対象外
- D-002: 既存フェーズの行番号シフトは影響なしと判断する -- workflow-phases.md を行番号で参照する外部システムは存在しない
- D-003: テスト設計は DoD ゲート検証のみで十分と判断する -- コード変更がなく、vitest 対象外のため
- D-004: ロールバック手段は git revert で即時可能と判断する -- 単一ファイルへの additive change のため
- D-005: 並行作業への影響はないと判断する -- workflow-phases.md の当該挿入位置 (L11) を編集中の他タスクは存在しない

## artifacts

- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/impact-analysis.md (本ファイル)

## next

phase: requirements
action: AC-1 から AC-N を定義し、hearing セクション追加の受入基準を確定する
readFiles: "docs/workflows/hearing-askuserquestion-rule/scope-definition.md"
