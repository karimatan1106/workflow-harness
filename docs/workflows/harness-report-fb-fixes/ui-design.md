phase: ui_design
task: harness-report-fb-fixes
status: complete
inputArtifact: docs/workflows/harness-report-fb-fixes/planning.md

## Overview

本タスク(harness-report-fb-fixes)は4件のバックエンド内部ロジック修正であり、ユーザー向けUIコンポーネントの新規追加・変更は発生しない。全修正はMCPサーバー内部のTypeScriptモジュールに閉じており、CLIインターフェース、プロンプト出力、ユーザー操作フローに直接的な変更はない。

以下では、各修正がユーザー体験(UX)に与える間接的な影響を分析する。

## Indirect UX Impact Analysis

### IUI-1: readonlyフェーズでのcoordinator挙動変更 (FB-1+5 / F-001)

修正内容: readonlyフェーズ(hearing, scope_definition, research, impact_analysis, requirements)でcoordinatorのallowedToolsからWrite/Editを除外する。

ユーザー体験への影響:
- ユーザーからは直接見えない変更。coordinatorのsubagent起動時にツール制限が適用される内部処理。
- readonlyフェーズでcoordinator経由の誤ったファイル書き込みが防止されるため、フェーズ完了後の成果物整合性が向上する。
- 従来はreadonly違反がhookで検出されてエラーとなりリトライが発生していた。本修正でリトライ頻度が削減され、フェーズ進行がスムーズになる。

ユーザー操作の変更: なし。既存のワークフロー操作手順は維持される。

### IUI-2: content_validation改善によるfalse positive削減 (FB-2 / F-002)

修正内容: isStructuralLine()にテストケースID行パターン(TC-001:, AC-1:等)を追加する。

ユーザー体験への影響:
- DoD(Definition of Done)チェックでテストケースID行が重複行と誤判定されなくなる。
- 従来はTC-001:形式の行がcheckDuplicateLinesで引っかかり、DoDゲート失敗 → ユーザーにリトライを促すエラーメッセージが表示されていた。
- 本修正でfalse positiveが排除され、正当な成果物が一度のDoD検証でパスするようになる。
- ユーザーが体感する「ハーネスが理由不明で失敗する」事象が減少する。

ユーザー操作の変更: なし。DoDチェックは自動実行されるためユーザー操作に影響しない。

### IUI-3: RTM upsert動作によるエラー防止 (FB-4 / F-003)

修正内容: applyAddRTM()を無条件pushからupsert(findIndex+splice)に変更する。

ユーザー体験への影響:
- ユーザー(またはcoordinator)がharness_add_rtmを同一IDで再実行してもエラーにならない。
- 従来は同一IDで再登録すると重複エントリが生成され、後続のharness_update_rtm_statusで予期しない動作が発生する可能性があった。
- 冪等性が確保されるため、セッション回復時やリトライ時の安全性が向上する。
- ユーザーが意識的にRTMを再登録する操作シナリオ(修正内容の更新)も正常動作する。

ユーザー操作の変更: なし。harness_add_rtm MCPツールの呼び出しインターフェースは変更されない。

### IUI-4: harness_back後のartifact_driftエラー解消 (FB-6 / F-004)

修正内容: goBack()でstate.artifactHashes = {}を追加する。

ユーザー体験への影響:
- ユーザーがharness_backでフェーズを戻した後、再実行時にartifact_driftエラーが発生しなくなる。
- 従来はgoBack後に古いartifactHashesが残存し、新しい成果物との不一致でDoDゲートが失敗していた。
- フェーズ巻き戻し → 再実行のワークフローが確実に動作するようになり、ユーザーの手動介入(state.jsonの直接編集等)が不要になる。
- harness_backの信頼性向上により、ユーザーが安心してフェーズ巻き戻しを利用できる。

ユーザー操作の変更: なし。harness_back MCPツールの呼び出しインターフェースは変更されない。

## UX Metrics Impact (Estimated)

| Metric | Before | After | Improvement |
|---|---|---|---|
| readonlyフェーズでのhook違反リトライ | 発生あり | 発生なし | リトライ削減 |
| DoD false positive発生率 | テストケースID行で発生 | 発生しない | false positive排除 |
| RTM重複登録エラー | 同一ID再登録でエラー | upsertで正常処理 | エラー排除 |
| harness_back後のartifact_drift | 発生あり | 発生なし | エラー排除 |

## Screen / Component Changes

変更対象のUIコンポーネント: なし

本タスクの全修正はMCPサーバー内部ロジック(TypeScript)に閉じており、以下のUIレイヤーへの変更は発生しない:
- CLIコマンドの追加・変更: なし
- MCPツールの入出力スキーマ変更: なし
- エラーメッセージ文言の変更: なし
- プロンプトテンプレートの変更: なし

## decisions

- UID-001: 全4件がバックエンド内部修正のため、UIコンポーネントの新規設計・変更は不要と判断
- UID-002: ユーザー体験への影響は全て間接的(エラー削減・リトライ削減)であり、操作フローの変更は発生しない
- UID-003: MCPツールの入出力スキーマは維持される。harness_add_rtmの戻り値やエラーコードに変更なし
- UID-004: DoDゲートのエラーメッセージは既存フォーマットを維持。false positiveが減少するのみ
- UID-005: harness_backの操作手順・確認プロンプトに変更なし。内部のstate初期化ロジックのみ改善
- UID-006: 4件の修正による間接的UX改善は全てリグレッションテストで検証可能。専用のUIテストは不要

## artifacts

- docs/workflows/harness-report-fb-fixes/ui-design.md (this file)
- docs/workflows/harness-report-fb-fixes/planning.md (input)
- docs/workflows/harness-report-fb-fixes/requirements.md (reference)

## next

design_reviewフェーズでui-design.mdの間接UX影響分析がAC-1〜AC-5の要件と整合していることを検証する。
