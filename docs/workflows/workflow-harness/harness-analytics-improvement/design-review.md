# Design Review: harness-analytics-improvement

phase: design_review
date: 2026-03-26

## summary

全6設計成果物(planning.md, requirements.md, threat-model.md, ui-design.md, state-machine.mmd, flowchart.mmd)を検証した。planning.mdの詳細設計はrequirements.mdの全FR(FR-1~FR-6)とAC(AC-1~AC-5)を網羅しており、threat-model.mdの緩和策(TM-D1~TM-D7)がplanning.mdのdetailedChangesに反映されている。state-machine.mmdとflowchart.mmdはplanning.mdのdataFlowと整合する。ui-design.mdの出力フォーマット定義はanalytics-toon.tsの変更仕様と一致している。設計品質は合格水準に達している。

## consistencyCheck

### planning.md と state-machine.mmd の一貫性

state-machine.mmdはReadErrors -> SortFailures -> DetectOutliers -> ClassifyErrors -> GenerateAdvice -> WriteToonの順序で遷移を定義しており、planning.mdのdataFlowセクション(L14-29)の実行順と一致する。CheckMinDataPointsガード(4データ点未満でスキップ)はplanning.mdのdetailedChanges outlier-detection.ts L66のガード条件と対応する。state-machine.mmdのD4(cascading判定の末尾数字パターン)はplanning.md L85のTM-D6参照と一致する。

### planning.md と flowchart.mmd の一貫性

flowchart.mmdはbuildAnalytics()の内部フローを詳細化しており、planning.mdのdetailedChanges項目8-9(buildAnalytics内でのclassifyErrors呼び出しとbuildErrorHistory統合)と整合する。flowchart.mmdのノードI(buildErrorHistory構築)はplanning.md L225-239のインライン構築仕様と対応する。空データパスのデフォルト初期化(flowchart D -> E)はstate-machine.mmdのHandleEmptyDataとも一致する。

### planning.md と ui-design.md の一貫性

ui-design.mdのlayoutsセクション(L96-116)はplanning.mdのanalytics-toon.ts変更仕様(L243-279)と出力構造が一致する。outlierPhasesのbottlenecksサブフィールド配置(UID-D1)はplanning.mdのBottleneckResult型定義(L152-157)と整合する。errorClassificationの配置順序(bottlenecksとadviceの間、UID-D2)はplanning.mdのanalytics-toon.ts出力仕様と合致する。

### 不整合の指摘

requirements.mdのchangeTargetsセクション(L142-148)でファイルパスが`src/analytics/phase-analytics.ts`となっているが、planning.mdのfileChanges(L33-41)では`src/tools/phase-analytics.ts`となっている。phase-analytics.tsの実際の配置先はsrc/tools/であり、requirements.mdのchangeTargets内パスは転記時の誤りと判断される。テストファイルパスも同様に`src/analytics/`と記載されているが、planning.mdでは`src/__tests__/`配下を正としている。

flowchart.mmdのノードM(slowestPhase検出スキップ)からノードO(detectOutliers呼び出し)への遷移は、timingsが存在しない場合でもdetectOutliersを呼ぶように見えるが、timingsがnullの場合はdetectOutliersの引数が不正となる。planning.mdのL187ではif(timings)ガード内でdetectOutliersを呼ぶ設計であるため、flowchart.mmdのM -> O遷移は実装と乖離している。

## requirementsTraceability

