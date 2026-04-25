# Design Review: harness-detailed-error-analytics

phase: design_review
date: 2026-03-25
reviewer: coordinator
status: approved

## summary

errorAnalytics詳細化の全設計成果物(requirements, threat-model, planning, state-machine, flowchart, ui-design)を横断レビューした。6成果物間の整合性は高く、FR-1~FR-4の全要件がWorker分解にトレースされている。200行制約、後方互換性、既存出力非破壊の3大リスクは全て設計段階で緩和策が組み込まれている。

## decisions

- DR-D1: requirements→planning整合性は十分と判断する。FR-1はWorker-1+Worker-2、FR-2はWorker-2、FR-3はWorker-2+Worker-3、FR-4はWorker-1に対応し、全FRがWorker分解に含まれている
- DR-D2: AC-1~AC-4の全ACが設計で実現可能と判断する。AC-1はFR-1+FR-4の型拡張+mapping関数で実現、AC-2はFR-3のerrorHistory配列展開で実現、AC-3はFR-2のpassedフィルタで対応、AC-4はmapChecksForErrorToon外部化で実現
- DR-D3: lifecycle-next.tsの行数計算について、requirementsでは現在199行・delta+3=202行(要リファクタ)と識別し、planningではmapChecksForErrorToon外部化によりdelta-5=194行と解決している。実測値198行に対しdelta-2で196行程度が妥当な予測であり、いずれにせよ200行以下を維持できる
- DR-D4: DoDFailureEntry型のoptionalフィールド追加戦略は妥当と判断する。toonDecodeSafeが未知フィールドを無視する設計特性により、既存phase-errors.toonファイルの後方互換性が構造的に保証される
- DR-D5: topFailureとerrorHistoryの並列出力設計は妥当と判断する。既存のgenerateAdvice()やfindBottlenecks()がtopFailureを参照するため、破壊回避は必須要件であり、ui-designのelement-1(維持)とelement-2(新規)の分離が明確
- DR-D6: 成果物間の行数記載に1行程度の差異がある(requirements: 199/51/168行、実測: 198/50/167行)が、設計判断に影響しない軽微な差異であり許容する
- DR-D7: flowchart.mmdのdecisionsセクションにMarkdown太字記法(**text**)が含まれる。Mermaid描画には影響しないコメント部分であり、修正は不要と判断する

## reviewPoints

### RP-1: requirements→planning整合性

結果: 合格 - FR-1~FR-4が全てWorker分解に完全対応

| FR | Planning Worker | 対応状況 |
|----|----------------|---------|
| FR-1: 全check結果記録 | Worker-1(型+関数), Worker-2(呼び出し元) | 完全対応 |
| FR-2: passedフィルタ+level修正 | Worker-2(phase-analytics.ts) | 完全対応 |
| FR-3: errorHistory配列展開 | Worker-2(型定義), Worker-3(出力) | 完全対応 |
| FR-4: 型optional拡張 | Worker-1(error-toon.ts) | 完全対応 |

### RP-2: AC-1~AC-4カバレッジ

結果: 合格 - 全ACが設計要素の組合せで実現可能

| AC | 設計要素 | 実現可能性 |
|----|---------|-----------|
| AC-1: 全check結果記録 | FR-1(mapChecksForErrorToon) + FR-4(optional型拡張) | 可能。型定義とmapping関数が対になっている |
| AC-2: errorHistory全展開 | FR-3(buildErrorHistory + writeAnalyticsToon) | 可能。phase-errors.toon→ErrorHistoryEntry[]→TOON出力のパイプラインが完成 |
| AC-3: テスト回帰なし | FR-2(passedフィルタ追加)。failureカウント減少は意図的なバグ修正 | 可能。既存テストのfailure期待値調整が必要な場合あり |
| AC-4: 200行以下維持 | mapChecksForErrorToon外部化(3行→1行) | 可能。実測198行からdelta-2で196行 |

### RP-3: 200行制約の計算根拠

結果: 合格(軽微な差異あり)

実測値との比較:
- error-toon.ts: 実測50行、requirements記載51行(差異1行)、planning予測69行
- lifecycle-next.ts: 実測198行、requirements記載199行(差異1行)、planning予測194行
- phase-analytics.ts: 実測167行、requirements記載168行(差異1行)、planning予測178行
- analytics-toon.ts: 実測65行、requirements記載65行(一致)、planning予測83行

全ファイルの予測値が200行以下であり、制約を満たす。差異は末尾空行の計数方法による1行程度のもの。

### RP-4: 後方互換性

結果: 合格 - optionalフィールド戦略によりtoonDecodeSafe互換性を保証

optionalフィールド戦略の妥当性:
- DoDFailureEntry.checksにlevel, fix, exampleをoptionalで追加
- toonDecodeSafeは未知フィールドを無視する(threat-model TM-02で分析済み)
- 既存phase-errors.toonファイルは新フィールドを持たないが、optional定義により読み込みエラーは発生しない
- AnalyticsResult.errorHistoryもoptionalフィールドとして追加し、既存コードへの影響を回避

