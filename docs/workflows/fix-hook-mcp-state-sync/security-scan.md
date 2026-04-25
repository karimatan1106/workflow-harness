# Security Scan

## background
fix-hook-mcp-state-sync 実装完了後のセキュリティ検証フェーズ。threat-model.md で特定した STRIDE 脅威に対する実装済み緩和策の効果を確認し、追加の finding が無いことを保証する。対象変更は hook-utils.js の readToonPhase 関数追加、.mcp.json の STATE_DIR 絶対パス化、start.sh の pwd -P フォールバック挿入の三点である。

## scanScope
- parent/.claude/hooks/lib/hook-utils.js: readToonPhase 関数および getActivePhaseFromWorkflowState 分岐を追加した対象
- workflow-harness/.mcp.json: STATE_DIR を絶対パスへ固定化した設定ファイル
- workflow-harness/start.sh: pwd -P フォールバックを追加した MCP サーバ起動スクリプト
- docs/adr/ADR-029-hook-mcp-state-sync.md: 許容リスクを明記した決定文書

## threatCoverage
- spoofing: workflow-state.toon 偽造リスクは task-index.json 二重照合で緩和済み、本修正で追加入口なし
- tampering: TOON パーサは `phase: <literal>` 固定書式のみ抽出、任意キー解釈経路なし、既知フェーズ名バリデーション継承
- repudiation: bootstrap 削除の痕跡は ADR-029 日付記録で補填、手順は git 履歴と ADR で追跡可能
- informationDisclosure: readToonPhase は phase 文字列のみを戻り値とし、TOON 値のログ出力経路なし
- denialOfService: 先頭 64KB 制限と早期 return により大容量ファイルでのハングを回避
- elevationOfPrivilege: 既存関数シグネチャ維持により L1 層の Write 判定セマンティクスに変更なし

## findings
None - 本修正はファイル読み取り専用、ネットワーク/外部入力なし。追加の攻撃面は生成されておらず、既存 hook セマンティクスを保存した分岐追加に留まる。

## checklist
- パストラバーサル: 対応 (readToonPhase は渡されたパスをそのまま fs.openSync に渡す。呼出元で dirname が制御済み)
- リソース枯渇: 対応 (64KB 超は head-only 4KB 読み取りに制限)
- 例外/throw: 対応 (全例外 try/catch で undefined 返却、fail-safe)
- シークレット混入: 対応 (JSON/TOON 値をログ出力しない、phase 文字列のみ返却)
- 絶対パス依存: 許容リスク (ADR-029 Consequences に記載済み、環境差異は設定変更で対応)

## severity
- High: 該当 finding なし。権限昇格・任意コード実行・機密漏洩に繋がる欠陥は検出されなかった
- Medium: 観測された中位リスクはゼロ件。絶対パス依存は設計上の許容リスクであり脆弱性分類には該当しない
- Low: 新規導入された脆弱性は存在せず、既存の low リスク項目はいずれも threat-model.md に掲載済みで緩和策が稼働中

## decisions
- D-SEC-001: readToonPhase は fs.openSync + 4KB バッファに固定し、任意サイズ読み取り経路を設けない
- D-SEC-002: phase 文字列は正規表現 `/^phase:\s*(\w+)/` による単一行抽出に限定し、他キー解釈を拒否する
- D-SEC-003: 例外発生時は undefined を返却する fail-safe 設計を維持し、呼び出し側の既存フォールバックに委譲する
- D-SEC-004: 絶対パス化は STATE_DIR 誤解決を排除する目的で採用、ADR-029 に許容リスクとして明記する
- SEC-005: 監視観点として rtk lossy 圧縮は security_scan 出力のデバッグに影響するため、完全出力が必要な場合は素コマンド実行へ切替える運用を明示 (rtk-scope.md 参照)

## artifacts
- 本ドキュメント security-scan.md
- 参照元 threat-model.md の STRIDE 分析
- 対象ファイル hook-utils.js / .mcp.json / start.sh
- 根拠文書 ADR-029-hook-mcp-state-sync.md

## next
- performance_test フェーズへ引継ぎ
- readToonPhase の 64KB 制限下でのレイテンシを計測し、hook フック全体のオーバーヘッドに閾値を設定する
- start.sh の pwd -P フォールバック経路が MCP 起動時間に与える影響を観測する
