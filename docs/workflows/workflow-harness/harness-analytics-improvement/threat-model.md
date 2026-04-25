# Threat Model: harness-analytics-improvement

phase: threat_modeling
task: harness-analytics-improvement
status: complete
inputArtifact: docs/workflows/harness-analytics-improvement/requirements.md

## context

内部ツール(ワークフローハーネス)のphase-analytics改善。外部入力なし、ネットワーク通信なし、認証不要。脅威は主にデータ整合性、計算正確性、ファイルサイズに限定される。攻撃者モデルは不要(内部開発ツールのため)。

## strideAnalysis

strideAnalysis6{id,category,threat,likelihood,impact,mitigation}:
  TM-01, T, "failuresソート変更によるtopFailure値の非連続変化: count降順ソート導入でtopFailureが従来と異なる値を返す。既存のgenerateAdvice()ルールが想定外のtopFailure値を受け取る可能性", 高, 中, "topFailure変化は意図された改善。generateAdvice()のADVICE_RULESは文字列パターンマッチであり特定のtopFailure値にハードコード依存していない。テストでソート後の出力を検証する"
  TM-02, D, "IQR外れ値検出の誤検出: フェーズ数が少ない場合(N<4)にIQR計算が不安定になり正常値をoutlierとして誤検出する", 中, 中, "Q1/Q3計算に最低4データ点を要求するガード条件を追加。データ不足時はoutlierPhases空配列を返し既存動作に影響しない(D-RQ-5のoptional設計で吸収)"
  TM-03, I, "analytics-toon.ts出力肥大化: outlierPhasesとerrorClassificationセクション追加でTOON出力が大幅増加しコンテキスト圧迫", 中, 低, "D-RQ-6で空結果時はセクション省略。outlierPhasesは通常0-2件、errorClassificationのrecurringも数件程度。最大追加量は20行以内"
  TM-04, T, "cascading判定のフェーズ番号抽出エラー: フェーズ名末尾の数字パターンが想定外の形式(例: threat_modeling)で誤抽出", 中, 中, "FR-4仕様で数字なしフェーズ名はcascading判定から除外。正規表現パターンのテストケースにunderscoreを含むフェーズ名を追加して検証"
  TM-05, D, "新規ファイル間の循環依存: outlier-detection.tsとerror-classification.tsが共通型をimportする際にphase-analytics.tsとの循環参照が発生", 低, 高, "D-RQ-4で依存方向をanalytics/ -> tools/(型importのみ)に制限。新規2ファイルはphase-analytics.tsの型をimportせず独自のインターフェースを定義。phase-analytics.tsが新規ファイルを一方向に呼び出す"
  TM-06, I, "phase-analytics.ts 200行超過: BottleneckResult/AnalyticsResult型拡張とimport追加で行数制約違反", 中, 高, "FR-6でIQR計算とエラー分類を外部化済み。199行から170行への削減見込み。changeTargetsで各ファイルの行数予測を検証済み"

## securityRequirements

securityRequirements3{id,requirement,priority}:
  SR-1, "BottleneckResult.outlierPhasesとAnalyticsResult.errorClassificationはoptionalフィールドとし後方互換性を維持する", must
  SR-2, "outlier-detection.tsはphase-analytics.tsの内部型に依存しない。独自のOutlierResult型を定義しexportする", must
  SR-3, "IQR計算はデータ点4未満の場合に空結果を返し例外をスローしない", must

## decisions

- TM-D1: 外部脅威分析はスコープ外とする。内部開発ツールでありネットワーク露出なし。攻撃者モデルの定義は不要
- TM-D2: topFailureソート変更による既存出力値の変化は意図された改善として許容する。従来のMap挿入順はバグであり、count降順が正しい動作(TM-01分析結果)
- TM-D3: IQR計算のデータ点下限を4に設定する。統計的に四分位数計算には最低4データ点が必要。下限未満時はoutlier検出をスキップし空結果を返す(TM-02緩和)
- TM-D4: 新規ファイル(outlier-detection.ts, error-classification.ts)はphase-analytics.tsの型を直接importしない。型結合を避け一方向依存を維持する(TM-05緩和)
- TM-D5: analytics-toon.ts出力の空セクション省略をD-RQ-6に従い実装する。TOON出力の肥大化を防ぎコンテキスト効率を維持(TM-03緩和)
- TM-D6: cascading判定のフェーズ番号抽出は末尾数字パターン(\d+$)を使用し、数字なしフェーズ名はcascading対象外とする。FR-4仕様に準拠(TM-04緩和)
- TM-D7: phase-analytics.tsの行数削減(199->170行)はFR-6のファイル分割で達成する。型定義拡張(+5行)とimport追加(+2行)を考慮しても170行以下に収まる(TM-06緩和)

## riskMatrix

| threat | likelihood | impact | severity | status |
|--------|-----------|--------|----------|--------|
| TM-01 topFailure change | 高 | 中 | medium | accepted as intended fix |
| TM-02 IQR false positive | 中 | 中 | moderate | mitigated by min data guard |
| TM-03 toon output size | 中 | 低 | low | mitigated by empty section skip |
| TM-04 phase name parsing | 中 | 中 | moderate | mitigated by test coverage |
| TM-05 circular dependency | 低 | 高 | medium | mitigated by one-way deps |
| TM-06 200-line violation | 中 | 高 | high | mitigated by file extraction |

## artifacts

artifacts2{path,role,summary}:
  docs/workflows/harness-analytics-improvement/threat-model.md, report, "analytics改善の脅威モデル。6脅威のSTRIDE分析と7判断"
  docs/workflows/harness-analytics-improvement/requirements.md, spec, "入力: 機能要件6件とAC5件の要件定義"

## next

criticalDecisions: "TM-D3(IQRデータ点下限4)とTM-D4(一方向依存)が設計フェーズの制約条件。TM-D6のフェーズ番号抽出パターンはerror-classification.tsのインターフェース設計に影響"
readFiles: "docs/workflows/harness-analytics-improvement/requirements.md, docs/workflows/harness-analytics-improvement/threat-model.md"
warnings: "TM-06(200行超過)はFR-6のファイル分割が前提。分割せずに型拡張を先行するとphase-analytics.tsが202行に到達する"
