# UI Design: harness-analytics-improvement

phase: ui_design
date: 2026-03-26

## summary

phase-analytics.toonへの出力フォーマット設計。既存の6セクション(phaseTimings, errorAnalysis, errorHistory, bottlenecks, advice, hookStats)に対し、3セクション(outlierPhases, errorClassification, advice拡張)を追加する。CLIツール出力のため画面レイアウトではなくTOONシリアライズ構造として設計する。

## components

出力セクション(モジュール)の定義。各セクションはanaltyics-toon.tsのwriteAnalyticsToon関数内でresultオブジェクトのプロパティとして構築される。

### errorAnalysis セクション (既存改善)

topFailureフィールドがcount降順ソート済みfailures[0]を参照する。ソートはphase-analytics.ts側で実施済みのため、出力側の変更は不要。

```
errorAnalysis:
  - phase: "planning"
    retries: 2
    topFailure: "ac_coverage(L2) x4"
```

topFailureの表示形式: `{check}({level}) x{count}` は既存仕様を維持。ソート改善により最頻失敗チェックが正確に反映される。

### errorHistory セクション (既存、変更なし)

全entry全checksを展開した詳細履歴。前タスク(harness-detailed-error-analytics)で実装済み。本タスクでの変更は不要。

```
errorHistory:
  - phase: "implementation"
    retry: 1
    check: "ac_coverage"
    level: "L2"
    passed: false
    evidence: "AC-1 not addressed"
```

### bottlenecks セクション (既存拡張)

既存フィールド(slowestPhase, mostRetriedPhase, mostFailedCheck)に加え、outlierPhasesサブセクションを追加する。

```
bottlenecks:
  slowestPhase: "implementation (245s)"
  mostRetriedPhase: "planning (3 retries)"
  mostFailedCheck: "ac_coverage (5 failures)"
  outlierPhases:
    - phase: "implementation"
      seconds: 245
      iqrScore: 2.3
```

outlierPhasesの出力条件: detectOutliers()が空でない配列を返した場合のみ出力(D-RQ-6準拠)。iqrScoreは小数第1位に丸める。

### errorClassification セクション (新規)

recurring/cascading/one-offの3分類結果を出力する。bottlenecksの直後、adviceの直前に配置する。

```
errorClassification:
  recurring:
    - "ac_coverage"
    - "rtm_trace"
  cascading:
    - ["line_count", "5", "6", "7"]
  oneOff:
    - "file_exists"
```

各サブフィールドの出力条件: 該当配列が空でない場合のみ出力(D-RQ-6準拠)。errorClassification自体もclassifyErrors()がundefinedを返した場合は省略する。

### advice セクション (既存拡張)

既存のADVICE_RULESパターンマッチに加え、3種類の新規adviceを追加する。

```
advice:
  - "テスト設計の見直しを推奨: red phase失敗が頻発"
  - "テンプレート改善を推奨: ac_coverage (5回失敗)"
  - "セッション中断の可能性: implementation (245s, IQR=2.3)"
```

advice生成の優先順序:
1. ADVICE_RULESパターンマッチ(既存、tdd_red_evidenceルール追加)
2. 閾値ルール: 同一チェック5回以上で改善提案
3. 外れ値ルール: outlierPhasesの各フェーズに中断警告

## layouts

phase-analytics.toonの出力配置順序。TOONはキー順序を保持するため、セクション配置順がそのまま読み取り順序となる。

```
phase-analytics.toon
  |-- phase: "analytics"
  |-- task: {taskName}
  |-- taskId: {taskId}
  |-- generatedAt: {ISO8601}
  |-- totalElapsed: "{N}s"              (timingsあり時のみ)
  |-- phaseTimings: {...}               (timingsあり時のみ)
  |-- errorAnalysis: [...]              (既存、ソート改善)
  |-- errorHistory: [...]               (既存、変更なし)
  |-- bottlenecks:
  |     |-- slowestPhase                (既存)
  |     |-- mostRetriedPhase            (既存)
  |     |-- mostFailedCheck             (既存)
  |     |-- outlierPhases: [...]        (新規、空時省略)
  |-- errorClassification:              (新規、空時省略)
  |     |-- recurring: [...]            (空時省略)
  |     |-- cascading: [...]            (空時省略)
  |     |-- oneOff: [...]               (空時省略)
  |-- advice: [...]                     (既存拡張)
  |-- hookStats: {...}                  (既存、hookObsStatsあり時のみ)
```

