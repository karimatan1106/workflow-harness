---
name: workflow-harness
description: Intent-driven 30-phase workflow harness for code changes. Start here for requirements, design, implementation, testing, or code review tasks. Provides phase-by-phase guidance with L1-L4 deterministic gates.
user-invocable: true
---

# Workflow Harness — Router

30-phase, 8-stage lifecycle. Gates use L1-L4 deterministic checks only (L5 forbidden).
Phases = context compression devices: each artifact is the complete handoff for the next phase.

---

## 0. Task Detection (Auto-Start)
1. ユーザーの依頼を分析
2. コード変更を伴うか判定
   - YES → `harness_start` を自動呼び出し → orchestrator.md を読み込み
   - NO → ハーネスなしで直接回答

---

## 1. File Routing (read ONLY what the current stage needs)

**Always loaded**: This file (SKILL.md) + CLAUDE.md (authority spec).

| Current Stage | Read These Files | Why |
|--------------|-----------------|-----|
| `/workflow-harness start` | orchestrator.md | Execution flow, template rule |
| scope → requirements | phases.md, gates.md | Phase work + DoD checks |
| threat → planning | phases.md, execution.md | Phase work + subagent config |
| design phases | phases.md, docs.md | Phase work + doc/diagram placement |
| test_design → test_impl | phases.md, execution.md, gates.md | TDD, edit mapping, DoD |
| implementation | phases.md, execution.md, rules.md | Phase work, edit mapping, directives |
| implementation (API) | + api-standards.md, project-structure.md | API/structure standards |
| implementation (UI) | + project-structure.md, docs.md | Frontend structure, CDD |
| refactoring → code_review | phases.md, rules.md, gates.md | Quality, AC table, directives |
| testing → regression | phases.md, execution.md, operations.md | Test placement, baseline |
| acceptance → deploy | phases.md | Phase work only |
| retry/error | rules.md, execution.md | Retry protocol, error conversion |
| doc creation | docs.md | Directory structure, naming, per-phase docs |
| MCP restart | operations.md | Cache management procedure |
| package install | operations.md | Installation rules |

**Rule**: 1フェーズで読むファイルは最大4つ。全9ファイルを一度に読まない。

---

## 2. File Index (9 files, 853 lines total)

| File | Lines | Content | When |
|------|-------|---------|------|
| `workflow-orchestrator.md` | 113 | 3層モデル, MCP全ツール, テンプレートルール, Memory Curator | 毎タスク開始時 |
| `workflow-phases.md` | 78 | 30フェーズ作業内容, タスクサイジング | 各フェーズ作業時 |
| `workflow-rules.md` | 112 | 23指令, 22禁則, リトライ, 完了語, 成果物品質, Bash定義 | impl/review/retry時 |
| `workflow-gates.md` | 62 | L1-L4定義, フェーズ別DoD, UI-1~7政策 | DoD確認/承認時 |
| `workflow-execution.md` | 62 | subagent設定表, Bash許可表, エラー変換表, 編集制限表 | subagent起動時 |
| `workflow-docs.md` | 136 | ディレクトリ構造, 命名規則, フェーズ別ドキュメント作成 | ドキュメント配置時 |
| `workflow-operations.md` | 37 | テスト配置, MCP再起動, パッケージ規則 | テスト/運用時 |
| `workflow-project-structure.md` | 73 | Frontend/Backend構造, Docs-Source対応表 | ファイル作成時 |
| `workflow-api-standards.md` | 103 | Zod/Hono/OpenAPI, レスポンス形式, エラーコード | API実装時 |

---

## 3. Commands

| Command | Action |
|---------|--------|
| `/workflow-harness start <name>` | Start task (userIntent >= 20 chars, UI-1) |
| `/workflow-harness status` | Show current task state |
| `/workflow-harness next` | Run DoD checks and advance |
| `/workflow-harness approve <type>` | Approve gate |
| `/workflow-harness list` | List all active tasks |
| `/workflow-harness reset [reason]` | Reset to scope_definition |
| `/workflow-harness back <phase>` | Roll back to earlier phase |
| `/workflow-harness complete-sub <sub>` | Complete sub-phase in parallel group |

---

## 4. Command Routing

**`/workflow-harness start <name>`**
1. Pre-start: active tasks <= 5, git clean, branch fresh
2. Validate: userIntent >= 20 chars (UI-1), ambiguity (UI-2), purpose (UI-7)
3. `harness_start(taskName, userIntent)` → `harness_set_scope` if known
4. Report: taskId, phase, size, docsDir, sessionToken

**`/workflow-harness next`**: `harness_next(taskId, sessionToken)` → DoD failure: re-launch subagent (never edit directly)

**`/workflow-harness approve <type>`**: Present artifacts to user FIRST → `harness_approve(taskId, type, sessionToken)`

**`/workflow-harness complete-sub <sub>`**: `harness_complete_sub` → when all complete: `harness_next`

---

## 5. Workflow vs Direct Answer

| User Request | Action |
|-------------|--------|
| Code/file changes ("~して", "add X", "fix Y") | Start workflow |
| Questions, analysis ("~か？", "is X correct?") | Answer directly |

## 6. Growth Protocol

ファイルが200行に近づいた場合:
1. CLAUDE.mdとの重複を再チェック → 重複排除
2. 他ファイルとの重複を再チェック → 単一ソース化
3. 散文を箇条書き/表に変換 → 情報密度向上
4. それでも超過 → 最も独立したセクションを新ファイルに分離 + ルーティング表更新

## 7. Orchestrator Direct Edit Policy

`docs/workflows/` 配下のWrite/Edit直接編集禁止。Task toolでsubagent再起動。例外: `claude-progress.txt`のみ。
