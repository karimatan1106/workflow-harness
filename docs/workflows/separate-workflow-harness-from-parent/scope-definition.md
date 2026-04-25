# Scope Definition: separate-workflow-harness-from-parent (Phase A)

task: separate-workflow-harness-from-parent
phase: scope_definition
version: 1.0
date: 2026-04-11

## scope

keywords: separate workflow-harness parent ADR phase-templates hooks commands rules mcp.json cwd submodule commit push

Phase A は親リポジトリ `C:\ツール\Workflow\` に存在する設計資産 (ADR 群, workflow-phases テンプレート, 親固有 hooks, 親固有 commands, 追加 rules) を `workflow-harness/` サブモジュールへ加法的にコピーし、`workflow-harness/.mcp.json` の `cwd` を `"workflow-harness"` から `"."` に修正し、サブモジュールで commit + push するところまでを対象とする。親リポジトリ本体の削除・クリーンアップは Phase B 以降に分離する。

## in-scope

- `docs/adr/ADR-001.md` 〜 `docs/adr/ADR-027-remove-minimax-settings.md` (27 ファイル) を `workflow-harness/docs/adr/` へコピー
- `.claude/workflow-phases/*.md` (27 ファイル) を `workflow-harness/.claude/workflow-phases/` へコピー
- `.claude/hooks/` 親固有スクリプト (`check_ocr.py` を除く最大 13 本) を `workflow-harness/.claude/hooks/` へコピー
- `.claude/commands/` の `handoff.md`, `harness-report.md`, `recall.md` を `workflow-harness/.claude/commands/` へコピー
- `.claude/rules/` の `code-search-policy.md`, `rtk-scope.md` を `workflow-harness/.claude/rules/` へコピー
- `workflow-harness/.mcp.json` の `cwd` キーを `"."` に書き換え
- `workflow-harness` サブモジュールで `git add` → `git commit` → `git push origin main` を実行
- 既存 `workflow-harness/.claude/hooks/pre-tool-guard.sh` はバイト差分を確認のうえ、必要なら親版で上書き

## not-in-scope

- 親リポジトリ `C:\ツール\Workflow\` 配下のファイル削除・ディレクトリ削除
- `C:\ツール\workflow-harness\` への単独 clone セットアップ
- auto-memory `~/.claude/projects/C------Workflow/` の削除
- `~/.claude.json` の `projects[]` エントリ編集
- GitHub remote `karimatan1106/Workflow.git` の archive / delete
- 親リポジトリの `kirigami/`, `remotion/`, `vision_ocr_mcp_server/` 等のプロジェクト資産削除
- `check_ocr.py` の移管 (vision_ocr_mcp_server 依存のため本 Phase では対象外)
- 親リポジトリの `CLAUDE.md`, `.mcp.json`, `settings.json` の編集
- サブモジュール参照 SHA の親リポジトリ側での bump

## decisions

- D1: 加法的コピー方針を採用し、親側の資産は一切削除しない。親削除は Phase B 以降で切り離すことで、Phase A のロールバックを単純な `git reset` 1 回に限定する。
- D2: `.mcp.json` の `cwd` は `"."` に統一する。サブモジュール単独 clone 時に harness が自リポジトリ直下を正しく指すため。
- D3: `check_ocr.py` は vision_ocr_mcp_server 依存のため移管しない。ワークフロー純粋機能のみを submodule に集約し、外部 MCP 依存は親リポジトリに残す。
- D4: 既存ファイル (例 `pre-tool-guard.sh`) はバイト比較のうえ親版を権威とする。親側が最新に更新されている前提のため。
- D5: コピー実行は worker 層の Bash (`cp`) で行い、coordinator は scope/decomposition のみ担当する。
- D6: commit メッセージは `feat: migrate harness assets from parent repo (Phase A)` に統一し、対象ディレクトリを bullet で列挙する。
- D7: push 先は `karimatan1106/workflow-harness.git` の `main` ブランチ。force push は禁止、通常 push のみ許可。

## artifacts

- `workflow-harness/docs/adr/ADR-001.md` 〜 `ADR-027-remove-minimax-settings.md` (27 files, 新規)
- `workflow-harness/.claude/workflow-phases/*.md` (27 files, 新規)
- `workflow-harness/.claude/hooks/` 配下に親固有 hooks 最大 13 本 (新規または上書き)
- `workflow-harness/.claude/commands/handoff.md`, `harness-report.md`, `recall.md` (新規)
- `workflow-harness/.claude/rules/code-search-policy.md`, `rtk-scope.md` (新規)
- `workflow-harness/.mcp.json` (cwd フィールド更新, 差分 1 行)
- submodule 側の git commit 1 本 + remote push 記録

## AC 候補 (requirements phase で登録)

- AC-1: `workflow-harness/docs/adr/` に `ADR-001.md` 〜 `ADR-027-remove-minimax-settings.md` の 27 ファイルが存在する
- AC-2: `workflow-harness/.claude/workflow-phases/` に親と同じ 27 ファイルが存在し、内容が一致する
- AC-3: `workflow-harness/.claude/hooks/` に親固有 hooks (`check_ocr.py` を除く) がすべて存在する
- AC-4: `workflow-harness/.claude/commands/` に `handoff.md`, `harness-report.md`, `recall.md` が存在する
- AC-5: `workflow-harness/.claude/rules/` に `code-search-policy.md`, `rtk-scope.md` が存在する
- AC-6: `workflow-harness/.mcp.json` の `cwd` フィールドが `"."` である
- AC-7: 上記変更が submodule にコミットされ、`origin/main` に push 済みである

## next

- requirements phase: 上記 AC 候補 7 件を `requirements.md` に F-001 〜 F-007 として登録し、RTM を生成する
- design phase: 単純な file copy + 1 箇所 JSON 編集のため設計は最小化、ComponentDAG は hooks-batch / adr-batch / phases-batch / commands-batch / rules-batch / mcp-json-edit / submodule-commit-push の 7 コンポーネントで構成
- implementation phase: worker 層に 7 並列タスクを発行。各 batch はファイルリストを引数として受け取り `cp` を実行
- test phase: `find workflow-harness/docs/adr -name 'ADR-*.md' | wc -l` 等で存在確認、`jq '.mcpServers[].cwd' workflow-harness/.mcp.json` で cwd 検証
- code-review phase: `pre-tool-guard.sh` バイト差分の判断が正しかったかレビュー、`check_ocr.py` 除外判断の妥当性確認
- Phase B 設計: 親リポジトリ削除とスタンドアロン clone セットアップを別タスクとして切り出す準備
