# Test Design: harness-detailed-error-analytics

phase: test_design
date: 2026-03-25

## summary

phase-analytics.toonのerrorAnalysis詳細化に対するテスト設計。mapChecksForErrorToon(error-toon.ts)の全フィールドマッピングとoptionalフィールド後方互換性、buildErrorAnalysis(phase-analytics.ts)のpassedフィルタとlevel実値使用、buildErrorHistory経由のerrorHistory全展開、writeAnalyticsToon(analytics-toon.ts)のerrorHistory出力と空配列安全動作、lifecycle-next.tsの200行制約を検証する。8テストケース、3テストファイル、1ゲートチェックで全AC(AC-1~AC-4)をカバーする。

## decisions

- TD-D1: buildErrorHistory()は非exportのため、buildAnalytics()経由でerrorHistoryを検証する。直接テスト不可の内部関数はpublic API経由で間接検証する
- TD-D2: phase-errors.toonのread/writeはファイルシステムモックを使用する。vi.mock('fs')でreadFileSync/writeFileSyncをスタブ化し、実ファイルI/Oを回避する
- TD-D3: TC-AC4-01の行数検証はBashのwc -lコマンドで実行する。vitestテストではなく実装後のゲートチェックとして位置付ける
- TD-D4: TC-AC3-01のpassedフィルタテストでは、同一entry内にpassed=trueとpassed=falseのcheckを混在させ、フィルタの正確性を検証する
- TD-D5: テストファイル配置はソースファイルと同階層の__tests__ディレクトリに従う。error-toon.test.ts, phase-analytics.test.ts, analytics-toon.test.tsをtools/__tests__/に配置する
- TD-D6: analytics-toon.tsのwriteAnalyticsToon検証では、toonEncodeの出力をパースせず、writeFileSyncに渡された引数を検査する。TOON形式のパース実装に依存しないテスト設計とする

## testCases

### TC-AC1-01: mapChecksForErrorToon全フィールドマッピング (AC-1)
- 対象関数: mapChecksForErrorToon() (error-toon.ts)
- 入力: checks配列(check, passed, evidence, level, fix, example全フィールドあり)
- 期待結果: 各要素が{name: check値, passed, message: evidence値, level, fix, example}にマッピングされる
- 検証方法: vitestで返却値の各フィールドを厳密比較(toEqual)
- RTM: F-001

### TC-AC1-02: optionalフィールド省略時の後方互換性 (AC-1)
- 対象関数: mapChecksForErrorToon() (error-toon.ts)
- 入力: checks配列(level, fix, exampleを含まない)
- 期待結果: 各要素のlevel, fix, exampleがundefinedとなる
- 検証方法: vitestで返却値のlevel, fix, exampleがundefinedであることをassert
- RTM: F-004

### TC-AC2-01: buildErrorHistory全entry全checksフラット展開 (AC-2)
- 対象関数: buildErrorHistory() (phase-analytics.ts、非export)
- 入力: phase-errors.toonに2 entry、各3 checksの合計6 check
- 期待結果: ErrorHistoryEntry[]の長さ6。各要素にphase, retryCount, check, level, passed, evidenceが含まれる
- 検証方法: buildAnalytics()経由でerrorHistoryフィールドを検証(buildErrorHistoryは非exportのため)
- RTM: F-003 (errorHistory配列展開)

### TC-AC2-02: writeAnalyticsToonがerrorHistory配列を含む出力を生成 (AC-2)
- 対象関数: writeAnalyticsToon() (analytics-toon.ts)
- 入力: AnalyticsResult with errorHistory=[{phase:"planning", retryCount:1, check:"toon_safety", level:"L2", passed:false, evidence:"missing field"}]
- 期待結果: 生成されたTOONファイルにerrorHistory配列が存在し、各要素にphase, retry, check, level, passed, evidenceフィールドがある
- 検証方法: writeFileSyncモックの呼び出し引数を検査し、errorHistory配列の構造を検証する
- RTM: F-003 (writeAnalyticsToon出力)

