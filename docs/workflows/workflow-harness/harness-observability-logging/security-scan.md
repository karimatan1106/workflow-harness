# Security Scan: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: security_scan
date: 2026-03-25

## summary

ハーネスのオブザーバビリティログ機能に対するセキュリティスキャン結果。threat-model.mdで定義した8脅威(T-1~T-8)の緩和策が実装に反映されていることを検証した。パストラバーサル防御(T-1)、機密情報非記録(T-4)、入力検証の3観点でスキャンを実施し、全項目PASSを確認した。

## decisions

- SS-D01: T-1(パストラバーサル)の緩和策がtrace-writer.tsのvalidatePath関数に実装されていることを確認した。path.resolve後にworkflowRoot配下チェックを実施
- SS-D02: T-4(機密情報漏洩)の緩和策として、detailフィールドにはツール名のみ記録し引数値を含めない設計を確認した。TraceEntry型でdetailはstring型だが、記録箇所で引数値を渡していないことをコードレビューで確認
- SS-D03: T-2(ディスク枯渇)の緩和策として10MBサイズ上限チェックがappendTraceとtrace-logger.shの両方に実装されていることを確認した
- SS-D04: bash側のtrace-logger.shでシェルインジェクションの可能性を検証した。変数展開はダブルクォートで囲まれており、コマンド置換は使用されていないためインジェクションリスクは低い
- SS-D05: appendFileSyncの使用によりファイルディスクリプタリークのリスクがないことを確認した。openSync/closeSync不要のAPI選択は適切

## scanResults

### SR-1: パストラバーサル防御 (T-1)

- スキャン対象: trace-writer.ts validatePath関数
- 検証内容: path.resolve(docsDir)がworkflowRoot配下であることをstartsWith()で検証
- 結果: PASS — ../../等の相対パス攻撃を防御。TRACE_PATH_VIOLATIONエラーでログ記録を拒否
- TC参照: TC-AC6-03で自動検証済み

### SR-2: 機密情報非記録 (T-4)

- スキャン対象: 全appendTrace呼び出し箇所(4ファイル)
- 検証内容: detailフィールドにツール引数の値が渡されていないことを確認
- 結果: PASS — detailにはツール名(Agent, Write等)、subagent_type(coordinator, worker)、フェーズ名、チェック名のみ。APIキー・トークン等の機密情報が記録される経路は存在しない

### SR-3: シェルインジェクション (trace-logger.sh)

- スキャン対象: trace-logger.sh log_trace_event関数
- 検証内容: 引数が直接evalやコマンド置換に渡されていないこと。echo出力先パスの検証
- 結果: PASS — 全変数展開がダブルクォート内。echo >>の出力先はworkflow-state.toonから取得したdocsDirのみ

### SR-4: ファイルシステム安全性

- スキャン対象: trace-writer.ts appendTrace, initTraceFile
- 検証内容: ファイル操作のエラーハンドリング、ディスクリプタリーク防止
- 結果: PASS — appendFileSync使用(ディスクリプタ自動管理)、全操作がtry-catch内、例外時はstderrに出力してハーネス継続

### SR-5: 入力検証

- スキャン対象: TraceEntry型定義(trace-types.ts)
- 検証内容: axisフィールドがTraceAxis列挙型に制限されていること
- 結果: PASS — TypeScript型システムでaxis/layer/eventフィールドが列挙型に制限。不正な値はコンパイル時に検出される

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/security-scan.md | report | 本ファイル: 5項目のセキュリティスキャン結果(パス防御/機密非記録/インジェクション/FS安全性/入力検証) |

## next

- パフォーマンステストフェーズで追記オーバーヘッドのベンチマークを実施する
- e2eテストフェーズでハーネス全体の統合動作を検証する
