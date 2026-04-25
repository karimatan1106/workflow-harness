# UI Design

## background
本タスクはhook/MCP層のインフラ修正でGUIを伴わない。ここでは開発者が体感するCLI挙動とエラーメッセージ、設定ファイルの見え方を整理する。DXの後退を避けることが目的。

## uxScope
- MCPサーバ起動時のコンソール出力
- harness関連コマンド（/workflow-harness start など）の体感動作
- hook ブロック時のエラーメッセージ
- 設定ファイル（.mcp.json、start.sh）の可読性
- ADR-029がリポジトリ閲覧時にどう見えるか

## cliBehaviorChanges
### beforeFix
- 新規タスク作成後すぐにworker Write/Editが「no active phase」でblock
- state の保存先がわかりにくく、2系統の .claude/state/ に分かれる
- bootstrap 手順を手動実行しないとharness運用不能

### afterFix
- 新規タスク作成→直後のworker Write/Editが通常通り動作
- state は単一ルート（絶対パス解決されたSTATE_DIR配下）に集約
- bootstrap 手順はリポジトリから消え、開発者は意識する必要なし

## errorMessaging
- hookのWrite block時に返すエラーはreason文を維持（"Write/Edit not allowed" などの既存表現）
- TOON読み取り失敗時は silent fallback にせず、debugログに "toon parse skipped: <file>" を1行出力
- 新規ログは日本語化せず英語のままとし既存の慣習と整合

## configFileSurface
- .mcp.jsonは既存フォーマットを維持し envキーの値だけが絶対パス相当に更新される
- start.shの先頭コメントに「STATE_DIR absolute resolution」の1行メモを追加
- 他のMCPエントリ（もし存在すれば）へのフォーマット影響は無し

## adrVisibility
- docs/adr/ADR-029-hook-mcp-state-sync.md は標準のADRテンプレートで作成
- Status/Context/Decision/Consequences/References セクション構造で既存ADR（023-028）と並列に表示可能

## decisions
- D-001: UXエラー文言は既存の英語表現を温存しローカライズ追加はしない
- D-002: TOON読み取り失敗時は debugレベルで1行ログを出し silent を避ける
- D-003: .mcp.json の env 値は絶対パスに更新するが envキー名自体は維持する
- D-004: start.sh に1行のヘッダーコメントを追加して絶対化の意図を明示する
- D-005: ADR-029 は既存ADR番号連番で追加し、他ADRと同じ章構造を踏襲する
- D-006: bootstrap 手順は README / CLAUDE.md から完全削除し、ADR-029 内の履歴記録のみ残す

## artifacts
- 本ドキュメント ui-design.md
- 次フェーズ test_design への入力
- ADR-029 作成時の UX 整合性チェック参照元

## next
- test_design フェーズへ進む
- 各ACに対応するテストケースを定義する
- 特に "readToonPhase" と "bootstrap unnecessary" の統合ケースを定義する

## constraints
- GUIなし、CLI/DXのみ
- 既存エラー文言の破壊的変更なし
- 外部UIフレームワーク追加なし
- L1-L4決定的ゲートのみ
