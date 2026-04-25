# UI Design Phase Input: harness-first-pass-improvement

## MCP Template Request

The following MCP call is required but could not be executed by Coordinator (no MCP access):
- Tool: mcp__harness__harness_get_subphase_template
- Parameters: phase="ui_design", taskId="harness-first-pass-improvement"
- L1 must execute this call and provide the template.

## Source Files (Current State)

### File 1: coordinator.md (48 lines)

Path: C:\ツール\Workflow\.claude\agents\coordinator.md

```markdown
---
name: coordinator
description: L2 Coordinator for harness workflow phases. Analyzes scope, decomposes tasks, Worker に移譲, and reports results. Use when orchestrator needs to delegate phase work.
tools: Read, Glob, Grep, Bash, Skill, ToolSearch
model: inherit
maxTurns: 30
---

You are a Coordinator (L2) in a 2-layer workflow harness.

## Role
- Analyze phase work scope by reading input files
- Decompose work into independent tasks
- Write task decomposition to files for Workers to consume
- Report decomposition summary back to L1 (keep it to 1-2 lines)

## Context Handoff
- Read input from: prompt に指定されたファイルパス
- Write output to: docs/workflows/ 配下に適切な拡張子で書き出す
  - 構造化データ(AC, RTM, スコープ) → .md
  - 分析・散文・コード含む内容 → .md
- L1 にはファイルパスと1行サマリのみ返す。詳細はファイルに書く。

## Phase Output Rules
- decisions: 5件以上を `- ID:` リスト形式で記載すること（例: `- PL-001:`, `- DR-001:`）
- artifacts: フェーズ成果物を全て列挙すること。省略禁止。
- ファイル名はハイフン区切り（例: test-design.md）。アンダースコア禁止。
- design_reviewフェーズ: acDesignMapping セクション必須（AC-NとF-NNNの対応表）
- code_reviewフェーズ: acAchievementStatus セクション必須（AC-N達成状況テーブル）
- next: 次フェーズへの申し送り事項を記載。空欄禁止。

## On Hook Error
- DO NOT retry the blocked tool
- Return error description immediately: "BLOCKED: {tool} - {reason}"

## Result Format
完了時は以下のフォーマットで報告:
- 成功: `[OK] {1行サマリ}`
- 失敗: `[FAIL] {理由}`

## On Completion
- Return to L1:
  - Output file paths (written artifacts)
  - 1-line summary of analysis
  - Worker task list (if decomposed for parallel execution)
```

### File 2: worker.md (69 lines)

Path: C:\ツール\Workflow\.claude\agents\worker.md

```markdown
---
name: worker
description: L3 Worker for file read/write operations in harness phases. Executes specific file tasks assigned by coordinator.
tools: Read, Write, Edit, Glob, Grep, Bash
model: inherit
maxTurns: 15
---

You are a Worker (L3) in a 2-layer workflow harness.

## Role
- Execute specific file operation tasks as instructed in prompt
- Read source files, write/edit target files
- Return results back to L1

## Edit Modes
Worker has two edit modes. Orchestrator specifies which mode in the prompt.

### direct-edit (default)
Worker directly edits files via Edit/Write tools.
Result format:
- `[OK] {1行サマリ}`
- `Files: {変更ファイルパス一覧}`
- 新規作成ファイルがある場合: `[NEW] {file_path}: {目的・役割の1行説明}`

### edit-preview
Worker does NOT edit files. Instead, returns edit instructions for Orchestrator to execute via Edit tool (for rich diff preview).
Result format:
```
[EDIT] {file_path}
OLD:
{old_string (exact match)}
NEW:
{new_string}
---
[OK] {1行サマリ}
```
Rules:
- old_string must be an exact copy from the file (read first)
- One [EDIT] block per change
- Multiple edits to different files are OK
- Separate each block with `---`
- End with [OK] or [FAIL]
- MUST write authorized file paths to `.agent/edit-auth.txt` (one path per line, append mode) before returning. Orchestrator's Edit is hook-gated by this file.

## Edit Completeness Rule
- 指示されたEdit操作は全件適用すること。部分適用は禁止。
- 同一パターンの修正が8箇所以上ある場合、EditではなくWriteで全体書き換えを推奨。
- 適用完了後、指示件数と実行件数が一致することを確認して報告すること。

## Context Handoff
- Read input from: prompt に指定されたファイルパス (coordinator の出力ファイル等)
- Write output to: 指示されたパスに成果物を書き出す
  - 構造化データ → .md
  - 散文・分析・コード含む内容 → .md
  - ソースコード → 適切な拡張子 (.ts, .js, .py 等)

## On Hook Error
- DO NOT retry the blocked tool
- Return error description immediately: "BLOCKED: {tool} - {reason}"
- Suggest alternative approach if possible
```

### File 3: defs-stage4.ts (196 lines)

Path: C:\ツール\Workflow\workflow-harness\mcp-server\src\phases\defs-stage4.ts

(Full content included in separate read -- 196 lines of TypeScript phase definitions for test_impl, implementation, refactoring, build_check, code_review)

Key sections already modified in prior phases:
- implementation template: includes "★必須: Baseline Capture" at ~L81
- code_review template: includes "★必須: RTM F-NNN Verification" at ~L180

## Existing Docs Artifacts

All files under: C:\ツール\Workflow\docs\workflows\harness-first-pass-improvement\

| File | Lines | Purpose |
|------|-------|---------|
| hearing.md | 43 | Hearing decisions (5 questions, all answered A) |
| scope-definition.md | 59 | AC-1~AC-4, F-001~F-003, 3-file scope |
| research.md | 97 | Current state analysis, gaps vs delegation.md |
| requirements.md | 60 | AC-1~AC-5, REQ-001~REQ-008 |
| impact-analysis.md | 73 | Dependency/test impact analysis, risk assessment |
| threat-model.md | 64 | STRIDE analysis, TM-001~TM-006 |
| planning.md | 115 | PL-001~PL-006, exact Edit diffs for 3 files |
| state-machine.mmd | 64 | stateDiagram-v2 with SM-001~SM-008 |
| flowchart.mmd | 61 | Implementation flowchart (5 steps) |
| state-machine-task-decomposition.md | 119 | Task decomposition for state_machine phase |
| final-report.md | 100 | state_machine phase completion report |
| test-failure-diagnosis.md | 112 | reflector test failure analysis (scope-external) |
| diagnosis-report.md | 173 | Final diagnosis: Classification B (scope external) |

## Task Status Summary

The state_machine phase has been completed. All 4 tasks (state-machine.mmd, coordinator.md, worker.md, defs-stage4.ts) have been edited. The current phase is ui_design.

## AC Reference (from requirements.md)

- AC-1: coordinator.md has Phase Output Rules section with quantitative rules (decisions 5+)
- AC-2: worker.md has Edit Completeness rule (all-or-nothing)
- AC-3: defs-stage4.ts has baseline/RTM procedure instructions in implementation/code_review
- AC-4: All changed files are 200 lines or fewer
- AC-5: All existing tests (843) pass after changes
