# Scope Definition: harness-analytics-improvement

phase: scope_definition
task: harness-analytics-improvement
status: complete

## summary

purpose: phase-analytics.toonの分析精度を4軸(errorAnalysis/bottlenecks/advice/errorHistory)で全面改善し、改善アクションに繋がる信頼性の高い分析レポートを生成する
rootCause: 現行の分析結果が実態と乖離しており、output_file_existsの過剰カウント、壁時計時間の異常値混入、advice精度不足、errorHistoryの未活用が重なり意思決定材料として機能していない
reporter: user

## scopeFiles

| path | role | lines | changeType |
|------|------|-------|------------|
| workflow-harness/mcp-server/src/tools/phase-analytics.ts | impl | 199 | modified |
| workflow-harness/mcp-server/src/tools/analytics-toon.ts | impl | 73 | modified |
| workflow-harness/mcp-server/src/analytics/outlier-detection.ts | impl | 80 | new |
| workflow-harness/mcp-server/src/analytics/error-classification.ts | impl | 80 | new |
| workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts | test | 147 | modified |
| workflow-harness/mcp-server/src/__tests__/outlier-detection.test.ts | test | 60 | new |
| workflow-harness/mcp-server/src/__tests__/error-classification.test.ts | test | 60 | new |

## decisions

- SD-01: IQR法で外れ値検出を実装する。フェーズ時間は右裾分布でありIQRが統計的に適切。新規ファイルoutlier-detection.tsに分離する
- SD-02: output_file_existsは除外せず重み付けで対応する。L1チェックの初回失敗は情報価値が低いが完全除外すると初期セットアップ問題を見逃す
- SD-03: 失敗パターンをrecurring(同一チェック3回以上)/cascading(連続フェーズ失敗)/one-offの3カテゴリに分類する。新規ファイルerror-classification.tsに実装
- SD-04: phase-analytics.tsから外れ値検出とエラー分類のロジックを新規ファイルに抽出し200行制約を維持する。現在199行のため機能追加にはファイル分割が必須
- SD-05: ADVICE_RULESにtdd_red_evidence連続失敗パターン向けルールを追加し、閾値超過時にテンプレート改善提案を生成する
- SD-06: analytics-toon.tsのTOON出力に外れ値フラグとエラー分類結果を追加し、分析結果の永続化を完備する
- SD-07: ソースファイルの実際のパスはtools/配下(hearing.mdのanalytics/は誤り)。新規ファイルはanalytics/配下に作成し責務分離する

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-analytics-improvement/hearing.md | spec | ヒアリング結果。4軸改善のスコープと5つの設計判断を記録 |
| docs/workflows/harness-analytics-improvement/scope-definition.md | spec | 本スコープ定義。7ファイルの変更計画と7つの設計判断 |

## next

criticalDecisions: IQR外れ値検出の閾値(1.5xIQR)は初期値として設定し、実データで調整可能にする。エラー分類のrecurring閾値は3回とする
readFiles: "workflow-harness/mcp-server/src/tools/phase-analytics.ts, workflow-harness/mcp-server/src/tools/analytics-toon.ts, workflow-harness/mcp-server/src/tools/error-toon.ts"
warnings: "phase-analytics.tsは199行で上限到達済み。機能追加前にoutlier-detection.tsとerror-classification.tsへの責務分割を先行実施すること"
