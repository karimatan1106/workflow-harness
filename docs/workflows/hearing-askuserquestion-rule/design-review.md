# Design Review: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md に hearing フェーズセクション(3行)を追加する設計の全成果物レビュー。変更対象は単一ドキュメントファイルのみ。全 AC がトレース可能であり、設計上の矛盾はない。承認を推奨する。

## acDesignMapping

### AC-1: workflow-phases.md に hearing フェーズセクションが存在すること

- planning.md Step 2: L11 に `### Stage 0: hearing` 見出しを挿入する手順を定義
- ui-design.md after-state: 挿入後の L12 に `### Stage 0: hearing` が配置される構造を図示
- state-machine.mmd InsertSection: InsertAtL11 で 3行挿入の原子操作を定義
- flowchart.mmd InsertSection: scope_definition 直前への挿入フローを定義
- 検証レベル: L1 (見出し存在確認)

### AC-2: hearing セクションに hearing-worker エージェント指定が明記されていること

- planning.md Step 2 行2: 説明文に "hearing-worker agent" を含める設計
- ui-design.md content-specification: agent-type 要素として hearing-worker を明示
- state-machine.mmd ValidateFormat: CheckAgentMention サブステートで検証
- flowchart.mmd CheckAgentRef: hearing-worker 文字列の存在を判定ノードで検証
- 検証レベル: L4 (文字列検索)

### AC-3: hearing セクションに AskUserQuestion ツール使用ルールが明記されていること

- planning.md Step 2 行2: 説明文に "AskUserQuestion tool" を含める設計
- ui-design.md content-specification: tool 要素として AskUserQuestion を明示
- state-machine.mmd ValidateFormat: CheckToolMention サブステートで検証
- flowchart.mmd CheckToolRef: AskUserQuestion 文字列の存在を判定ノードで検証
- 検証レベル: L4 (文字列検索)

### AC-4: workflow-phases.md が200行以下を維持していること

- planning.md Step 3: 追加後 81行を期待値とし wc -l で検証する手順を定義
- research.md finding 1: 現行 78行、上限まで 122行の余裕を確認済み
- ui-design.md impact-on-existing-sections: 78行から 81行への増加を明示
- threat-model.md T-001: 200行制限超過リスクを低と評価、59%の余裕を記載
- 検証レベル: L1 (行数カウント)

### AC-5: hearing セクションの記述が他フェーズセクションと同一形式であること

- ui-design.md format-consistency: 5項目(見出し形式、作業概要、Output、DoD、行数)で既存フェーズとの一致を確認
- research.md finding 3: 既存フェーズの記述パターン(見出し + 1-3文 + Output + DoD)を分析済み
- planning.md Step 4: 形式整合性の確認手順を4項目で定義
- state-machine.mmd ValidateFormat: CheckHeadingPattern から CheckToolMention まで 5サブステートで形式検証
- 検証レベル: L4 (セクション構造の形式比較)

## reviewFindings

### RF-001: 設計成果物間の挿入内容の一貫性

planning.md Step 2 の挿入テキストと ui-design.md after-state の挿入テキストが文字レベルで一致している。hearing-worker agent、AskUserQuestion tool、Output: hearing.md、DoD: L1 exists + L4 の全要素が両成果物で同一である。

### RF-002: スコープ制限の明確性

scope-definition.md の out-of-scope 4項目(hook強制、テンプレート標準化、delegation.md変更、hearing-worker.md変更)が requirements.md notInScope と完全に対応している。hearing.md の D-HR-1 から D-HR-5 がスコープ決定の根拠として一貫して参照されている。

### RF-003: 脅威と AC の対応関係

threat-model.md の 5脅威が全て既存 AC でカバーされている。T-001 は AC-4、T-002 は AC-5、T-003 は AC-2/AC-3、T-004 は planning Step 1/5、T-005 は impact-analysis D-004。脅威固有の追加 AC は不要との判断(threat-model D-002)は妥当である。

### RF-004: 行番号の整合性

research.md(現行78行、L12がscope_definition)、planning.md(L11に挿入、結果81行)、ui-design.md(L12にhearing、L15にscope_definition)の行番号参照が全て整合している。research では L12 を scope_definition としているが、planning では L11 を挿入位置としており、これは空行(L11)への挿入でscope_definition(L12)を押し下げる操作として矛盾がない。

## decisions

- D-001: 全5 AC が複数の設計成果物でトレース可能であり、カバレッジに欠落はない
- D-002: planning.md と ui-design.md の挿入内容が文字レベルで一致しており、実装フェーズでの解釈ブレのリスクはない
- D-003: 変更対象が単一ファイル(workflow-phases.md)に限定されており、影響範囲は最小限である
- D-004: 脅威モデルの全脅威が既存 AC でカバーされており、追加の緩和策は不要である
- D-005: state-machine.mmd と flowchart.mmd が planning.md の Step 1-5 と対応しており、実装手順の可視化として十分である
- D-006: 200行制限に対し 81/200 (59%余裕) であり、将来のフェーズ追加に対する余地も確保されている
- D-007: hearing.md の D-HR-1 から D-HR-5 がスコープ境界の根拠として全成果物で一貫して参照されている

## artifacts

- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/hearing.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/scope-definition.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/research.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/impact-analysis.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/requirements.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/threat-model.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/planning.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/ui-design.md
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/state-machine.mmd
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/flowchart.mmd
- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/design-review.md (本ファイル)

## next

phase: implementation
action: planning.md Step 1-5 に従い workflow-phases.md の L11 に hearing セクション 3行を挿入する