配置理由: errorClassificationはbottlenecksとadviceの間に配置する。bottlenecksで検出した異常値の分類結果がerrorClassificationであり、その分類結果を踏まえたアクションがadviceとなるため、データ分析の流れ(検出->分類->提案)に沿った順序とする。

## interactions

データの入出力関係。関数から出力セクションへのマッピング。

| 関数 | 入力 | 出力セクション | 変換内容 |
|------|------|---------------|---------|
| buildErrorAnalysis() | phase-errors.toon | errorAnalysis | failures配列をcount降順ソートし、failures[0]をtopFailureとして表示 |
| readErrorToon() | phase-errors.toon | errorHistory | 全entry全checksを展開(前タスクで実装済み) |
| findBottlenecks() | phaseTimings, errorAnalysis | bottlenecks | detectOutliers()結果をoutlierPhasesとして出力 |
| classifyErrors() | phase-errors.toon entries | errorClassification | recurring/cascading/one-offの3分類結果を出力 |
| generateAdvice() + buildAnalytics() | errorAnalysis, bottlenecks | advice | ADVICE_RULES + 閾値ルール + 外れ値ルールの3段階で生成 |
| writeAnalyticsToon() | AnalyticsResult | phase-analytics.toon | 全セクションをTOONシリアライズして出力 |

データフロー:
```
phase-errors.toon
  -> buildErrorAnalysis() -> errorAnalysis[].topFailure (ソート済み)
  -> classifyErrors()     -> errorClassification
  -> buildAnalytics()     -> errorHistory (インライン構築)

phase-timings.toon
  -> findBottlenecks()    -> bottlenecks.outlierPhases
  -> buildAnalytics()     -> advice (外れ値アドバイス追加)

AnalyticsResult
  -> writeAnalyticsToon() -> phase-analytics.toon (TOON出力)
```

## decisions

- UID-D1: outlierPhasesをbottlenecksのサブフィールドとして配置する。独立トップレベルセクションにすると、slowestPhaseとの関連が失われる。bottlenecksは性能異常の検出結果を集約するセクションであり、IQR外れ値もその一種である
- UID-D2: errorClassificationをbottlenecksとadviceの間に配置する。データ分析の論理的な流れ(検出->分類->提案)に沿った読み取り順序を維持するため
- UID-D3: 空セクション省略をD-RQ-6準拠で一貫適用する。outlierPhases, errorClassification, recurring, cascading, oneOffの全てで空時省略する。TOON出力の肥大化を防ぎ、LLMが読み取る際のノイズを削減する
- UID-D4: iqrScoreの表示精度を小数第1位(toFixed(1))とする。IQRスコアの目的はフェーズ間の相対的な異常度の比較であり、小数第2位以下の精度は実用上不要である
- UID-D5: advice生成の3段階(パターンマッチ->閾値->外れ値)は配列への逐次pushで実装する。adviceは順序付きリストであり、生成順序がそのまま優先度を表す。パターンマッチ(構造的問題)が最優先、閾値(頻度問題)が次点、外れ値(時間異常)が最後となる
- UID-D6: cascadingの出力形式を[check, phase1, phase2, ...]のフラット配列とする。classifyErrors()の戻り値をそのまま出力し、出力側での再構造化を避ける。TOON形式でネストを深くすると読み取り側の負荷が増すため

## artifacts

- docs/workflows/harness-analytics-improvement/ui-design.md: 本設計書。5セクション定義、配置順序、関数マッピング
- docs/workflows/harness-analytics-improvement/planning.md: 入力。4Worker構成の実装計画
- workflow-harness/mcp-server/src/tools/analytics-toon.ts: 参考。既存TOON出力実装(74行)

## next

criticalPath: "analytics-toon.tsへのoutlierPhases+errorClassificationセクション追加がWorker-4の責務"
readFiles: "docs/workflows/harness-analytics-improvement/ui-design.md, docs/workflows/harness-analytics-improvement/planning.md"
warnings: "analytics-toon.tsは74行から90行への増加見込み。200行制約に対して十分な余裕あり"
