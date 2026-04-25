# Scope Definition: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: scope_definition
date: 2026-03-25

## Intent Recap

ハーネスの運用品質メトリクスを5軸(ツール権限遵守、委譲効率、処理速度、DoDリトライ率、コンテキストサイズ)で記録するオブザーバビリティ機能を実装する。各タスクのdocsDir内にTOON形式のtool-trace.toonを出力し、事後分析を可能にする。

## Scope Boundary

### In Scope

| # | 変更対象 | 軸 | 変更内容 |
|---|---------|---|---------|
| S-1 | workflow-harness/hooks/pre-tool-guard.sh | 軸1,5 | ALLOW/BLOCKイベントのtrace-logger.sh呼び出し追加(3-5行) |
| S-2 | workflow-harness/hooks/trace-logger.sh | 軸1,5 | 新規: bashからtool-trace.toonへの追記関数。docsDirをworkflow-state.toonから取得 |
| S-3 | workflow-harness/mcp-server/src/observability/trace-types.ts | 全軸 | 新規: TraceEntry型、TraceAxis列挙、TraceEvent列挙の定義 |
| S-4 | workflow-harness/mcp-server/src/observability/trace-writer.ts | 全軸 | 新規: TOON形式でのtool-trace.toon追記ユーティリティ(appendFileSync使用) |
| S-5 | workflow-harness/mcp-server/src/observability/metrics-aggregator.ts | 軸2,5 | 新規: 委譲回数集計、コンテキストサイズ集計 |
| S-6 | workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts | 軸2,3 | Agent spawn記録(subagent_type、プロンプトサイズ、所要時間) |
| S-7 | workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts | 軸3,4 | フェーズ遷移時刻、DoD判定結果の記録 |
| S-8 | workflow-harness/mcp-server/src/tools/handlers/lifecycle-start-status.ts | 軸3 | タスク開始時のtool-trace.toonヘッダ初期化 |
| S-9 | workflow-harness/mcp-server/src/gates/dod-l1-l2.ts | 軸4 | DoD各チェックのPASS/FAIL結果をtrace記録 |

### Out of Scope

- ログの可視化ダッシュボード(別タスク)
- 複数タスクの横断分析スクリプト(別タスク)
- リアルタイムアラート/閾値通知(別タスク)
- ログローテーション/アーカイブ(タスク単位で分離されるため不要)
- 既存metrics.tsの改修(別系統として独立運用)

## File Analysis

### pre-tool-guard.sh (108行 -> 推定115行)

現在108行。trace-logger.sh呼び出しを3箇所(ALLOW判定後、BLOCK判定後、subagent通過時)に追加。各呼び出しは1行で済むためtrace-logger.shへの委譲で200行制限内に収まる。

### delegate-coordinator.ts (175行 -> 推定185行)

現在175行。startTime変数は既に存在(161行目)。trace-writer.tsのappendTrace呼び出しを2箇所(spawn開始/完了)に追加。import 1行 + 呼び出し2行 + プロンプトサイズ計算2行で約10行増。200行制限内。

### lifecycle-next.ts (179行 -> 推定190行)

現在179行。recordPhaseEnd/recordPhaseStartの既存呼び出しに並行してtrace記録を追加。dodResult記録も既存のrecordDoDFailure隣に追加。約11行増。200行以内。

### lifecycle-start-status.ts (139行 -> 推定150行)

現在139行。handleHarnessStart内でtool-trace.toonヘッダ初期化を追加。約11行増。200行以内。

### dod-l1-l2.ts (167行 -> 推定175行)

現在167行。各check関数のreturn前にtrace記録を追加するのではなく、呼び出し元のdod.tsで一括記録する方式を採用。本ファイルの変更は不要に変更する可能性あり。代替としてdod.ts側のrunDoDChecks関数で結果配列をtrace記録する。

## Architecture Decision

### 既存metrics.tsとの関係

metrics.tsは.claude/state/metrics.toonにグローバル集計を記録する既存機能。本タスクのtrace-writer.tsはタスク別docsDirにイベント単位のトレースを記録する新機能。役割が異なるため独立モジュールとして共存させる。

