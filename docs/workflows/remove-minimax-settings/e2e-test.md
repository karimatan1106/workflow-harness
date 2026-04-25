# E2E Test — remove-minimax-settings

## Scope

本タスクは MiniMax 関連記述を CLAUDE.md / README / skills 配下から除去する
ドキュメント専用変更であり、実行時コードパスを一切変更しない。したがって
従来型のランタイム E2E シナリオ (UI 操作 → API → DB → assert) は該当しない。
代替として、リポジトリ全体を対象とする統合 grep (`test-minimax-removal.js`)
を E2E 相当の検証として採用する。これは文書 I/O 全経路に対する end-to-end な
アサーションとして機能する。

## E2E Flow (document-level)

1. session 起動: Claude Code が CLAUDE.md を読み込む
2. index 参照: CLAUDE.md → `.claude/rules/*.md` を参照
3. skill 読込: workflow-harness / update-config / その他 skills の SKILL.md を読み込む
4. subagent 委譲: coordinator/worker の agents/*.md を読み込む
5. 検証: 上記パス配下のいずれにも `minimax` / `MiniMax` 文字列が残存しないこと
6. 判定: TC-AC5-01 の統合 grep が Green ならフロー全体 PASS

## Evidence

- test-minimax-removal.js TC-AC5-01: リポジトリ全域 `rg -i minimax` の exit code 非 0 (matches 0 件) を assert
- manual-test.md: LLM session 開始時に該当セクションが読まれないことを確認済み
- acceptance-report.md: AC-1〜AC-5 すべて Green

## User-Facing Flow

LLM session が開始されたとき:
- CLAUDE.md を読んでもバックエンド候補として MiniMax が列挙されない
- rtk 注意書きから MiniMax の言及が消えている
- ADR / skills を参照しても MiniMax への参照リンクが発生しない

この観点で、エンドユーザー (= LLM agent) の意思決定フローから MiniMax の
選択肢が完全に除去されることを E2E 的に保証する。

## Result

PASS (代替 e2e として TC-AC5-01 Green, 統合 grep 0 matches)

## decisions

- D-E2E-1: runtime E2E は省略する。本変更はドキュメント削除のみで実行時
  コードパス・設定ロード・subprocess 呼び出しに変更が無く、ランタイム経路
  の回帰が発生する余地がないため、ランタイム E2E harness 起動コストを
  払う合理性がない。
- D-E2E-2: TC-AC5-01 (リポジトリ全域統合 grep) を E2E 相当として採用する
  根拠は、本タスクの観測対象が「全ドキュメント I/O 経路」であり、統合
  grep はその全経路を単一 assertion で覆うため end-to-end 性を満たす。
- D-E2E-3: session 起動時の CLAUDE.md 読込みシナリオを想定フローとする。
  Claude Code の実運用における最外殻トリガは session 開始時の project
  memory ロードであり、ここから派生する全参照が検証対象になる。
- D-E2E-4: subagent 委譲時 (coordinator/worker/hearing-worker) に
  MiniMax 設定参照は発生しない。agents/*.md に MiniMax 記述が無いことを
  前提とした delegation flow で追加副作用が無いことを確認する。
- D-E2E-5: Playwright/Puppeteer 等の外部 e2e ツール導入は本タスクに不適。
  対象が静的ドキュメントである以上、ブラウザ駆動テストの導入は
  over-engineering であり、統合 grep で十分なカバレッジが得られる。

## artifacts

- docs/workflows/remove-minimax-settings/e2e-test.md (this file)
- docs/workflows/remove-minimax-settings/test-minimax-removal.js (TC-AC5-01)
- docs/workflows/remove-minimax-settings/manual-test.md (ユーザー視点検証)
- docs/workflows/remove-minimax-settings/acceptance-report.md (AC 合否)
- docs/workflows/remove-minimax-settings/regression_test.md (回帰観点)

## next

- phase performance_test の実行 (本タスクでは N/A 宣言で通過見込み)
- phase final_review への接続準備
- RTM の E2E 欄更新: F-001〜F-005 に対し本ファイルパスを紐付け
