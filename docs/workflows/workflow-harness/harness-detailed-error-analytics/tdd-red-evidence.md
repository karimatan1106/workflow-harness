# TDD Red Evidence: harness-detailed-error-analytics

phase: test_impl
date: 2026-03-25
result: all_red

## summary

7テスト全てが期待通りに失敗。実装コードの変更なしでRed状態を確認した。

## test results

| test file | test case | status | failure reason |
|-----------|-----------|--------|----------------|
| error-toon.test.ts | TC-AC1-01 | FAIL | mapChecksForErrorToon is not a function (未実装) |
| error-toon.test.ts | TC-AC1-02 | FAIL | mapChecksForErrorToon is not a function (未実装) |
| phase-analytics.test.ts | TC-AC3-01 | FAIL | passed=trueのcheckがfailuresから除外されない (passedフィルタ未実装) |
| phase-analytics.test.ts | TC-AC3-02 | FAIL | level値が'L3'ではなく'L1'固定 (levelハードコード) |
| phase-analytics.test.ts | TC-AC2-01 | FAIL | result.errorHistoryがundefined (AnalyticsResultにerrorHistory未追加) |
| analytics-toon.test.ts | TC-AC2-02 | FAIL | encodedArg.errorHistoryがundefined (writeAnalyticsToonにerrorHistory出力未追加) |
| analytics-toon.test.ts | TC-AC2-03 | FAIL | encodedArg.errorHistoryがundefined (空配列デフォルト未実装) |

## files created

| file | lines | test cases |
|------|-------|-----------|
| workflow-harness/mcp-server/src/__tests__/error-toon.test.ts | 62 | TC-AC1-01, TC-AC1-02 |
| workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts | 127 | TC-AC2-01, TC-AC3-01, TC-AC3-02 |
| workflow-harness/mcp-server/src/__tests__/analytics-toon.test.ts | 83 | TC-AC2-02, TC-AC2-03 |

## ac coverage

| AC | test cases | status |
|----|-----------|--------|
| AC-1 | TC-AC1-01, TC-AC1-02 | Red (mapChecksForErrorToon未実装) |
| AC-2 | TC-AC2-01, TC-AC2-02, TC-AC2-03 | Red (errorHistory未実装) |
| AC-3 | TC-AC3-01, TC-AC3-02 | Red (passedフィルタ+level修正未実装) |
| AC-4 | TC-AC4-01 | gate check (実装後に検証) |

## run command

```
cd workflow-harness/mcp-server && npx vitest run src/__tests__/error-toon.test.ts src/__tests__/phase-analytics.test.ts src/__tests__/analytics-toon.test.ts
```