| FR | planning.md対応箇所 | 設計図反映 |
|----|---------------------|-----------|
| FR-1 topFailureソート | detailedChanges項目4(L172-182): count降順+L1後方配置 | flowchart G->G1->G2, state-machine SortFailures->CountSort |
| FR-2 IQR外れ値検出 | detailedChanges outlier-detection.ts(L45-79): detectOutliers関数 | state-machine DetectOutliers->CalculateIQR, flowchart O->R |
| FR-3 adviceルール追加 | detailedChanges項目6-7(L194-215): ADVICE_RULES+閾値+外れ値advice | state-machine GenerateAdvice->ApplyAdviceRules->ApplyThreshold, flowchart AD->AG |
| FR-4 エラー分類 | detailedChanges error-classification.ts(L81-138): classifyErrors関数 | state-machine ClassifyErrors->GroupChecksByPhase, flowchart T1->AC |
| FR-5 TOON出力拡張 | detailedChanges analytics-toon.ts(L243-279): outlierPhases+errorClassification | state-machine WriteToon->WriteOutliers+WriteClassification, ui-design layouts |
| FR-6 200行制約 | fileChanges表(L33-41): phase-analytics.ts 199->170行 | planning.md risks表で行数超過リスクを管理 |

全FR(FR-1~FR-6)がplanning.mdのdetailedChangesに具体的な実装仕様として展開されており、設計図(state-machine.mmd, flowchart.mmd)にも処理フローとして反映されている。

## securityReview

| SR | threat-model.md定義 | planning.md反映 | 状態 |
|----|--------------------|-----------------|----- |
| SR-1 optional後方互換 | SR-1: outlierPhasesとerrorClassificationはoptional | BottleneckResult型L156, AnalyticsResult型L168に`?`付きフィールド定義 | 反映済み |
| SR-2 型独立性 | SR-2: outlier-detection.tsは内部型に非依存 | outlier-detection.ts(L49-79)が独自インターフェースを定義、phase-analytics.tsの型をimportしない | 反映済み |
| SR-3 データ点ガード | SR-3: 4未満で空結果、例外なし | outlier-detection.ts L66: `if (entries.length < 4) return []` | 反映済み |

threat-model.mdの6脅威(TM-01~TM-06)に対する緩和策:

| 脅威 | 緩和策 | planning.md実装 |
|------|--------|----------------|
| TM-01 topFailure非連続変化 | テストで検証 | Worker-4: phase-analytics.test.tsにソート検証テスト追加 |
| TM-02 IQR誤検出 | 4データ点ガード | outlier-detection.ts L66のガード条件 |
| TM-03 TOON出力肥大化 | 空セクション省略 | analytics-toon.ts L257-276のスプレッド演算子による条件出力 |
| TM-04 フェーズ名パース誤り | 末尾数字パターン限定 | error-classification.ts L117: `p.match(/(\d+)$/)` |
| TM-05 循環依存 | 一方向依存制限 | PL-D5: analytics/はtools/の型を直接importしない |
| TM-06 200行超過 | ファイル分割 | fileChanges表: 199行->170行削減計画 |

## acDesignMapping

| AC | 設計コンポーネント | 仕様書参照 |
|----|-------------------|-----------|
| AC-1 | buildErrorAnalysis failures配列sort(count降順+L1後方配置) | planning.md detailedChanges項目4(L172-182), phase-analytics.ts |
| AC-2 | detectOutliers IQR計算(1.5x IQR閾値, 4データ点ガード) | planning.md detailedChanges outlier-detection.ts(L45-79) |
| AC-3 | generateAdvice ADVICE_RULES拡張(tdd_red_evidenceパターン+閾値5回+外れ値advice) | planning.md detailedChanges項目6-7(L194-215), phase-analytics.ts |
| AC-4 | classifyErrors 3分類(recurring>=3回/cascading連続フェーズ/one-off残余) | planning.md detailedChanges error-classification.ts(L81-138) |
| AC-5 | ファイル分割(outlier-detection.ts 70行, error-classification.ts 70行, phase-analytics.ts 170行) | planning.md fileChanges表(L33-41), Worker-1+Worker-3の分担 |

全AC(AC-1~AC-5)が設計コンポーネントに対応付けられており、planning.mdの具体的なコード仕様を参照可能である。

## findings

### F-1: requirements.md changeTargetsのファイルパス誤り (低リスク)

requirements.md L142-148のchangeTargetsでファイルパスが`src/analytics/phase-analytics.ts`等と記載されているが、正しくはphase-analytics.tsは`src/tools/phase-analytics.ts`、テストファイルは`src/__tests__/`配下である。planning.mdでは正しいパスが記載されており、実装フェーズはplanning.mdを参照するため実害は低い。

