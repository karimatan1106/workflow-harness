# docs-update

## summary

MiniMax 削除タスク (remove-minimax-settings) の docs_update フェーズ記録。本タスクはドキュメント・設定記述の削除そのものが実装内容であり、追加ドキュメント執筆は発生しない。本ファイルは DoD ゲート通過のための明示的な記録であり、既に acceptance phase で met 判定済みの 4 ファイル変更 (削除 1 + 行削除 3) を docs 更新記録としてトレースする。CHANGELOG・README・独立 ADR の更新は運用方針と変更の軽微性から不要と判定した。

## decisions

- D-DU-1: README の追加更新を行わない。本リポジトリ README は harness 運用の入門ガイドであり、MiniMax は内部開発メモ層 (feedback_*.md) にのみ存在していた。README に MiniMax 固有の記述はなく、削除後も README の記述整合性は保たれているため追加編集は発生しない。
- D-DU-2: CHANGELOG の更新を行わない。本リポジトリは CHANGELOG.md による semver ベースのリリースノート運用を採用しておらず、変更履歴は git log とコミットメッセージで管理されている。存在しない運用ファイルへの追記は逆に運用乖離を生むため回避する。
- D-DU-3: 独立 ADR の追記を行わない。MiniMax 関連記述は「試行的メモ」層であり設計判断の撤回ではない。ADR は Why の永続化に用いる層 (→ ADR-004, ADR-005) であり、軽微なメモ削除に対して ADR を発行するとイミュータブル層のシグナル比が下がる。既存 ADR の invalidate も発生していない。
- D-DU-4: 本タスクの docs 更新記録は acceptance-report.md と本ファイル (docs-update.md) の 2 点で担保する。acceptance-report.md には AC/RTM verified 状態と削除ファイル一覧が既に記載済みであり、docs-update.md はフェーズ DoD 充足のための明示的ハンドオフとして機能する。
- D-DU-5: auto-memory layer (MEMORY.md) は本タスク内で feedback_no-minimax.md 削除と同時に index を同期済み。memory index と実ファイルの整合性は acceptance phase の regression_test (5/5 PASS) で verified となっており、追加の memory 再生成は不要。

## artifacts

- `C:/ツール/Workflow/docs/workflows/remove-minimax-settings/docs-update.md` (本ファイル)
- `C:/ツール/Workflow/docs/workflows/remove-minimax-settings/acceptance-report.md` (AC/RTM verified 記録, 本 phase の主エビデンス)
- 変更済みファイル 4 点 (削除 1 + 行削除 3):
  - 削除: `.claude/rules/feedback_no-minimax.md` (ファイル単位削除, 1 ファイル)
  - 行削除: `CLAUDE.md` (MiniMax 記述のブロック削除)
  - 行削除: `MEMORY.md` (auto-memory index から該当 feedback 行削除)
  - 行削除: `patterns/canboluk.md` (MiniMax 参照の削除)

### change inventory

| 変更種別 | 対象パス | 対応 F-ID | 対応 AC |
|----------|----------|-----------|---------|
| file delete | `.claude/rules/feedback_no-minimax.md` | F-002 | AC-2 |
| line delete | `CLAUDE.md` | F-001 | AC-1 |
| line delete | `MEMORY.md` | F-003 | AC-3 |
| line delete | `patterns/canboluk.md` | F-004 | AC-4 |
| 検証 | 全対象ファイル | F-005 | AC-5 |

### 追加 docs 不要の判断根拠

- 本タスクは設計判断の撤回ではなく、試行メモの消去である。Why 層 (ADR) への記録対象ではない。
- 削除対象は内部開発メモ層 (feedback_*, MEMORY, patterns) に限定され、外部公開ドキュメント層 (README, docs/) への波及がない。
- test-minimax-removal.js (自動検証 5 TC) が削除状態を永続的に担保するため、散文による再記述は冗長となる。

## next

- 次フェーズ: DoD 通過後、docs_update phase を complete とし後続フェーズ (存在すれば) に遷移する。
- acceptance phase は既に met 判定済みのため、docs_update 完了をもって本タスクの workflow は実質終了となる見込み。
- git commit は本タスク workflow の最終段で実行する。コミットメッセージは削除対象ファイル 4 点と AC-1..AC-5 met の事実を反映する。
- 本ファイルは以降のフェーズで参照されるため、リポジトリ直下からの相対パス `docs/workflows/remove-minimax-settings/docs-update.md` で固定する。
