# Hearing: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
date: 2026-03-25
userResponse: "Q1:B(タスク別docsDir), Q2:C(TOON), Q3:A(5軸全部)"

## Intent Summary

ハーネスの運用品質を5つの観測軸で可視化する構造化ログ機能を実装する。
各タスクのdocsDir内にTOON形式のtool-trace.toonを出力し、事後分析を可能にする。

## Hearing Questions and Answers

### Q1: ログ出力先

- 選択: B -- 各タスクのdocsDir内にtool-trace.logを出力(タスクごとに分離)
- 理由: タスク単位で完結した分析が可能。横断分析が必要な場合は後から集約スクリプトで対応可能
- 影響: docsDir取得ロジックがhook/MCPの両方で必要。workflow-state.toonのdocsDirフィールドを参照する

### Q2: ログフォーマット

- 選択: C -- TOON形式(既存フォーマットと統一)
- 理由: ハーネス内の全状態ファイルがTOON形式であり、パーサーが既に存在する。一貫性を維持
- 影響: 高頻度追記に対応するため、TOON追記関数の実装が必要。ファイル名はtool-trace.toon
- 制約: TOONは行志向のため、1イベント=1行エントリで記録する。配列形式(entries[N]{fields})を使用

### Q3: 実装範囲

- 選択: A -- 5軸全部を一度に実装
- 理由: 5軸は相互に関連しており、同一のログ基盤に統合することで効率的に実装可能
- 影響: タスクサイズはlargeのまま。実装フェーズでの分割(hook側/MCP側)は許容

## Five Observation Axes

1. ツール権限: 各層(O/C/W)のALLOW/BLOCK記録。hookのpre-tool-guard.shを拡張
2. 委譲効率: Agent spawn回数、subagent_type別の集計。過剰/過少委譲の閾値検出
3. 処理速度: フェーズ別・ツール別の所要時間(ms)。lifecycle-next.tsのフェーズ遷移時刻を記録
4. DoDリトライ: dod-l1-l2.ts等のゲート判定結果(PASS/FAIL)、失敗理由、リトライ回数
5. コンテキスト: 各層のファイル読み込みサイズ(bytes)、委譲プロンプトサイズ、戻り値サイズ

## Scope Analysis

### 変更対象ファイル(既存)

- workflow-harness/hooks/pre-tool-guard.sh -- 軸1(ツール権限)のALLOW/BLOCK記録を追加
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts -- 軸3(処理速度)のフェーズ遷移時刻記録
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-start-status.ts -- 軸3の開始時刻記録
- workflow-harness/mcp-server/src/gates/dod-l1-l2.ts -- 軸4(DoDリトライ)の判定結果記録
- workflow-harness/mcp-server/src/gates/dod.ts -- 軸4の集約ゲート記録

### 新規作成ファイル

- workflow-harness/mcp-server/src/observability/trace-writer.ts -- TOON形式のログ追記ユーティリティ
- workflow-harness/mcp-server/src/observability/trace-types.ts -- ログエントリの型定義
- workflow-harness/mcp-server/src/observability/metrics-aggregator.ts -- 軸2(委譲効率)/軸5(コンテキスト)の集計

### 変更対象ディレクトリ

- workflow-harness/hooks/ -- bash hookの拡張
- workflow-harness/mcp-server/src/observability/ -- 新規ディレクトリ(ログ基盤)
- workflow-harness/mcp-server/src/tools/handlers/ -- ライフサイクルハンドラへの計装追加
- workflow-harness/mcp-server/src/gates/ -- DoDゲートへの計装追加

## Output Format (tool-trace.toon)

出力先: {docsDir}/tool-trace.toon (タスクごと)

```
traceVersion: 1
taskId: {taskId}
entries[N]{timestamp,axis,layer,event,detail,durationMs,sizeBytes}:
  "2026-03-25T05:00:00.000Z",tool-access,orchestrator,ALLOW,Agent(coordinator),,
  "2026-03-25T05:00:01.000Z",tool-access,orchestrator,BLOCK,Write(src/foo.ts),,
  "2026-03-25T05:00:02.000Z",delegation,orchestrator,spawn,coordinator,,1024
  "2026-03-25T05:00:10.000Z",phase-time,system,phase-enter,research,,,
  "2026-03-25T05:01:30.000Z",phase-time,system,phase-exit,research,80000,
  "2026-03-25T05:01:31.000Z",dod-retry,system,FAIL,l2-artifact_exists(research.md),,,
  "2026-03-25T05:02:00.000Z",context-size,worker,file-read,src/foo.ts,,2048
```

## Decisions

- ログ出力先はdocsDir内のtool-trace.toonとし、タスクスコープで完結させる
- フォーマットはTOON配列形式を採用し、ハーネス内の他状態ファイルと統一する
- 5軸を単一のtool-trace.toonに統合し、axisフィールドで区別する
- hook(bash)からのログ追記はecho appendで実装し、MCPサーバー側のTOONパーサーとは独立動作させる
- 200行制限に従い、observabilityモジュールは3ファイル以上に分割する
- 高頻度のログ追記によるパフォーマンス劣化を防ぐため、同期書き込み(appendFileSync)を使用しバッファリングは行わない

## Acceptance Criteria

- AC-1: pre-tool-guard.shがALLOW/BLOCKの両方をtool-trace.toonに記録する
- AC-2: Agent spawn時にsubagent_type/層/プロンプトサイズが記録される
- AC-3: フェーズ遷移時に開始/終了時刻と所要時間(ms)が記録される
- AC-4: DoDゲート判定時にPASS/FAILと失敗理由が記録される
- AC-5: ファイル読み込み/委譲プロンプト/戻り値のサイズ(bytes)が記録される
- AC-6: tool-trace.toonはタスクのdocsDir内に出力され、TOON配列形式に準拠する
- AC-7: ログ追記のオーバーヘッドが1回あたり10ms以下である

## Risk Assessment

- hook(bash)とMCP(TypeScript)の2系統でdocsDirを解決する必要がある。hookはworkflow-state.toonをgrepで参照
- TOONの高頻度追記でファイル破損のリスク。appendFileSyncで原子性を確保
- pre-tool-guard.shの行数が108行 -> ログ追加で200行超過の可能性。ログ出力を別ファイル(trace-logger.sh)に分離
- MINGW環境でのdate +%s%N非対応。代替としてdate +%s000を使用

## Not In Scope

- ログの可視化ダッシュボード(別タスク)
- 複数タスクの横断分析スクリプト(別タスク)
- リアルタイムアラート/閾値通知(別タスク)
- ログローテーション/アーカイブ(タスク単位で分離されるため不要)

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/hearing.md | hearing | 本ファイル: ヒアリング結果と5軸オブザーバビリティ要件 |

## next

- scope_definition フェーズで変更対象ファイルとディレクトリを確定する
- pre-tool-guard.sh の現在行数(108行)を確認し、trace-logger.sh 分離の設計を行う
- MCP側の observability/ ディレクトリ構成を決定する
