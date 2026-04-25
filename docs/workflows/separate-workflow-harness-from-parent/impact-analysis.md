# Impact Analysis: separate-workflow-harness-from-parent (Phase A)

task: separate-workflow-harness-from-parent
phase: impact_analysis
version: 1.0
date: 2026-04-11

## summary

Phase A は加法的ファイルコピー + `.mcp.json` の 1 行書換 + submodule commit/push のみで構成される。親リポジトリ側のファイル削除はスコープ外のため、ロールバックは submodule の `git revert` もしくは親側で submodule pointer を前 SHA に戻すだけで完結する。総合リスク判定: **Low-Medium**。Medium 要因は `.mcp.json` cwd 変更と GitHub remote への push という共有状態変化のみ。

## 1. 影響範囲

### 1.1 submodule 内部 (workflow-harness/)
- `docs/adr/` — 新規ディレクトリ作成、ADR 物理 28 本追加 (ユニーク番号 27 + ADR-013 重複 1 本)
- `.claude/workflow-phases/` — 新規ディレクトリ作成、phase テンプレート 27 本追加
- `.claude/hooks/` — 既存 2 本 (pre-tool-guard.sh, rtk-rewrite.sh) に親固有 11 本追加 (check_ocr.py 除外)
- `.claude/commands/` — 新規ディレクトリ作成、handoff.md / harness-report.md / recall.md の 3 本追加
- `.claude/rules/` — 既存 6 本に code-search-policy.md / rtk-scope.md の 2 本追加、tool-delegation.md を親版で上書き
- `.mcp.json` — 5 行目 `"cwd": "workflow-harness"` → `"cwd": "."` の 1 行書換
- 合計追加/更新ファイル数: 約 71 本 (28 ADR + 27 phases + 11 hooks + 3 commands + 2 rules 新規 + tool-delegation 上書き + .mcp.json)

### 1.2 親リポジトリ (C:/ツール/Workflow/)
- submodule pointer の git コミット (任意、Phase A 本体では実施しない)
- 親側 `.claude/` や `docs/adr/` は一切変更しない (Phase B で削除)

### 1.3 外部 (GitHub remote)
- `karimatan1106/workflow-harness.git` main ブランチに 1 コミット push
- 通常 push のみ、force push 禁止 (scope D7)

### 1.4 ユーザー環境
- setup.sh 経由で harness を他プロジェクトに配布しているユーザーは、次回 setup 実行時に追加ファイル群を受け取る
- 現在 submodule として参照しているプロジェクトは、submodule update するまで影響なし

## 2. リスク評価

