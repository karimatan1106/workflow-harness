# research: separate-workflow-harness-from-parent

## scope
親リポジトリ `C:/ツール/Workflow` から submodule `workflow-harness` を単独 clone 可能な自立リポジトリとして分離するため、移管対象ファイル群の実在・件数・内容差分を確定する。本フェーズでは計測と判断のみ行い、ファイル移動は次フェーズで実施する。

## measurements

### 1. ADR
- 親側: `C:/ツール/Workflow/docs/adr/*.md` = 28 ファイル (ADR-001〜ADR-027 + ADR-013 重複1件)
  - 重複: `ADR-013-article-insights-harness-improvements.md` と `ADR-013-harness-report-fb-fixes.md` が同番で併存
  - ユニーク ADR 番号ベースでは 27 種類、物理ファイルは 28 本
- submodule 側: `workflow-harness/docs/adr/` は存在しない (新規作成が必要)

### 2. workflow-phases
- 親側: `.claude/workflow-phases/*.md` = 27 ファイル
  - README.md を含む phase 定義一覧 (branching-strategy, build_check, ci_verification, code_review, commit, deploy, design_review, docs_update, e2e_test, flowchart, implementation, manual_test, performance_test, planning, push, refactoring, regression_test, requirements, research, security_scan, state_machine, test_design, test_impl, testing, threat_modeling, ui_design)
- submodule 側: `workflow-harness/.claude/workflow-phases/` は存在しない

### 3. hooks diff
- 親 `.claude/hooks/` 全ファイル (13 本): `check_ocr.py`, `context-watchdog.sh`, `handoff-reader.sh`, `handoff-validator.sh`, `harness-enforce.sh`, `post-commit-auto-push.sh`, `post-tool-lint.sh`, `pre-compact-context-save.sh`, `pre-tool-config-guard.sh`, `pre-tool-gate.sh`, `pre-tool-guard.sh`, `pre-tool-no-verify-block.sh`, `test-guard.sh`
- submodule `.claude/hooks/` (2 本): `pre-tool-guard.sh`, `rtk-rewrite.sh`
- `pre-tool-guard.sh` diff 結果: **内容は完全一致** (親 710B / submodule 700B のバイト差は CRLF/LF 行末のみ)
- `check_ocr.py` は `tempfile.gettempdir() / "ocr_jobs"` を監視する OCR ジョブ検出スクリプト。harness の機能ではなく親環境固有のツール連携 (OCR MCP ワークフロー補助) のため、移管対象外

### 4. commands
- 親 `.claude/commands/`: `handoff.md`, `harness-report.md`, `recall.md` (3 本)
- いずれも harness 運用コマンドとして submodule に移管可能

### 5. rules diff
- 親 `.claude/rules/` (8 本): code-search-policy, core-constraints, documentation-layers, forbidden-actions, rtk-scope, session-recovery, tool-delegation, workflow-enforcement
- submodule `.claude/rules/` (6 本): core-constraints, documentation-layers, forbidden-actions, session-recovery, tool-delegation, workflow-enforcement
- 親のみ存在: `code-search-policy.md` (301B, Serena LSP 前提)、`rtk-scope.md` (2.3K, rtk 挙動ルール)
- `tool-delegation.md` の差分: 親は 1 行多く `Agent呼び出し時はworkflow-delegation.mdの4層テンプレート(Why/What/How/Constraints)に従う。` を含む (親 769B vs submodule 658B)。親側が新しい

### 6. .mcp.json 現状
- path: `C:/ツール/Workflow/workflow-harness/.mcp.json`
- 現在値 (6 行 JSON): `"cwd": "workflow-harness"` (5 行目)
- 親リポジトリから見た相対パス前提のため、単独 clone 時は解決不能

### 7. submodule git state
- remote: `origin  https://github.com/karimatan1106/workflow-harness.git` (fetch/push 同一)
- branch: `main`
- status: 未コミット変更あり (mcp-debug.log、state toon 群、新規 workflows/ dir)
- 直近コミット: `8f967e3 feat(setup): auto-install rtk and check jq in setup.sh`
- push 先は既に自前 remote を保有しているため独立 push 可能

