# Regression Test Report — fix-hook-mcp-state-sync

## Summary
hook-utils.js への TOON 読み込み追加 (readToonPhase / getActivePhaseFromWorkflowState 拡張) が、既存テスト群を破壊していないかを確認する回帰テスト。

## Execution Commands
1. 本修正テスト (新規追加)
   ```
   node --test workflow-harness/hooks/__tests__/hook-utils.test.js
   ```
   結果: pass=7 / fail=0 / total=7 (duration 72.9ms)

2. 全体回帰 (vitest)
   ```
   cd workflow-harness/mcp-server && npm test
   ```
   結果: pass=854 / fail=10 / total=864 / files=103 (2 failed) / exitCode=1 / duration 8.27s

## Aggregate Result
- Total executed: 871 tests (vitest 864 + node --test 7)
- Total pass: 861
- Total fail: 10
- 本修正関連の新規テスト: 7/7 pass (hook-utils.test.js)
- 既存失敗 10件は全て markdown content rules の文言不一致 (本修正の hook-utils.js とは無関係)

## Pre-existing Failures (本修正と無関係)
全 10件が markdown 規約テストの文言不一致。hook-utils.js / TOON 読み込みパス / state-sync ロジックには一切触れない。

| File | Test Name | Reason |
|------|-----------|--------|
| first-pass-improvement.test.ts | TC-AC1-01 Phase Output Rules section exists | coordinator.md 文言不一致 |
| first-pass-improvement.test.ts | TC-AC1-02 decisions quantitative rule (5+) | coordinator.md 文言不一致 |
| first-pass-improvement.test.ts | TC-AC1-03 artifacts enumeration rule | coordinator.md 文言不一致 |
| first-pass-improvement.test.ts | TC-AC1-04 next field must not be empty | coordinator.md 文言不一致 |
| first-pass-improvement.test.ts | TC-AC2-01 Edit Completeness section exists | worker.md 文言不一致 |
| first-pass-improvement.test.ts | TC-AC2-02 partial application prohibition | worker.md 文言不一致 |
| first-pass-improvement.test.ts | TC-AC2-03 all-or-nothing principle | worker.md 文言不一致 |
| hearing-worker-rules.test.ts | TC-AC1-01 confirmation-only prohibition rule | hearing-worker.md 文言不一致 |
| hearing-worker-rules.test.ts | TC-AC2-01 2+ substantively different approaches | hearing-worker.md 文言不一致 |
| hearing-worker-rules.test.ts | TC-AC3-01 merit and demerit required | hearing-worker.md 文言不一致 |

これらは git status で既に Modified 表示されている coordinator.md / worker.md / hearing-worker.md (別 PR 由来) に紐づく既知失敗で、本タスクのスコープ外。

## Baseline Comparison
- 指示プロンプトでは "39件失敗" を既知ベースラインとして除外可と明記。
- 本実行で観測された失敗は 10件。指示の上限ベースラインを大幅に下回る。
- vitest 並列実行時のリソース競合は今回観測されず (前回より改善している可能性)。
- いずれにせよ、本修正で新規追加された hook-utils.test.js (7件) は全件 pass しており、既存テストの新規 regression は 0 件。

## Green Flag Determination
green = TRUE
- 本修正範囲 (hook-utils.js / readToonPhase / getActivePhaseFromWorkflowState) のテストは全件 pass
- 既存失敗 10件は全て本修正と無関係なドキュメント文言テスト
- 指示の baseline 上限 (39件) を大きく下回る
- vitest exit code 1 は既存 markdown rule fail に起因し、hook-utils 由来ではない

## decisions
1. 既存失敗 10件 (first-pass-improvement / hearing-worker-rules) は本修正と無関係な markdown 規約テストであり、hook-utils.js の TOON 拡張とは独立した別系統の修正対象。本タスクのスコープ外として分離。
2. 新規追加された hook-utils.test.js は 7/7 全件 pass。AC-1/AC-2/AC-4 の TC をカバーしており、TOON head-only parse (TC-AC2-04, <50ms 性能契約) も実測でパス。
3. vitest 全体は exitCode=1 だが、green と判定する。理由: (a) 失敗テストの内容が markdown 文言で hook-utils 由来でない、(b) 指示の既知ベースライン 39件失敗より大幅に少ない、(c) 本修正で 854 件の既存テストが引き続き pass し新規 regression は 0 件。
4. 観測 10 < ベースライン 39 の差分は、別 PR で coordinator.md/worker.md/hearing-worker.md の文言が一部改善された結果と推定 (git status 上で Modified 表示)。本修正とは無関係。
5. acceptance フェーズへは "回帰なし・本修正テスト全件 pass" を引き継ぐ。markdown 文言テスト 10 件は別タスク化を推奨。

## artifacts
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js (本修正対象、+73/-6 行)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/hook-utils.test.js (新規テスト、7件)
- C:/ツール/Workflow/workflow-harness/mcp-server/src/__tests__/first-pass-improvement.test.ts (既存失敗、本修正無関係)
- C:/ツール/Workflow/workflow-harness/mcp-server/src/__tests__/hearing-worker-rules.test.ts (既存失敗、本修正無関係)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md (前フェーズ成果物)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/implementation.md (前フェーズ成果物)
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/test-design.md (前フェーズ成果物)

## next
- acceptance フェーズで以下を確認:
  1. AC-1 (.toon-only ワークフロー dir で active phase が取得できる) の end-to-end 検証
  2. AC-2 (TOON head-only parse 4KB 制約) の実環境性能測定
  3. AC-4 (.json と .toon 共存時の precedence: .json 優先) の hook-gate 実呼び出しでの確認
  4. 本修正と無関係な markdown 文言テスト 10件は別 issue 化して分離追跡
- acceptance チェックリスト: hook-utils.test.js 全件 pass / 全体回帰で hook 由来 fail=0 / 既存ベースライン以上 / 性能契約 <50ms

## Evidence Snippets

### hook-utils.test.js (full pass)
```
ok 1 - TC-AC2-01: readToonPhase extracts phase value from minimal TOON
ok 2 - TC-AC2-02: readToonPhase returns undefined when no phase line
ok 3 - TC-AC2-03: readToonPhase swallows malformed binary input
ok 4 - TC-AC2-04: readToonPhase reads head only for oversized input (perf contract)
ok 5 - TC-AC4-01: getActivePhaseFromWorkflowState still works for .json only
ok 6 - TC-AC4-02: .json takes precedence over .toon when both exist
ok 7 - TC-AC1-02: getActivePhaseFromWorkflowState reads .toon when only .toon exists
# tests 7 / pass 7 / fail 0 / duration_ms 72.9346
```

### vitest summary
```
Test Files  2 failed | 101 passed (103)
Tests       10 failed | 854 passed (864)
Duration    8.27s
EXIT=1
```
