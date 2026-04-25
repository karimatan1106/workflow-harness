# Code Review: harness-observability-logging

## summary

8ファイルを対象にコードレビューを実施。全ファイル200行制限を遵守（最大199行）。セキュリティ（パストラバーサル防御、機密情報非記録）、パフォーマンス（同期I/O + 10MBキャップ）、エラーハンドリング（全trace呼び出しnon-blocking）、型安全性（TraceEntry一貫使用）、TOON形式出力、MINGW互換性の全観点で合格水準。重大な問題なし。軽微な改善提案2件を記録。

## decisions

- CR-D01: 200行制限遵守を確認。lifecycle-next.ts(199行)とdelegate-coordinator.ts(198行)が境界値だが制限内。追加変更時は分割を実施する。
- CR-D02: T-1パストラバーサル防御はtrace-writer.ts validatePath()で`filePath.includes('..')`チェック+normalize実施。TOON限定用途として十分。
- CR-D03: T-4機密情報非記録を確認。トレースにはtool名、phase名、axis情報のみ記録。sessionToken/パスワード等の機密情報は一切含まれない。
- CR-D04: appendFileSyncの同期I/Oは1行追記用途で許容。10MB上限(MAX_TRACE_BYTES)がTS/bash両方で一致(10485760 bytes)。
- CR-D05: 全trace呼び出し箇所でtry-catch + `/* non-blocking */`パターンが一貫。トレース障害がハーネス本体処理を阻害しない設計。
- CR-D06: TraceEntry型がtrace-types.tsで定義され、trace-writer.ts、lifecycle-next.ts、delegate-coordinator.tsで一貫使用。型安全性確保。
- CR-D07: TOON形式出力はformatEntry()で`key: value`カンマ区切りを生成。trace-logger.shも同一フォーマット。ヘッダーにtraceVersion/taskId/createdAt含む。
- CR-D08: trace-logger.shのMINGW互換性確認。`wc -c | tr -d ' '`でサイズ取得、`date +%s`でタイムスタンプ、`2>/dev/null`でエラー抑制。
- CR-D09: テストカバレッジ確認。TC-AC6-01〜04でappendTrace/initTraceFile/recordDoDResults/パストラバーサル拒否/10MB上限の5機能をカバー。

## findings

### FND-01: タイムスタンプ形式の不一致（軽微）

- 箇所: trace-logger.sh(epoch秒 `date +%s`) vs trace-writer.ts(ISO 8601 `new Date().toISOString()`)
- 影響: 分析ツールでのパース時に2形式対応が必要
- 推奨: 将来的にISO 8601への統一を検討。現時点では機能要件を満たしており、即時対応不要

### FND-02: lifecycle-next.ts 199行で境界値（注意）

- 箇所: lifecycle-next.ts (199行)、delegate-coordinator.ts (198行)
- 影響: 今後の機能追加で200行制限に抵触するリスク
- 推奨: 次回変更時にbuildDoDFailureResponse/addNextPhaseOutputFileの外部モジュール化を検討

## acAchievementStatus

| AC | 内容 | 状態 | 根拠 |
|----|------|------|------|
| AC-1 | appendTrace()がTOON形式1行を追記 | PASS | trace-writer.ts formatEntry()で`key: value`形式生成、appendFileSyncで追記 |
| AC-2 | pre-tool-guard.shがtrace-logger.shをsource | PASS | pre-tool-guard.sh L19で`source trace-logger.sh`、全ALLOW/BLOCKパスでlog_trace_event呼び出し |
| AC-3 | delegate-coordinator内でspawn-start/complete/failを記録 | PASS | delegate-coordinator.ts L162-168(start)、L178-184(complete)、L188-194(fail) |
| AC-4 | recordDoDResults()がDoD結果を一括記録 | PASS | trace-writer.ts L71-90、テストTC-AC4-01で3件一括記録を検証 |
| AC-5 | lifecycle-start内でinitTraceFile呼び出し | PASS | lifecycle-start-status.ts L52-54でtask作成直後にinitTraceFile実行 |
| AC-6 | テスト4件がappendTrace/initTraceFile/パストラバーサル/10MB上限をカバー | PASS | trace-writer.test.ts TC-AC6-01〜04の4テストケース |
| AC-7 | 全ファイル200行以下 | PASS | 最大199行(lifecycle-next.ts)、全8ファイル制限内 |

## artifacts

| ファイル | 行数 | 種別 | 状態 |
|---------|------|------|------|
| observability/trace-types.ts | 52 | 型定義 | 新規作成 |
| observability/trace-writer.ts | 91 | トレース書込 | 新規作成 |
| hooks/trace-logger.sh | 41 | shellトレース | 新規作成 |
| hooks/pre-tool-guard.sh | 120 | ツールガード | 既存変更 |
| handlers/lifecycle-next.ts | 199 | フェーズ遷移 | 既存変更 |
| handlers/lifecycle-start-status.ts | 143 | 開始/状態 | 既存変更 |
| handlers/delegate-coordinator.ts | 198 | 委譲 | 既存変更 |
| observability/__tests__/trace-writer.test.ts | 105 | テスト | 新規作成 |

## next

- harness_nextでcode_reviewフェーズ完了を申請
- FND-01/FND-02は即時対応不要、将来タスクとして記録
