# Requirements: separate-workflow-harness-from-parent (Phase A)

task: separate-workflow-harness-from-parent
phase: requirements
version: 1.2
date: 2026-04-11

## scope

keywords: separate workflow-harness parent ADR phase-templates hooks commands rules mcp.json cwd submodule commit push 加法的

本フェーズは親リポジトリ配下の設計資産を workflow-harness サブモジュールへ加法的にコピーし、.mcp.json の cwd を "." に修正したうえで submodule 内で commit + push するところまでを Phase A としてスコープする。

## summary

本要件は親リポジトリ `C:\ツール\Workflow\` と workflow-harness サブモジュールを完全分離する Phase A を定義する。Phase A では workflow-harness を単独自立させるために必要な資産 (親リポジトリに存在する ADR 群 27 件、phase テンプレート 27 件、親固有 hooks 群、commands 3 件、rules 2 件 (code-search-policy, rtk-scope)) を親から submodule 内に加法的にコピーし、workflow-harness/.mcp.json の cwd フィールドを "." へ書き換える JSON 編集を行ったうえで、submodule 内部での git commit と origin/main への push を実施する。親リポジトリ側のファイル削除は対象外で、すべての操作は加法的なコピー方針で進め、親側資産は一切変更しない。これにより Phase A のロールバックは submodule の git reset 1 回に限定され、並行作業中の他プロジェクトへの波及を防ぐ。コピー対象は ADR、workflow-phases テンプレート、hooks、commands、rules の 5 カテゴリであり、各カテゴリは独立コンポーネントとして並列実行可能である。

## decisions

- D1: 加法的コピー方針を採用し、親側資産は一切削除しない。Phase A のロールバックを submodule の git reset 1 回に限定するため。
- D2: workflow-harness/.mcp.json の cwd キーは "." に統一する。サブモジュール単独 clone 時に harness が自リポジトリ直下を正しく指すため。
- D3: check_ocr.py は vision_ocr_mcp_server 依存のため移管対象外。ワークフロー純粋機能のみを submodule に集約する。
- D4: 既存ファイル (pre-tool-guard.sh 等) はバイト比較のうえ親版を権威とし、必要に応じて上書きする。
- D5: コピー実行は worker 層の Bash (cp) で行い、coordinator は scope 分解のみ担当する。
- D6: commit メッセージは `feat: migrate harness assets from parent repo (Phase A)` に統一し、対象ディレクトリを bullet 列挙する。
- D7: push 先は karimatan1106/workflow-harness.git の main ブランチに限定し、force push は禁止する。
- D8: 本 Phase A は加法的コピーのみを扱い、既存の submodule 内ファイル上書きは D4 で明示した pre-tool-guard.sh 等の同名ファイルに限定する。新規パスへのコピーは無条件で許可する。
- D9: check_ocr.py は vision_ocr MCP サーバに依存する外部連携スクリプトのため、workflow-harness の純粋フェーズ実行に不要であり Phase A の移管対象から恒久的に除外する。
- D10: ADR 群に重複 ID (例: ADR-013 が 2 ファイル存在) があった場合でも、両方のファイルをそのままコピーして歴史保全を優先する。ID 衝突解消は Phase B 以降の別タスクで扱う。

## acceptanceCriteria

- AC-1: workflow-harness/docs/adr/ 配下に親リポジトリ docs/adr の 27 件 (ADR-001.md 〜 ADR-027-remove-minimax-settings.md) がすべて存在する。重複 ID が存在する場合は両方コピーして保全する。
  - 検証方法: `ls workflow-harness/docs/adr/ADR-*.md` の件数が親と一致、内容 diff 0
- AC-2: workflow-harness/.claude/workflow-phases/ 配下に親の workflow-phases 全 27 ファイルが存在し、ファイル名と内容が一致する。
  - 検証方法: `ls workflow-harness/.claude/workflow-phases/*.md` で 27 ファイル存在確認
- AC-3: workflow-harness/.claude/hooks/ 配下に親固有 hooks (check_ocr.py を除く) が存在する。
  - 検証方法: `ls workflow-harness/.claude/hooks/` に親固有 12 本 (check_ocr.py 除く) 存在確認
- AC-4: workflow-harness/.claude/commands/ 配下に handoff.md, harness-report.md, recall.md の 3 ファイルが存在する。
  - 検証方法: 3 ファイル個別に `stat` で確認
- AC-5: workflow-harness/.claude/rules/ 配下に code-search-policy.md, rtk-scope.md の 2 ファイルが存在する。
  - 検証方法: code-search-policy.md と rtk-scope.md の存在確認
- AC-6: workflow-harness/.mcp.json の各 mcpServers エントリの cwd フィールド値が "." である。
  - 検証方法: `jq '.mcpServers."workflow-harness".cwd' workflow-harness/.mcp.json` が `"."` を返す
- AC-7: 上記すべての変更が workflow-harness submodule にコミットされ、origin/main へ push 済みである。
  - 検証方法: `git -C workflow-harness log -1` で最新コミット、`git ls-remote origin main` で SHA 一致

## notInScope

- 親リポジトリ C:\ツール\Workflow\ の削除
- kirigami/, remotion/, vision_ocr_mcp_server/, src/, mcp-servers/ の扱い
- 単独 clone (C:\ツール\workflow-harness\ への配置)
- ~/.claude/projects/C------Workflow/ auto-memory の削除
- ~/.claude.json の projects[] エントリ編集
- GitHub remote (karimatan1106/Workflow.git) の archive/delete
- setup.sh 経由の他プロジェクトへの配布
- 親の CLAUDE.md や親 settings.json の編集
- submodule 参照 SHA の親リポジトリ側での bump
- check_ocr.py の移管 (vision_ocr_mcp_server 依存のため Phase A 対象外)

## constraints

- 全ファイル ≤200 行
- Markdown 形式 (.md)
- 禁止語ゼロ
- commit メッセージは英語 or 日本語いずれでも可
- --no-verify / --amend / --force 使用禁止
- コピーは加法的のみ、削除は一切しない

## successMetrics

- AC-1..AC-7 全 met
- F-001..F-007 全 verified
- submodule push 成功 (exit code 0)
- 重複行 3 回以上なし

## openQuestions

なし

## artifacts

- workflow-harness/docs/adr/ADR-001.md 〜 ADR-027-remove-minimax-settings.md (27 files, 新規コピー)
- workflow-harness/.claude/workflow-phases/*.md (27 files, 新規コピー)
- workflow-harness/.claude/hooks/ 配下の親固有 hooks (check_ocr.py を除く, 新規または上書き)
- workflow-harness/.claude/commands/handoff.md, harness-report.md, recall.md (3 files, 新規)
- workflow-harness/.claude/rules/code-search-policy.md, rtk-scope.md (2 files, 新規)
- workflow-harness/.mcp.json (cwd フィールド 1 行差分)
- submodule 側 git commit 1 本 + origin/main push 記録

## next

- planning phase: 7 コンポーネント (adr-batch, phases-batch, hooks-batch, commands-batch, rules-batch, mcp-json-edit, submodule-commit-push) の ComponentDAG を確定する
- design phase: 依存関係最小 (mcp-json-edit と submodule-commit-push のみ直列、他は並列) を設計に反映する
- test_design phase: find / wc / jq による存在・cwd 値検証テストを設計する
- implementation phase: worker 層に 6 並列 + 1 直列のタスクを発行する
