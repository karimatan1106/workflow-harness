# Requirements: harness-analytics-improvement

phase: requirements
task: harness-analytics-improvement
status: complete

## summary

phase-analytics.toonの分析結果を4軸で改善する。現状の問題: (1) topFailure精度(count降順ソート)が欠如しoutput_file_existsに偏る (2) tdd_red_evidenceアドバイスルールが存在せず17回失敗の原因が不明 (3) bottlenecksにセッション中断の壁時計時間が含まれる (4) errorHistoryが活用されていない。対策として、topFailure集計のソート修正と重み付け、IQR法による外れ値検出、tdd_red_evidence向けadviceルール追加、失敗パターン分類(recurring/cascading/one-off)とフェーズ間相関を実装する。

## functionalRequirements

### FR-1: topFailure集計のソート修正と重み付け (-> AC-1, F-001)

buildErrorAnalysis()のfailures配列をcount降順でソートし、topFailureが実際の最頻失敗チェックを反映する。同countの場合はL2+チェックをL1チェックより優先する重み付けを導入する。

変更対象: phase-analytics.ts buildErrorAnalysis関数 L82付近
根拠: failures配列がMap挿入順のままであり、最初に検出されたL1チェック(output_file_exists)が常にtopFailureになる問題の修正

### FR-2: IQR法による外れ値検出 (-> AC-2, F-002, F-006)

outlier-detection.tsにIQR法(四分位範囲)による外れ値検出関数detectOutliers()を新規実装する。findBottlenecks()から呼び出し、セッション中断による壁時計時間の異常値をoutlierとしてフラグ付けする。

新規ファイル: src/analytics/outlier-detection.ts (60-80行)
export関数: detectOutliers(timings: Record<string, { seconds: number }>) => OutlierResult[]
型定義: OutlierResult { phase: string; seconds: number; iqrScore: number; isOutlier: boolean }
閾値: 1.5x IQR(標準的なIQR法の外れ値判定基準)

BottleneckResult型にoutlierPhases?: OutlierResult[]フィールドを追加する。

### FR-3: tdd_red_evidence向けadviceルール追加 (-> AC-3, F-003)

generateAdvice()のADVICE_RULESにtdd_red_evidence連続失敗パターンへの改善提案ルールを追加する。

追加ルール:
- パターン: "tdd_red_evidence"
- メッセージ: テスト設計の見直しを提案(red phase失敗が頻発している旨)
- 閾値ベース条件: 同一チェック5回以上のfailureに対してテンプレート改善提案を生成
- 外れ値フェーズには「セッション中断の可能性」を表示する分岐を追加

変更対象: phase-analytics.ts generateAdvice関数 L114-146

### FR-4: 失敗パターン分類とフェーズ間相関 (-> AC-4, F-004, F-006)

error-classification.tsに失敗パターンの3カテゴリ分類とフェーズ間失敗相関マトリクスを新規実装する。

新規ファイル: src/analytics/error-classification.ts (60-80行)
export関数: classifyErrors(entries: DoDFailureEntry[]) => ErrorClassification
型定義: ErrorClassification { recurring: string[]; cascading: string[][]; oneOff: string[] }

分類ロジック:
- recurring: 同一check.nameが3エントリ以上出現するチェック名のリスト
- cascading: 連続するフェーズ番号で同系統の失敗が発生するチェック名グループのリスト
- one-off: recurring/cascadingのいずれにも該当しない失敗

フェーズ番号抽出: phase名の末尾数字パターンを使用。数字なしフェーズ名はcascading判定から除外する。

AnalyticsResult型にerrorClassification?: ErrorClassificationフィールドを追加する。buildAnalytics()からclassifyErrors()を呼び出す。

### FR-5: analytics-toon.ts出力拡張 (-> F-005)

writeAnalyticsToon()にoutlierPhasesとerrorClassification結果の出力セクションを追加する。

変更対象: analytics-toon.ts L46-57付近
出力内容:
- bottlenecksセクションにoutlierPhasesのフェーズ名・秒数・IQRスコアを追加
- errorClassificationセクション(recurring/cascading/one-offの各リスト)を新規追加
- 結果が空の場合は該当セクションを省略する(D-IA-6)

### FR-6: ファイル分割による200行制約維持 (-> AC-5, F-006)

phase-analytics.tsからIQR計算ロジックとエラー分類ロジックを新規ファイルに分離し、全ファイル200行以下を維持する。

分離先:
- src/analytics/outlier-detection.ts: IQR計算と外れ値判定
- src/analytics/error-classification.ts: 失敗パターン分類

依存方向: analytics/ -> tools/(型importのみ)の一方向に制限。循環依存を防止する。
phase-analytics.tsは199行から170行程度に削減される見込み。

## decisions

