# Docs Update: harness-template-reliability

taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
phase: docs_update
size: large

## 変更サマリー

本タスクは3タスク横断分析に基づくハーネス信頼性改善5件を実装した。

FIX-1: hearingテンプレートにuserResponse TOONキーを明示追加。AskUserQuestion呼び出し必須化と選択肢2個以上の要求を追加。SUMMARY_SECTIONフラグメントを追加。対象: toon-skeletons-a.ts, defs-stage0.ts

FIX-2: testingフェーズテンプレートにbaseline_captureリマインドを追加。regression_testフェーズでのベースライン未記録問題を予防。対象: defs-stage5.ts

FIX-3: harness_backツールにcascadeオプショナルパラメータを追加。cascade=true時にPHASE_APPROVAL_GATESを参照し承認エントリを削除。後方互換性維持(cascade未指定時は従来動作)。対象: defs-a.ts, scope-nav.ts

FIX-4: SUMMARY_SECTION_RULEにフィールド順序ガイダンスを追加(phase→status→summary→配列→decisions→artifacts→next)。DoD L4チェック走査順序と一致。対象: definitions-shared.ts

FIX-5: phase-analyticsにcompletedフェーズ滞留検出を追加。閾値3600秒超過時に警告advice出力。対象: phase-analytics.ts

## ドキュメント影響分析

CLAUDE.md: 変更不要。FIX-1~FIX-5はコード変更であり設計方針やルールに影響しない。

ADR: 新規ADR不要。全FIXは既存設計方針(ADR-001 L1-L4ゲート、ADR-002 フェーズ圧縮)の範囲内。

スキルファイル: 変更不要。workflow-phases.mdやworkflow-gates.mdの記述に影響する変更なし。

README/外部ドキュメント: 変更不要。MCP内部ツール変更であり外部ユーザー向けドキュメントに影響なし。

## テスト追加

4テストファイル新規追加(11テストケース):
- hearing-template.test.ts: TC-AC1-01, TC-AC2-01, TC-AC2-02, TC-AC7-01
- testing-template.test.ts: TC-AC3-01
- phase-analytics-stale.test.ts: TC-AC8-01, TC-AC8-02
- harness-back-cascade.test.ts: TC-AC4-01, TC-AC5-01, TC-AC9-01, TC-AC10-01

## decisions

- DU-001: CLAUDE.mdの更新は不要と判断。FIX-1~FIX-5は全てコードレベルの変更で設計方針やワークフロールールに影響しない。
- DU-002: 新規ADRは不要と判断。全FIXは既存ADR-001(L1-L4ゲート)とADR-002(フェーズ圧縮)の範囲内で実装。
- DU-003: スキルファイルの更新は不要と判断。workflow-phases.mdやworkflow-gates.mdの記述に影響する変更なし。
- DU-004: 外部ドキュメント更新は不要と判断。MCP内部ツールスキーマ変更は外部ユーザーに非公開。
- DU-005: テスト追加ファイル4本は既存テストディレクトリのパターンに従い命名。追加ドキュメント不要。

## artifacts

- docs/workflows/harness-template-reliability/docs-update.md: report: FIX-1~FIX-5の変更サマリーとドキュメント影響分析。既存ドキュメントへの変更不要と判断。

## next

- criticalDecisions: DU-001(CLAUDE.md変更不要)、DU-002(ADR不要)
- readFiles: なし
- warnings: FIX-3 cascadeパラメータが将来外部公開される場合はAPIドキュメント更新が必要
