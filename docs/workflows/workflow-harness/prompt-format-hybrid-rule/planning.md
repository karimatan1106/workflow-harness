# Planning: prompt-format-hybrid-rule

## 技術設計

### 変更対象

ファイル: .claude/skills/workflow-harness/workflow-delegation.md (現在126行)

### セクション追加位置

Common Constraints (現L118) の直前に ## Prompt Format Rules セクションを挿入する。

理由: Format RulesとCommon Constraintsは共に全テンプレート横断の規定だが、「形式(どう書くか)」と「制約(何を守るか)」は責務が異なる。形式が先、制約が後の順序が自然な読み順になる。

### 新セクション構成

  ## Prompt Format Rules

  - Top-level keys: TOON key-value (Task, Why, Context, What, How, Constraints)
  - Inner content: Markdown lists + indented hierarchy
  - Section separator: blank line between top-level keys
  - MCP short params (summary, evidence): single-sentence plain text
  - MCP long params (instruction, output): hybrid format (TOON top + Markdown body)
  - Long prompt threshold: 20+ lines of content → pass via file reference, not inline

### Common Constraints追加行

既存の箇条書き末尾(現L126)の後に1行追加:

  - Format: artifacts in Markdown. Do not let prompt input format (TOON) contaminate output

### 行数見積もり

| 項目 | 行数 |
|------|------|
| 新セクションヘッダ + 空行 | 2 |
| ルール本文 (6項目) | 6 |
| セクション間空行 | 2 |
| Common Constraints追加行 | 1 |
| 合計追加行数 | 11 |
| 変更後総行数 | 137 (200行上限内) |

## F-NNN specs

### F-001: Prompt Format Rulesセクション追加

- 対応AC: AC-1
- 挿入位置: L117 (Phase Parameter Table末尾) と L118 (Common Constraints) の間
- 内容: セクションヘッダ + 6項目の箇条書き
- 実装: Edit toolで L117の後に新セクションを挿入

### F-002: Agent委譲プロンプト形式ルール

- 対応AC: AC-2
- 内容: Prompt Format Rules内の最初2項目がカバー
  - Top-level keys: TOON key-value
  - Inner content: Markdown lists + indented hierarchy
- 既存Template A/B/Cの構造と一致する（追認ルール）

### F-003: MCP toolパラメータ形式ルール

- 対応AC: AC-2
- 内容: Prompt Format Rules内の4-5項目目がカバー
  - 短パラメータ: 一文プレーンテキスト
  - 長パラメータ: ハイブリッド形式
- MCP toolの使い分けを明確化し、不要なハイブリッド適用を防止

### F-004: 出力形式伝染防止

- 対応AC: AC-3
- 実装箇所: Common Constraints内に1行追加
- 内容: 成果物はMarkdown形式、プロンプト入力形式(TOON)を出力に使用しない
- 配置理由: 全テンプレートに共通適用されるため、個別テンプレート修正より効率的

### F-005: 長文閾値+空行ルール

- 対応AC: AC-4
- 内容: Prompt Format Rules内の最後2項目がカバー
  - セクション間空行区切り
  - 20行超→ファイル参照

### F-006: 200行以下維持

- 対応AC: AC-5
- 検証: 追加11行で合計137行。余裕63行。
- 制約: 新セクションは簡潔な箇条書きで構成し、説明文を含めない

## implementation order

1. Prompt Format Rulesセクション挿入 (F-001, F-002, F-003, F-005) — 単一のEdit操作でL117後に新セクション全体を挿入
2. Common Constraints追加行 (F-004) — L126後に1行追加のEdit操作
3. 行数検証 (F-006) — wc -l で200行以下を確認

ステップ1と2は同一ファイルの異なる位置への編集のため、ステップ1を先に実行し行番号ずれを考慮してステップ2を実行する。

## decisions

- セクション追加位置: Common Constraints直前 -- 形式(どう書くか)と制約(何を守るか)は責務が異なり、形式→制約の順序が論理的読み順として自然
- 既存テンプレート非修正: Template A/B/Cの本文は変更しない -- notInScopeで明示されており、Format Rulesセクション+Common Constraints追加行で全テンプレートをカバーできる
- Common Constraintsへの伝染防止行追加: 個別テンプレート修正ではなくCommon Constraintsに1行追加 -- 全テンプレートに一括適用でき、重複を避けられる
- MCP短長パラメータの区別明記: summary/evidenceとinstruction/outputを分けて形式を規定 -- 短パラメータにハイブリッド形式を適用するのは過剰であり、用途に応じた最適形式を指定
- ルール記述言語: 英語で記述 -- 既存セクション(4-Layer Template Structure, Phase Parameter Table, Common Constraints)がすべて英語であり統一性を維持
- 説明文の排除: 各ルールは1行の箇条書きのみ -- 200行制限内で最大効率を確保し、LLMが解釈しやすい簡潔な形式を優先
- 編集順序: 新セクション挿入→Common Constraints追加の順 -- 新セクション挿入で行番号がずれるため、下流(Common Constraints)の編集を後にすることで行番号計算の誤りを防止

## artifacts

| # | ファイルパス | 変更種別 | 対応F-NNN |
|---|-------------|---------|-----------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 編集 | F-001〜F-006 |

## next

- design_reviewフェーズでAC→設計マッピングを検証
