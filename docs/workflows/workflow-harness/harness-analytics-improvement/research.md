# Research: harness-analytics-improvement

phase: research
task: harness-analytics-improvement
status: complete

## summary

phase-analytics.ts(199行)、analytics-toon.ts(73行)、error-toon.ts(79行)の3ファイルを調査し、4軸改善の具体的な変更箇所を特定した。

## file-inventory

| path | lines | functions |
|------|-------|-----------|
| workflow-harness/mcp-server/src/tools/phase-analytics.ts | 199 | buildErrorAnalysis, findBottlenecks, generateAdvice, parseHookObsLog, buildErrorHistory, buildAnalytics |
| workflow-harness/mcp-server/src/tools/analytics-toon.ts | 73 | writeAnalyticsToon |
| workflow-harness/mcp-server/src/tools/error-toon.ts | 79 | appendErrorToon, readErrorToon, mapChecksForErrorToon |

## analysis

### axis-A: topFailure偏りの根本原因

buildErrorAnalysis(L42-86)はphase-errors.toonのcheck.passedがfalseの全エントリをカウントする。output_file_existsがtopFailureになる原因は以下の2点:

1. analytics-toon.ts L34でtopFailureは`e.failures[0]`を取得する。failures配列はMap挿入順であり、phase-errors.toonに最初に記録されたチェック(通常はL1のoutput_file_exists)が先頭に来る
2. buildErrorAnalysisのresult(L85)はretries降順ソートだが、failures配列自体はMap挿入順のまま。countが多いチェックが先頭に来る保証がない

根本原因: failures配列がcount降順でソートされていないため、最初に検出されたチェック(L1 output_file_exists)が常にtopFailureとして出力される。

変更箇所: L82のmap後にsort((a, b) => b.count - a.count)を追加。加えて、L1チェックとL2-L4チェックが同一countの場合にL2以上を優先する重み付けロジックを導入する。

### axis-B: bottleneck外れ値検出の不在

findBottlenecks(L89-111)は単純な最大値検出のみ。全フェーズの時間分布を考慮しない。commit(11387s)のような異常値がslowestPhaseとして報告され、セッション中断による壁時計時間と実作業時間の区別がない。

L91-98のtimingsループが外れ値検出の挿入箇所。IQR法の実装は新規ファイルoutlier-detection.tsに分離し、findBottlenecksから呼び出す構造にする。

BottleneckResult型(L13-17)にoutlierPhasesフィールドを追加し、外れ値としてマークされたフェーズを記録する。

### axis-C: advice精度不足

generateAdvice(L124-146)のADVICE_RULES(L114-122)にtdd_red_evidenceパターンがない。現在7ルールのみで、テスト駆動開発の赤フェーズ失敗(tdd_red_evidence)は検出されない。

L122の配列末尾にtdd_red_evidenceルールを追加する。閾値ベースの条件付きルール(例: 同一チェック5回以上で「テスト設計の見直し」を提案)にはgenerateAdvice内のL128-133ループを拡張する。

L138-139の600秒閾値は固定値。外れ値検出結果を参照し、外れ値フェーズには「セッション中断の可能性」を表示する分岐を追加する。

### axis-D: errorHistory活用

buildErrorHistory(L170-187)はphase-errors.toonの全エントリをフラット化するのみ。分類(recurring/cascading/one-off)やフェーズ間相関の分析がない。

DoDFailureEntry型(error-toon.ts L10-23)にはtimestamp, phase, retryCount, checks配列があり、分類に必要なフィールドは揃っている:
- recurring検出: 同一check.nameが3エントリ以上 → checksのname集計で判定可能
- cascading検出: 連続するphase(フェーズ番号の隣接)で同系統の失敗 → phase名からフェーズ番号を抽出して隣接判定
- one-off: 上記に該当しないもの

分類ロジックは新規ファイルerror-classification.tsに実装し、buildAnalytics(L190-198)から呼び出す。AnalyticsResult型にerrorClassificationフィールドを追加する。

### axis-output: TOON出力の拡張箇所

analytics-toon.ts L31-37のerrorAnalysis出力にtopFailureの重み付き値を反映する。L46-56のbottlenecksにoutlierPhasesセクションを追加する。新規のerrorClassification結果をL57付近に追加出力する。

## decisions

- D-RS-1: failures配列のcount降順ソートをbuildErrorAnalysis L82に追加する。topFailure偏りの直接的な修正
- D-RS-2: L1チェックとL2+チェックが同countの場合、L2+を優先する重み付けを導入する。levelフィールドのL数値を重みに変換する
- D-RS-3: IQR外れ値検出はfindBottlenecks L91-98のtimingsループ直前に挿入する。IQR計算自体はoutlier-detection.tsに分離
- D-RS-4: ADVICE_RULESにtdd_red_evidenceルールを追加する。パターン文字列は"tdd_red_evidence"、メッセージは"テスト設計の見直し: red phase失敗が頻発"
- D-RS-5: generateAdvice内に閾値ベース条件ルールを追加する。同一チェック5回以上のfailureに対してテンプレート改善提案を生成
- D-RS-6: BottleneckResult型にoutlierPhases: Array<{ phase: string; seconds: number; iqrScore: number }>を追加する
- D-RS-7: AnalyticsResult型にerrorClassification: { recurring: string[]; cascading: string[][]; oneOff: string[] }を追加する
- D-RS-8: error-toon.tsのDoDFailureEntry型は変更不要。既存フィールド(timestamp, phase, retryCount, checks)で分類に必要な情報が揃っている

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-analytics-improvement/hearing.md | input | ヒアリング結果。4軸改善のスコープと判断 |
| docs/workflows/harness-analytics-improvement/scope-definition.md | input | スコープ定義。7ファイル変更計画 |
| docs/workflows/harness-analytics-improvement/research.md | output | 本リサーチ結果。根本原因分析と変更箇所特定 |

## next

implementationOrder: "1. failures配列ソート(axis-A最小変更), 2. ADVICE_RULES追加(axis-C), 3. outlier-detection.ts新規作成(axis-B), 4. error-classification.ts新規作成(axis-D), 5. analytics-toon.ts出力拡張"
criticalPath: "phase-analytics.tsが199行のため、axis-B/Dの実装前にoutlier-detection.tsとerror-classification.tsへの分離が必須"
testStrategy: "各新規ファイルにユニットテスト作成。phase-analytics.test.tsに統合テスト追加"
