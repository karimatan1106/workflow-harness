# Scope Definition: harness-detailed-error-analytics

## overview

phase-analytics.toon生成時にphase-errors.toonの全エントリをerrorHistory配列として展開出力する。DoD失敗時には全check結果(passed含む)をphase-errors.toonに蓄積し、完了時にphase-analytics.toonへ集約する。TOON形式自体の変更は行わない。

## decisions

- errorHistory配列はphase-analytics.toon内に配置する（ファイル分散を回避し、分析データを一箇所に集約）
- 全checks(passed/failed両方)を記録する（パス率計算やパターン分析にpassed情報が必須）
- TOON形式の拡張は行わない（既存toonEncodeでkey-value配列をそのまま出力可能）
- phase-errors.toonへの書き込み時点で全check結果を保存する（生成時変換ではなくソースデータの充実化）
- errorHistory配列の各要素はphase-errors.toonエントリと1:1対応とする（データ整合性を型レベルで保証）
- サマリ(errorAnalysis)と全履歴(errorHistory)を並列保持する（高速概要把握と詳細分析の両立）
- DoDCheckResult型の既存構造(level, check, passed, evidence)をそのまま活用する（新型定義不要）

## in-scope

- error-toon.ts: appendErrorToon()に全checks配列(passed含む)の保存を追加
- error-toon.ts: DoDFailureEntryの型定義にallChecks(passed含む)フィールドを追加
- phase-analytics.ts: buildErrorAnalysis()にerrorHistory配列の構築ロジックを追加
- analytics-toon.ts: writeAnalyticsToon()にerrorHistory配列のTOON出力を追加
- lifecycle-next.ts: buildDoDFailureResponse()からappendErrorToonへ全checks配列を渡す
- dod-types.ts: 必要に応じてDoDFailureEntry型の拡張

## out-of-scope

- TOON形式(toonEncode/toonDecode)自体の変更
- observability-events.toonとの統合
- observability-trace.toonの変更
- UI/CLI表示の変更
- phase-metrics.toonの変更
- errorHistory配列のサイズ上限制御

## target-files

- workflow-harness/mcp-server/src/tools/error-toon.ts (50行) -- phase-errors.toon読み書き、DoDFailureEntry型
- workflow-harness/mcp-server/src/tools/phase-analytics.ts (167行) -- buildAnalytics()、buildErrorAnalysis()
- workflow-harness/mcp-server/src/tools/analytics-toon.ts (65行) -- writeAnalyticsToon()、TOON出力
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts (199行) -- DoD失敗時のappendErrorToon呼び出し
- workflow-harness/mcp-server/src/gates/dod-types.ts (21行) -- DoDCheckResult/DoDResult型定義
- workflow-harness/mcp-server/src/gates/dod.ts (82行) -- runDoDChecks()、全check結果生成元

## artifacts

- phase-analytics.toon -- errorHistory配列が追加された出力ファイル
- phase-errors.toon -- allChecks(passed含む)が各エントリに含まれるデータソース
- scope-definition.md -- 本ドキュメント

## constraints

- 全ファイル200行以下を維持
- TOON形式の既存スキーマを破壊しない
- phase-errors.toonの既存エントリとの後方互換性を維持（allChecksは任意フィールド）
- DoDCheckResult型の既存フィールド(level, check, passed, evidence, fix, example)を変更しない
- errorHistory配列のサイズ上限は設けない（フェーズ完了時の一括生成のため）

## risks

- error-toon.tsの行数増加（現50行、全checks保存で+15行程度、200行以内に収まる）
- phase-analytics.tsの行数増加（現167行、errorHistory構築で+20行程度、責務分割が必要になる可能性）
- allChecksフィールド追加による既存readErrorToon()の互換性（任意フィールドとすることで回避）

## next

- researchフェーズでerror-toon.tsの現行DoDFailureEntry型とappendErrorToon()の引数を確認
- phase-analytics.tsのbuildErrorAnalysis()の現行ロジックを調査し、errorHistory挿入ポイントを特定
- analytics-toon.tsのtoonEncode呼び出し箇所でerrorHistory配列の出力形式を確認
- lifecycle-next.tsのbuildDoDFailureResponse()内でDoDResult.checksの渡し方を確認
- phase-analytics.tsが200行を超える場合の責務分割方針を検討
