# Test Selection: harness-detailed-error-analytics

phase: test_selection
date: 2026-03-25

## summary

4対象ファイルの影響範囲を分析し、実行すべきテストを選定した。vitest --relatedはv1.6.1で未対応のため、import依存チェーンの手動分析で代替した。3新規テストファイル(error-toon.test.ts, phase-analytics.test.ts, analytics-toon.test.ts)をsrc/__tests__/に作成し、既存handler-lifecycle.test.tsを回帰テストとして実行する。ゲートチェック1件(lifecycle-next.ts行数)を含め、合計5テスト実行単位で全AC(AC-1~AC-4)をカバーする。

## decisions

- TS-D1: テストファイル配置先をsrc/__tests__/(フラット構造)に変更する。test-designではsrc/tools/__tests__/を指定していたが、当該ディレクトリは存在せず、既存86テストファイルは全てsrc/__tests__/に配置されている
- TS-D2: vitest --relatedはv1.6.1で未サポート(v2.x+機能)のため、import依存チェーンの手動分析で影響範囲を特定した
- TS-D3: handler-lifecycle.test.tsを回帰テストとして選定する。handleHarnessNextを直接テストしており、lifecycle-next.tsの変更が既存動作を破壊しないことを検証できる
- TS-D4: stale-task-hmac.test.tsは回帰テスト対象外とする。lifecycle-next.tsを参照するがHMAC検証に特化しており、今回の変更(checksマッピング外部化)とは無関係である
- TS-D5: e2e-mcp-chain.test.tsは回帰テスト対象外とする。E2Eチェーンテストは実行コストが高く、今回の変更はunit-levelで十分検証可能である
- TS-D6: buildErrorHistory()の間接テストはphase-analytics.test.tsでbuildAnalytics()経由で実施する。非export関数のため直接テスト不可(TD-D1踏襲)

## targetFiles

| source file | path | existing tests | new tests |
|-------------|------|---------------|-----------|
| error-toon.ts | workflow-harness/mcp-server/src/tools/error-toon.ts | none | error-toon.test.ts |
| lifecycle-next.ts | workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts | handler-lifecycle.test.ts (indirect) | gate check (wc -l) |
| phase-analytics.ts | workflow-harness/mcp-server/src/tools/phase-analytics.ts | none | phase-analytics.test.ts |
| analytics-toon.ts | workflow-harness/mcp-server/src/tools/analytics-toon.ts | none | analytics-toon.test.ts |

## dependencyChain

```
error-toon.ts <-- lifecycle-next.ts (appendErrorToon, mapChecksForErrorToon)
error-toon.ts <-- phase-analytics.ts (readErrorToon)
phase-analytics.ts <-- analytics-toon.ts (AnalyticsResult type)
phase-analytics.ts <-- lifecycle-completion.ts (buildAnalytics)
analytics-toon.ts <-- lifecycle-completion.ts (writeAnalyticsToon)
phase-analytics.ts <-- lifecycle-start-status.ts (buildAnalytics)
analytics-toon.ts <-- lifecycle-start-status.ts (writeAnalyticsToon)
```

## selectedTests

### new (3 files, 8 test cases)

| file | path | test cases | AC coverage |
|------|------|-----------|-------------|
| error-toon.test.ts | workflow-harness/mcp-server/src/__tests__/error-toon.test.ts | TC-AC1-01, TC-AC1-02 | AC-1 |
| phase-analytics.test.ts | workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts | TC-AC2-01, TC-AC3-01, TC-AC3-02 | AC-2, AC-3 |
| analytics-toon.test.ts | workflow-harness/mcp-server/src/__tests__/analytics-toon.test.ts | TC-AC2-02, TC-AC2-03 | AC-2 |

### existing (regression, 1 file)

| file | path | purpose |
|------|------|---------|
| handler-lifecycle.test.ts | workflow-harness/mcp-server/src/__tests__/handler-lifecycle.test.ts | lifecycle-next.ts変更の回帰検証 |

### gate check (1 check)

| check | command | expected | AC coverage |
|-------|---------|----------|-------------|
| TC-AC4-01 | wc -l workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts | 200以下 | AC-4 |

## executionOrder

```
1. error-toon.test.ts (TC-AC1-01, TC-AC1-02)
   依存: error-toon.tsの型定義とmapChecksForErrorToon関数
2. phase-analytics.test.ts (TC-AC2-01, TC-AC3-01, TC-AC3-02)
   依存: error-toon.ts(readErrorToon), phase-analytics.ts(buildAnalytics, buildErrorAnalysis)
3. analytics-toon.test.ts (TC-AC2-02, TC-AC2-03)
   依存: phase-analytics.ts(ErrorHistoryEntry型), analytics-toon.ts(writeAnalyticsToon)
4. gate check: wc -l lifecycle-next.ts (TC-AC4-01)
   依存: lifecycle-next.tsの実装完了
5. handler-lifecycle.test.ts (regression)
   依存: 全実装完了後
```

## runCommand

```bash
cd workflow-harness/mcp-server
npx vitest run src/__tests__/error-toon.test.ts src/__tests__/phase-analytics.test.ts src/__tests__/analytics-toon.test.ts src/__tests__/handler-lifecycle.test.ts
wc -l src/tools/handlers/lifecycle-next.ts
```

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-detailed-error-analytics/test-selection.md | test_selection output | 本ファイル: 3新規+1回帰+1ゲート、計5実行単位 |
| docs/workflows/harness-detailed-error-analytics/test-design.md | input | 8テストケース設計、3テストファイル、1ゲートチェック |
| docs/workflows/harness-detailed-error-analytics/planning.md | input | 4ファイル変更の詳細設計とWorker分解 |

## next

- criticalPath: error-toon.test.ts作成 -> phase-analytics.test.ts作成 -> analytics-toon.test.ts作成 -> 実装 -> テスト実行 -> gate check -> regression
- readFiles: docs/workflows/harness-detailed-error-analytics/test-selection.md, docs/workflows/harness-detailed-error-analytics/test-design.md
- warnings: テストファイル配置先がtest-designのsrc/tools/__tests__/からsrc/__tests__/に変更された(TS-D1)。test_code_genフェーズではsrc/__tests__/を使用すること
