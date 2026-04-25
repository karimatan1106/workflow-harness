# Test Design: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: test_design
date: 2026-03-25

## summary

ハーネスのオブザーバビリティログ機能に対するテスト設計。trace-writer.ts(TypeScript側)のユニットテスト、trace-logger.sh(bash側)のシェルテスト、および計装済み既存ファイルの回帰テストを定義する。AC-1~AC-7の全受入基準に対応するテストケースを設計し、TC-ACマッピングで追跡可能性を確保する。

## decisions

- TD-D01: trace-writer.tsのユニットテストはvitestで実装する。一時ディレクトリ(tmp)を使用してファイルシステム操作を検証する
- TD-D02: trace-logger.shのテストはbashスクリプトで実装する。一時ディレクトリに模擬workflow-state.toonを配置してdocsDir解決を検証する
- TD-D03: 既存ファイル(lifecycle-next.ts, delegate-coordinator.ts, lifecycle-start-status.ts)の回帰テストは既存vitestスイートの再実行で確認する
- TD-D04: パストラバーサル(T-1)とサイズ上限(T-2)のエッジケースは専用テストケースで検証する
- TD-D05: パフォーマンステスト(AC-7)はDate.now()差分で計測し、1000回追記の平均が50ms未満であることを検証する
- TD-D06: MINGW互換性(NFR-2)はdate +%sの出力が数値であることをアサーションで確認する
- TD-D07: 並行追記(NFR-3)テストはNode.jsのchild_process.execSyncで5並列のecho追記を実行し、行数の整合性を検証する

## testCases

### TC-AC6-01: appendTrace正常追記 (AC-6)
- 前提条件: 空のdocsDir、initTraceFile実行済み
- 入力: TraceEntry{timestamp, axis:tool-access, layer:orchestrator, event:ALLOW, detail:Agent}
- 期待結果: observability-events.toonにヘッダ+1エントリが追記される。TOON配列形式に準拠
- 検証方法: ファイル読み込み後にtoonDecodeSafe()でパース成功を確認

### TC-AC6-03: パストラバーサル拒否 (T-1)
- 前提条件: docsDir = "../../etc/cron.d"
- 入力: appendTrace(maliciousPath, validEntry)
- 期待結果: 追記されない。stderr出力に"TRACE_PATH_VIOLATION"を含む
- 検証方法: ファイル未生成をassert、consoleError mockで検証

### TC-AC6-04: 10MBサイズ上限 (T-2)
- 前提条件: 10MB超の検証用ファイルをdocsDir/observability-events.toonとして配置
- 入力: appendTrace(docsDir, validEntry)
- 期待結果: 追記されない。stderr出力に"TRACE_SIZE_EXCEEDED"を含む
- 検証方法: ファイルサイズ変化なしをassert

### TC-AC6-02: initTraceFileヘッダ書き込み (AC-6)
- 前提条件: docsDir未存在
- 入力: initTraceFile(docsDir, "test-task-id")
- 期待結果: ディレクトリ作成、observability-events.toonにtraceVersion:1とtaskIdヘッダが書き込まれる
- 検証方法: ファイル内容の先頭2行を文字列比較

### TC-AC2-01: spawn-startイベント検証 (AC-2)
- 前提条件: initTraceFile実行済み、delegate-coordinator計装済み
- 入力: coordinator spawn開始時のログ呼び出し
- 期待結果: observability-events.toonにaxis=agent-spawn, event=spawn-startエントリが追記される
- 検証方法: 既存delegate-coordinator回帰テスト実行後、toonファイル内のspawn-startエントリ存在を確認

### TC-AC2-02: spawn-completeイベント検証 (AC-2)
- 前提条件: initTraceFile実行済み、delegate-coordinator計装済み
- 入力: coordinator spawn完了時のログ呼び出し
- 期待結果: observability-events.toonにaxis=agent-spawn, event=spawn-completeエントリが追記される
- 検証方法: 既存delegate-coordinator回帰テスト実行後、toonファイル内のspawn-completeエントリ存在を確認