### RP-5: 既存出力の非破壊性

結果: 合格 - topFailure維持とerrorHistory並列追加で既存参照への影響なし

topFailureとerrorHistoryの関係:
- ui-designのelement-1(topFailure)は既存形式をそのまま維持。変更はlevel値のL1ハードコード解消のみ
- ui-designのelement-2(errorHistory)は新規追加の並列配列
- phase-analytics.toonの出力構造: errorAnalysis(既存) + errorHistory(新規) の並列配置
- generateAdvice()やfindBottlenecks()はtopFailure形式のerrorAnalysisを参照するため影響なし

## crossArtifactConsistency

| 検証項目 | requirements | threat-model | planning | state-machine | flowchart | ui-design | 判定 |
|---------|-------------|-------------|---------|--------------|-----------|-----------|------|
| FR-1~FR-4定義 | 定義元 | TM-02,TM-03で参照 | Worker分解に展開 | データフロー反映 | 処理フロー反映 | 出力形式定義 | 整合 |
| AC-1~AC-4定義 | 定義元 | SR-1,SR-2で参照 | acceptanceCriteria転記 | - | - | - | 整合 |
| 200行制約 | NFR-1で定義 | TM-03で脅威化 | fileChangesで予測 | - | - | - | 整合 |
| optional戦略 | decisionsで記載 | TM-D2で根拠化 | detailedChangesで実装 | - | - | - | 整合 |
| topFailure維持 | decisionsで記載 | TM-D5で根拠化 | - | 並列writeで表現 | 最終出力で反映 | element-1で定義 | 整合 |
| dataFlow | dataFlowで定義 | - | architectureで転記 | 全状態遷移で表現 | 全ノードで表現 | dataMappingで変換定義 | 整合 |

## risks

| リスク | 重大度 | 緩和状況 | 判定 |
|-------|-------|---------|------|
| lifecycle-next.ts 200行超過 | medium | mapChecksForErrorToon外部化で解消(planning) | 緩和済み |
| 後方互換性破壊 | high | optionalフィールド+toonDecodeSafe特性(threat-model) | 緩和済み |
| failureカウント変化 | low | passedフィルタはバグ修正(requirements decisions) | 許容済み |
| ファイルサイズ増加 | low | 最大450KB(threat-model TM-01) | 許容済み |
| topFailure/errorHistory不整合 | medium | 同一データソース参照(threat-model TM-05) | 緩和済み |

## acDesignMapping

| AC | 関連FR | 設計要素 | Worker | 実現手段 |
|----|-------|---------|--------|---------|
| AC-1 | FR-1, FR-4 | DoDFailureEntry型拡張 + mapChecksForErrorToon関数 | Worker-1, Worker-2 | error-toon.tsに型+関数追加、lifecycle-next.tsで呼び出し |
| AC-2 | FR-3 | ErrorHistoryEntry型 + buildErrorHistory関数 + writeAnalyticsToon拡張 | Worker-2, Worker-3 | phase-analytics.tsで型+関数、analytics-toon.tsで出力 |
| AC-3 | FR-2 | passedフィルタ追加 + level実値使用 | Worker-2 | phase-analytics.tsのbuildErrorAnalysis修正 |
| AC-4 | FR-1 | mapChecksForErrorToon外部化(3行インライン→1行関数呼出) | Worker-1, Worker-2 | error-toon.tsに関数定義、lifecycle-next.tsで使用 |

## artifacts

- docs/workflows/harness-detailed-error-analytics/design-review.md: 本レビュー結果。6成果物の横断レビューと整合性評価
- docs/workflows/harness-detailed-error-analytics/requirements.md: レビュー対象。機能要件4件とAC4件
- docs/workflows/harness-detailed-error-analytics/threat-model.md: レビュー対象。5脅威のSTRIDE分析と7判断
- docs/workflows/harness-detailed-error-analytics/planning.md: レビュー対象。3Worker直列構成と4ファイル変更詳細
- docs/workflows/harness-detailed-error-analytics/state-machine.mmd: レビュー対象。データフローの状態遷移図
- docs/workflows/harness-detailed-error-analytics/flowchart.mmd: レビュー対象。処理フローチャートと5判断
- docs/workflows/harness-detailed-error-analytics/ui-design.md: レビュー対象。errorHistory出力形式と変換ルール

## next

criticalPath: "Worker-1(error-toon.ts型+関数) -> Worker-2(lifecycle-next.ts+phase-analytics.ts) -> Worker-3(analytics-toon.ts)"
readFiles: "docs/workflows/harness-detailed-error-analytics/design-review.md, docs/workflows/harness-detailed-error-analytics/planning.md"
warnings: "AC-3のテスト回帰確認時、passedフィルタ追加によるfailureカウント変化はバグ修正として許容。テストの期待値更新が必要になる可能性あり"