- **Low** — 加法的コピーで既存ファイルの上書きは `tool-delegation.md` の 1 本のみ。pre-tool-guard.sh は research フェーズで内容一致 (行末差のみ) を確認済み、上書きしない。
- **Low** — 約 71 ファイル追加で submodule リポジトリサイズは数百 KB 程度の微増。git clone 時間への影響は体感不能。
- **Medium** — `.mcp.json` cwd 変更は破壊的変更。現セッションが親 `C:\ツール\Workflow\` の `.mcp.json` (cwd: `"workflow-harness/mcp-server"`) を使用しているため、submodule 側 `.mcp.json` は実行時に参照されず、本セッションの harness 起動には影響しない。ただし単独 clone した workflow-harness 配下で直接 harness を起動する将来ユースケースでは `"."` が必須となる。
- **Medium** — GitHub remote への push は共有状態変更。push 後に revert するには再度 push が必要で、force push 禁止制約のため `git revert` + 通常 push の2 コミット運用になる。
- **Low** — hooks/commands/rules/phases/ADR のいずれも `kirigami`, `vision_ocr`, `remotion`, `check_ocr`, `C:/ツール/Workflow` といった親固有識別子を含まないことを grep で確認済み。pure harness 資産のみ移管される。
- **Low** — submodule 側 CI は現状 vitest 等の自動テストを対象ファイル拡張子 (.md/.sh) に対して実行しない。静的ファイル追加のため CI 破壊リスク無し。

## 3. rollback 手段

- **R-1 (commit 単位)**: submodule 内で `git revert <migrate-commit-sha>` → `git push origin main` の通常 push で巻き戻し
- **R-2 (未 push 前)**: `git reset --hard HEAD~1` をローカルで実行して commit 破棄 (push 前限定)
- **R-3 (親 submodule pointer)**: 親リポジトリが submodule pointer を bump していた場合は親側でも `git checkout <前 sha> -- workflow-harness` で pointer を戻す
- **R-4 (ユーザー波及)**: 他プロジェクトで fetch しない限りローカル状態は無変化。fetch 済み環境は R-1 の revert コミットを追加 pull で自動同期

## 4. 影響を受けるユーザー/プロセス

- 現セッション (親 `C:\ツール\Workflow\` から harness 操作中): 親 `.mcp.json` を使用しているため submodule 側 `.mcp.json` cwd 変更の影響を受けない。作業継続可能
- Phase B で実施予定の単独 clone セットアップ: Phase A の成果を反映した状態で clone され、`"cwd": "."` により mcp-server 起動が成功する
- setup.sh で配布しているプロジェクト: 次回 setup 実行時に追加された hooks/commands/rules を自動的にコピーして受け取る
- submodule を直接 clone して使う既存利用者: 次回 `git pull` で追加ファイルを取得、`.mcp.json` cwd 変更は直接 clone 利用者にとって fix にあたる

## 5. 依存関係確認結果

- hooks 配下の `harness-enforce.sh`, `post-commit-auto-push.sh`, `pre-tool-gate.sh`, `context-watchdog.sh` 等に `kirigami` / `vision_ocr` / `remotion` / `check_ocr` 参照なし (grep 結果 0 件)
- `.claude/workflow-phases/*.md` 全 27 本に親固有パス (C:/ツール/Workflow, kirigami, vision_ocr, remotion) 参照なし
- `docs/adr/` 配下 ADR 群にも親プロジェクト識別子の参照なし
- `.claude/commands/handoff.md`, `harness-report.md`, `recall.md` に親固有識別子なし
- `.claude/rules/code-search-policy.md`, `rtk-scope.md` に親固有識別子なし
- 結論: 全移管候補は harness 単体で自己完結しており、外部プロジェクト依存はゼロ

## 6. 後続 Phase への引き継ぎ事項

- requirements phase: scope-definition.md の AC-1 〜 AC-7 を F-001 〜 F-007 として登録、RTM 生成
- design phase: 7 コンポーネント DAG (hooks-batch / adr-batch / phases-batch / commands-batch / rules-batch / mcp-json-edit / submodule-commit-push)
- implementation phase: W-1 〜 W-7 の worker タスク (or worker 1 個で一括実行も可)
- test phase: `find workflow-harness/docs/adr -name 'ADR-*.md' | wc -l` で件数検証、`jq '.mcpServers[].cwd' workflow-harness/.mcp.json` で cwd 検証
- push 前の最終チェック: submodule 側既存の未 commit 変更 (mcp-debug.log, state toon 等) を stash してクリーン環境で移管 commit を作成する (research R-3 対応)

## decisions

- D1: 総合リスク判定は **Low-Medium**。Medium 要因は `.mcp.json` 破壊的変更と GitHub remote への共有状態 push の 2 点のみで、他は全て Low
- D2: 親リポジトリ側の `.mcp.json` (cwd: `workflow-harness/mcp-server`) は本 Phase で一切触らないため、現セッションの harness 起動パスは不変
- D3: force push は R-1/R-2/R-3 いずれのロールバック手段でも不要。revert コミット + 通常 push で巻き戻し可能
- D4: `check_ocr.py` は vision_ocr_mcp_server 依存のため移管対象外 (research D-R-3 継承)。harness 純粋機能のみを submodule に集約する原則を保持
- D5: submodule 側 CI は静的 `.md`/`.sh` ファイル追加に対して破壊テストを持たないため、Phase A のコピー作業でテスト失敗は発生しない
- D6: 移管対象 71 ファイル全てに親プロジェクト固有識別子 (kirigami, vision_ocr, remotion, C:/ツール/Workflow) が存在しないことを grep で確認済み。依存関係ゼロで移管可能
- D7: rollback は `git revert` (通常 push) で完結する。force push 禁止制約下でも復旧可能

## artifacts

- `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/impact-analysis.md` (本ファイル)
- 参照: `scope-definition.md`, `research.md` (同ディレクトリ配下)
- 検証対象: `C:/ツール/Workflow/workflow-harness/.mcp.json` (5 行目 cwd), `C:/ツール/Workflow/.mcp.json` (親側、変更なし確認)

## next

- requirements phase: AC-1 〜 AC-7 を F-001 〜 F-007 として register_requirement で登録
- design phase: 7 batch コンポーネントの依存関係を最小化 (全 batch 並列実行可能、submodule-commit-push のみ直列最後)
- implementation phase: worker 1 個で 7 batch を順次実行 (並列化の実益は小さく、worker プロセス起動オーバーヘッドのほうが大きい)
