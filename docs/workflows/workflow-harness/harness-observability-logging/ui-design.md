# UI Design: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: ui_design
date: 2026-03-25

## summary

本タスクはGUI/CLIのユーザー向けUIを持たない内部ログ機能である。本ドキュメントではデータインタフェース設計として、observability-events.toonのTOONスキーマ、trace-logger.shのbash関数インタフェース、trace-writer.tsのTypeScript APIを定義する。

## decisions

- UID-D01: observability-events.toonはTOON配列形式(entries[N]{fields})を採用する。7フィールド固定でスキーマバージョニングはtraceVersion:1で管理する
- UID-D02: bash側(trace-logger.sh)のインタフェースはlog_trace_event()関数として、5引数(event, tool, layer, decision, detail)で呼び出す。戻り値はなし(void)
- UID-D03: TypeScript側(trace-writer.ts)のインタフェースはappendTrace(docsDir: string, entry: TraceEntry): void。initTraceFile(docsDir: string, taskId: string): voidで初期化する
- UID-D04: TraceEntryの7フィールドは timestamp, axis, layer, event, detail, durationMs, sizeBytes とする。durationMsとsizeBytesはオプショナル(未指定時は空文字)
- UID-D05: recordDoDResults(docsDir: string, checks: DoDCheckResult[], retryCount: number): void をヘルパーとして提供し、lifecycle-next.tsからの呼び出しを1行に削減する
- UID-D06: エラー時の出力はstderrへの1行メッセージとし、ログ追記失敗がハーネス本体の動作を停止させないよう例外をcatchする
- UID-D07: フェーズ×層×ツールの正解マトリクスはobservability/tool-matrix.tsに定数として定義し、ログとの差分検出に使用する

## toonSchema

出力先: {docsDir}/observability-events.toon

ヘッダ(initTraceFileで書き込み):
- traceVersion: 1
- taskId: {taskId}

エントリ配列:
- entries[N]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}

フィールド定義:
- timestamp: ISO8601形式(MCP側) または エポック秒(bash側、パース時にISO変換)
- axis: tool-access | delegation | phase-time | dod-retry | context-size
- layer: orchestrator | coordinator | worker | system
- event: ALLOW | BLOCK | spawn-start | spawn-complete | spawn-fail | phase-enter | phase-exit | PASS | FAIL | file-read
- detail: ツール名、subagent_type、フェーズ名、チェック名など(自由文字列、引数値は含めない)
- durationMs: 所要時間(ミリ秒)。未計測時は空文字
- sizeBytes: バイト数。未計測時は空文字

出力例:
```
traceVersion: 1
taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
entries[0]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "2026-03-25T05:00:00.000Z",tool-access,orchestrator,ALLOW,Agent(coordinator),,
entries[1]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "1742878800",tool-access,worker,BLOCK,Write(src/foo.ts),,
entries[2]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "2026-03-25T05:00:02.000Z",delegation,orchestrator,spawn-start,coordinator,,1024
entries[3]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "2026-03-25T05:01:30.000Z",phase-time,system,phase-exit,research,80000,
entries[4]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "2026-03-25T05:01:31.000Z",dod-retry,system,FAIL,l2-artifact_exists(research.md),,
```

## bashInterface

ファイル: workflow-harness/hooks/trace-logger.sh

関数シグネチャ:
- log_trace_event <event> <tool> <layer> <decision> [detail]

引数:
- event: ALLOW | BLOCK
- tool: ツール名(例: Agent, Write, Edit, Read)
- layer: orchestrator | coordinator | worker
- decision: ALLOW | BLOCK
- detail: 追加情報(省略可)

内部処理:
1. workflow-state.toonからdocsDirフィールドをgrep -m1で取得
2. date +%sでエポック秒タイムスタンプ取得
3. stat -c%sまたはwc -cでファイルサイズ確認(10MB超過時はスキップ)
4. echo "$ts,tool-access,$layer,$event,$tool,," >> "$docsDir/observability-events.toon"

## typescriptAPI

ファイル: workflow-harness/mcp-server/src/observability/trace-writer.ts

関数:
- initTraceFile(docsDir: string, taskId: string): void -- ヘッダ書き込み。ディレクトリ未存在時はmkdirSync
- appendTrace(docsDir: string, entry: TraceEntry): void -- 1行追記。パス検証+10MB上限チェック
- recordDoDResults(docsDir: string, checks: DoDCheckResult[], retryCount: number): void -- DoD結果一括記録

ファイル: workflow-harness/mcp-server/src/observability/trace-types.ts

型:
- TraceEntry: { timestamp: string, axis: TraceAxis, layer: TraceLayer, event: TraceEvent, detail: string, durationMs?: number, sizeBytes?: number }
- TraceAxis: 'tool-access' | 'delegation' | 'phase-time' | 'dod-retry' | 'context-size'
- TraceLayer: 'orchestrator' | 'coordinator' | 'worker' | 'system'
- TraceEvent: 'ALLOW' | 'BLOCK' | 'spawn-start' | 'spawn-complete' | 'spawn-fail' | 'phase-enter' | 'phase-exit' | 'PASS' | 'FAIL' | 'file-read'

## errorHandling

- appendTrace内の全エラーはtry-catchで捕捉し、stderrに警告を出力して処理を継続する
- trace-logger.shのエラーはstderrに出力し、exit codeは変更しない(hookの判定結果に影響させない)
- パストラバーサル検出時はstderrに"TRACE_PATH_VIOLATION: {path}"を出力して追記をスキップする
- 10MB超過時はstderrに"TRACE_SIZE_EXCEEDED: {size}bytes"を出力して追記をスキップする

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/ui-design.md | ui_design | 本ファイル: TOONスキーマ、bash/TypeScript APIインタフェース設計 |

## next

- specフェーズでtrace-types.tsの完全な型定義コードを確定する
- trace-writer.tsのパス検証ロジック(path.resolve + workflowRootチェック)の具体的実装を確定する
- trace-logger.shのworkflow-state.toonパース方法(grep -m1 'docsDir:')を検証する
- tool-matrix.tsの正解マトリクス定義構造を確定する