### F-2: flowchart.mmdのtimings未存在時フロー (低リスク)

flowchart.mmdではtimingsが存在しない場合(ノードM)からdetectOutliers呼び出し(ノードO)への遷移が描かれているが、planning.mdのL187ではif(timings)ガード内でのみdetectOutliersを呼ぶ設計である。flowchart上の表現が実装仕様と厳密には異なるが、planning.mdの実装仕様が優先されるため実装への影響はない。

### F-3: cascading判定のchain途切れ処理 (情報)

planning.mdのerror-classification.ts L126-131でchainが途切れた場合に`chain.length = 0`でリセットするが、breakで脱出した場合のchainが保持される設計となっている。この動作は「最初に見つかった連続シーケンスのみ検出する」意図と整合しており、設計上の問題はない。

### F-4: ui-design.md analyticsToonの関数名typo (情報)

ui-design.md L12で`analtyics-toon.ts`と記載されている箇所があるが、正しくは`analytics-toon.ts`。コード上のファイル名は正しいため実装への影響はない。

## verdict

合格。全AC(AC-1~AC-5)が設計成果物に対応付けられており、FR(FR-1~FR-6)の実装仕様がplanning.mdに具体化されている。threat-model.mdの緩和策(SR-1~SR-3, TM-D1~TM-D7)もplanning.mdの設計に反映済みである。state-machine.mmd、flowchart.mmd、ui-design.mdはplanning.mdのdataFlowと整合しており、設計間の矛盾は軽微(F-1, F-2のパス/フロー表記差異)に留まる。実装フェーズへの進行に支障はない。

## decisions

- DR-D1: requirements.md changeTargetsのファイルパス誤り(F-1)は実装フェーズで自然解消されるため、requirements.mdの修正は不要とする。planning.mdのfileChanges表が正であり、Worker指示はplanning.mdを参照する
- DR-D2: flowchart.mmdのtimings未存在時フロー(F-2)は概念的なフロー図としては許容する。厳密な実装仕様はplanning.mdのdetailedChanges L187のif(timings)ガードが正である
- DR-D3: cascading判定のchain途切れ処理(F-3)はplanning.mdの設計通り「最初の連続シーケンスを検出する」方針を維持する。複数連続シーケンスの検出は現状のスコープ外とする
- DR-D4: ui-design.md L12のtypo(F-4)は文書修正の対象としない。コード上のファイル名が正しく、実装に影響しないため
- DR-D5: 設計成果物の全体整合性は合格水準に達しており、追加の設計フェーズ反復は不要とする。軽微な表記差異(F-1~F-4)は実装品質に影響しない

## artifacts

- docs/workflows/harness-analytics-improvement/design-review.md: 本レビュー報告書。6成果物の整合性検証結果
- docs/workflows/harness-analytics-improvement/planning.md: 検証対象。4Worker構成の実装計画
- docs/workflows/harness-analytics-improvement/requirements.md: 検証対象。機能要件6件とAC5件
- docs/workflows/harness-analytics-improvement/threat-model.md: 検証対象。6脅威のSTRIDE分析
- docs/workflows/harness-analytics-improvement/ui-design.md: 検証対象。TOON出力フォーマット設計
- docs/workflows/harness-analytics-improvement/state-machine.mmd: 検証対象。状態遷移図
- docs/workflows/harness-analytics-improvement/flowchart.mmd: 検証対象。処理フローチャート

## next

criticalPath: "implementation フェーズへ進行。Worker-1(新規モジュール2件) -> Worker-2(テスト) + Worker-3(phase-analytics.ts改修) -> Worker-4(analytics-toon.ts + 追加テスト)"
readFiles: "docs/workflows/harness-analytics-improvement/planning.md, docs/workflows/harness-analytics-improvement/design-review.md"
warnings: "F-1(requirements.md changeTargetsパス誤り)に注意。Worker指示時はplanning.mdのfileChanges表を参照すること"
