# Security Scan: harness-detailed-error-analytics

phase: security_scan
task: harness-detailed-error-analytics
date: 2026-03-25
scanner: manual-review

## scope

対象ファイル4件の静的セキュリティレビュー。内部ツールのanalytics詳細化であり、外部入出力やネットワーク通信は存在しない。

- workflow-harness/mcp-server/src/analytics/error-toon.ts
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts
- workflow-harness/mcp-server/src/analytics/phase-analytics.ts
- workflow-harness/mcp-server/src/analytics/analytics-toon.ts

## decisions

- SEC-1: 入力バリデーション -- mapChecksForErrorToonはDoDCheckResult型で型安全。TypeScript型システムによりランタイム型不整合は防止される。リスク: なし
- SEC-2: ファイルI/O -- TOONファイル読み書きはreadFileSync/writeFileSync経由。パスはTaskState.docsDirから構築され、ユーザー入力が直接パスに入ることはない。リスク: なし
- SEC-3: 情報漏洩 -- errorHistory内のevidenceはDoD失敗メッセージ(チェック名+結果)のみ。認証情報・個人情報・APIキー等の機密情報は含まれない。リスク: なし
- SEC-4: DoS/リソース枯渇 -- errorHistoryの最大サイズはTM-01分析で約450KB。30フェーズ x 5リトライ x 10チェック = 1500エントリが上限。ディスク枯渇リスクは実質ゼロ。リスク: なし
- SEC-5: 依存関係 -- 新規npmパッケージの追加なし。既存のnode:fs, node:pathのみ使用。サプライチェーンリスク: なし
- SEC-6: パストラバーサル(LOW) -- appendErrorToonのdocsDirパラメータにパストラバーサル検証は存在しないが、呼び出し元はTaskState内部値を使用しており外部入力経路がないため実質リスクは低い
- SEC-7: コマンドインジェクション -- child_process/exec等の使用なし。外部コマンド実行経路は存在しない。リスク: なし

## findings

| ID | severity | category | description | status |
|----|----------|----------|-------------|--------|
| F-001 | LOW | path-traversal | appendErrorToonのdocsDirに入力検証なし。内部値のみ使用のため実質リスク低 | accepted |
| F-002 | INFO | file-size | errorHistory蓄積は最大450KB。制限なしだが実用上の問題なし | accepted |
| F-003 | INFO | error-handling | appendErrorToon呼び出しはtry-catchで囲まれ、失敗時は非ブロッキング | ok |
| F-004 | INFO | no-network | 全対象ファイルにネットワーク通信コードなし | ok |

## risk-assessment

overall-risk: LOW
justification: 内部ツールのanalytics機能拡張。外部入力経路・ネットワーク通信・認証情報取り扱いが一切なく、攻撃面は極めて限定的。唯一のLOW所見(F-001)も内部値のみ使用のため実害リスクは最小。

## artifacts

- security-scan.md (本ファイル)
- 検査対象: 4ファイル、7関数
- 検出: HIGH/CRITICAL 0件、LOW 1件、INFO 3件

## next

- 実装フェーズへ進行可能
- F-001はリファクタリング時にdocsDir検証を追加することを推奨(優先度低)
- 新規の外部入力経路が追加される場合は再スキャンが必要
