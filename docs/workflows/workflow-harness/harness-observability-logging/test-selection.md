# Test Selection: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: test_selection
date: 2026-03-25

## summary

14件のテストケース(TC-AC1-01~TC-AC7-02)から実装優先度と実行順序を決定する。ユニットテスト(vitest)を最優先とし、bash側テストはシェルスクリプトで実装する。既存テストの回帰確認をE2Eテストの前に実施する。

## decisions

- TS-D01: 全14テストケースを実装対象とする。スコープ削減は行わない
- TS-D02: テスト実行順序はユニット(trace-writer.ts) → bash(trace-logger.sh) → 回帰(既存vitest) → E2E(計装検証)の4段階とする
- TS-D03: vitestのテストファイルはworkflow-harness/mcp-server/src/observability/__tests__/trace-writer.test.tsに配置する
- TS-D04: bashテストはworkflow-harness/hooks/__tests__/trace-logger.test.shに配置する。実行はbash直接呼び出し
- TS-D05: パフォーマンステスト(TC-AC7-01)はvitest内でDate.now()計測を行い、CI環境差を考慮して閾値を50ms(設計値)の2倍=100msに設定する
- TS-D06: 並行追記テスト(TC-AC7-02)はNode.jsのchild_process.execSyncで5並列echo追記を実行し、不安定テスト回避のためリトライ付きで実装する

## selectedTests

### Priority 1: ユニットテスト (trace-writer.ts)
- TC-AC6-01: appendTrace正常追記検証 — 基盤機能の最重要テスト
- TC-AC6-02: initTraceFileヘッダ検証 — 初期化ロジックの検証
- TC-AC4-01: recordDoDResults一括記録検証 — ヘルパー関数の検証
- TC-AC6-03: パストラバーサル拒否検証(T-1) — セキュリティ検証
- TC-AC6-04: 10MBサイズ上限検証(T-2) — 防御ロジック検証

### Priority 2: bashテスト (trace-logger.sh)
- TC-AC1-01: ALLOW記録検証 — hook系統の基本動作
- TC-AC1-02: BLOCK記録検証 — hook系統のブロック記録

### Priority 3: 回帰テスト (既存vitest)
- TC-AC2-01: spawn-startイベント検証 — delegate-coordinator.ts回帰
- TC-AC2-02: spawn-completeイベント検証 — delegate-coordinator.ts回帰
- TC-AC3-01: phase-enterイベント検証 — lifecycle-next.ts回帰
- TC-AC3-02: phase-exitイベント検証 — lifecycle-next.ts回帰
- TC-AC5-01: 委譲プロンプトサイズ記録検証 — delegate-coordinator.ts回帰

### Priority 4: パフォーマンス/並行テスト
- TC-AC7-01: 1000回追記パフォーマンス検証 — 50ms未満保証
- TC-AC7-02: 並行追記整合性検証(NFR-3) — 5並列100回追記

## executionPlan

1. vitest実行: trace-writer.test.ts (TC-AC6-01~04, TC-AC4-01)
2. bashテスト実行: trace-logger.test.sh (TC-AC1-01~02)
3. 既存vitest回帰: vitest --run (TC-AC2-01~02, TC-AC3-01~02, TC-AC5-01)
4. パフォーマンステスト: TC-AC7-01, TC-AC7-02

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/test-selection.md | test_selection | 本ファイル: 14テストケース選択、4段階実行順序、優先度定義 |

## next

- test_implフェーズでtrace-writer.test.tsを実装する(Priority 1の5テスト)
- trace-logger.test.shを実装する(Priority 2の2テスト)
- 既存vitestスイートの回帰確認方法を確定する