### hook(bash)とMCP(TypeScript)の二系統

- bash側: trace-logger.shがworkflow-state.toonからdocsDirをgrep取得し、echo appendでtool-trace.toonに追記
- TypeScript側: trace-writer.tsがStateManagerからdocsDirを取得し、appendFileSyncで追記
- 両系統が同一ファイルに追記するため、行単位の原子性(appendFileSync + echo >>)で競合を回避

### TOON配列形式

tool-trace.toonのフォーマット:
```
traceVersion: 1
taskId: {taskId}
entries[N]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "{ISO8601}",{axis},{layer},{event},{detail},{ms},{bytes}
```

## Acceptance Criteria (from hearing)

- AC-1: pre-tool-guard.shがALLOW/BLOCKの両方をtool-trace.toonに記録する
- AC-2: Agent spawn時にsubagent_type/層/プロンプトサイズが記録される
- AC-3: フェーズ遷移時に開始/終了時刻と所要時間(ms)が記録される
- AC-4: DoDゲート判定時にPASS/FAILと失敗理由が記録される
- AC-5: ファイル読み込み/委譲プロンプト/戻り値のサイズ(bytes)が記録される
- AC-6: tool-trace.toonはタスクのdocsDir内に出力され、TOON配列形式に準拠する
- AC-7: ログ追記のオーバーヘッドが1回あたり10ms以下である

## RTM (Requirements Traceability)

| ID | AC | 実装ファイル | 検証方法 |
|----|----|-----------|---------| 
| F-001 | AC-1 | pre-tool-guard.sh, trace-logger.sh | hook実行後にtool-trace.toonにALLOW/BLOCKエントリが存在 |
| F-002 | AC-2 | delegate-coordinator.ts, trace-writer.ts | spawn完了後にdelegationエントリが存在 |
| F-003 | AC-3 | lifecycle-next.ts, lifecycle-start-status.ts | phase-enter/phase-exitエントリとdurationMs値の検証 |
| F-004 | AC-4 | lifecycle-next.ts, dod-l1-l2.ts | dod-retryエントリにPASS/FAILとcheck名が存在 |
| F-005 | AC-5 | delegate-coordinator.ts, trace-writer.ts | delegationエントリにsizeBytes値が存在 |
| F-006 | AC-6 | trace-writer.ts, trace-logger.sh | TOON形式準拠(traceVersion, entries[]ヘッダ, カンマ区切り値) |
| F-007 | AC-7 | trace-writer.ts | appendFileSyncの所要時間計測テスト |

## decisions

- trace-writer.tsとtrace-logger.shの二系統でdocsDirへの追記を行い、TypeScript側はappendFileSync、bash側はecho >>で行単位の原子性を確保する
- 既存metrics.ts(グローバル集計)とは独立したモジュールとして実装し、observability/ディレクトリに配置する
- pre-tool-guard.shの200行制限を維持するため、ログ出力ロジックはtrace-logger.shに分離する
- dod-l1-l2.tsの各check関数には直接trace呼び出しを入れず、runDoDChecks(dod.ts)で結果配列を一括trace記録する方式を採用する
- TOON配列形式(entries[N]{fields})を使用し、1イベント=1行で高頻度追記に対応する
- MINGW環境でのdate +%s%N非対応を考慮し、bash側のタイムスタンプはdate +%s000(秒精度)を使用する
- コンテキストサイズ(軸5)はdelegate-coordinator.tsのfullInstruction.lengthとstdout.lengthから計測する

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/hearing.md | hearing | ヒアリング結果と5軸オブザーバビリティ要件 |
| docs/workflows/harness-observability-logging/scope-definition.md | scope_definition | 本ファイル: スコープ境界、ファイル分析、RTM |

## next

- requirements フェーズでAC-1〜AC-7を機能要件に展開し、各要件の入力/出力/前提条件を定義する
- trace-types.tsの型定義を詳細化し、TraceEntry/TraceAxis/TraceEventの全フィールドを確定する
- bash側trace-logger.shのdocsDir解決ロジック(workflow-state.toonのgrep)を要件として明文化する
