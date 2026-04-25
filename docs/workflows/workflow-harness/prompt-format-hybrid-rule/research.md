## サマリー

workflow-delegation.mdにPrompt Format Rulesセクションを追加し、subagent/MCP向けプロンプトのTOON+Markdownハイブリッド形式を明文化するタスク。現在のテンプレートA/B/Cは既に暗黙的にハイブリッド形式を採用しているが、明示的なルールが欠落しており、出力形式伝染（入力TOONが成果物TOONになる問題）の防止策が未記載。

## ユーザー意図の分析

- 表層: workflow-delegation.mdにPrompt Format Rulesセクションを追加する
- 深層: subagentへの指示形式が出力成果物に伝染する問題を構造的に防止し、delta_entry_format等のDoD失敗を根本解消する
- 不明点: なし（feedback_prompt-format-hybrid.mdに検証済みの方針が記録されている）
- 前提: feedback_prompt-format-hybrid.mdの方針をユーザーが承認済み

## 現在の構造分析

### workflow-delegation.md（126行、上限200行以内）

現在のセクション構成:
1. 4-Layer Template Structure（L6-L88）: Template A/B/C定義
2. Phase Parameter Table（L90-L117）: フェーズ別設定表
3. Common Constraints（L118-L126）: 全テンプレート共通制約6項目

残り行数余裕: 約74行（200行上限まで）

### テンプレートの既存ハイブリッド形式分析

Template A/B/Cは既に以下のハイブリッド構造を使用:
- トップレベル: TOON key-value形式（Task:, Why:, Context:, What:, How:, Constraints:）
- What内部: YAMLライクなインデント（Output:, Sections:, Spec:）
- How内部: 番号付きリスト（Markdown形式）
- Constraints内部: key=value形式（Scope:, Forbidden:, Quality:）

ただし「成果物はMarkdown形式で書くこと」という出力形式指定は明記されていない。

### tool-delegation.md（10行）

- Agent呼び出し時はworkflow-delegation.mdの4層テンプレートに従うことを規定（L7）
- プロンプト形式自体への言及なし
- 本ファイルはWhat層（達成すべきゴール）であり、How（具体的手段）はスキルファイルが担う

### workflow-execution.md（72行）

- subagent委譲時の必須コンテキスト（L64-L72）に「Markdown形式: フェーズ成果物は.mdで生成」と記載あり
- ただしプロンプト自体の形式ルール（入力形式）には言及なし
- 出力形式と入力形式の区別が不明確

### feedback_prompt-format-hybrid.md（18行、検証済みフィードバック）

確定方針:
- トップレベル: TOON key-value
- 中身: Markdownリスト + インデント階層
- Constraints内に「Format: Markdown形式で記述」を明記し出力伝染を防止
- 20行超の指示はファイル経由で渡す
- セクション間は空行区切り

## decisions

- 追加位置: Common Constraintsセクションの直前に新セクションを挿入 -- Common Constraintsは全テンプレート共通の制約であり、Format Rulesも同様に全テンプレートに適用されるが、制約（何を守るか）と形式（どう書くか）は責務が異なるため独立セクションが適切
- セクション名: "Prompt Format Rules" -- 英語で統一（既存セクション名がすべて英語）、プロンプトの書き方ルールであることが明確
- 出力形式伝染防止: Constraints内にFormat行を必須化 -- feedback_prompt-format-hybrid.mdで検証済みの手法。Template A/B/CのConstraintsブロック内にFormat指定のプレースホルダを追加する
- ファイル経由委譲ルール: 20行閾値を明記 -- 長いプロンプトはトークン消費増とコンテキスト圧迫を招くため、ファイル経由で渡す閾値を明示する
- テンプレート修正範囲: Template A/B/Cの各Constraintsブロックに Format 行を追加 -- 新セクションだけでなくテンプレート本体にも反映が必要。ただしCommon Constraintsへの1行追加で全テンプレートをカバーする方が重複を避けられる
- セクション間空行: ルールとして明記 -- TOON key-valueの結合問題（改行のみだとパーサーが結合する場合がある）を防止するため

## artifacts

| 成果物 | 変更種別 | 内容 |
|--------|---------|------|
| workflow-delegation.md | セクション追加 | "Prompt Format Rules"セクション（約10-15行） |
| workflow-delegation.md | テンプレート修正 | Common ConstraintsにFormat行追加（1行） |

## next

1. requirements: Prompt Format Rulesセクションの受入基準を定義（AC-1: ハイブリッド形式ルール明記、AC-2: 出力伝染防止策明記、AC-3: 既存テンプレートとの整合性）
2. planning: workflow-delegation.mdへの具体的な追加内容と挿入位置を確定
3. implementation: セクション追加とCommon Constraints修正を実施