### TC-AC2-03: errorHistory空配列時の安全動作 (AC-2)
- 対象関数: writeAnalyticsToon() (analytics-toon.ts)
- 入力: AnalyticsResult with errorHistory=undefined (省略)
- 期待結果: エラーなく動作。errorHistoryは空配列[]として出力される
- 検証方法: writeFileSyncモックの呼び出し引数を検査し、errorHistoryが空配列であることを確認する
- RTM: F-003 (空配列ガード)

### TC-AC3-01: passedフィルタによるfailure除外 (AC-3)
- 対象関数: buildErrorAnalysis() (phase-analytics.ts)
- 入力: phase-errors.toonに{passed:true, name:"check_a"}と{passed:false, name:"check_b"}を含むentry
- 期待結果: PhaseErrorStats.failuresにcheck_bのみ含まれ、check_aは除外される
- 検証方法: buildErrorAnalysis()の返却値のfailures配列をフィルタ結果と照合する
- RTM: F-002

### TC-AC3-02: level実値の使用 (AC-3)
- 対象関数: buildErrorAnalysis() (phase-analytics.ts)
- 入力: phase-errors.toonに{level:"L3", name:"check_c", passed:false}を含むentry
- 期待結果: PhaseErrorStats.failures内のcheck_cのlevelが"L3"("L1"ではない)
- 検証方法: failures配列内の該当要素のlevelフィールドを文字列比較する
- RTM: F-002

### TC-AC4-01: lifecycle-next.ts行数制約 (AC-4)
- 検証方法: wc -l workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts
- 期待結果: 200以下
- 検証タイミング: 実装完了後のゲートチェック(vitestテストではない)
- RTM: F-001

## acTcMapping

- AC-1: TC-AC1-01(全フィールドマッピング検証), TC-AC1-02(optionalフィールド後方互換性検証)
- AC-2: TC-AC2-01(errorHistory全展開検証), TC-AC2-02(writeAnalyticsToon errorHistory出力検証), TC-AC2-03(errorHistory空配列安全動作検証)
- AC-3: TC-AC3-01(passedフィルタ検証), TC-AC3-02(level実値使用検証)
- AC-4: TC-AC4-01(lifecycle-next.ts行数制約検証)

## rtm

| RTM ID | Test Cases | AC |
|--------|-----------|-----|
| F-001 | TC-AC1-01, TC-AC4-01 | AC-1, AC-4 |
| F-002 | TC-AC3-01, TC-AC3-02 | AC-3 |
| F-003 | TC-AC2-01, TC-AC2-02, TC-AC2-03 | AC-2 |
| F-004 | TC-AC1-02 | AC-1 |

## testFiles

| file | testCases | framework |
|------|-----------|-----------|
| workflow-harness/mcp-server/src/tools/__tests__/error-toon.test.ts | TC-AC1-01, TC-AC1-02 | vitest |
| workflow-harness/mcp-server/src/tools/__tests__/phase-analytics.test.ts | TC-AC2-01, TC-AC3-01, TC-AC3-02 | vitest |
| workflow-harness/mcp-server/src/tools/__tests__/analytics-toon.test.ts | TC-AC2-02, TC-AC2-03 | vitest |
| (gate check) | TC-AC4-01 | wc -l |

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-detailed-error-analytics/test-design.md | test_design | 本ファイル: 8テストケース、3テストファイル、1ゲートチェック |
| docs/workflows/harness-detailed-error-analytics/requirements.md | input | AC-1~AC-4定義 |
| docs/workflows/harness-detailed-error-analytics/planning.md | input | Worker分解と詳細変更仕様 |
| docs/workflows/harness-detailed-error-analytics/design-review.md | input | 設計整合性レビュー結果 |

## next

- criticalPath: error-toon.test.ts(TC-AC1-01,02) -> phase-analytics.test.ts(TC-AC2-01,AC3-01,02) -> analytics-toon.test.ts(TC-AC2-02,03) -> gate check(TC-AC4-01)
- readFiles: docs/workflows/harness-detailed-error-analytics/test-design.md, docs/workflows/harness-detailed-error-analytics/planning.md
- warnings: buildErrorHistory()は非exportのためbuildAnalytics()経由で検証する必要がある。phase-errors.toonのファイルI/Oモックが正しく設定されないとTC-AC2-01, TC-AC3-01, TC-AC3-02が偽陽性になる
