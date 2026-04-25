# Requirements: prompt-format-hybrid-rule

## ユーザー意図との整合性確認

| 意図キーワード (hearing) | 対応AC |
|------------------------|--------|
| ハイブリッド形式(トップレベルTOON+中身Markdown)をルール化 | AC-1 |
| Agent委譲+MCPパラメータ両方を対象 | AC-2 |
| 出力形式伝染防止(Constraints内Format指定) | AC-3 |
| 長文閾値(20行超→ファイル参照)+空行区切り | AC-4 |
| 200行以下維持 | AC-5 |

deep意図: subagent/MCP向けプロンプトのハイブリッド形式（トップレベルTOON + 中身Markdown）をworkflow-delegation.mdにルールとして適用する。入力形式が出力形式に伝染する問題を防止し、プロンプト品質を標準化する。delta_entry_format等のDoDゲート失敗を減らす。

## acceptanceCriteria

- AC-1: workflow-delegation.mdに## Prompt Format Rulesセクションが追加され、トップレベルTOON+中身Markdownのハイブリッド形式ルールが定義されている
  - 検証: セクション存在確認 + "TOON" と "Markdown" の両方への言及
- AC-2: Agent委譲プロンプトとMCP toolパラメータの両方に対する形式ルールが記載されている
  - 検証: "Agent" と "MCP" の両方に言及する形式ルールが存在
- AC-3: 出力形式伝染防止ルール(Constraints内にFormat指定明記)が含まれている
  - 検証: 出力形式伝染/Format指定に関するルールが記載
- AC-4: 長文閾値ルール(20行超→ファイル参照)とセクション間空行ルールが含まれている
  - 検証: "20行" と "空行" に関するルールが記載
- AC-5: 変更後のworkflow-delegation.mdが200行以下を維持している
  - 検証: wc -l で200以下

## notInScope

- 既存テンプレートA/B/Cの書き換え（形式ルールは補完であり既存テンプレートの内容は変更しない）
- agent定義ファイル(coordinator.md/worker.md/hearing-worker.md)の変更
- tool-delegation.mdの変更
- hookによる形式ルール強制の実装

## openQuestions

## decisions

- AC数: 5件 -- 1ファイル15-20行追加の小規模変更に対して十分な粒度
- notInScope明示: 既存テンプレート書き換えを除外 -- 形式ルールは補完であり既存構造を壊さない方針を明確化
- Format指定の粒度: Constraints内に1行追加を推奨 -- 過剰なフォーマット指示はWorkerの自律性を損なう
- MCP tool対応: 長短パラメータの区別を明記 -- summary/evidenceは一文、instruction/outputはハイブリッド形式
- hook強制は対象外: ルール明文化が第一歩 -- hook実装は効果を確認してから別タスクで対応

## artifacts

| # | ファイルパス | 変更種別 | 対応AC |
|---|-------------|---------|--------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 編集 | AC-1, AC-2, AC-3, AC-4, AC-5 |

## next

- planningフェーズで技術設計
