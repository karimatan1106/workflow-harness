# Requirements: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: requirements
date: 2026-03-25

## summary

ハーネスの運用品質メトリクスを構造化ログとして出力する。ツール権限遵守・委譲効率・処理速度・DoDリトライ率・コンテキストサイズの5軸を.agent/tool-traceログに記録し、事後分析可能にする。フェーズ×層×ツールの正解マトリクスとの差分検出で違反を自動検出する。

## decisions

- TOON形式のobservability-events.toonをタスクのdocsDir内に出力し、タスクスコープで完結したログを実現する
- hook(bash)側はtrace-logger.shに分離し、echo appendで行単位の原子性を確保する。MCP(TypeScript)側はappendFileSyncで追記する
- 5軸を単一ファイルに統合し、axisフィールドで識別する。TOON配列形式(entries[N]{fields})で1イベント=1行を維持する
- bash側のタイムスタンプはdate +%s(エポック秒)を使用し、MINGW互換性を確保する。Node.js側はDate.now()でミリ秒精度を維持する
- pre-tool-guard.shの200行制限を維持するため、ログ出力ロジックをtrace-logger.shに分離する
- DoD判定結果はrunDoDChecks呼び出し元で一括trace記録する方式を採用し、個別check関数への計装を避ける
- 既存metrics.ts(グローバル集計)とは独立モジュールとして共存させ、observability/ディレクトリに新設する

## acceptanceCriteria

- AC-1: pre-tool-guard.shの全判定(ALLOW/BLOCK)がタイムスタンプ・層・ツール名と共に記録される
- AC-2: Agent spawn(coordinator/worker)の開始・完了・失敗イベントとdurationMsが記録される
- AC-3: 各フェーズの開始・完了時刻と所要時間が記録される
- AC-4: DoD判定のPASS/FAILと失敗理由・リトライ回数が記録される
- AC-5: 各層のファイル読み込みサイズ、委譲プロンプトサイズ、戻り値サイズが記録される
- AC-6: ログはタスクのdocsDir内にTOON形式(observability-events.toon)で出力される
- AC-7: ログ追記のオーバーヘッドがhook実行時間を50ms以上増加させない

## functionalRequirements

### FR-1: hookイベントログ (AC-1)

pre-tool-guard.shの全判定箇所(ALLOW/BLOCK)でtrace-logger.shを呼び出し、以下のフィールドをobservability-events.toonに追記する: timestamp(epoch秒), axis(tool-access), layer(orchestrator/coordinator/worker), event(ALLOW/BLOCK), detail(ツール名), sizeBytes(引数サイズ)。trace-logger.shはworkflow-state.toonからdocsDirをgrep取得する。

### FR-2: Agent spawnイベントログ (AC-2)

delegate-coordinator.tsのhandleDelegateCoordinator()でspawn開始時にエントリを記録し、完了または失敗時にdurationMs付きで完了エントリを記録する。フィールド: timestamp(ISO8601), axis(delegation), layer(orchestrator), event(spawn-start/spawn-complete/spawn-fail), detail(subagent_type), durationMs(Date.now()差分), sizeBytes(プロンプトサイズ)。

### FR-3: フェーズ時間計測 (AC-3)

lifecycle-next.tsのrunDoDChecks前後でphase-enter/phase-exitイベントを記録する。lifecycle-start-status.tsのhandleHarnessStart内でtool-trace.toonのヘッダ(traceVersion, taskId)を初期化する。durationMsはrecordPhaseEnd()で計算済みの値を流用する。

### FR-4: DoD判定ログ (AC-4)

lifecycle-next.tsでrunDoDChecks()の結果配列をループし、各DoDCheckResultのpassed/evidence/fixをtrace記録する。失敗時はretryCountをdetailに含める。retryCount >= 3の場合はVDB-1警告もログに記録する。

### FR-5: コンテキストサイズ計測 (AC-5)

delegate-coordinator.tsでfullInstruction.length(委譲プロンプトサイズ)とstdout.length(戻り値サイズ)をsizeBytesフィールドに記録する。axis=context-sizeとして記録し、layer=orchestrator/coordinator/workerを設定する。

### FR-6: TOON出力基盤 (AC-6)

trace-writer.tsを新規作成し、appendTrace(docsDir, entry)関数を実装する。初回呼び出し時にヘッダ(traceVersion: 1, taskId)を書き込み、以降はentries配列に1行追記する。trace-types.tsでTraceEntry型(7フィールド)、TraceAxis列挙(5値)、TraceEvent列挙(10値)を定義する。

### FR-7: パフォーマンス制約 (AC-7)

hook側(trace-logger.sh)はecho >>による1行追記で実装し、ファイルロックやread-modify-writeを行わない。MCP側(trace-writer.ts)はappendFileSyncで追記し、ファイル全体の読み込みを行わない。hook実行のクリティカルパスにおけるログ追記のオーバーヘッドは50ms未満とする。

## nonFunctionalRequirements

- NFR-1: 全新規ファイルは200行以下。既存ファイルの変更後も200行以下を維持する
- NFR-2: MINGW(Git Bash on Windows)環境でbash側ログが正常動作する
- NFR-3: bash側とTypeScript側が同一ファイルに並行追記しても行単位の整合性が維持される
- NFR-4: タスク完了後のobservability-events.toonがTOONパーサーで正常にデコードできる

## notInScope

- ログの可視化ダッシュボード(別タスクで対応)
- 複数タスクの横断分析スクリプト(別タスクで対応)
- リアルタイムアラート・閾値通知(別タスクで対応)
- ログローテーション・アーカイブ(タスク単位で分離されるため不要)
- 既存metrics.tsの改修(独立系統として共存)

## openQuestions

なし

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/requirements.md | requirements | 本ファイル: 7件のAC、7件のFR、4件のNFR、5件のRTM |

## next

- specフェーズでtrace-types.tsの型定義詳細、trace-writer.tsのAPI設計、trace-logger.shのインタフェースを確定する
- TOON配列形式のスキーマ(entries[N]{fields})を正式定義する
- 各既存ファイルへの計装挿入箇所をコード行レベルで特定する
