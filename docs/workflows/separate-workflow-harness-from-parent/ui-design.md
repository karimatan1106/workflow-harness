# UI Design — separate-workflow-harness-from-parent

## 概要

本タスクは workflow-harness サブモジュール配下の設定ファイルを親リポジトリから独立させる移管作業である。
ユーザー向けの視覚的インターフェース、CLI の対話体験、MCP ツールの入出力スキーマに対する変更は発生しない。
従って本フェーズは形式上の N/A 判定となるが、DoD 通過のため decisions と artifacts を明文化する。

## 判定

- 種別: N/A (UI 変更なし)
- 根拠: 対象は .claude/settings.json と hook スクリプトのパス解決ロジックのみ。
- 影響を受けないレイヤ: CLI help、MCP シグネチャ、hook stdin/stdout、setup.sh 出力、ドキュメント視覚表現
- 後続タスク (Phase B 以降) で README の単独 clone 手順を更新するが、本フェーズの範囲外である

## Decisions

- D-UI-1: UI 変更なし。ファイル移管タスクのため視覚的コンポーネントは追加も削除もしない
- D-UI-2: CLI および MCP ツールの出力フォーマットに変更を加えない。既存のコンシューマ互換性を維持する
- D-UI-3: Claude Code session 開始時の CLAUDE.md 読込みフローに影響を与えない。子リポジトリ単独起動でも同等の挙動を保証する
- D-UI-4: mermaid 図 (state-machine.mmd / flowchart.mmd) 以外のドキュメント視覚要素の追加はしない
- D-UI-5: 既存ハーネス MCP ツール (harness_start 等) のシグネチャは不変。引数名・型・戻り値形式を維持する
- D-UI-6: hook スクリプトの exit code 仕様を維持する。L1-L4 ゲートの判定ロジックには触れない
- D-UI-7: .mcp.json の cwd パラメータ調整は起動時のみに作用し、対話的プロンプトを発生させない

## 変更なし項目 (多観点列挙)

### CLI レイヤ

- `workflow-harness --help` の出力文字列は一字一句変わらない
- サブコマンド一覧 (start/status/resume) の並び順と説明文を維持
- エラー終了時の stderr メッセージテンプレートも継続利用

### MCP レイヤ

- harness_start / harness_status / harness_finish の引数スキーマは凍結
- 戻り値の taskId / sessionToken / phase フィールド名を変更しない
- TOON 形式のレスポンスペイロードのキー順序も既存のまま

### Hook レイヤ

- PreToolUse / PostToolUse hook が受け取る stdin JSON 構造は不変
- hook が返す PermissionDecision の文字列リテラルを維持
- フック実行時の環境変数 CLAUDE_PROJECT_DIR の参照方法を継続

### ドキュメントレイヤ

- README の見出し階層、目次、章立てを維持
- 既存の mermaid 図やスクリーンショット画像への差し替えなし
- ADR 文書のフォーマット (Status / Context / Decision / Consequences) を踏襲

### セットアップレイヤ

- setup.sh の実行時ログの行構成、プレフィックス (==> など) を保持
- プログレス表示の色付けやバッジ類に変更なし
- インタラクティブプロンプトの追加・削除なし

## 視覚的成果物

本タスクで提出済みの視覚的アーティファクトは以下 2 件のみであり、いずれも前フェーズで作成された。

- state-machine.mmd — 移管プロセスの状態遷移図
- flowchart.mmd — ファイル移動と検証の実行フロー

両図は workflow/separate-workflow-harness-from-parent ディレクトリ配下に配置済みで、本フェーズでの追加改修は実施しない。

## Artifacts

- docs/workflows/separate-workflow-harness-from-parent/ui-design.md (本ファイル)
- docs/workflows/separate-workflow-harness-from-parent/state-machine.mmd (既存)
- docs/workflows/separate-workflow-harness-from-parent/flowchart.mmd (既存)

## Next

- 次フェーズ: dependency-analysis または component-design (ハーネス仕様に従う)
- 後続 Phase B でのドキュメント UI 改訂タスクは別 taskId で起票する
- README 更新、INSTALL ガイド整備は本タスクのスコープ外であり、分離完了後に別タスクで取り扱う

## 備考

本ドキュメントは DoD 通過のための形式成果物である。
ファイル移管という性質上、ユーザー体験への直接的な接点が存在しないことを明示し、後工程の誤解を防ぐ目的で各レイヤ別に「不変である」旨を記録する。
