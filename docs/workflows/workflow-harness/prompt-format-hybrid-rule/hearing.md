# Hearing: prompt-format-hybrid-rule

## ユーザー意図の分析

- surface: subagent/MCPプロンプトのハイブリッド形式ルールをスキルファイルに適用する
- deep: 入力形式が出力形式に伝染する問題を構造的に防止し、DoDゲート失敗（delta_entry_format等）を減らす
- unclear: なし（Q1/Q2でユーザー回答済み）
- assumptions: なし

## 回答結果

- Q1(配置先): A) workflow-delegation.md に追記（4層テンプレートと形式ルールを1ファイルに統合）
- Q2(スコープ): B) Agent委譲プロンプト + MCP toolパラメータ（harness MCPへの文字列引数も含む）

userResponse: Q1=A(workflow-delegation.mdに追記), Q2=B(Agent委譲+MCPパラメータ両方)

## decisions

- 配置先: workflow-delegation.mdに追記 -- 4層テンプレートと形式ルールは同じ責務（委譲プロンプト品質）であり1ファイルに統合が自然
- スコープ: Agent委譲+MCPパラメータ両方を対象 -- MCPのinstructionパラメータも構造化指示であり同じ形式ルールが適用可能
- トップレベル形式: TOON key-value -- LLMがセクション名を確実に認識でき、Markdownの##+空行よりトークン効率が高い
- 中身形式: Markdownリスト -- 成果物がMarkdown指定のため入力もMarkdownにすることで出力形式伝染を防止
- 長文閾値: 20行超でファイル参照に切替 -- LLMの末尾忘却が20行付近で始まるため

## artifacts

| # | file | change | AC |
|---|------|--------|----|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | edit | AC-1 |

## next

- scope_definition phase

userResponse: Q1=A(workflow-delegation.mdに追記), Q2=B(Agent委譲+MCPパラメータ両方)
