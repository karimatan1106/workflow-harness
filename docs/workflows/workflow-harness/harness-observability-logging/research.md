# Research: harness-observability-logging

## overview

ハーネスの観測可能性を改善し、hook判定・coordinator spawn・DoD判定の各イベントを構造化ログとして記録するための技術調査。

## findings

### F-1: pre-tool-guard.sh の構造 (108行)

- MINGW環境でjqなしでJSON解析: grep -o + sed で tool_name, agent_id を抽出
- AGENT_IDの有無で Orchestrator/Subagent を二値判定（L35-37）
- 判定ロジックは4ブロック: (1)サブエージェント即通過、(2)Write/Edit .toon/.mmd許可、(3)Agent subagent_type検証、(4)ホワイトリスト照合
- 現在ログ出力はBLOCKEDケースのstderrのみ。ALLOWケースは記録されない
- 関数分離: is_lifecycle_mcp()のみ。判定ブロックはcase文の連鎖で未関数化

### F-2: delegate-coordinator.ts の spawn方式 (175行)

- spawnAsync() で claude CLI を子プロセス起動（coordinator-spawn.ts L24-67）
- 環境変数でセッション情報伝搬: HARNESS_SESSION_TOKEN, HARNESS_TASK_ID, HARNESS_LAYER
- StreamProgressTracker が stdout を10行単位でフラッシュ → progressFile(.md)書き出し
- logFile に全stdout/stderrをappendFileSync でストリーム記録
- durationMs は Date.now() 差分で計測済み（L161-168）
- buildResponse() で成果物をTOON KV形式にシリアライズ

### F-3: lifecycle-next.ts の DoD判定フロー (179行)

- runDoDChecks(task, docsDir) が全チェック実行、結果は { passed, errors, checks }
- 失敗時: buildDoDFailureResponse() → stashFailure(), recordRetry(), recordDoDFailure(), appendErrorToon()
- appendErrorToon() はdocsDir/phase-errors.toonに構造化エラーを追記
- 成功時: recordPhaseEnd() → metrics.toon にフェーズ所要時間を記録
- retryCount >= 3 で VDB-1 警告（バリデータバグ疑い）をレスポンスに付与
- recordDoDFailure() は dodFailurePatterns 配列に重複除去で蓄積

### F-4: dod-l1-l2.ts のチェック関数戻り値 (167行)

- 全関数は DoDCheckResult 型を返却: { level, check, passed, evidence, fix? }
- 5種のチェック: checkL1FileExists, checkInputFilesExist, checkL2ExitCode, checkTDDRedEvidence, checkTestResultsExist, checkTestRegression
- evidence フィールドに判定理由を自然言語で記録（LLMリトライ用）
- fix フィールドは失敗時のみ付与。修正指示を日本語で記載

### F-5: TOON配列形式の追記パターン

- error-toon.ts (51行): read-modify-write パターン。全エントリ読み込み→append→全体再書き込み
- toon-io-adapter.ts (25行): @toon-format/toon ライブラリのencode/decodeラッパー
- toonEncode() は末尾改行付きで文字列化。toonDecodeSafe() はパース失敗時null返却
- metrics.ts (175行): MetricsStore全体をread-modify-writeで永続化。フェーズ別集計を内包
- analytics-toon.ts (66行): writeAnalyticsToon() で docsDir/phase-analytics.toon に書き出し

### F-6: docsDir解決方法（2系統）

- MCP系統: task.docsDir ?? ('docs/workflows/' + task.taskName) — lifecycle-next.ts L61
- Hook系統: pre-tool-guard.sh はdocsDirを参照しない。ツール名とagent_idのみで判定
- lifecycle-start-status.ts: sm.createTask() がdocsDirを生成。handleHarnessStatus()でレスポンスに含める
- resolveProjectPath(): getProjectRoot() + 正規化パスで絶対パス解決

### F-7: MINGW環境でのミリ秒タイムスタンプ

- bash: date +%s%3N は GNU coreutils必須。MINGW の date は %3N 非対応の場合あり
- 代替案: $(date +%s)000 で秒精度に丸める、または printf '%(%s)T' -1 (bash 4.2+)
- Node.js側: Date.now() で問題なくミリ秒取得可能（metrics.ts L100, delegate-coordinator.ts L161）
- 推奨: hook側ログのタイムスタンプは秒精度で十分。MCP側は既存Date.now()を流用

## decisions

- D-1: hookログはappend専用ファイル(.agent/hook-events.log)に追記する。TOON read-modify-writeはbash単体では困難なため、echoによる1行追記が最もシンプルかつ高速。
- D-2: hookログフォーマットはTSV(タブ区切り)を採用する。カラム: timestamp, event_type, tool_name, agent_layer, decision, detail。bashのechoで生成容易かつNode.js側でsplit('\t')でパース可能。
- D-3: MCP側ログは既存のmetrics.toon/appendErrorToonパターンを拡張し、observability-events.toonをdocsDir配下に生成する。DoDCheckResultのevidence/fixをそのまま構造化データとして保存する。
- D-4: hookタイムスタンプはdate +%s(エポック秒)を使用する。MINGW互換性のためミリ秒は不可。Node.js側集計時にISO8601変換する。
- D-5: hook判定ログはALLOW/BLOCKの両方を記録する。現状BLOCKEDのみ出力しているが、ALLOWケースも記録してツール使用頻度分析を可能にする。
- D-6: coordinator spawnイベントはdelegate-coordinator.tsのhandleDelegateCoordinator()内で記録する。既存のdurationMs計測を活用し、spawn開始/完了/失敗をobservabilityイベントに追記する。
- D-7: hook-events.logは1000行超過で先頭500行を切り捨て(tail -n +501)。切り捨て判定はhook実行10回に1回の頻度で負荷軽減。

## artifacts

| artifact | path | description |
|----------|------|-------------|
| research | docs/workflows/harness-observability-logging/research.md | 本ファイル |

## next

- requirementsフェーズで AC（受入基準）を定義
- hook-events.log の TSV スキーマ詳細設計
- observability-events.toon のTOONスキーマ定義
- analytics-toon.ts の hookObsStats 既存枠への統合設計
- pre-tool-guard.sh の関数分離計画（200行制限内でのログ追加方法）
