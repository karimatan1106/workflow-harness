# Hearing: harness-analytics-improvement

userResponse: "スコープはD(全面改善): errorAnalysis精度+bottlenecks外れ値検出+advice改善+errorHistory活用の新分析軸。tdd_red_evidenceの根本原因はテンプレート指示不足。commitの11387秒はセッション中断による壁時計時間で実作業時間ではない"

## overview

phase-analytics.tsの分析精度を4軸で全面改善する。errorAnalysisの偏り是正、bottleneckの外れ値検出、advice精度向上、errorHistory活用の新分析軸を対象とする。

## intent-analysis

- surfaceRequest: phase-analytics.toonの分析結果を全面改善する。errorAnalysis/bottlenecks/advice/errorHistoryの4領域を対象とする
- deepNeed: ハーネス完走後の分析レポートが実態と乖離しており、改善アクションに繋がらない。分析の信頼性を上げて、フェーズ設計やテンプレート改善の意思決定材料にする

## unclearPoints

- 壁時計時間と実LLM作業時間の分離手法: セッション中断やユーザー離席を検出する信号源の選定
- errorHistory相関分析の粒度: フェーズ間相関をどの深さまで掘るか(隣接フェーズ vs 全組み合わせ)
- advice生成の閾値パラメータ: tdd_red_evidence 17回失敗のような極端なケースに対する閾値設計

## assumptions

- 前回タスク(harness-detailed-error-analytics)で実装済みのerrorHistoryとpassedフィルタの上に構築する
- 対象ファイルはworkflow-harness/mcp-server/src/tools/phase-analytics.ts(199行)の1ファイル
- 壁時計時間の計測改善はphase-analytics.ts内のfindBottlenecks関数で対応可能な範囲とする
- MCPサーバーのモジュールキャッシュのため、変更後はセッション再起動が必要

## implementation-plan

4軸並行改善:
- (A) buildErrorAnalysis内のtopFailure集計ロジックにoutput_file_exists以外の実質的失敗を優先するフィルタ追加
- (B) findBottlenecksにIQR法による外れ値検出を追加し、セッション中断による異常値をマーク
- (C) generateAdviceのADVICE_RULESにtdd_red_evidence連続失敗パターン向けルール追加とテンプレート改善提案の生成
- (D) buildErrorHistoryを拡張し、フェーズ間失敗相関マトリクスと失敗パターン分類(recurring/cascading/one-off)を出力

estimatedScope: 1ファイル変更(phase-analytics.ts)、推定差分60-80行。関数4つの改修。テストファイル1つ追加または拡張

## risks

- phase-analytics.tsが199行で200行上限に近い。4軸改善で行数超過する可能性が高く、責務分割(ヘルパー関数の別ファイル抽出)が必要
- 外れ値検出の閾値が固定的だとタスク特性により誤検出する。閾値をphase-analytics.toon内で調整可能にする設計が必要
- errorHistory相関分析はフェーズ数に対してO(n^2)だが、30フェーズ程度なら性能問題にはならない

## decisions

- D-HR-1: 外れ値検出にIQR法を採用する。フェーズ時間は右裾分布でありIQRが適切
- D-HR-2: output_file_existsは除外せず重み付けで対応する。L1チェックの初回失敗は情報価値が低いため
- D-HR-3: 失敗パターンを3カテゴリ(recurring/cascading/one-off)に分類する
- D-HR-4: 新規ファイル(outlier-detection.ts, error-classification.ts)に責務分割し200行制約を維持する
- D-HR-5: テンプレート改善提案をadviceルールとして生成する

## artifacts

- docs/workflows/harness-analytics-improvement/hearing.md: 本ヒアリング結果。4軸改善のスコープと判断を記録

## next

readFiles: "workflow-harness/mcp-server/src/analytics/phase-analytics.ts"
warnings: "phase-analytics.tsは199行。新機能追加時にファイル分割が必須"
