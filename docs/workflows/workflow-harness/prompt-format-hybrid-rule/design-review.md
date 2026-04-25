# Design Review: prompt-format-hybrid-rule

## AC→設計マッピング

| AC | 内容 | 対応F-NNN | 設計成果物での根拠 |
|----|------|-----------|-------------------|
| AC-1 | Prompt Format Rulesセクション追加(TOON+Markdown) | F-001 | planning.md: L117後に6項目の箇条書きセクション挿入。ui-design.md: Agent委譲プロンプトインターフェースで構造定義 |
| AC-2 | Agent委譲+MCP tool両方の形式ルール | F-002, F-003 | planning.md: F-002がAgent委譲(top-level TOON + inner Markdown)、F-003がMCP短長パラメータ使い分けをカバー。ui-design.md: 両インターフェースの形式仕様と例示 |
| AC-3 | 出力形式伝染防止(Constraints内Format指定) | F-004 | planning.md: Common Constraintsに1行追加。ui-design.md: 検証基準#5で伝染検出方法を規定 |
| AC-4 | 長文閾値(20行超→ファイル参照)+空行ルール | F-005 | planning.md: Prompt Format Rules内の最後2項目。ui-design.md: 検証基準#3(空行)と#6(閾値)で自動検証 |
| AC-5 | 変更後200行以下維持 | F-006 | planning.md: 追加11行で合計137行(余裕63行)。state-machine.mmd: VerifyLineCount→SplitFile回復パス |

## 設計カバレッジ分析

全5件のACがF-001〜F-006に対応しており、未カバーのACは存在しない。

F-NNNからACへの逆引き:
- F-001 → AC-1 (セクション追加)
- F-002 → AC-2 (Agent委譲形式)
- F-003 → AC-2 (MCP tool形式)
- F-004 → AC-3 (伝染防止)
- F-005 → AC-4 (閾値+空行)
- F-006 → AC-5 (200行以下)

AC-2に対してF-002とF-003の2つのspecが割り当てられている。Agent委譲とMCP toolは利用者・形式が異なるため、分離は妥当。

カバレッジギャップ: なし。全ACが設計で網羅されている。

## 設計品質評価

一貫性: 全設計成果物(planning.md, ui-design.md, state-machine.mmd, flowchart.mmd)が同一の変更内容(Prompt Format Rulesセクション挿入 + Common Constraints追加行)を参照しており、矛盾は検出されない。

完全性: ui-design.mdの検証基準7項目がF-NNNすべてに対応し、自動検証と手動検証の分離が明記されている(項目5のみcode_reviewで目視)。

実現可能性: 変更対象が単一ファイル(workflow-delegation.md)への11行追加。既存テンプレート非修正のため、リグレッションリスクは極めて低い。

state-machine.mmdにSplitFile回復パスが定義されており、200行超過の想定外事態にも対応設計がある。ただし現行126行+11行=137行であり、このパスが発動する可能性は実質ゼロ。

flowchart.mmdの処理順序(Read → Insert Format Rules → Add Guard → Verify Line Count)はplanning.mdの実装順序と一致している。

## acDesignMapping

- AC-1: F-001 Prompt Format Rulesセクション追加 → state-machine.mmd InsertFormatRules状態, flowchart.mmd InsertRules/AddSubsections ノード
- AC-2: F-002 Agent委譲形式ルール + F-003 MCP toolパラメータ形式ルール → ui-design.md Agent委譲/MCPインターフェース仕様
- AC-3: F-004 出力形式伝染防止 → Common Constraints追加行, ui-design.md 検証基準
- AC-4: F-005 長文閾値+空行ルール → Prompt Format Rules内の2項目
- AC-5: F-006 200行以下維持 → state-machine.mmd VerifyLineCount状態, flowchart.mmd LineCountOK判定ノード

## decisions

- AC→F-NNNマッピング完全性: 全5件のACがカバーされており、設計漏れなし -- F-001〜F-006が各ACに明示的に紐づき、逆引きでも孤立specなし
- AC-2の2spec分割は妥当: Agent委譲(F-002)とMCP tool(F-003)を分離 -- 利用者(Orchestrator vs Coordinator/Worker)と形式(ハイブリッド vs 短文/ハイブリッド使い分け)が異なるため、単一specでは検証粒度が不足する
- 単一ファイル変更スコープは適切: workflow-delegation.md のみの編集 -- notInScopeで除外された既存テンプレート・agent定義ファイル・hook実装への波及がないことを設計が保証している
- SplitFile回復パスは過剰だが安全: 137行で200行上限に63行の余裕があり発動可能性は極めて低い -- 将来の追加変更で行数が増える場合の防護策として設計に含めることは合理的
- 検証の自動/手動分離は設計として健全: 出力形式伝染(項目5)のみ手動、他6項目は自動 -- 文脈依存の検出を正規表現で強制すると偽陽性が多発するという判断は過去の経験と整合する
- 編集順序の設計(新セクション→Common Constraints)は行番号ずれ防止として正しい -- 上流の挿入で下流の行番号が変わるため、上から順に編集する設計は安全側

## artifacts

| # | 成果物 | 種別 | レビュー結果 |
|---|--------|------|-------------|
| 1 | docs/workflows/prompt-format-hybrid-rule/requirements.md | 要件定義 | AC-1〜AC-5が明確に定義。notInScopeも適切 |
| 2 | docs/workflows/prompt-format-hybrid-rule/planning.md | 技術設計 | F-001〜F-006が全ACをカバー。行数見積もり妥当 |
| 3 | docs/workflows/prompt-format-hybrid-rule/ui-design.md | インターフェース設計 | 3種のインターフェース定義と7項目の検証基準 |
| 4 | docs/workflows/prompt-format-hybrid-rule/state-machine.mmd | 状態遷移図 | 6状態+エラーパス。回復パスあり |
| 5 | docs/workflows/prompt-format-hybrid-rule/flowchart.mmd | フローチャート | 処理順序がplanning.mdと一致 |

## next

- test_designフェーズでAC-1〜AC-5に対するテストケースを設計する
