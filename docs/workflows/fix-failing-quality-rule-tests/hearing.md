# Hearing: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925
sessionToken: b0491af7b373b7da0bfc7b2d8907170f254464edf992887c9106ca3e4144b415

## summary

quality-rules.test.ts の10件のテストが失敗している。
原因は coordinator.md, worker.md, hearing-worker.md の3ファイルにテストが期待するルールテキストが不足していること。
各ファイルに必要なセクションとキーワードを追加することで全テストをパスさせる。

userResponse: ユーザーは修正方針を承認済み。3ファイル(coordinator.md, worker.md, hearing-worker.md)にテスト期待パターンに合致するルールセクションを追加する方針で進める。

## Intent

2つのテストファイルが期待するルールテキストが、対象の3つのagentファイルに不足している。
テストが要求するキーワード/セクションを追加して全テストをパスさせる。

## Gap Analysis

### coordinator.md (38行 -> 追加後も200行以内)

不足:
- `## Phase Output Rules` セクションが存在しない
- `decisions.*5件以上` パターンに該当するルールがcoordinator.mdに存在しない
- `artifacts.*列挙` に合致する記述がcoordinator.mdのartifactsルールにない
- `next.*空欄禁止` に適合するルールがcoordinator.mdのnextセクションにない

### worker.md (57行 -> 追加後も200行以内)

不足:
- `## Edit Completeness` セクションが存在しない
- `部分適用.*禁止` に一致するルールがworker.mdに存在しない
- `全件適用` を含むルールがworker.mdに未記載

### hearing-worker.md (27行 -> 追加後も200行以内)

不足:
- 確認のみ(Yes/No)の質問を禁止するルール (`確認.*禁止` or `confirmation.*prohibit`)
- 2つ以上の実質的に異なるアプローチを要求するルール (`2.*以上` + `異なる`)
- 各選択肢にメリット/デメリット記載を要求するルール (`メリット` + `デメリット`)

### defs-stage4.ts -- 変更不要 (全テストPASS)

## decisions

- D-001: coordinator.mdに `## Phase Output Rules` セクションを追加し、decisions/artifacts/nextに関するルールを記載する
- D-002: worker.mdに `## Edit Completeness` セクションを追加し、部分適用禁止と全件適用ルールを記載する
- D-003: hearing-worker.mdに `## AskUserQuestion Quality Rules` セクションを追加し、確認質問禁止/複数アプローチ/メリットデメリットのルールを記載する
- D-004: 各ルールテキストはテストの正規表現パターンに正確に合致する文言を使用する
- D-005: 各ファイルへの追加後も200行制限を維持する(coordinator.md約42行, worker.md約60行, hearing-worker.md約30行)

## artifacts

- hearing.md

## next

scope_definition
