# Hearing: harness-detailed-error-analytics

userResponse: Q1:A(phase-analytics.toon内にerrorHistory追加), Q2:B(全checks記録), Q3:既存TOON形式維持(拡張不要)

## overview

harness-detailed-error-analyticsタスクは、ハーネスのDoDチェック失敗時のエラー情報を詳細に記録・分析する機能を実装する。phase-errors.toonに蓄積された生データをphase-analytics.toon内のerrorHistory配列として展開し、passed/failedの全チェック結果を保持することで、エラーパターンの分析と再発防止を可能にする。

## user-responses

Q1: A -- phase-analytics.toon内にerrorHistory配列を追加（サマリと全履歴を並列保持）
Q2: B -- 全checks(passed含む)を記録
Q3: 既存TOON形式のまま拡張不要。phase-errors.toonをそのまま活用する

## decisions

- エラー履歴の格納先はphase-analytics.toon内のerrorHistory配列とする（既存ファイルへの集約、ファイル分散を回避）
- 全checks（passed含む）を記録する（失敗のみでは文脈が失われ、パス率やパターン分析が不可能になるため）
- TOON形式の拡張は行わない（phase-errors.toonの既存形式をそのまま活用）
- phase-errors.toonの生データをphase-analytics.toon生成時に展開する（リアルタイム変換ではなく生成時変換）
- サマリと全履歴を並列保持する（サマリで高速な概要把握、全履歴で詳細分析を両立）
- errorHistory配列の各要素はphase-errors.toonのエントリと1:1対応とする（データ整合性の保証）

## scope

- phase-analytics.toon生成ロジックにerrorHistory配列の出力を追加
- phase-errors.toonからのデータ読み込み・展開処理
- 全チェック結果（passed/failed）の記録フォーマット定義
- サマリ情報（エラー率、頻出パターン等）の並列出力
- errorHistoryエントリのタイムスタンプ・フェーズ名・チェック名を含む構造化データ設計

## artifacts

- phase-analytics.toon（errorHistory配列追加）
- phase-errors.toon（既存、変更なし、データソースとして参照）
- エラー展開処理の実装ファイル（analytics生成ロジック内）

## constraints

- TOON形式の既存仕様を破壊しない
- phase-errors.toonのスキーマ変更なし
- 全ファイル200行以下
- errorHistory配列のサイズ上限は設けない（フェーズ完了時の一括生成のため）
- passed/failedの記録形式は既存checksフィールドとの互換性を維持

## next

- researchフェーズでphase-analytics.toonとphase-errors.toonの現行スキーマを調査
- errorHistory配列のフィールド定義を確定
- サマリ計算ロジックの設計
- analytics生成処理の既存コードパスを特定し、errorHistory出力の挿入ポイントを決定
- passed checksの記録が既存のphase-errors.toon書き込みフローに影響しないことを確認
