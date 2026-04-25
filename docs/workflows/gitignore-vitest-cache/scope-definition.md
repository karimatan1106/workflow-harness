phase: scope_definition
status: complete
summary: vitest cache 3パターンを workflow-harness/.gitignore に追加し submodule dirty marker 解消
userResponse: orchestrator経由でユーザーから「Express mode で3-pattern ignore 追加」承認済 (hearing approval gate完了)

intent-analysis:
  problem: workflow-harness submodule に vitest cache が落ち、parent repo で `m workflow-harness` の dirty marker が常時発生する
  rootCause: workflow-harness/.gitignore に vitest 関連の cache パターンが定義されていない
  desiredOutcome: cache 生成後も git status がクリーンになる
  constraints: parent repo は触らない、tracked file の untrack は行わない、最小差分で解決する

scope:
  inScope:
    - workflow-harness/.gitignore に `**/node_modules/.vite/` パターンを追加
    - workflow-harness/.gitignore に `**/.vite/` パターンを追加
    - workflow-harness/.gitignore に `mcp-server/vitest-out.json` パターンを追加
  notInScope:
    - parent repo の .gitignore 変更
    - src/, mcp-server/dist/, hooks/ 配下のソースコード改修
    - vitest config (vitest.config.ts 等) の修正
    - 既存 tracked file に対する git rm --cached による untrack 操作
    - dist/ や build pipeline への変更
  unchanged:
    - workflow-harness/.gitignore の既存エントリ全て
    - parent repo .gitignore
    - vitest 実行設定

acceptanceCriteria[3]{id,criterion,measurement}:
  AC-1, "workflow-harness/.gitignore に **/node_modules/.vite/ パターンが含まれる", "grep で確認"
  AC-2, "workflow-harness/.gitignore に **/.vite/ パターンが含まれる", "grep で確認"
  AC-3, "改修後 git status で m workflow-harness の dirty marker が消えている", "status コマンド出力に該当文字列なし"

openQuestions[0]:

decisions[3]{id,statement,rationale}:
  SD-1, "vitest cache を gitignore で抑え込み git rm --cached は使わない", "cache file は既に未tracked。一括 untrack の副作用回避"
  SD-2, "3パターン (**/node_modules/.vite/ / **/.vite/ / mcp-server/vitest-out.json) を採用", "観測実体への最小被覆。過剰な glob で意図しない無視を避ける"
  SD-3, "parent repo の .gitignore は変更しない", "問題は submodule 側に閉じている。parent への波及は別タスクとして切り離す"

artifacts[3]{path,role,summary}:
  "docs/workflows/gitignore-vitest-cache/scope-definition.md", spec, "本ファイル。scope_definition phase の成果物"
  "workflow-harness/.gitignore", impl, "改修対象ファイル。3パターン追記する"
  "docs/workflows/gitignore-vitest-cache/hearing.md", parent-artifact, "前段 hearing phase の成果物。HR-001〜HR-003 の方針が前提"

next:
  criticalDecisions:
    - SD-1: git rm --cached は使わない。impl phase では patterns 追記のみ
  readFiles:
    - workflow-harness/.gitignore (現在の内容把握、末尾改行と既存 patterns 確認)
    - docs/workflows/gitignore-vitest-cache/hearing.md (HR-001〜HR-003 再確認)
  warnings:
    - ファイル末尾改行を破壊しないこと
    - 既存 patterns との重複を避けること

## decisions
- SD-1: vitest cache を gitignore で抑え込み git rm --cached は使わない (理由: cache file は既に未tracked、ignore 追加だけで充分)
- SD-2: 3パターンを採用 (`**/node_modules/.vite/`, `**/.vite/`, `mcp-server/vitest-out.json`) (理由: 観測されている実体への最小被覆)
- SD-3: parent repo の .gitignore は変更しない (理由: 問題は submodule 側、波及は別タスク)

## artifacts
- docs/workflows/gitignore-vitest-cache/scope-definition.md (spec)
- workflow-harness/.gitignore (impl, 改修対象)
- docs/workflows/gitignore-vitest-cache/hearing.md (前段成果物)

## next
- criticalDecisions: SD-1 git rm --cached なし、ignore 追加のみ
- readFiles: workflow-harness/.gitignore, hearing.md
- warnings: ファイル末尾改行を破壊しないこと、既存patterns との重複確認
