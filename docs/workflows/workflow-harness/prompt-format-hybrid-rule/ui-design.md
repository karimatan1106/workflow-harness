# UI Design: prompt-format-hybrid-rule

## インターフェース一覧

本タスクが影響するインターフェースは以下の3種。すべてworkflow-delegation.md内で定義される。

| # | インターフェース | 利用者 | 影響範囲 |
|---|-----------------|--------|---------|
| 1 | Agent委譲プロンプト (Template A/B/C) | Orchestrator → Coordinator/Worker | 全30フェーズの委譲呼び出し |
| 2 | MCP toolパラメータ | Coordinator/Worker → harness MCP | harness_record_proof, harness_record_test_result等 |
| 3 | Common Constraints出力形式指定 | 全テンプレート共通 | 成果物の出力形式制御 |

## Agent委譲プロンプトインターフェース

Orchestratorがsubagentを呼び出す際のプロンプト形式仕様。

構造:
- Top-level keys: TOON key-value形式 (Task, Why, Context, What, How, Constraints)
- Inner content: Markdown lists (-, 1.) + indented hierarchy
- Section separator: top-level key間は空行1行で区切る

例示 (Template B準拠):
```
Task: implementation for example-task

Why: 設計を実装に変換し、テストをGREENにする

What:
  Output: src/example.ts
  Spec: AC-1 requirements met

How:
  1. Read planning.md for F-NNN specs
  2. Implement changes per F-001
  3. Run tests and verify GREEN

Constraints:
  Scope: write=src/example.ts only
  Format: artifacts in Markdown. Do not let prompt input format (TOON) contaminate output
  Quality: no duplicate lines, ground facts in code
```

key部分はコロン区切りのTOON、value部分はMarkdownリスト/インデント。この分離により:
- Orchestratorはkey-valueのパース負荷が低い
- Workerは中身のMarkdown構造を自然に読める
- 出力成果物がTOON形式に伝染するリスクを低減

## MCP toolパラメータインターフェース

MCP toolのパラメータは長さに応じて形式を使い分ける。

| パラメータ種別 | 例 | 形式 | 理由 |
|--------------|-----|------|------|
| 短パラメータ | summary, evidence, exitCode | 一文プレーンテキスト | 構造化不要、トークン節約 |
| 長パラメータ | instruction, output | TOON top + Markdown body | 構造が必要、可読性確保 |

閾値: 20行超のコンテンツはインライン渡しではなくファイル参照で渡す。

ファイル参照形式:
```
How:
  1. Read docs/workflows/{taskId}/planning.md for detailed specs
```

## 検証基準

DoD gateが本ルールの準拠を検証する方法。

| # | 検証項目 | チェック方法 | 対応F-NNN |
|---|---------|-------------|-----------|
| 1 | Top-level keyがTOON形式 | Task/Why/What/How/Constraintsがコロン区切りで存在 | F-002 |
| 2 | Inner contentがMarkdown形式 | リスト項目が`-`または`1.`で開始 | F-002 |
| 3 | セクション間空行 | top-level key間に空行1行以上 | F-005 |
| 4 | 短パラメータが一文 | summary/evidenceが改行を含まない | F-003 |
| 5 | 出力形式伝染なし | 成果物にTOON key-value構造が混入していない | F-004 |
| 6 | 長文閾値 | 20行超のコンテンツがファイル参照で渡されている | F-005 |
| 7 | ファイル行数 | workflow-delegation.md が200行以下 | F-006 |

検証タイミング: content_validation (delta_entry_format) で自動チェック。項目5はcode_reviewフェーズでレビュアーが目視確認。

## decisions

- TOON+Markdown分離境界をtop-level keyに設定: top-level keyのみTOON、それ以外は全てMarkdown -- top-level keyは6種固定でパース容易、inner contentはMarkdownの方がLLMの出力品質が高い
- 短パラメータの形式をプレーンテキストに限定: summary/evidenceにハイブリッド形式を適用しない -- 一文で済む内容に構造を付与するのはオーバーヘッドであり、トークン消費が無駄に増加する
- 長文閾値を20行に設定: 20行超はファイル参照に切り替え -- Agent toolのプロンプトパラメータが長すぎるとコンテキスト圧迫が起き、Workerの出力品質が劣化する
- 出力形式伝染防止をCommon Constraintsに配置: 個別テンプレートではなくCommon Constraintsに1行追加 -- 全テンプレート横断で適用され、テンプレート個別修正の漏れリスクを排除できる
- 既存テンプレート本文を変更しない: Template A/B/Cの構造は現状でハイブリッド形式に準拠済み -- 追認ルールとしてPrompt Format Rulesセクションに明文化するのみで十分であり、不要な差分を生まない
- セクション間空行を必須化: blank lineをルールとして明記 -- 空行なしだとTOONパーサーがkey-valueの境界を誤認し、Workerへの指示が結合されるケースが報告されている
- 検証の自動/手動を分離: 項目1-4,6-7は自動検証、項目5はcode_reviewで目視 -- 出力形式伝染の検出は文脈依存であり、正規表現ベースの自動検証では偽陽性が多い

## artifacts

| # | ファイルパス | 変更種別 | 対応F-NNN |
|---|-------------|---------|-----------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 編集 (Prompt Format Rulesセクション挿入) | F-001, F-002, F-003, F-005 |
| 2 | .claude/skills/workflow-harness/workflow-delegation.md | 編集 (Common Constraints行追加) | F-004 |

変更後行数見積もり: 137行 (現126行 + 11行追加、200行上限内)

## next

- test_designフェーズでAC-1〜AC-5に対するテストケースを設計し、検証基準の具体的な期待値を確定する
