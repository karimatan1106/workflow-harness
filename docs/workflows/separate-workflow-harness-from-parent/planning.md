# Planning: separate-workflow-harness-from-parent

taskId: b3e4eddb-0f57-4cd6-8714-6fdf98b6e12f
phase: planning
worker 数: 1 (シーケンシャル実行)

## Overview

AC-1..AC-7 を worker タスク W-1..W-7 に分解する。全タスクは加法的コピー + 単一行編集 + git 操作で構成され、1 worker の直列実行で完結する。

## Worker Tasks

### W-1 (AC-1 / F-001): ADR 27 件のコピー

- 入力ADR: `C:/ツール/Workflow/docs/adr/*.md`
- 出力ADR: `workflow-harness/docs/adr/*.md`
- 手順 (ADR):
  - step W-1-a: `mkdir -p workflow-harness/docs/adr/`
  - step W-1-b: `cp -p docs/adr/*.md workflow-harness/docs/adr/`
- 検証ADR: `ls workflow-harness/docs/adr/ADR-*.md | wc -l` が親の件数と一致

### W-2 (AC-2 / F-002): workflow-phases 27 ファイルのコピー

- 入力phases: `.claude/workflow-phases/*.md`
- 出力phases: `workflow-harness/.claude/workflow-phases/*.md`
- 手順 (workflow-phases):
  - step W-2-a: `mkdir -p workflow-harness/.claude/workflow-phases/`
  - step W-2-b: `cp -p .claude/workflow-phases/*.md workflow-harness/.claude/workflow-phases/`
- 検証phases: submodule 側のファイル数 = 親ディレクトリのファイル数

### W-3 (AC-3 / F-003): 親固有 hooks コピー (check_ocr.py 除外)

- 対象ファイル (11 件):
  - グループ1: context-watchdog.sh, handoff-reader.sh, handoff-validator.sh, harness-enforce.sh
  - グループ2: post-commit-auto-push.sh, post-tool-lint.sh, pre-compact-context-save.sh
  - グループ3: pre-tool-config-guard.sh, pre-tool-gate.sh, pre-tool-no-verify-block.sh, test-guard.sh
- 除外hooks: check_ocr.py (親固有用途、research 済)
- 既存維持hooks: pre-tool-guard.sh (submodule 側に同等内容あり、上書き回避)
- 手順hooks: `cp -p .claude/hooks/{対象ファイル} workflow-harness/.claude/hooks/`
- 検証hooks: ls で該当ファイル存在、cp -p により実行 permission が保全されている

### W-4 (AC-4 / F-004): commands 3 ファイルコピー

- 対象commands: handoff.md, harness-report.md, recall.md
- 手順 (commands):
  - step W-4-a: `mkdir -p workflow-harness/.claude/commands/`
  - step W-4-b: `cp -p .claude/commands/{handoff.md,harness-report.md,recall.md} workflow-harness/.claude/commands/`
- 検証commands: 3 ファイル存在

### W-5 (AC-5 / F-005): rules 2 ファイルコピー

- 対象rules: code-search-policy.md, rtk-scope.md
- 手順rules: `cp -p .claude/rules/{code-search-policy.md,rtk-scope.md} workflow-harness/.claude/rules/`
- 検証rules: 2 ファイル存在

### W-6 (AC-6 / F-006): .mcp.json の cwd 修正

- 対象mcp: `workflow-harness/.mcp.json`
- 修正mcp: `"cwd": "workflow-harness"` -> `"cwd": "."`
- 手順mcp: Edit ツールで単一行置換 (Worker の edit-preview 経由)
- 検証mcp: `jq . workflow-harness/.mcp.json` が syntax エラーを返さず、cwd 値が "." であること

### W-7 (AC-7 / F-007): submodule commit + push

- 作業ディレクトリ: `workflow-harness`
- 手順 (git):
  - step W-7-a stage: `git add -A docs/adr .claude .mcp.json`
  - step W-7-b commit message (英語):
    - title: `feat: import parent assets for standalone operation`
    - body: Copy ADRs, workflow-phase templates, parent-specific hooks, commands, and additional rules from the enclosing Workflow repo so workflow-harness can be cloned and run independently. Fix .mcp.json cwd to "." for standalone clone compatibility.
  - step W-7-c push: `git push origin main`
- 検証git: `git log -1` で commit 確認、`git ls-remote origin main` で remote 反映確認

## 実行順と並列性

- 順序seq: W-1 -> W-2 -> W-3 -> W-4 -> W-5 -> W-6 -> W-7 (strict sequential)
- 並列性note: W-1..W-6 は独立のため理論上並列化可能だが、総規模が小さいため単一 worker 直列実行で単純化する
- 担当assignee: worker 1 人

## Decisions

- D-PL-1: worker 1 人で W-1..W-7 を直列実行。規模が小さく並列化の利得が薄い
- D-PL-2: `cp -p` を使用して permission とタイムスタンプを保全する
- D-PL-3: `check_ocr.py` は親固有用途のためコピー対象から除外 (research フェーズで確認済)
- D-PL-4: `pre-tool-guard.sh` は submodule 側に同等内容が既存のため上書きしない
- D-PL-5: commit メッセージは英語の簡潔な形式とし、reviewer 可読性を優先
- D-PL-6: push 先は `origin main` (submodule の remote 設定に従う)
- D-PL-7: rollback が必要な場合は `git revert HEAD` を使用し、force push は行わない

## Artifacts

- 入力参照一覧:
  - 参照A requirements: `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/requirements.md`
  - 参照B scope: `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/scope-definition.md`
  - 参照C research: `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/research.md`
  - 参照D impact: `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/impact-analysis.md`
- 出力planning: `C:/ツール/Workflow/docs/workflows/separate-workflow-harness-from-parent/planning.md` (本ファイル)
- 変更対象一覧:
  - 変更T1: `workflow-harness/docs/adr/` (新規追加: ADR 27 件)
  - 変更T2: `workflow-harness/.claude/workflow-phases/` (新規追加: フェーズテンプレート 27 件)
  - 変更T3: `workflow-harness/.claude/hooks/` (既存ディレクトリに 11 ファイル追加)
  - 変更T4: `workflow-harness/.claude/commands/` (新規追加: handoff/harness-report/recall)
  - 変更T5: `workflow-harness/.claude/rules/` (既存ディレクトリに 2 ファイル追加)
  - 変更T6: `workflow-harness/.mcp.json` (1 行修正: cwd を "." に変更)

## Next

- 次フェーズ: implementation
- 初手 worker: W-1 (ADR コピー) から開始
- DoD: 全 7 worker 完了後、submodule 単体 clone で AC-1..AC-7 を満たすことを testing フェーズで検証
