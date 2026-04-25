# Threat Model: harness-observability-logging

taskId: bc36ed81-8ade-49c7-b1b7-44fd1135a277
phase: threat_modeling
date: 2026-03-25

## summary

ハーネスのオブザーバビリティログ機能(observability-events.toon)に対する8件の脅威を分析し、緩和策と残存リスクを定義する。ログ出力は hook(bash) と MCP(TypeScript) の2系統から同一ファイルに追記される構造のため、並行書き込み・パストラバーサル・情報漏洩が主要な攻撃面となる。

## decisions

- T-1(パストラバーサル)はdocsDirのpath.resolve正規化とdocsDir配下チェックで緩和する。bash側はrealpath -m相当のチェックを行う
- T-2(ディスク枯渇)はタスクスコープでログが分離される設計により緩和される。追加の上限チェックとして出力前にファイルサイズを確認し、10MBを超えた場合は追記をスキップする
- T-3(並行追記破損)はbash側echo >>とNode.js側appendFileSyncの行単位追記で原子性を確保する。read-modify-writeパターンは使用しない
- T-4(機密情報漏洩)はログにツール引数の値を記録しない設計で緩和する。記録対象はツール名・層・イベント種別・サイズのみとし、引数内容はdetailフィールドに含めない
- T-5(hookパフォーマンス劣化)はecho >>による1行追記に限定し、ファイルロック・JSON解析・ファイル全体読み込みを行わないことで50ms未満を保証する
- T-6(DoD false positive)はobservability-events.toonをDoD対象アーティファクト一覧に含めないことで干渉を防止する。DoDチェッカーは明示的にこのファイルを除外する
- T-7(実行権限)はtrace-logger.shをgit add時にchmod +xを付与し、CI/hookでの実行失敗を防止する。pre-commit hookで実行権限を検証する
- T-8(配列カウント不整合)はentries配列のインデックスNを書き込み側で管理せず、行数ベースの自動採番とする。パーサー側でN値を信頼せず行順で処理する

## threats

### T-1: パストラバーサルによるログ書き込み先の改竄

- 深刻度: H
- 攻撃シナリオ: workflow-state.toonのdocsDirフィールドが不正な相対パス(../../etc/cron.d)に改竄された場合、trace-logger.shがタスクスコープ外にファイルを生成する
- 緩和策: trace-writer.tsでpath.resolve(docsDir)後にworkflowRoot配下であることを検証する。bash側ではrealpath結果がdocs/workflows/プレフィックスを持つことを確認する
- 残存リスク: L — workflow-state.toonの改竄自体はローカル環境の権限に依存するため、外部攻撃者による改竄リスクは極めて低い

### T-2: ログ肥大化によるディスク枯渇

- 深刻度: M — ディスク枯渇は運用停止に直結するが発生確率は中程度
- 攻撃シナリオ: 大規模タスクで数千回のツール呼び出しが発生し、observability-events.toonが数十MBに膨張してディスク容量を圧迫する
- 緩和策: 出力前にstat -cでファイルサイズを確認し、10MB超過時は追記をスキップしてstderrに警告を出力する。タスクスコープ分離により完了タスクのログは手動削除可能
- 残存リスク: L — 10MB上限により単一タスクでのディスク枯渇は回避される。複数タスクの蓄積は運用手順(タスク完了後のクリーンアップ)で対応する

### T-3: bash/TypeScript並行追記によるログ破損

- 深刻度: M — NTFS環境での並行追記はPOSIX保証より弱い
- 攻撃シナリオ: pre-tool-guard.sh(bash)とdelegate-coordinator.ts(Node.js)が同一のobservability-events.toonに同時に書き込み、行が混在してTOON形式が壊れる
- 緩和策: 両系統ともappend-onlyの1行追記に限定する。bash側はecho >> (POSIXでは小サイズのappendは原子的)、Node側はappendFileSyncを使用する。各エントリは改行終端の単一行とする
- 残存リスク: M — NTFS上のappend原子性はPOSIX保証より弱い。極端な並行度(同時5本以上の書き込み)では行混在の可能性が残る。実運用ではhookとMCPの呼び出しは逐次的であるため発生確率は低い

