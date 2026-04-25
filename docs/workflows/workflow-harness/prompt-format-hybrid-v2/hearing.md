# hearing: prompt-format-hybrid-v2

## ユーザー意図の分析

- surface request: workflow-delegation.mdにハイブリッド形式ルールを追加し、subagent/MCPプロンプトの形式を統一する
- deep need: subagent/MCPプロンプトの形式を標準化し、出力形式伝染（delta_entry_format失敗）を防止する。TOON形式の入力がMD出力に混入する問題、またはその逆を構造的に排除する
- unclear points: なし（Q1/Q2で解消済み）
- assumptions:
  - 既存テンプレートA（coordinator）/B（worker-write）/C（worker-edit）の構造は変更しない
  - hookによる形式強制は本タスクの対象外（別タスクで対応）
  - feedback_prompt-format-hybrid.mdの内容を正式ルールとしてworkflow-delegation.mdに昇格させる

## artifacts

| # | file path | description |
|---|-----------|-------------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | 変更対象: ハイブリッド形式ルールセクションを追加 |

## next

research

## decisions

- addition location: workflow-delegation.mdの末尾に独立セクションとして追加 -- テンプレートA/B/Cの構造を壊さず、全テンプレートに横断適用されるルールとして配置するため
- scope of application: Agent委譲プロンプトとMCPツールパラメータの両方を対象とする -- delta_entry_format失敗はMCPパラメータ経由でも発生しており、片方だけでは防止が不完全なため
- template preservation: 既存テンプレートA/B/Cの4層構造（Why/What/How/Constraints）は変更しない -- 既に安定運用されており、形式ルールは補足的に追加すべきため
- rule granularity: 入力形式と出力形式の分離を明示的に記述する -- LLMは入力形式に引きずられて出力形式を変える傾向があり、明示的な指示が必要なため
- hook enforcement exclusion: hookによる自動検出/強制は本タスクのスコープ外とする -- ルールの文書化と自動強制は別の関心事であり、段階的に導入すべきため
- feedback graduation: feedback_prompt-format-hybrid.mdの知見を正式ルールとして昇格させる -- フィードバックとして蓄積された知見を恒久的な運用ルールに変換するため

## userResponse

userResponse: Q1=A(workflow-delegation.mdに追加), Q2=B(Agent委譲+MCPパラメータ両方を対象)

- Q1: workflow-delegation.mdのどこにルールを追加するか
  - A: workflow-delegation.mdに追加する。テンプレートとは別セクションとして末尾に配置し、全テンプレートに横断適用されるルールとする
- Q2: ルールの適用スコープ
  - B: Agent委譲プロンプトとMCPツールパラメータの両方を対象とする。delta_entry_formatの失敗事例はMCPパラメータ経由でも発生しており、両方をカバーしなければ出力形式伝染を防止できない
