# Design Review: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: design_review
size: large

## レビュー結果

全設計成果物を確認。2ファイルのテキスト変更のみで低リスク。設計判断は妥当。

## 要件との整合性

AC-1(確認形式禁止): hearing-worker.mdにQuality Rulesセクションを新設し明示的に禁止。PL-001で対応。
AC-2(2案以上): 同セクションで「2+ substantively different approaches」を要求。PL-001で対応。
AC-3(メリット・デメリット): 同セクションで「trade-off: at least one merit and one demerit」を要求。PL-002で対応。
AC-4(具体的ルール): defs-stage0.tsに悪い例・良い例付きルールを追加。PL-004/UID-003で対応。
AC-5(hearing-worker.md 200行以下): 現在27行、7行追加で34行。余裕あり。PL-006相当。
AC-6(defs-stage0.ts 200行以下): 現在44行、3行追加で47行。余裕あり。PL-006で対応。
AC-7(テスト維持): PL-005でアサーションキーワード維持を確認済み。テスト更新不要。

## 設計品質評価

二重制約(UID-005): エージェント定義(永続ルール)+テンプレート(フェーズ指示)の2層で品質を担保。LLMがテンプレートを軽視してもエージェント定義が制約として残る。妥当な設計。

具体例活用(UID-003): 悪い例と良い例をテンプレートに含めることでLLMの出力品質を向上。抽象ルールのみの前回FIX-1では効果がなかった教訓を反映。

スキーマ非変更(UID-001): AskUserQuestionスキーマの変更なしは正しい判断。品質の意味解析はL5(LLM判断)に該当しL1-L4ゲート方針に反する。

## 懸念事項

なし。テキスト変更のみで技術リスクなし。唯一の不確実性はLLMの指示遵守率だが、これは本変更で新たに導入されるリスクではなく、二重制約で軽減される。

## acDesignMapping

- AC-1: hearing-worker.md Quality Rulesセクション — 確認形式禁止ルール (PL-001, UID-002)
- AC-2: hearing-worker.md Quality Rulesセクション — 2案以上の実質的選択肢要求 (PL-001, UID-002)
- AC-3: hearing-worker.md Quality Rulesセクション — トレードオフ明記要求 (PL-002, UID-002)
- AC-4: defs-stage0.ts hearingテンプレート指示 — 具体例付き品質ルール (PL-004, UID-003)
- AC-5: hearing-worker.md 行数確認 — 現在27行+7行=34行 (PL-006)
- AC-6: defs-stage0.ts 行数確認 — 現在44行+3行=47行 (PL-006)
- AC-7: hearing-template.test.ts アサーション互換性 — PL-005で確認済み

## decisions

- DR-001: 全7ACが設計成果物でカバーされていることを確認。未対応ACなし。
- DR-002: 二重制約設計(UID-005)を承認。前回FIX-1のテンプレートのみの変更が効果不十分だった実績に基づく妥当な判断。
- DR-003: 具体例(悪い例・良い例)のテンプレート挿入を承認。LLMは抽象ルールより具体例に従う傾向がある。
- DR-004: テスト更新不要の判断を承認。既存アサーションキーワードが新テキストに含まれることをPL-005で確認済み。
- DR-005: 設計成果物間の整合性を確認。planning.mdのold_string/new_stringがui-design.mdの設計仕様と一致。

## artifacts

- docs/workflows/hearing-worker-real-choices/design-review.md: report: 全AC対応確認、二重制約設計承認、テスト更新不要確認

## next

- criticalDecisions: DR-002(二重制約承認)、DR-003(具体例活用承認)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts
- warnings: なし
