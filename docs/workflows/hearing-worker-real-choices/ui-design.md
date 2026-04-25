# UI Design: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: ui_design
size: large

## 設計概要

本タスクはMCPツールスキーマやUIコンポーネントの変更を伴わない。hearing-workerエージェント定義とhearingテンプレートのテキスト変更のみ。AskUserQuestionツールのスキーマ自体は変更しない。

## hearing-worker.md追加セクション設計

セクション名: AskUserQuestion Quality Rules
配置位置: 既存Guidelinesセクションの後、Result Formatセクションの前
理由: Guidelinesが操作手順(何を使うか)、Quality Rulesが品質基準(どう使うか)、Result Formatが出力形式という論理的順序

追加内容(3ルール):
1. 確認形式禁止: 「Shall I do X?」「Xで進めてよいですか？」型の質問を禁止。各質問に実質的に異なる2案以上を提示。
2. トレードオフ必須: 各選択肢にメリットとデメリットを最低1つずつ明記。推奨案(Recommended)にもデメリットを記載。
3. 推奨案のデメリット開示: 推奨案の短所を隠すとユーザー信頼を損なう。

## defs-stage0.ts テンプレート指示設計

置換対象: 24行目「AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。」
置換後: 4行の具体的ルール(必須条件+禁止条件+悪い例+良い例)

テンプレート内の位置は変更しない。subagentTemplate文字列内のhearing固有指示ブロック内に留まる。

悪い例の形式: 「テストを追加しますか？ [はい / いいえ]」— 実質1択の確認パターン
良い例の形式: 「テスト戦略: A) ユニットテスト中心（速い・カバレッジ浅い） B) 統合テスト中心（遅い・信頼性高い）」— トレードオフ明示の選択パターン

## AskUserQuestionツールスキーマ

変更なし。既存のスキーマ(options配列、label/description必須、2-4オプション、multiSelect対応)はそのまま維持。品質はスキーマではなくプロンプト指示で制御する設計方針。

## テスト影響

hearing-template.test.ts:
- TC-AC2-01: /AskUserQuestion/iと/必須/をアサート。新テキストに「必須」が含まれるためPASS。
- TC-AC2-02: /選択肢.*2/をアサート。新テキストに「選択肢は2個以上」が含まれるためPASS。
- TC-AC1-01, TC-AC7-01: 変更行に無関係。PASS。

## decisions

- UID-001: AskUserQuestionツールスキーマは変更しない。品質制御はプロンプト指示レベルで行う。スキーマレベルでの品質強制はオプション内容の意味解析が必要でL5(LLM判断)に該当するため採用しない。
- UID-002: hearing-worker.mdのQuality Rulesセクションは3ルール構成。確認形式禁止、トレードオフ必須、推奨案デメリット開示の3点で網羅的に品質を担保。
- UID-003: defs-stage0.tsのテンプレート指示は悪い例・良い例を含める。LLMは具体例から学習するため、抽象的ルールより具体例が効果的。
- UID-004: テスト更新は不要と判断。既存アサーションのキーワード(必須、選択肢、2)が新テキストに含まれる。
- UID-005: 2ファイルの二重制約設計を採用。エージェント定義(永続的ルール)とテンプレート(フェーズ固有指示)の両方で制約することで、一方が無視されても他方がカバー。

## artifacts

- docs/workflows/hearing-worker-real-choices/ui-design.md: design: hearing-worker.md QualityRulesセクション設計とdefs-stage0.tsテンプレート指示強化設計

## next

- criticalDecisions: UID-001(スキーマ変更なし)、UID-003(具体例付き指示)、UID-005(二重制約)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts
- warnings: なし
