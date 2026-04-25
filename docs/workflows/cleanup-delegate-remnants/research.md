# Research: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

delegate-coordinator 機能は既に廃止済みだが、3箇所に残骸が残っている。
ソースファイル(.ts)は既に削除済みであり、残っているのはビルド成果物(dist/)と
参照コード内の文字列のみ。影響範囲は限定的で、安全に削除・修正可能。

## Findings

### 1. tool-gate.js - HARNESS_LIFECYCLE 配列 (行11)

- ファイル: `workflow-harness/hooks/tool-gate.js`
- 行番号: 11
- 内容: `'harness_delegate_coordinator'` が HARNESS_LIFECYCLE Set に含まれる
- 現状: このエントリはL1オーケストレーターが harness_delegate_coordinator MCP ツールを
  呼び出す権限を許可している。ツール自体が廃止済みのため不要。
- 対処: 行11から `'harness_delegate_coordinator',` を削除する。
  後続の `'harness_set_scope'` は同行に残す。

### 2. stream-progress-tracker.ts - JSDoc (行2)

- ファイル: `workflow-harness/mcp-server/src/tools/handlers/stream-progress-tracker.ts`
- 行番号: 2
- 内容: `* StreamProgressTracker - Tracks coordinator subprocess output and writes progress to a Markdown file.`
- 現状: "coordinator subprocess" という記述は旧 delegate-coordinator がサブプロセスを
  spawn していた時代の名残。現在このクラスは汎用的な進捗追跡として使用されている。
- 対処: JSDoc を "Tracks subprocess output" に修正し、coordinator 固有の文言を除去。

### 3. dist/ ディレクトリ - 孤立ビルド成果物 (12ファイル)

- ディレクトリ: `workflow-harness/mcp-server/dist/tools/handlers/`
- 対象ファイル:
  - delegate-coordinator.js, .js.map, .d.ts, .d.ts.map (4ファイル)
  - delegate-work.js, .js.map, .d.ts, .d.ts.map (4ファイル)
  - coordinator-spawn.js, .js.map, .d.ts, .d.ts.map (4ファイル)
- 現状: ソースファイル(.ts)は既に削除済み。dist/ のビルド成果物のみが孤立して残存。
  他のdistファイルからの import は delegate-coordinator.js -> coordinator-spawn.js の
  内部参照のみで、外部からの参照はない。
- 対処: 12ファイル全てを削除する。

## Impact Analysis

- tool-gate.js の変更: HARNESS_LIFECYCLE Set から1エントリ削除のみ。
  既に廃止済みツールのため、動作への影響なし。
- stream-progress-tracker.ts の変更: JSDoc コメントの修正のみ。
  実行時の動作に影響なし。dist/ の対応する .js も再ビルド時に自動更新される。
- dist/ ファイル削除: ソースが存在しないビルド成果物の除去。
  ランタイムで参照されていないため影響なし。

## decisions

- tool-gate.js 行11の `harness_delegate_coordinator` エントリを削除する
- stream-progress-tracker.ts 行2のJSDocから "coordinator subprocess" を "subprocess" に修正する
- dist/tools/handlers/ 配下の delegate-coordinator 関連4ファイルを削除する
- dist/tools/handlers/ 配下の delegate-work 関連4ファイルを削除する
- dist/tools/handlers/ 配下の coordinator-spawn 関連4ファイルを削除する
- ソースファイル(.ts)は既に削除済みのため追加のソース削除は不要

## artifacts

- research.md (本ファイル): 調査結果と変更計画

## next

planning フェーズへ進む。変更は3箇所(1ソース編集 + 1ソース編集 + 12ファイル削除)で、
planning で具体的な実行手順を記述する。
