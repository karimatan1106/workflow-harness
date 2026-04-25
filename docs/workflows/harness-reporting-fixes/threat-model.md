# Threat Model: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: threat_modeling
size: small

## STRIDE Analysis

### Spoofing (なりすまし)

- 脅威: scopeFiles を意図的に .md のみに偽装し、本来テスト必須のコード変更タスクで TDD Red 証拠チェックを回避する
- 影響度: 低。scopeFiles は harness_start 時にオーケストレーターが設定し、ユーザーが直接改竄できる MCP インターフェースは存在しない
- 対策: scopeFiles は TaskState 内部で管理され、harness_record_proof 経由の更新のみ許可。直接編集パスなし

### Tampering (改竄)

- 脅威: ARTIFACT_QUALITY_RULES の制約文言を改変し、DoD L1 ゲートの重複行検出と不整合を生じさせる
- 影響度: 低。definitions-shared.ts はソースコード管理下にあり、変更は git diff で検出可能
- 対策: 新規テスト (handler-templates-validation.test.ts) で ARTIFACT_QUALITY_RULES に全行ユニーク制約が含まれることを検証する

### Repudiation (否認)

- 脅威: checkTDDRedEvidence の免除判定が実行されたことを事後に確認できない
- 影響度: 極低。evidence フィールドに免除理由と scopeFiles 拡張子情報を出力する設計 (IA-003) により proofLog に記録される
- 対策: 免除実行時の evidence 出力を必須とし、proofLog で追跡可能にする

### Information Disclosure (情報漏洩)

- 脅威: scopeFiles のファイルパス情報が evidence フィールド経由で外部に漏洩する
- 影響度: 極低。evidence はハーネス内部の proofLog にのみ記録され、外部 API への送信パスは存在しない。scopeFiles はリポジトリ内の相対パスであり、機密情報を含まない
- 対策: 追加対策不要。既存の proofLog アクセス制御で十分

### Denial of Service (サービス拒否)

- 脅威: scopeFiles に大量のファイルパスが含まれる場合、拡張子チェックのループが性能劣化を引き起こす
- 影響度: 極低。scopeFiles は通常 1-10 件程度。拡張子チェックは path.extname の O(1) 操作であり、100 件でも無視可能な処理時間
- 対策: 追加対策不要。現実的なタスクサイズでは性能問題は発生しない

### Elevation of Privilege (権限昇格)

- 脅威: checkTDDRedEvidence の免除条件を拡張し、コードファイルを含むタスクでもテスト証拠を不要にする
- 影響度: 中。テスト証拠なしでコード変更が通過すると品質低下につながる
- 対策: 免除対象拡張子を .md と .mmd の 2 種のみにハードコード (D-002)。拡張子リストの変更は definitions-shared.ts のソースコード変更が必要であり、レビューで検出可能

## Risk Summary

全体リスク: 低。変更は内部ハーネスツールの DoD チェック条件追加とテンプレート文字列追記のみ。外部インターフェース変更なし、認証・認可・ネットワーク通信に関する変更なし。

攻撃面の変化:
- P1: checkTDDRedEvidence に新たな早期リターンパスが追加されるが、条件は scopeFiles 全件のドキュメント拡張子判定に限定
- P2: テンプレート文字列の追記のみであり、攻撃面の変化は実質なし

## decisions

- D-001: 全 STRIDE カテゴリでリスクは低または極低と判定。追加のセキュリティ対策は不要 (内部ツール修正であり外部攻撃面が存在しないため)
- D-002: scopeFiles 偽装リスクは TaskState の内部管理により軽減済み (MCP インターフェースに scopeFiles 直接編集のエンドポイントがないため)
- D-003: 免除拡張子のハードコードは意図的な制限であり、設定ファイル化しない (拡張子追加時にコードレビューを強制するため)
- D-004: evidence フィールドへの免除理由出力は Repudiation 対策として必須とする (proofLog の監査可能性を維持するため)
- D-005: ARTIFACT_QUALITY_RULES の制約文言と checkDuplicateLines の閾値の整合性はテストで保証する (IA-004 で特定された不整合リスクへの対策)

## artifacts

- docs/workflows/harness-reporting-fixes/threat-model.md (spec): STRIDE 分析、リスク評価、セキュリティ判断記録

## next

- criticalDecisions: D-001(追加セキュリティ対策不要), D-003(免除拡張子ハードコード維持)
- readFiles: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts
- warnings: なし。全体リスクが低いため、実装フェーズでのセキュリティ追加考慮は不要
