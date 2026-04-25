phase: scope_definition
status: complete
summary: workflow-plugin → workflow-harness 全置換、3 ファイル rename + 5 ファイル content edit + path 修正 1
userResponse: User explicit "全部正しく修正だけでいい"、AskUserQuestion 不要

intent-analysis:
  userIntent: "workflow-plugin" 表記を全プロジェクトで "workflow-harness" に統一置換
  trigger: 過去のリネーム残骸が doc / spec / test に残存し、新規参加者が混乱する
  expectedOutcome: grep workflow-plugin が 0 件、ファイル名・内容ともに workflow-harness で統一
  scopeBoundary: 動作するソース・doc・spec・test の表記統一に限定。harness 機能変更は対象外

scope:
  inScope:
    - CHANGELOG.md (3 occurrences, FR-9/10/11 path 修正含む)
    - code-review.md (1 occurrence)
    - docs/operations/PLUGIN_CHANGELOG.md (14 occ, rename 対象)
    - docs/operations/workflow-plugin-maintenance.md (11 occ, rename 対象)
    - docs/security/threat-models/workflow-plugin.md (4 occ, rename 対象)
    - docs/security/threat-models/workflow-plugin-bugfix.md (1 occ, rename 対象)
    - docs/product/features/workflow-plugin-path-consistency.md (6 occ, rename 対象)
    - docs/spec/features/*.md (workflow-mcp-server.md 15, scope-validator.md 15, verify-sync.md 9, ほか)
    - docs/testing/{plans,reports}/*.md (validation, design)
    - docs/architecture/modules/*.md
    - docs/security/threat-models/workflow-runtime-bugs.md
    - src/backend/tests/unit/hooks/*.test.ts (8 files, 各 1〜6 occ)
    - src/backend/tests/regression/hook-fixes/regression.test.ts
    - .agent/handoff/2026-03-07-0000.md (1 occ)
    - .claude/skills/workflow-harness/workflow-operations.md (line 24 path 修正)
    - workflow-harness/.claude/skills/workflow-harness/workflow-operations.md
  notInScope:
    - node_modules/ (生成物)
    - .git/ (履歴 immutable)
    - dist/ (ビルド成果物)
    - .claude/state/ (実行時状態)
    - 過去 commit message (immutable history)
    - harness 自体の機能変更
    - rtk hook など別系統の rename

acceptanceCriteria[3]{id,criterion,measurement}:
  AC-1, "grep workflow-plugin で 0 件", "grep 結果カウント"
  AC-2, "git mv で 3 file rename が history 保持", "git log --follow が新旧両方追える"
  AC-3, ".claude/skills/workflow-harness/workflow-operations.md:24 の build path が workflow-harness/mcp-server を指す", "Read 確認"

openQuestions[0]:

decisions[3]{id,statement,rationale}:
  SD-1, "file content の workflow-plugin → workflow-harness 置換 history 記述は文脈判断で旧 workflow-plugin 形式保持可", "完全削除は historical context 喪失リスク"
  SD-2, "file 名は git mv で workflow-harness*.md に rename", "git --follow で履歴維持 cp + rm では history が切れる"
  SD-3, "PLUGIN_CHANGELOG.md は HARNESS_CHANGELOG.md にリネーム", "同一プロダクトの changelog 一本化"

artifacts[8]{path,role,summary}:
  "docs/workflows/replace-workflow-plugin-references/scope-definition.md", "spec", "本書 scope と AC と decisions を定義"
  "docs/operations/PLUGIN_CHANGELOG.md", "rename + content edit", "→ HARNESS_CHANGELOG.md にリネーム 14 occ 置換"
  "docs/operations/workflow-plugin-maintenance.md", "rename + content edit", "→ workflow-harness-maintenance.md にリネーム 11 occ 置換"
  "docs/security/threat-models/workflow-plugin.md", "rename + content edit", "→ workflow-harness-threat-model.md または同等にリネーム 4 occ 置換"
  "docs/security/threat-models/workflow-plugin-bugfix.md", "rename", "→ workflow-harness-bugfix-threat-model.md にリネーム 1 occ 置換"
  "docs/product/features/workflow-plugin-path-consistency.md", "rename", "→ workflow-harness-path-consistency.md にリネーム 6 occ 置換"
  "CHANGELOG.md", "content edit", "FR-9/10/11 path 修正含む 3 occ 置換"
  ".claude/skills/workflow-harness/workflow-operations.md", "content edit", "line 24 build path を workflow-harness/mcp-server に修正"

next:
  criticalDecisions:
    - implementation で sed 一括置換ではなく Edit tool で context aware に作業
    - rename 後 file name 衝突なし確認
    - Markdown 内部リンク切れチェック
  readFiles:
    - 8 target files (rename + 主要 edit)
    - docs/spec/features/workflow-mcp-server.md (15 occ で最大)
    - docs/spec/features/scope-validator.md (15 occ)
    - docs/spec/features/verify-sync.md (9 occ)
    - src/backend/tests/unit/hooks/test-n6-security-new.test.ts (6 occ)
  warnings:
    - rename は git mv 必須、cp + rm では history が切れる
    - history 記述 (legitimate な過去経緯) は文脈判断で保持、無条件削除しない
    - test ファイルの "workflow-plugin" は識別子として使われている可能性あり、置換時は test 通過確認

## decisions
- SD-1: file content の workflow-plugin → workflow-harness 置換、history 記述は文脈判断で「(旧 workflow-plugin)」形式保持可 (理由: 完全削除は historical context 喪失)
- SD-2: file 名は git mv で workflow-harness*.md に rename (理由: git --follow で履歴維持)
- SD-3: PLUGIN_CHANGELOG.md は HARNESS_CHANGELOG.md にリネーム (理由: 同一プロダクトの changelog 一本化)

## artifacts
- docs/workflows/replace-workflow-plugin-references/scope-definition.md (spec, 本書)
- docs/operations/PLUGIN_CHANGELOG.md (rename → HARNESS_CHANGELOG.md, content edit)
- docs/operations/workflow-plugin-maintenance.md (rename → workflow-harness-maintenance.md, content edit)
- docs/security/threat-models/workflow-plugin.md (rename → workflow-harness-threat.md or similar, content edit)
- docs/security/threat-models/workflow-plugin-bugfix.md (rename, content edit)
- docs/product/features/workflow-plugin-path-consistency.md (rename, content edit)
- CHANGELOG.md (FR-9/10/11 path 修正)
- .claude/skills/workflow-harness/workflow-operations.md (line 24 path 修正)

## next
- criticalDecisions: rename 後 file name 衝突なし確認、Markdown link 切れチェック
- readFiles: 8 target files
- warnings: history 記述 (legitimate な過去経緯) は文脈判断で保持、無条件削除しない
