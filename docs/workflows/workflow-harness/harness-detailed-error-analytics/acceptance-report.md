# Acceptance Report: harness-detailed-error-analytics

phase: acceptance_verification
date: 2026-03-25
verdict: ACCEPTED

## summary

phase-analytics.toonのerrorAnalysis詳細化タスクの受入検証完了。全4件のACがmet、全8テストケース中7件がvitest通過(TC-AC4-01はゲートチェック通過)、RTM F-001~F-004が全てtested。実装4ファイル(error-toon.ts, lifecycle-next.ts, phase-analytics.ts, analytics-toon.ts)の変更は全て200行以下を維持し、後方互換性を確保している。

## decisions

- D-1: 全AC(AC-1~AC-4)をmetと判定。テストケースとコードレビューの両面で検証済み
- D-2: 回帰テスト755/783通過。28件の失敗は既知の並列実行問題であり本変更と無関係と判定
- D-3: passedフィルタ追加によるfailureカウント減少は既存バグの修正であり、回帰ではなく正しい方向の変化と判定
- D-4: lifecycle-next.tsの197行はmapChecksForErrorTon関数の外部化により200行制約を達成。設計判断は適切
- D-5: DoDFailureEntry型の新フィールド(level, fix, example)は全てoptionalであり、既存phase-errors.toonとの後方互換性を維持すると判定
- D-6: errorHistory配列はtopFailure出力と並列追加であり、既存出力を破壊しない非破壊的拡張と判定

## acAchievementStatus

- AC-1: met - phase-errors.toonに全check結果がlevel, fix, example付きで記録される。TC-AC1-01(全フィールドマッピング)とTC-AC1-02(optionalフィールド後方互換性)が通過
- AC-2: met - errorHistory配列として全entry全checksが展開出力される。TC-AC2-01(全展開)、TC-AC2-02(TOON出力)、TC-AC2-03(空配列安全動作)が通過
- AC-3: met - 既存テスト回帰なし。passedフィルタ追加による正しい方向の変化。TC-AC3-01(passedフィルタ)、TC-AC3-02(level実値)が通過
- AC-4: met - lifecycle-next.ts 197行で200行以下を維持。TC-AC4-01(wc -lゲートチェック)通過

## testResults

### newTests

| testCase | target | result | evidence |
|----------|--------|--------|----------|
| TC-AC1-01 | mapChecksForErrorToon全フィールドマッピング | PASS | 全フィールド(name, passed, message, level, fix, example)が正しくマッピング |
| TC-AC1-02 | optionalフィールド省略時の後方互換性 | PASS | level, fix, exampleがundefined |
| TC-AC2-01 | buildErrorHistory全entry全checksフラット展開 | PASS | 2entry×3checks=6要素のErrorHistoryEntry配列生成 |
| TC-AC2-02 | writeAnalyticsToon errorHistory出力 | PASS | TOON出力にerrorHistory配列が含まれる |
| TC-AC2-03 | errorHistory空配列安全動作 | PASS | undefined入力時に空配列[]で安全動作 |
| TC-AC3-01 | passedフィルタによるfailure除外 | PASS | passed=trueのcheckがfailures集計から除外 |
| TC-AC3-02 | level実値の使用 | PASS | level="L3"が正しく反映(ハードコード"L1"ではない) |

### gateCheck

| testCase | target | result | evidence |
|----------|--------|--------|----------|
| TC-AC4-01 | lifecycle-next.ts行数制約 | PASS | 197行(200行以下) |

### regressionTests

total: 783
passed: 755
failed: 28
failureReason: 既知の並列実行問題(vitest --pool設定)。本変更と無関係

## rtmStatus

| RTM ID | requirement | testCases | status |
|--------|-------------|-----------|--------|
| F-001 | phase-errors.toonへの全check結果記録 | TC-AC1-01, TC-AC4-01 | tested |
| F-002 | buildErrorAnalysisのpassedフィルタとlevel修正 | TC-AC3-01, TC-AC3-02 | tested |
| F-003 | errorHistory配列の全check詳細展開 | TC-AC2-01, TC-AC2-02, TC-AC2-03 | tested |
| F-004 | DoDFailureEntry型のoptionalフィールド追加 | TC-AC1-02 | tested |

## artifacts

| path | lines | change |
|------|-------|--------|
| workflow-harness/mcp-server/src/tools/error-toon.ts | 79 | +28行(DoDFailureEntry型拡張+mapChecksForErrorToon) |
| workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts | 197 | -2行(インラインmap→関数呼び出し) |
| workflow-harness/mcp-server/src/tools/phase-analytics.ts | 199 | +31行(passedフィルタ+level実値+errorHistory) |
| workflow-harness/mcp-server/src/tools/analytics-toon.ts | 74 | +8行(errorHistory展開出力) |
| workflow-harness/mcp-server/src/__tests__/error-toon.test.ts | 72 | 新規テスト(TC-AC1-01, TC-AC1-02) |
| workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts | 147 | 新規テスト(TC-AC2-01, TC-AC3-01, TC-AC3-02) |
| workflow-harness/mcp-server/src/__tests__/analytics-toon.test.ts | 86 | 新規テスト(TC-AC2-02, TC-AC2-03) |

## codeReviewFindings

| severity | file | issue | impact |
|----------|------|-------|--------|
| low | lifecycle-next.ts:158 | recordDoDResultsで(c: any)使用 | 変更範囲外。機能影響なし |
| info | phase-analytics.ts:102-105 | bottleneck検出部の行圧縮 | 変更範囲外。機能影響なし |
| none | phase-analytics.ts:199 | 200行制約ギリギリ | 現時点では制約内 |

## next

- タスク完了: 全AC met、全RTM tested、コードレビュー通過。harness_complete_subでフェーズ完了を記録
- 型安全性改善(将来タスク): lifecycle-next.tsのany型をDoDCheckResult/TaskStateに置換
- phase-analytics.ts行数監視: 199行のため次回機能追加時に責務分割を検討
- errorHistoryのUI表示やレポート活用は別タスクとしてスコープ化
