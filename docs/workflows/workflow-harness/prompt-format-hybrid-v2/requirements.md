# Requirements: prompt-format-hybrid-v2

## ユーザー意図との整合性確認

| 意図キーワード (hearing) | 対応AC |
|------------------------|--------|
| ハイブリッド形式(トップレベルTOON+中身Markdown)をルール化 | AC-1 |
| Agent委譲+MCPパラメータ両方を対象 | AC-2 |
| 出力形式伝染防止(Constraints内Format指定) | AC-3 |
| 長文閾値(20行超→ファイル参照)+空行区切り | AC-4 |
| 200行以下維持 | AC-5 |

deep意図: workflow-delegation.mdにPrompt Format Rulesセクションを追加し、トップレベルTOON+中身Markdownのハイブリッド形式ルールを定義する。Agent委譲とMCPパラメータの両方を対象とし、出力形式伝染を防止してDoDゲート失敗を減らす

## acceptanceCriteria

- AC-1: workflow-delegation.mdに## Prompt Format Rulesセクションが追加され、トップレベルTOON+中身Markdownのハイブリッド形式ルールが定義されている
  - 検証方法: grep "## Prompt Format Rules" + grep "TOON" + grep "Markdown"
  - 検証レベル: L2(文字列パターン一致) -- セクション存在+キーワード確認

- AC-2: Agent委譲プロンプトとMCP toolパラメータの両方に対する形式ルールが記載されている
  - 検証方法: grep "Agent" + grep "MCP" in Format Rules section
  - 検証レベル: L2(文字列パターン一致) -- 対象スコープ2種の記載確認

- AC-3: 出力形式伝染防止ルール(Constraints内にFormat指定明記)が含まれている
  - 検証方法: grep "Format:" in Common Constraints section
  - 検証レベル: L2(文字列パターン一致) -- Constraints内のFormat行存在確認

- AC-4: 長文閾値ルール(20行超→ファイル参照)とセクション間空行ルールが含まれている
  - 検証方法: grep "20" + grep "空行" in rules section
  - 検証レベル: L2(文字列パターン一致) -- 閾値と空行ルールの記載確認

- AC-5: 変更後のworkflow-delegation.mdが200行以下を維持している
  - 検証方法: wc -l <= 200
  - 検証レベル: L1(数値比較) -- 行数上限の機械的チェック

## notInScope

- 既存テンプレートA/B/Cの書き換え(形式ルールは補完であり既存テンプレートの内容は変更しない)
- agent定義ファイル(coordinator.md/worker.md/hearing-worker.md)の変更
- tool-delegation.mdの変更
- hookによる形式ルール強制の実装

## openQuestions


## decisions

- AC数: 5件 -- 1ファイルへの15-20行追加という小規模変更に対して必要十分な検証粒度
- notInScope明示: 既存テンプレート書き換えを除外 -- 形式ルールは既存構造の補完であり破壊的変更を避ける方針
- Format指定の配置: Constraints内に1行追加を推奨 -- 過剰なフォーマット指示はWorkerの自律性を損なうため最小限とする
- MCP tool対応: 長短パラメータの区別を明記 -- summary/evidenceは一文、instruction/outputはハイブリッド形式と使い分ける
- hook強制は対象外: ルール明文化が第一歩 -- hook実装は効果を確認してから別タスクで対応する
- v1からの差分: v1の成果を前提とした改善タスク -- v1で発見された不足点やエッジケースへの対応を含む

## artifacts

| # | ファイルパス | 変更種別 | 対応AC |
|---|-------------|---------|--------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 編集 | AC-1, AC-2, AC-3, AC-4, AC-5 |

## next

- planningフェーズで技術設計を実施し、workflow-delegation.mdへの具体的な追記内容を確定する
