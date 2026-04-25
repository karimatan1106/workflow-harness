# Planning: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: planning
date: 2026-03-25

## summary

ハーネスのオブザーバビリティログ機能を4Worker構成で実装する計画。新規3ファイル(observability基盤)と既存4ファイルへの計装を、基盤→計装3並列の順で実行する。全ファイル200行以下を厳守し、行数超過リスクのある既存ファイルにはヘルパー関数による行数削減を適用する。

## decisions

- PL-D01: 実装を4Workerに分割する。Worker-1(基盤)→Worker-2,3,4(計装)の逐次→並列構成とし、基盤モジュールの完成を計装の前提条件とする
- PL-D02: 新規ファイルはworkflow-harness/mcp-server/src/observability/ディレクトリに集約する。trace-types.ts(型定義)、trace-writer.ts(追記関数)、hooks/trace-logger.sh(bash側)の3ファイル構成
- PL-D03: lifecycle-next.ts(178行)の行数超過リスクに対し、DoD結果のtrace記録をtrace-writer.ts側のヘルパー関数recordDoDResults()に集約する。呼び出し元は1行で済む設計とする
- PL-D04: delegate-coordinator.ts(174行)も同様に、appendTrace()の1行呼び出しに統一し、オブジェクトリテラルをインラインで渡す
- PL-D05: pre-tool-guard.sh(107行)へのログ追加はtrace-logger.shのsource+関数呼び出し(1行)で実装し、120行以内に収める
- PL-D06: bash側タイムスタンプはdate +%s(エポック秒)を使用する。MINGW環境での%3N非対応を回避するため
- PL-D07: observability-events.toonをDoD対象アーティファクトから明示的に除外する(T-6緩和策)

## implementationPlan

### Worker-1: observability基盤モジュール (逐次実行)

目的: FR-6(TOON出力基盤) + FR-7(パフォーマンス制約)

新規ファイル:
- workflow-harness/mcp-server/src/observability/trace-types.ts -- TraceEntry型(7フィールド)、TraceAxis列挙(5値: tool-access, delegation, phase-time, dod-retry, context-size)、TraceEvent列挙(10値: ALLOW, BLOCK, spawn-start, spawn-complete, spawn-fail, phase-enter, phase-exit, PASS, FAIL, file-read)
- workflow-harness/mcp-server/src/observability/trace-writer.ts -- appendTrace(docsDir, entry)関数。appendFileSyncで1行追記。パス検証(T-1)、10MB上限(T-2)、ヘッダ初期化(initTraceFile)、recordDoDResults()ヘルパー
- workflow-harness/hooks/trace-logger.sh -- log_trace_event(event, tool, layer, decision, detail)関数。workflow-state.toonからdocsDirをgrep取得。echo >>で1行追記。date +%sでタイムスタンプ

### Worker-2: hookイベントログ計装 (Worker-1完了後、並列可)

目的: FR-1(AC-1) -- pre-tool-guard.shの全判定でALLOW/BLOCK記録

変更ファイル:
- workflow-harness/hooks/pre-tool-guard.sh -- 4判定ブロックの各exitポイントでtrace-logger.shのlog_trace_event()を呼び出し。sourceは冒頭で1回のみ。ALLOW(exit 0)とBLOCK(exit 2)の両方を記録

### Worker-3: MCPライフサイクル計装 (Worker-1完了後、並列可)

目的: FR-3(AC-3) + FR-4(AC-4) -- フェーズ時間計測 + DoD判定ログ

変更ファイル:
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts -- runDoDChecks前後にphase-enter/phase-exitイベント記録。DoD結果はrecordDoDResults(docsDir, checks, retryCount)で一括記録。retryCount>=3のVDB-1警告もログ記録
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-start-status.ts -- handleHarnessStart内でinitTraceFile(docsDir, taskId)呼び出し。traceVersion:1とtaskIdのヘッダを書き込み

### Worker-4: MCP委譲計装 (Worker-1完了後、並列可)

目的: FR-2(AC-2) + FR-5(AC-5) -- Agent spawnイベント + コンテキストサイズ

変更ファイル:
- workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts -- spawn実行前にspawn-startイベント記録(detail=subagent_type, sizeBytes=fullInstruction.length)。完了後にspawn-complete+durationMs記録(sizeBytes=stdout.length)。catchブロックにspawn-failイベント記録

## executionOrder

1. Worker-1: observability基盤モジュール新規作成(逐次)
2. Worker-2 + Worker-3 + Worker-4: 計装追加(並列)

## riskMitigation

- lifecycle-next.ts行数超過: recordDoDResults()ヘルパーにDoD記録を集約し、呼び出し元は1行に削減
- delegate-coordinator.ts行数超過: appendTrace()のインライン呼び出しで最小行数化
- trace-logger.sh実行権限: git update-index --chmod=+xを実装フェーズで付与
- observability/ディレクトリ未存在: Worker-1でmkdirSync(recursive:true)で作成
- NTFS並行追記(T-3): append-only設計で残存リスクMを許容。実運用では逐次呼び出しのため発生確率は低い

## testStrategy

- trace-types.ts: 型定義のみのためユニットテスト不要。TypeScriptコンパイルで検証
- trace-writer.ts: appendTrace()の追記動作、パス検証(T-1)、10MB上限(T-2)をvitestで検証
- trace-logger.sh: bash関数のecho出力をbats-coreまたはシェルスクリプトテストで検証。MINGW環境での動作確認
- 計装(Worker-2,3,4): 既存テストが破壊されないことをvitest --runで確認。observability-events.toonの生成をE2Eテストで検証

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/planning.md | planning | 本ファイル: 4Worker構成の実装計画、リスク緩和策、テスト戦略 |

## next

- specフェーズでtrace-types.tsの型定義詳細(TraceEntry/TraceAxis/TraceEvent)を確定する
- trace-writer.tsのappendTrace() APIシグネチャとrecordDoDResults()ヘルパーの設計を確定する
- trace-logger.shのbash関数インタフェースとworkflow-state.toonのgrep取得ロジックを確定する
- 各既存ファイルの計装挿入箇所をコード行レベルで特定する
