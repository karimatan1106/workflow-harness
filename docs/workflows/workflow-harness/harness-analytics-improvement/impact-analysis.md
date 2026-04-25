# Impact Analysis: harness-analytics-improvement

phase: impact_analysis
task: harness-analytics-improvement
status: complete

## summary

phase-analytics.ts(199行)への4軸改善について、変更対象7ファイルの影響範囲・依存関係・リスクを分析した。既存199行ファイルへの直接追加は200行制約に違反するため、新規2ファイルへのロジック分離が前提条件となる。

## impact-map

### phase-analytics.ts (modified, 199行 -> 170行程度)

変更内容:
- L82: failures配列にcount降順ソート追加(.sort((a,b) => b.count - a.count))
- L82: 同countの場合にL2+チェックを優先する重み付け(levelの数値変換比較)
- L89-111: findBottlenecks内でoutlier-detection.tsのdetectOutliers()を呼び出し
- L114-122: ADVICE_RULESにtdd_red_evidenceルール追加
- L128-133: 閾値ベース条件ルール追加(同一チェック5回以上)
- L138-139: 外れ値フェーズに「セッション中断の可能性」分岐追加
- L13-17: BottleneckResult型にoutlierPhasesフィールド追加
- L31-37: AnalyticsResult型にerrorClassificationフィールド追加
- L190-198: buildAnalytics内でerror-classification.tsのclassifyErrors()を呼び出し

依存影響: analytics-toon.tsがAnalyticsResult/BottleneckResult型をimportしているため、型変更は下流に伝播する。error-toon.tsのDoDFailureEntry型は変更不要。

行数影響: IQR計算とエラー分類ロジックを新規ファイルに分離するため、phase-analytics.tsは逆に行数が減少する。import文2行追加、findBottlenecks内のIQRループ削除(新規関数呼び出しに置換)、buildErrorHistory内の分類ロジック削除(新規関数呼び出しに置換)により170行程度になる見込み。

### analytics-toon.ts (modified, 73行 -> 90行程度)

変更内容:
- L31-37: errorAnalysis出力でtopFailureをfailures[0]から重み付きソート済み先頭要素に変更(phase-analytics.ts側のソートにより自動対応)
- L46-56: bottlenecksセクションにoutlierPhasesの出力を追加
- L57付近: errorClassification結果の出力セクションを新規追加

依存影響: AnalyticsResult型の拡張に追従する変更のみ。出力フォーマットの追加であり、既存フィールドの変更はない。phase-analytics.toon読者(ハーネス内部の他ツール)は新規フィールドを無視できるため後方互換性あり。

### outlier-detection.ts (new, 60-80行)

配置: workflow-harness/mcp-server/src/analytics/outlier-detection.ts
責務: IQR法による外れ値検出。Q1/Q3/IQR計算、1.5xIQR閾値による外れ値判定。
export関数: detectOutliers(timings: Record<string, { seconds: number }>) => OutlierResult[]
型export: OutlierResult { phase: string; seconds: number; iqrScore: number; isOutlier: boolean }

依存影響: phase-analytics.tsのfindBottlenecksから呼び出される。新規ファイルのため既存コードへの副作用なし。analyticsディレクトリの新規作成が必要。

### error-classification.ts (new, 60-80行)

配置: workflow-harness/mcp-server/src/analytics/error-classification.ts
責務: エラーパターンの3カテゴリ分類(recurring/cascading/one-off)。
export関数: classifyErrors(entries: DoDFailureEntry[]) => ErrorClassification
型export: ErrorClassification { recurring: string[]; cascading: string[][]; oneOff: string[] }
分類ロジック:
- recurring: 同一check.nameが3エントリ以上出現
- cascading: 連続フェーズ番号で同系統の失敗が発生(フェーズ名からフェーズ番号を抽出して隣接判定)
- one-off: 上記に該当しないもの

依存影響: error-toon.tsのDoDFailureEntry型をimportする。phase-analytics.tsのbuildAnalyticsから呼び出される。新規ファイルのため既存コードへの副作用なし。

### phase-analytics.test.ts (modified, 147行)

変更内容: buildErrorAnalysis結果のfailures配列がcount降順ソートされていることの検証追加。BottleneckResultにoutlierPhasesが含まれることの検証追加。AnalyticsResultにerrorClassificationが含まれることの検証追加。

### outlier-detection.test.ts (new, 60行)

テスト対象: detectOutliers関数。正常分布データ、外れ値含むデータ、データ不足時(4件未満)のエッジケース。

### error-classification.test.ts (new, 60行)

テスト対象: classifyErrors関数。recurring検出、cascading検出、one-off分類、空配列入力のエッジケース。

## dependency-graph