### TC-AC3-01: phase-enterイベント検証 (AC-3)
- 前提条件: initTraceFile実行済み、lifecycle-next計装済み
- 入力: フェーズ遷移開始時のログ呼び出し
- 期待結果: observability-events.toonにaxis=phase-transition, event=phase-enterエントリが追記される
- 検証方法: 既存lifecycle-next回帰テスト実行後、toonファイル内のphase-enterエントリ存在を確認

### TC-AC3-02: phase-exitイベント検証 (AC-3)
- 前提条件: initTraceFile実行済み、lifecycle-next計装済み
- 入力: フェーズ遷移完了時のログ呼び出し
- 期待結果: observability-events.toonにaxis=phase-transition, event=phase-exitエントリが追記される
- 検証方法: 既存lifecycle-next回帰テスト実行後、toonファイル内のphase-exitエントリ存在を確認

### TC-AC4-01: recordDoDResults一括記録 (AC-4)
- 前提条件: initTraceFile実行済み、3件のDoDCheckResult(2 PASS, 1 FAIL)
- 入力: recordDoDResults(docsDir, checks, retryCount=1)
- 期待結果: 3エントリが追記される。FAIL分はevidence/fixをdetailに含む
- 検証方法: ファイル行数確認 + 各行のaxis=dod-retry検証

### TC-AC1-01: trace-logger.sh ALLOW記録 (AC-1)
- 前提条件: 模擬workflow-state.toonにdocsDir設定済み
- 入力: log_trace_event ALLOW Agent orchestrator ALLOW "Agent(coordinator)"
- 期待結果: observability-events.toonにtool-access,orchestrator,ALLOW行が追記
- 検証方法: grep "tool-access,orchestrator,ALLOW" で1行ヒット

### TC-AC1-02: trace-logger.sh BLOCK記録 (AC-1)
- 前提条件: 模擬workflow-state.toonにdocsDir設定済み
- 入力: log_trace_event BLOCK Write worker BLOCK "Write(src/foo.ts)"
- 期待結果: observability-events.toonにtool-access,worker,BLOCK行が追記
- 検証方法: grep "tool-access,worker,BLOCK" で1行ヒット

### TC-AC7-01: パフォーマンス検証 (AC-7)
- 前提条件: initTraceFile実行済み
- 入力: 1000回のappendTrace連続呼び出し
- 期待結果: 1000エントリが正常追記。平均1回あたり50ms未満
- 検証方法: Date.now()差分 / 1000 < 50をassert

### TC-AC7-02: 並行追記整合性 (NFR-3)
- 前提条件: initTraceFile実行済み
- 入力: 5並列プロセスから各20回追記(計100回)
- 期待結果: ファイル行数がヘッダ2行+100エントリ=102行
- 検証方法: wc -l結果を検証。各行がTOON形式として有効であることをパースで確認

## acTcMapping

- AC-1: TC-AC1-01(ALLOW記録検証), TC-AC1-02(BLOCK記録検証)
- AC-2: TC-AC2-01(spawn-startイベント検証), TC-AC2-02(spawn-completeイベント検証)
- AC-3: TC-AC3-01(phase-enterイベント検証), TC-AC3-02(phase-exitイベント検証)
- AC-4: TC-AC4-01(recordDoDResults一括記録検証)
- AC-5: TC-AC5-01(委譲プロンプトサイズ記録検証)
- AC-6: TC-AC6-01(appendTrace正常追記検証), TC-AC6-02(initTraceFileヘッダ検証), TC-AC6-03(パストラバーサル拒否), TC-AC6-04(サイズ上限拒否)
- AC-7: TC-AC7-01(1000回追記パフォーマンス検証), TC-AC7-02(並行追記整合性検証)

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/test-design.md | test_design | 本ファイル: 9テストケース、AC-TCマッピング、エッジケース検証設計 |

## next

- test_selectionフェーズでテスト実行順序と優先度を決定する
- test_implフェーズでvitest + bashテストスクリプトを実装する
- TC-AC6-03(パストラバーサル)とTC-AC6-04(サイズ上限)のモック戦略を確定する
- TC-AC7-02(並行追記)のchild_process実装方法を確定する
