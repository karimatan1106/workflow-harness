# Research: agent-delegation-prompt-templates

## サマリー

調査対象9ファイルのうち8ファイルが存在し、workflow-delegation.mdのみ未存在（新規作成予定）を確認した。
現在の委譲構造は3つのagentファイル(coordinator/worker/hearing-worker)が個別にRole/Context Handoff/Result Formatを定義し、tool-delegation.mdが許可ツールを列挙する形式。
フェーズ別の具体的なPrompt Contract（入力/出力/制約の明示的テンプレート）は存在せず、workflow-execution.mdのsubagent設定表とworkflow-phases.mdのフェーズ記述が暗黙的にその役割を担っている。
4層テンプレート（Goal/Context/Constraints/Output Format）導入により、散在する委譲情報を構造化し、DoDリトライを削減できる見込みがある。

## ユーザー意図の分析

- surface: 委譲プロンプトのテンプレート化による構造化
- deep: DoDリトライ削減による実行時間半減。subagentが初回で正しい成果物を生成する確率を上げる
- unclear: なし
- assumptions:
  - 4層テンプレートとは Goal / Context / Constraints / Output Format の4セクションを指す[推測]
  - 変更対象の6ファイルとは coordinator.md, worker.md, hearing-worker.md, tool-delegation.md, workflow-phases.md, workflow-delegation.md(新規) を指す[推測]
  - workflow-delegation.md は新規ファイルとして .claude/skills/workflow-harness/ 配下に配置される前提

## 現在の構造分析

### workflow-phases.md (79行)

- フォーマット: YAMLフロントマター + 8ステージ構成の散文記述
- 各フェーズの記述パターン: `### Stage N: phase_name` → 1-3行の作業内容 → `Output:` → `DoD:` → `Gate:`(一部)
- Whyの記述: なし。全てWhat/Howの記述
- 特徴: フェーズごとの入力ファイルの明示がない（workflow-execution.mdの表にある）
- テンプレート関連: subagentへの委譲指示は含まれていない。作業内容の定義のみ

### coordinator.md (38行)

- YAMLフロントマター: name, description, tools(Read/Glob/Grep/Bash/Skill/ToolSearch), model(inherit), maxTurns(30)
- Role: 4項目（分析、分解、ファイル書き出し、L1への報告）
- Context Handoff: 入力元と出力先のルール
- On Hook Error: BLOCKED返却ルール
- Result Format: [OK]/[FAIL]の定型
- On Completion: 返却物リスト
- Prompt Contractの有無: なし。フェーズ固有の指示は一切含まれない汎用定義

### worker.md (57行)

- YAMLフロントマター: name, description, tools(Read/Write/Edit/Glob/Grep/Bash), model(inherit), maxTurns(15)
- Role: 3項目（ファイル操作実行、読み書き、結果返却）
- Edit Modes: direct-edit(デフォルト)とedit-previewの2モード。edit-previewのプロトコルが詳細に記述されている
- Context Handoff: coordinatorの出力ファイルを入力とする
- On Hook Error: BLOCKED返却 + 代替案提案
- Prompt Contractの有無: なし。editモードの選択指示のみ

### hearing-worker.md (27行)

- YAMLフロントマター: name, description, tools(Read/Write/Edit/Glob/Grep/Bash/AskUserQuestion), model(inherit), maxTurns(15)
- Role: 4項目（意図分析、AskUserQuestion、コードベース調査、hearing.md生成）
- AskUserQuestion Guidelines: 4ルール（最大4問、2-4選択肢、推奨マーク、分割戦略）
- Result Format: [OK]/[FAIL]
- Prompt Contractの有無: なし。hearing固有だがフェーズ横断の汎用性は低い

### tool-delegation.md (8行)

- 箇条書き6項目の簡潔なルール定義
- 内容: オーケストレーターのツール制限、許可ツールリスト、Edit運用、Coordinator/Worker役割、コンテキスト中継方式
- テンプレート関連記述: なし
- 課題: 委譲時のプロンプト構造については一切触れていない

### workflow-delegation.md

- 存在しない（新規作成予定）
- 配置先: .claude/skills/workflow-harness/ 配下が適切（SKILL.mdのFile Indexに追加が必要）

### 関連ファイル

#### workflow-rules.md (113行)
- 委譲関連ルール:
  - Rule 5(Prohibited): "Write subagent prompts from scratch -- use server templates" — テンプレート使用の強制ルールが既に存在
  - Rule 21(AI Directives): バリデーション失敗時のsubagent再起動ルール
  - Retry Protocol(Section 3): 5段階のリトライ戦略。buildRetryPrompt関数への言及あり
