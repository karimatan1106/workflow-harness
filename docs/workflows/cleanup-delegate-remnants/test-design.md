# Test Design: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

dead code 除去タスクのテスト設計。新規テスト作成は不要。
既存テストのリグレッション確認と、削除対象の残存チェックが主体。

## decisions

- TC-AC1-01 は grep ベースの静的検証とする。tool-gate.js の HARNESS_LIFECYCLE Set 内に harness_delegate_coordinator が含まれないことを文字列検索で確認する。実行時テストより確実かつ高速である
- TC-AC2-01 は grep ベースの静的検証とする。stream-progress-tracker.ts 内に "coordinator subprocess" が含まれないことを検索で確認する。JSDoc 修正はコンパイル不要のため静的チェックで十分である
- TC-AC3-01 はファイル存在チェックで検証する。dist/ 配下に delegate-coordinator.js, delegate-work.js, coordinator-spawn.js が存在しないことを ls/stat で確認する。12ファイル全てを対象とする
- TC-AC3-02 は npm run build の exit code 0 で検証する。ビルド成功はコンパイルエラーがないことの証明であり、削除ファイルが再生成されないことも同時に確認できる
- TC-AC4-01 は vitest run で全既存テストパスを検証する。dead reference 除去がランタイム動作に影響しないことのリグレッション確認である
- TC-AC5-01 は grep -r でソースツリー全体を走査する。harness_delegate_coordinator への参照がゼロであることを保証する。dist/, node_modules/ は除外する
- 新規テストファイルは作成しない。変更はロジック変更を含まず、既存テスト通過と静的検証で品質保証が成立する

## Test Cases

### TC-AC1-01: tool-gate allowlist 検証

- 対象: workflow-harness/hooks/tool-gate.js
- 手法: grep "harness_delegate_coordinator" tool-gate.js の結果が空であること
- AC mapping: AC-1
- RTM: F-001
- 期待結果: 一致行ゼロ (allowlist内)

### TC-AC2-01: JSDoc 修正検証

- 対象: workflow-harness/mcp-server/src/tools/handlers/stream-progress-tracker.ts
- 手法: grep "coordinator subprocess" stream-progress-tracker.ts の結果が空であること
- AC mapping: AC-2
- RTM: F-002
- 期待結果: 一致行ゼロ (JSDoc内)

### TC-AC3-01: dist stale file 除去検証

- 対象: workflow-harness/mcp-server/dist/tools/handlers/
- 手法: ls で以下のファイルが存在しないことを確認
  - delegate-coordinator.js, .js.map, .d.ts, .d.ts.map
  - delegate-work.js, .js.map, .d.ts, .d.ts.map
  - coordinator-spawn.js, .js.map, .d.ts, .d.ts.map
- AC mapping: AC-3
- RTM: F-003
- 期待結果: 12ファイル全て存在しない

### TC-AC3-02: ビルド成功検証

- 対象: workflow-harness/mcp-server/
- 手法: npm run build を実行し exit code 0 を確認
- AC mapping: AC-3 (削除ファイル非再生成の間接確認)
- RTM: F-003
- 期待結果: exit code 0、削除済みファイルが再出現しない

### TC-AC4-01: リグレッションテスト

- 対象: workflow-harness/mcp-server/ 全テスト
- 手法: vitest run を実行し全テストパスを確認
- AC mapping: AC-4
- RTM: F-004
- 期待結果: 全テスト pass、failure ゼロ

### TC-AC5-01: 残存参照ゼロ検証

- 対象: workflow-harness/ 配下全ソース (dist/, node_modules/ 除外)
- 手法: grep -r "harness_delegate_coordinator" --include="*.ts" --include="*.js" --include="*.json" で検索
- AC mapping: AC-5
- RTM: F-005
- 期待結果: 一致行ゼロ (ソース全体)

## AC-TC Mapping

| AC | TC | 検証手法 |
|----|-----|---------|
| AC-1 | TC-AC1-01 | grep 静的検証 |
| AC-2 | TC-AC2-01 | grep 静的検証 |
| AC-3 | TC-AC3-01, TC-AC3-02 | ファイル存在チェック + ビルド検証 |
| AC-4 | TC-AC4-01 | vitest リグレッション |
| AC-5 | TC-AC5-01 | grep ソースツリー走査 |

## RTM Traceability

| RTM ID | AC | TC | Status |
|--------|-----|-----|--------|
| F-001 | AC-1 | TC-AC1-01 | designed |
| F-002 | AC-2 | TC-AC2-01 | designed |
| F-003 | AC-3 | TC-AC3-01, TC-AC3-02 | designed |
| F-004 | AC-4 | TC-AC4-01 | designed |
| F-005 | AC-5 | TC-AC5-01 | designed |

## artifacts

- test-design.md: 本ドキュメント。テストケース6件、AC-TCマッピング、RTMトレーサビリティを含む

## next

implementation フェーズ: scope-definition.md の Change Inventory に従い、tool-gate.js 編集、stream-progress-tracker.ts 編集、dist/ 12ファイル削除、npm run build 実行

## acTcMapping

- AC-1: TC-AC1-01
- AC-2: TC-AC2-01
- AC-3: TC-AC3-01, TC-AC3-02
- AC-4: TC-AC4-01
- AC-5: TC-AC5-01