```
error-toon.ts (unchanged)
  └─ DoDFailureEntry型 ──→ error-classification.ts (new)
                               └─ classifyErrors() ──→ phase-analytics.ts
                                                          └─ buildAnalytics()

phase-timings.ts (unchanged)
  └─ PhaseTimingsResult型 ──→ phase-analytics.ts
                                 └─ findBottlenecks() ──→ outlier-detection.ts (new)
                                                             └─ detectOutliers()

phase-analytics.ts
  └─ AnalyticsResult型(拡張) ──→ analytics-toon.ts
  └─ BottleneckResult型(拡張) ──→ analytics-toon.ts
```

## risk-assessment

| 変更 | リスク | 理由 | 緩和策 |
|------|--------|------|--------|
| failures配列ソート追加 | low | 1行追加。既存ロジックの出力順序のみ変更 | テストでソート順を検証 |
| L1チェック重み付け | low | ソート比較関数内の条件分岐追加 | level値のパース失敗時はデフォルト重みを使用 |
| IQR外れ値検出 | low | 新規ファイルに独立実装。既存コードへの影響はfindBottlenecksの戻り値型拡張のみ | outlierPhasesはオプショナルフィールド |
| エラー分類ロジック | medium | フェーズ番号抽出の正規表現がフェーズ命名規則に依存 | フェーズ名パターンをテストで網羅的に検証 |
| analytics-toon.ts出力追加 | low | 既存出力に新規フィールドを追加するのみ。後方互換性あり | 新規フィールドが空の場合は出力を省略 |
| analyticsディレクトリ新規作成 | low | 既存のディレクトリ構造に新規ディレクトリを追加 | tsconfig.jsonのパス設定確認 |
| phase-analytics.tsからのロジック移動 | medium | 関数の移動に伴いimport文の追加が必要。循環依存のリスク | 依存方向を一方向(analytics/ -> tools/の型のみ)に制限 |

## execution-order

1. analyticsディレクトリ作成とoutlier-detection.ts新規作成(独立、副作用なし)
2. error-classification.ts新規作成(独立、副作用なし)
3. phase-analytics.tsの型定義拡張(BottleneckResult, AnalyticsResult)
4. phase-analytics.tsのbuildErrorAnalysis修正(failuresソート追加)
5. phase-analytics.tsのfindBottlenecks修正(detectOutliers呼び出し追加)
6. phase-analytics.tsのgenerateAdvice修正(ADVICE_RULES追加、閾値ルール追加)
7. phase-analytics.tsのbuildAnalytics修正(classifyErrors呼び出し追加)
8. analytics-toon.tsの出力拡張(outlierPhases、errorClassification追加)
9. テストファイル作成・修正(3ファイル)

ステップ1-2は並列実行可能。ステップ3-7はphase-analytics.ts内の順次変更。ステップ8はステップ3の型定義完了後に実行可能。ステップ9はステップ1-8完了後に実行。

## decisions

- D-IA-1: phase-analytics.tsは199行から170行程度に削減される。新規ロジックを外部ファイルに分離するため、行数制約(200行以下)を継続的に満たす
- D-IA-2: 新規ファイルの配置先はsrc/analytics/ディレクトリとする。tools/ディレクトリはMCPツール実装用であり、汎用分析ロジックはanalytics/に分離する(SD-07準拠)
- D-IA-3: BottleneckResult.outlierPhasesはオプショナル(?)として定義する。外れ値検出が実行されない場合(timingsが未提供)でも既存動作に影響しない
- D-IA-4: ErrorClassification型はerror-classification.tsからexportし、phase-analytics.tsでre-exportする。analytics-toon.tsからの参照パスを最小化する
- D-IA-5: 依存方向はanalytics/ -> tools/(型importのみ)の一方向に制限する。循環依存を防止するため、analytics/内のファイルはtools/の関数を呼び出さない
- D-IA-6: analytics-toon.tsの新規出力フィールドは結果が空の場合は省略する。TOON出力の肥大化を防ぎ、読者への情報過多を避ける
- D-IA-7: フェーズ番号抽出はphase名の末尾数字パターン(例: "scope_definition" -> 抽出不可、"phase_03" -> 3)に依存する。数字なしフェーズ名はcascading判定から除外する

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-analytics-improvement/research.md | input | リサーチ結果。4軸の根本原因と変更箇所を特定 |
| docs/workflows/harness-analytics-improvement/scope-definition.md | input | スコープ定義。7ファイル変更計画と設計判断 |
| docs/workflows/harness-analytics-improvement/impact-analysis.md | output | 本影響分析。依存関係・リスク・実行順序を定義 |

## next

implementationPlan: "テスト先行で実装する。outlier-detection.test.ts -> outlier-detection.ts -> error-classification.test.ts -> error-classification.ts -> phase-analytics.ts修正 -> analytics-toon.ts修正の順序"
parallelWork: "outlier-detection.tsとerror-classification.tsは独立しており並列実装可能"
riskMitigation: "phase-analytics.tsの変更は型定義拡張を先行し、関数修正を後続させることでコンパイルエラーの範囲を限定する"