- D-RQ-1: 外れ値検出にIQR法(1.5x IQR閾値)を採用する。フェーズ時間は右裾分布でありIQRが適切(D-HR-1準拠)
- D-RQ-2: output_file_existsは除外せず、count降順ソートとlevel重み付けで対応する。L1チェックの初回失敗は情報価値が低いが、除外するとデータ損失になる(D-HR-2準拠)
- D-RQ-3: 失敗パターンを3カテゴリ(recurring/cascading/one-off)に分類する。recurringは同一チェック3回以上、cascadingは隣接フェーズの同系統失敗(D-HR-3準拠)
- D-RQ-4: 新規ファイルの配置先はsrc/analytics/ディレクトリとする。tools/ディレクトリはMCPツール実装用であり、汎用分析ロジックはanalytics/に分離する(D-IA-2準拠)
- D-RQ-5: BottleneckResult.outlierPhasesはオプショナル(?)として定義する。外れ値検出が実行されない場合でも既存動作に影響しない(D-IA-3準拠)
- D-RQ-6: analytics-toon.tsの新規出力フィールドは結果が空の場合は省略する。TOON出力の肥大化を防ぐ(D-IA-6準拠)
- D-RQ-7: tdd_red_evidence閾値ルールは同一チェック5回以上でテンプレート改善提案を生成する(D-RS-5準拠)
- D-RQ-8: error-toon.tsのDoDFailureEntry型は変更しない。既存フィールドで分類に必要な情報が揃っている(D-RS-8準拠)

## acceptanceCriteria

| ID | 基準 | 検証方法 |
|----|------|----------|
| AC-1 | topFailureが失敗回数最大のチェックを正しく表示する(ソート済み) | failures配列がcount降順であることをテストで検証 |
| AC-2 | IQR外れ値検出がセッション中断相当の異常値をoutlierとしてフラグ付けする | 外れ値データセットでdetectOutliers()の出力を検証 |
| AC-3 | tdd_red_evidence連続失敗時にテンプレート改善を示唆するadviceが生成される | tdd_red_evidence失敗データでgenerateAdvice()の出力を検証 |
| AC-4 | errorHistoryから失敗パターンが3分類(recurring/cascading/one-off)に正しく分類される | 各パターンのテストデータでclassifyErrors()の出力を検証 |
| AC-5 | 全ファイル200行以下を維持する | 変更後の全対象ファイルの行数をwc -lで検証 |

## notInScope

- フェーズタイミングの計測方法自体の変更(壁時計時間からアクティブ時間への変換)
- DoDチェックロジックの変更
- テンプレートファイル自体の修正
- harness-reportスキルの変更
- error-toon.tsのDoDFailureEntry型の変更
- MCPサーバーの再起動メカニズムの変更

## openQuestions

なし

## traceability

### AC -> FR mapping

| AC | FR |
|----|-----|
| AC-1 | FR-1 |
| AC-2 | FR-2 |
| AC-3 | FR-3 |
| AC-4 | FR-4 |
| AC-5 | FR-6 |

### FR -> RTM mapping

| FR | RTM |
|----|-----|
| FR-1 | F-001 (AC-1) |
| FR-2 | F-002 (AC-2), F-006 (AC-5) |
| FR-3 | F-003 (AC-3) |
| FR-4 | F-004 (AC-4), F-006 (AC-5) |
| FR-5 | F-005 (AC-4) |
| FR-6 | F-006 (AC-5) |

## changeTargets

| path | action | lines(before) | lines(after) |
|------|--------|---------------|--------------|
| src/analytics/phase-analytics.ts | modify | 199 | 170 |
| src/analytics/analytics-toon.ts | modify | 73 | 90 |
| src/analytics/outlier-detection.ts | new | 0 | 70 |
| src/analytics/error-classification.ts | new | 0 | 70 |
| src/analytics/phase-analytics.test.ts | modify | 147 | 170 |
| src/analytics/outlier-detection.test.ts | new | 0 | 60 |
| src/analytics/error-classification.test.ts | new | 0 | 60 |

## executionOrder

1. outlier-detection.ts新規作成(独立、副作用なし)
2. error-classification.ts新規作成(独立、副作用なし)
3. phase-analytics.tsの型定義拡張(BottleneckResult, AnalyticsResult)
4. phase-analytics.tsのbuildErrorAnalysis修正(failuresソート追加)
5. phase-analytics.tsのfindBottlenecks修正(detectOutliers呼び出し追加)
6. phase-analytics.tsのgenerateAdvice修正(ADVICE_RULES追加、閾値ルール追加)
7. phase-analytics.tsのbuildAnalytics修正(classifyErrors呼び出し追加)
8. analytics-toon.tsの出力拡張(outlierPhases、errorClassification追加)
9. テストファイル作成・修正(3ファイル)

ステップ1-2は並列実行可能。ステップ3-7はphase-analytics.ts内の順次変更。ステップ9はステップ1-8完了後に実行。

## artifacts

| path | role |
|------|------|
| docs/workflows/harness-analytics-improvement/hearing.md | input |
| docs/workflows/harness-analytics-improvement/research.md | input |
| docs/workflows/harness-analytics-improvement/impact-analysis.md | input |
| docs/workflows/harness-analytics-improvement/requirements.md | output |