### T-4: 機密情報のログ漏洩

- 深刻度: H
- 攻撃シナリオ: ツール引数にAPIキー・認証トークン・パスワードが含まれる場合、ログに記録されると.toonファイル経由で漏洩する
- 緩和策: detailフィールドにはツール名のみを記録し、引数の値は記録しない。sizeBytes(引数のバイト数)は記録するが内容は含まない。TraceEntry型定義でdetailフィールドの型をツール名列挙に制限する
- 残存リスク: L — ツール名自体には機密情報は含まれない。引数サイズの記録は情報量として無害

### T-5: hookパフォーマンス劣化

- 深刻度: M — hook遅延はユーザー体感に直接影響する
- 攻撃シナリオ: trace-logger.shの処理が重く、pre-tool-guard.shの実行時間が50ms以上増加してClaude Codeのレスポンスが体感的に悪化する
- 緩和策: trace-logger.shはecho >>のみで実装し、ファイルロック・JSONパース・条件分岐を最小化する。date +%sとechoの2コマンドに限定する
- 残存リスク: L — echo >>のオーバーヘッドは1ms未満。MINGW環境でのdate呼び出しを含めても5ms以内に完了する

### T-6: DoD検証でのfalse positive

- 深刻度: M — false positiveはワークフロー停止を引き起こす
- 攻撃シナリオ: observability-events.toonの存在や内容がDoDチェッカーの既存バリデーションに干渉し、本来PASSすべきチェックがFAILする
- 緩和策: DoDチェッカーのアーティファクト列挙ロジックでobservability-events.toonを明示的に除外する。DoD対象アーティファクトはartifactsセクションに登録されたファイルのみとする
- 残存リスク: L — 明示的除外により干渉は発生しない

### T-7: trace-logger.shの実行権限

- 深刻度: L
- 攻撃シナリオ: 新規作成したtrace-logger.shにchmod +xが付与されず、pre-tool-guard.shからの呼び出しがPermission deniedで失敗する
- 緩和策: gitリポジトリへの追加時にgit update-index --chmod=+xで実行権限を設定する。CI環境ではchmod +xを明示的に実行する
- 残存リスク: L — git管理下のファイル権限はclone時に復元される

### T-8: TOON配列カウント不整合

- 深刻度: L
- 攻撃シナリオ: entries[N]のインデックスNが書き込み時にカウントミスで重複・欠番となり、パーサーがエントリを正しく読み取れない
- 緩和策: 書き込み側ではインデックスNをwc -l(bash)またはファイル行数カウント(Node.js)で動的に算出する。パーサー側ではN値を参考値として扱い、行順序をプライマリキーとする
- 残存リスク: L — 行順序ベースの処理により、N値の不整合があっても正常にデコードできる

## riskMatrix

| ID | 深刻度 | 発生確率 | 緩和後リスク | 対応方針 |
|----|--------|----------|-------------|---------|
| T-1 | H | L | L | 実装時にパス検証を組み込み |
| T-2 | M | M | L | 10MB上限チェックを実装 |
| T-3 | M | L | M | append-only設計で対応、残存リスクを許容 |
| T-4 | H | M | L | 引数値の非記録を型レベルで強制 |
| T-5 | M | L | L | echo >>限定の軽量実装 |
| T-6 | M | L | L | DoD対象から明示除外 |
| T-7 | L | M | L | git権限設定で対応 |
| T-8 | L | L | L | 行順序ベースのパース |

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/harness-observability-logging/threat-model.md | threat_modeling | 本ファイル: 8脅威の分析、緩和策、残存リスク評価 |

## next

- specフェーズでtrace-writer.tsのパス検証ロジック(T-1緩和策)の具体的なAPI設計を確定する
- trace-logger.shの10MB上限チェック(T-2緩和策)の実装をFR-7に反映する
- T-3(並行追記)の残存リスクMについて、specフェーズで許容判断を明記する
- T-4(機密情報)の緩和策をtrace-types.tsのTraceEntry型定義に反映する
