phase: design_review
task: workflow-harness-refactoring
status: complete
inputArtifacts: [planning.md, requirements.md, threat-model.md]

scope: planning.mdの10ステップ実装計画が、requirements.mdの6機能要件(F-001〜F-006)/4非機能要件(NF-001〜NF-004)を完全にカバーし、threat-model.mdの7脅威(TM-01〜TM-07)に対する緩和策が計画に反映されていることを検証する。

consistencyCheck: planning.mdの10ステップ(PL-01〜PL-10)による要件カバレッジ検証
  F-001(vscode-ext削除): PL-01(ディレクトリ削除) + PL-02(参照除去)でカバー
  F-002(hookバックアップ削除): PL-03でカバー
  F-003(テンプレート取得フロー更新): PL-07(スキルドキュメント更新) + PL-08(subagent開放確認)でカバー
  F-004(hearing dodChecks追加): PL-05でカバー
  F-005(Serena MCPサーバー化): PL-06でカバー
  F-006(small/mediumデッドコード削除): PL-04でカバー
  result: 全6機能要件がPL-01〜PL-08で完全カバーされている。PL-09/PL-10は検証ステップでNF-001/NF-002に対応。NF-003(200行制限)はPL-D7で対策定義済み。NF-004(サブモジュールコミット順序)はsubmoduleStrategyで定義済み。

securityCheck: threat-model.mdの7脅威に対する緩和策のplanning.md反映状況
  TM-01(Serenaスコープ): PL-06のverificationに.mcp.jsonのserenaキー存在確認あり。PL-D3でcwd制約設定を明記。SR-1対応済み
  TM-02(Serena起動失敗): PL-06がフォールバック経路(EP-02)維持を前提としている。TM-D3で明示的に緩和
  TM-03(vscode-ext参照残存): PL-02のverificationでgrep -r検索を実施。TM-D6で削除前全検索を規定
  TM-04(hook誤削除): PL-03で個別ファイル指定削除を採用(PL-D4)。稼働hookの存在確認をverificationに含む。SR-2対応済み
  TM-05(デッドコード型破壊): PL-04のverificationでgrep検索+PL-09でbuild検証。TM-D4の二重検証戦略が反映済み
  TM-06(LSP情報露出): ローカル実行のためネットワーク露出なし。追加対策不要と判断(影響low)
  TM-07(dodChecks副作用): PL-05でhearing単独に限定。PL-D5でスコープ制限を明記。REQ-04のテスト先行が計画に含まれる
  result: 全7脅威の緩和策がplanning.mdの対応ステップに反映されている。残留リスクは許容範囲内。

acDesignMapping[8]:
  ac: AC-1, designComponent: PL-01 vscode-extディレクトリ全削除 + PL-02 STRUCTURE_REPORT.md参照除去, specRef: planning.md PL-01/PL-02
  ac: AC-2, designComponent: PL-03 hookバックアップファイル4件の個別指定削除, specRef: planning.md PL-03
  ac: AC-3, designComponent: PL-09 npm run buildによるビルド検証, specRef: planning.md PL-09
  ac: AC-4, designComponent: PL-10 vitestによるテスト実行, specRef: planning.md PL-10
  ac: AC-5, designComponent: PL-06 .mcp.jsonへのserenaエントリ追加 + defs-stage1.tsテンプレート書換, specRef: planning.md PL-06
  ac: AC-6, designComponent: PL-04 defs-a.tsのTaskSize型からsmall/medium削除 + 関連分岐除去, specRef: planning.md PL-04
  ac: AC-7, designComponent: 実施済み(coordinator.md/worker.mdのtools行からBash除去)。PL-08で動作確認, specRef: planning.md PL-08
  ac: AC-8, designComponent: PL-07 workflow-orchestrator.md/workflow-execution.mdのテンプレート取得手順更新, specRef: planning.md PL-07

reviewFindings[5]:
  id: RF-01, severity: info, finding: PL-03のverification記述で稼働hookファイル数が5件と記載されているが実際のリスト記載は8ファイル(pre-tool-guard.sh/test-guard.sh/hook-utils.js/block-dangerous-commands.js/context-watchdog.js/loop-detector.js/session-boundary.js/tool-gate.js)。件数表記の不一致, recommendation: verificationの件数を8件に修正するか、リストとの整合性を確認すること
  id: RF-02, severity: low, finding: PL-05のac欄がnoneとなっており、AC-3/AC-4で間接検証と記載。dodChecks追加は機能変更だが直接対応するACが未定義, recommendation: dodChecks動作確認はPL-09/PL-10(AC-3/AC-4)の間接検証で十分。現状の設計で問題なし
  id: RF-03, severity: medium, finding: PL-D7でdefs-stage1.ts(202行)の200行制限超過リスクを認識しているが、超過時の分割方針が具体化されていない。分割ポイントや分割先ファイル名が未定義, recommendation: 実装時にSerenaテンプレート部分を独立ファイルに切り出す分割案を事前に用意しておくこと。ただし現時点ではCLI記法からMCPツール記法への置換で行数が減少する可能性もあるため、実装結果を見て判断する方針で許容
  id: RF-04, severity: info, finding: executionGroupsの並列実行グループ(group1: PL-01/PL-03/PL-04/PL-06)は相互依存なしと判定されているが、PL-04(defs-a.ts変更)とPL-06(defs-stage1.ts変更)は同一mcp-serverビルド対象内の変更。並列実行時のコンフリクトリスクは型定義レベルで独立しているため低い, recommendation: 現状の並列化設計で問題なし。workerが同一ファイルを同時編集しないことを確認済み
  id: RF-05, severity: info, finding: SR-4(TOOL_GUARD_DISABLE環境変数のドキュメント整備)がpriority=shouldで本タスクスコープに含まれていない。TM-D7で記録済みだが明示的な後続タスク登録がない, recommendation: 本タスク完了後の後続タスクとして登録を推奨

## decisions

- DR-01: planning.mdの10ステップ実装計画は要件F-001〜F-006を完全カバーしており、設計として承認する
- DR-02: threat-model.mdの7脅威(TM-01〜TM-07)全てに対する緩和策がplanning.mdに反映されており、セキュリティ設計として承認する
- DR-03: RF-01(稼働hookファイル件数不一致)は実装時にverification実行で自動的に検出されるため、計画修正は不要とする
- DR-04: RF-03(defs-stage1.ts 200行超過リスク)は実装結果を見て対応する方針とする。CLI記法からMCPツール記法への変換で行数が変動するため事前の分割計画は過剰
- DR-05: executionGroupsの5グループ構成(並列4ステップ -> 順次4ステップ -> 検証2ステップ)は依存関係を正確に反映しており、実行計画として承認する
- DR-06: AC-1〜AC-8の全8受入基準が設計ステップPL-01〜PL-10にマッピングされており、トレーサビリティが確保されている

## artifacts

- docs/workflows/workflow-harness-refactoring/design-review.md, report, 設計レビューレポート(要件カバレッジ検証/脅威緩和策反映検証/ACマッピング/5件の発見事項)

## next

- criticalPath: PL-04 -> PL-05 -> PL-07(hearing dodChecks追加がスキルドキュメント更新の前提)
- parallelGroup: PL-01/PL-03/PL-04/PL-06を初期並列実行グループとして開始
- monitorItems: defs-stage1.ts行数(PL-D7), hookバックアップ削除の個別指定厳守(PL-D4), サブモジュールコミット順序(NF-004)
- postTask: SR-4(TOOL_GUARD_DISABLE環境変数ドキュメント整備)を後続タスクとして登録推奨(RF-05)