### 8. gitignore side-effect
- 親 `.gitignore` 21 行目: `**/docs/workflows/` → 成果物は git 管理外
- submodule `.gitignore` 6 行目: `**/docs/workflows/` → submodule 側でも同一パターンで除外
- research.md のような成果物は両リポジトリで無視されるため、今回の research.md は git 追跡されない

## decisions
- D-R-1: ADR 27 種(物理 28 本)を `workflow-harness/docs/adr/` に丸コピー。ADR-013 重複はファイル名保持のまま両方コピーし、次フェーズで整理判断
- D-R-2: `.claude/workflow-phases/*.md` 27 本を `workflow-harness/.claude/workflow-phases/` に移管 (ディレクトリ新設)
- D-R-3: `.claude/hooks/check_ocr.py` は harness 非依存の OCR 補助スクリプトのため移管対象外 (親リポジトリに残置)
- D-R-4: `pre-tool-guard.sh` は親/submodule で内容一致 (行末差のみ)。submodule 既存を維持し親側は変更しない
- D-R-5: `workflow-harness/.mcp.json` の 5 行目 `"cwd": "workflow-harness"` を単独 clone 前提で `"cwd": "."` に変更
- D-R-6: submodule は既に `karimatan1106/workflow-harness.git` remote を持つため push 先はそのまま流用、新規リポジトリ作成不要
- D-R-7: 親リポジトリ側の重複ファイル削除 (`docs/adr/`, `.claude/workflow-phases/`, `.claude/rules/*` 等) は本タスクのスコープ外。submodule 自立化が成立した後の別タスクで扱う
- D-R-8: `tool-delegation.md` は親のほうが 1 行新しいため、移管時は親版で submodule を上書き
- D-R-9: `code-search-policy.md` と `rtk-scope.md` は親にのみ存在し harness 運用に関わるため submodule に新規追加
- D-R-10: 親 `.claude/commands/` 3 本 (handoff/harness-report/recall) は submodule に移管

## artifacts
- `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/research.md` (本ファイル)
- `C:/ツール/Workflow/docs/adr/` (計測対象、28 本)
- `C:/ツール/Workflow/.claude/workflow-phases/` (計測対象、27 本)
- `C:/ツール/Workflow/.claude/hooks/pre-tool-guard.sh` (diff 対象、内容一致確認済み)
- `C:/ツール/Workflow/workflow-harness/.mcp.json` (変更対象、5 行目)
- `C:/ツール/Workflow/.claude/rules/tool-delegation.md` (親が新しい、上書き対象)
- `C:/ツール/Workflow/.claude/rules/code-search-policy.md` (submodule 新規追加)
- `C:/ツール/Workflow/.claude/rules/rtk-scope.md` (submodule 新規追加)

## next
- N-1: requirements フェーズで AC を確定 (ADR 27 種コピー完了、phases 27 本コピー完了、.mcp.json cwd = ".", etc.)
- N-2: design フェーズで移管手順 DAG を作成 (ディレクトリ作成 → コピー → .mcp.json 書換 → 動作確認)
- N-3: implementation フェーズでファイル移動と .mcp.json 編集を worker に委譲
- N-4: test フェーズで `cd workflow-harness && node mcp-server/dist/index.js` を単独ディレクトリ前提で起動確認
- N-5: code_review フェーズで submodule 側の `.gitignore` / ADR 重複 / phases README 整合をレビュー
- N-6: commit/push フェーズで submodule 側に独立コミットを作成し `origin/main` へ push

## risks
- R-1: ADR-013 同番重複を残したまま submodule にコピーすると下流で参照曖昧化
- R-2: `.mcp.json` cwd を `.` に変更すると親リポジトリ側の mcp 起動 (親 `.mcp.json` が別途存在すれば) に影響する可能性があるので親側の mcp 設定を後続タスクで確認する必要あり
- R-3: submodule 側の未コミット変更 (mcp-debug.log、state toon 群) が移管作業と混在すると diff が汚染される。事前に stash または commit 分離が必要