- エラー種別→改善要求変換: workflow-execution.mdに5パターンの変換表あり

#### workflow-gates.md (63行)
- L1-L4の定義表
- フェーズ別DoD表: 全フェーズのL1/L2/L3/L4チェック項目を網羅
- UI-1~UI-7ポリシー
- Constraints源泉: DoDの各L3/L4チェック項目がテンプレートのConstraintsセクションに直接転記可能

#### workflow-execution.md (72行)
- フェーズ別subagent設定表: model/delegation/入力/出力の4列
- subagent委譲時の必須コンテキスト(Section末尾): taskId, sessionToken, docsDir, Markdown形式, ファイル名規則, 必須キー — これが現在の「暗黙的テンプレート」に最も近い
- フェーズ別編集可能ファイル表: Constraintsの材料

#### SKILL.md (113行)
- File Index(Section 2): 9ファイル853行の一覧表。workflow-delegation.md追加時はここを更新
- File Routing(Section 1): ステージ別の読み込みファイル表。新ファイルのルーティング追加が必要
- Growth Protocol(Section 6): 200行制限のガイドライン

## 4層テンプレート導入の影響分析

### 高インパクト（構造変更）

1. **workflow-delegation.md（新規）**: 4層テンプレートの定義本体。Goal/Context/Constraints/Output Formatのフェーズ別テンプレートを格納。SKILL.mdのFile Indexに追加要。推定80-150行。
2. **workflow-phases.md**: 各フェーズ記述にテンプレートへの参照を追加。または、テンプレート情報をworkflow-delegation.mdに移動しphases.mdは作業内容のみに絞る（現状の方針に合致）。

### 中インパクト（参照追加・整合性）

3. **coordinator.md**: Role定義にPrompt Contract遵守の記述を追加。テンプレートの読み込み・展開がcoordinatorの責務であることを明記。
4. **worker.md**: Output Format遵守の記述を追加。テンプレートで指定されたフォーマットに従う義務を明記。
5. **tool-delegation.md**: テンプレート使用の義務を追記（workflow-rules.md Prohibited#5と整合させる）。

### 低インパクト（参照のみ）

6. **hearing-worker.md**: hearing固有テンプレートへの参照追加のみ。
7. **SKILL.md**: File Index更新 + File Routing表への追加。
8. **workflow-execution.md**: subagent委譲時の必須コンテキストセクションをテンプレート参照に置換可能。

## decisions

- D-01: workflow-rules.md Prohibited#5に "use server templates" ルールが既に存在する — 4層テンプレートはこのルールの具体的実装となる
- D-02: workflow-execution.md末尾の「subagent委譲時の必須コンテキスト」(5項目)が現在の暗黙的テンプレート — 4層テンプレートのContext/Constraintsの原型
- D-03: workflow-delegation.mdの配置先は .claude/skills/workflow-harness/ — SKILL.mdのFile RoutingでAgent起動時に読み込む設定にする
- D-04: 200行制限(SKILL.md Growth Protocol)により全30フェーズを1ファイルに収めるにはフェーズグループ単位でのテンプレート定義が必要
- D-05: 3つのagentファイルは現状フェーズ非依存の汎用定義 — テンプレートはworkflow-delegation.mdに集約し、agentファイルからは参照のみ
- D-06: workflow-gates.mdのDoD表(L1-L4)がConstraints層の主要情報源 — フェーズごとのL3/L4チェック項目をConstraintsに転記することでDoD初回通過率が向上
- D-07: テンプレート導入でスキルファイル総行数が増加(推定+80-150行) — コンテキストウィンドウへの影響を要考慮

## artifacts

| # | ファイル | 状態 | 行数 |
|---|---------|------|------|
| 1 | .claude/skills/workflow-harness/workflow-phases.md | 既存 | 79 |
| 2 | .claude/agents/coordinator.md | 既存 | 38 |
| 3 | .claude/agents/worker.md | 既存 | 57 |
| 4 | .claude/agents/hearing-worker.md | 既存 | 27 |
| 5 | .claude/rules/tool-delegation.md | 既存 | 8 |
| 6 | .claude/skills/workflow-harness/workflow-delegation.md | 未存在（新規） | - |
| 7 | .claude/skills/workflow-harness/workflow-rules.md | 既存(参照) | 113 |
| 8 | .claude/skills/workflow-harness/workflow-gates.md | 既存(参照) | 63 |
| 9 | .claude/skills/workflow-harness/SKILL.md | 既存(参照) | 113 |
| 10 | .claude/skills/workflow-harness/workflow-execution.md | 既存(参照) | 72 |

## next

- requirementsフェーズでAC定義
