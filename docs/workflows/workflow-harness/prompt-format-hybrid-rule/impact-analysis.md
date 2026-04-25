# Impact Analysis: prompt-format-hybrid-rule

## 影響サマリー

workflow-delegation.md 1ファイルに15-20行のPrompt Format Rulesセクションを追加する。既存のテンプレート定義やパラメータ表には変更なし。影響範囲は極めて限定的。

## 依存グラフ

### 直接依存（workflow-delegation.mdを参照するファイル）

| file | reference type | impact |
|------|---------------|--------|
| .claude/agents/coordinator.md | Prompt Contract "follow workflow-delegation.md" | 影響なし: 既存参照はテンプレート構造全体を指すため、新セクション追加で参照が壊れない |
| .claude/agents/worker.md | Prompt Contract "follow workflow-delegation.md" | 同上 |
| .claude/agents/hearing-worker.md | Prompt Contract "follow workflow-delegation.md" | 同上 |
| .claude/rules/tool-delegation.md | "workflow-delegation.mdの4層テンプレートに従う" | 影響なし: 形式ルールは4層テンプレートの補完であり矛盾しない |

### 間接依存

| file | relationship | impact |
|------|-------------|--------|
| SKILL.md File Routing | delegation.mdのロード制御 | 影響なし: ファイルパス変更なし、行数増加は200行以内 |
| workflow-phases.md | Stage Why → テンプレートWhy | 影響なし: 形式ルールはWhyの内容ではなくフォーマットを規定 |
| workflow-gates.md | DoD checks | 正の影響: Format指定明記により delta_entry_format 失敗が減少する見込み |

## 行数影響

| file | current | added | total | limit | margin |
|------|---------|-------|-------|-------|--------|
| workflow-delegation.md | 125 | 15-20 | 140-145 | 200 | 55-60行 |

## リスク分析

- R-1: 既存テンプレートとの矛盾リスク → LOW: 形式ルールはテンプレートの補完であり、既存のWhy/What/How/Constraintsセクションの内容を変更しない
- R-2: コンテキストウィンドウ増加 → NEGLIGIBLE: 15-20行 = 約300トークン増加（0.15%）
- R-3: ルール過剰によるWorker混乱 → LOW: 形式ルールは具体的な判断基準を提供（「20行超→ファイル参照」等）であり曖昧さを増やさない

## decisions

- 影響ファイル数: 1ファイルのみ変更 -- 新セクション追加は既存参照を壊さず、依存ファイル4つに変更不要
- 行数安全性: 追加後140-145行で200行制限の72% -- ファイル分割の必要なし
- 既存テンプレートとの整合: 形式ルールは補完であり矛盾しない -- テンプレートA/B/Cは既にハイブリッド形式を暗黙使用しており明文化するだけ
- DoD改善効果: delta_entry_format失敗の防止が期待 -- Constraints内のFormat指定明記によりWorkerの出力形式が安定する
- テスト影響: テストコード変更なし -- Markdown設定ファイルの変更のため自動テストへの影響ゼロ

## artifacts

| # | file | status |
|---|------|--------|
| 1 | docs/workflows/prompt-format-hybrid-rule/impact-analysis.md | new |

## next

- requirements phase
