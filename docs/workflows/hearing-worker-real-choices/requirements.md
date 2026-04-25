# Requirements: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: requirements
size: large
intent: hearing-workerが実質1択の確認形式(「全決定委任(A)で進めてよいですか？」型)を出す問題を修正。各質問に対して実質的に異なる選択肢を提示し、推奨案のみの確認形式を禁止する。hearing-worker.mdエージェント定義とdefs-stage0.tsテンプレートの両方を修正対象とする。

## acceptanceCriteria

- AC-1: hearing-worker.mdに「推奨案のみの確認形式禁止」ルールが明記されていること
- AC-2: hearing-worker.mdに「各質問に実質的に異なる2案以上」ルールが明記されていること
- AC-3: hearing-worker.mdに「各選択肢にメリット・デメリット明記」ルールが明記されていること
- AC-4: defs-stage0.tsのhearingテンプレートに具体的な選択肢品質ルールが含まれること(抽象的な「2個以上」ではなく具体例付き)
- AC-5: 変更後のhearing-worker.mdが200行以下であること
- AC-6: 変更後のdefs-stage0.tsが200行以下であること
- AC-7: 既存テスト(hearing-template.test.ts)が変更後も全てパスすること、または文言変更に合わせてテストが更新されていること

## decisions

- REQ-001: F-001 hearing-worker.mdにAskUserQuestion品質ルールセクションを追加。禁止パターン(確認形式)と必須パターン(トレードオフ明示)を明記。
- REQ-002: F-002 defs-stage0.tsのhearing指示を具体化。現在の1行指示を具体例付きの品質ルールに書き換え。
- REQ-003: F-003 hearing-template.test.tsの文言アサーションを更新。defs-stage0.tsの指示変更に追従。
- REQ-004: 禁止パターンの明示: 「Aで進めてよいですか」「全決定委任」のような実質1択は禁止。
- REQ-005: 必須パターンの明示: 各選択肢にメリット・デメリットを含むトレードオフ説明を付与。

## artifacts

- docs/workflows/hearing-worker-real-choices/requirements.md: spec: AC-1~AC-7の受入基準とF-001~F-003の機能要件定義。

## next

- criticalDecisions: REQ-001(エージェント定義レベルの制約が核心)、REQ-004(禁止パターンの明示)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts, workflow-harness/mcp-server/src/__tests__/hearing-template.test.ts
- warnings: hearing-template.test.tsのアサーション変更が必要になる可能性

## notInScope

- coordinator.mdの変更(hearing-workerへの委譲ロジックは変更しない)
- toon-skeletons-a.tsの変更(前回FIX-1のuserResponseキーはそのまま)
- dod-l2-hearing.tsの変更(DoD検証ロジックは変更しない)
- hearingフェーズ以外のテンプレート変更

## openQuestions

なし
