# Hearing: harness-template-reliability

taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
phase: hearing
size: large

## userResponse

Q1: FIX-3(artifact_drift re-approval半自動化)の実装方針は？
A1: A — cascade-reapproveオプション追加。harness_backに--cascadeフラグを追加し、戻り先から現在フェーズまで自動で再承認を実行する。

Q2: FIX-5(completed滞留アラート)の閾値は？
A2: A — 1時間(3600s)。completedに1時間以上滞留した場合にanalytics adviceに警告を出力。

userResponse: Q1=A(cascade-reapproveオプション追加), Q2=A(3600s閾値)

## summary

3タスク横断分析に基づくハーネス信頼性改善5件の実装方針をユーザーと合意した。

FIX-1: hearingテンプレートにuserResponse TOONキー形式を明示例示する
FIX-2: testing→regression_test間のbaseline_capture未実行を検出しリマインドを追加する
FIX-3: harness_backにcascade-reapproveオプションを追加し、artifact_drift検出時の再承認チェーンを半自動化する
FIX-4: テンプレートのTOON/MD出力形式統一ガイダンスを強化する
FIX-5: completedフェーズが3600s以上滞留した場合にanalytics adviceに警告を出力する

## decisions

- HR-001: 全5件(FIX-1〜FIX-5)を実装対象とする。3タスクの横断分析で再現性が確認されたエラーパターンを全て解消するため。
- HR-002: FIX-3はcascade-reapproveオプション方式を採用。drift検出時の完全自動化は意図しない再承認リスクがあるため、明示的なフラグ指定を要求する設計とする。
- HR-003: FIX-5の閾値は3600s(1時間)とする。hearing-askuserquestion-ruleの13,810sやdocs-workflows-refactoring-v2の31,729sの滞留を検出しつつ、短時間タスクの誤検知を回避するバランス。
- HR-004: FIX-1とFIX-4はテンプレート生成部の修正で、同一ファイル群への変更となるためセットで実装する。
- HR-005: FIX-2はdod-l1-l2.tsのbaseline_requiredチェックまたはtestingフェーズ完了時のリマインド追加で実現する。

## artifacts

- docs/workflows/harness-template-reliability/hearing.md: spec: ユーザーヒアリング結果。FIX-3はcascade-reapprove方式、FIX-5は3600s閾値で合意。

## next

- criticalDecisions: HR-002(cascade-reapprove方式採用)、HR-003(3600s閾値)
- readFiles: workflow-harness/mcp-server/src/phases/definitions-hearing.ts, workflow-harness/mcp-server/src/commands/harness-back.ts, workflow-harness/mcp-server/src/analytics/phase-analytics.ts
- warnings: FIX-3はharness-back.tsの既存シグネチャ変更を伴うため影響範囲の調査が必要
