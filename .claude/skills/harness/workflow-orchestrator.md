---
name: harness-orchestrator
description: Orchestrator protocol, three-layer execution model, model selection, context handoff, and MCP tool reference.
---
> CLAUDE.md Sec5(Orchestrator)/Sec9(sessionToken) が権威仕様。本ファイルはプロトコル詳細とMCPツール一覧。

## 1. Orchestrator Protocol

Main Claude = Orchestrator. Never does phase work directly. Delegates via Agent Teams.

### Three-Layer Execution Model (Agent Teams)
```
Orchestrator (state management, delegation, retry tracking)
  → TeamCreate → Coordinator (ComponentDAG execution, parallel planning)
    → Agent() → Worker (reads files, writes artifacts atomically)
```
| 層 | 起動方法 | 責務 | 使用可能ツール |
|----|---------|------|--------------|
| Orchestrator | - | 状態管理・フェーズ遷移 | ライフサイクルMCP、TeamCreate、SendMessage、Skill、AskUserQuestion |
| Coordinator | TeamCreateで定義 | フェーズ作業管理・Worker委譲 | 非ライフサイクルMCP、Agent |
| Worker | CoordinatorからAgent()で起動 | ファイル読み書き | Read、Write、Edit、Bash、Glob、Grep |

### Execution Flow (Agent Teams)
1. `harness_start(taskName, userIntent)`
2. For each phase:
   a. `harness_next` → advance (returns hasTemplate flag)
   b. If hasTemplate: `harness_get_subphase_template` → get prompt
   c. `TeamCreate` でCoordinatorを定義（フェーズ実行の責務）
   d. `SendMessage` でCoordinatorにテンプレートを送信
   e. Coordinator が `Agent(prompt=template)` でWorkerを起動
   f. Worker が入力読み込み → 作業 → 成果物書き出し
   g. Orchestrator が `harness_next` → DoD検証+遷移
3. Parallel phases: 複数TeamCreateを同時発行 → Worker並列実行 → `harness_complete_sub`
4. Approval gates: present artifacts to user → `harness_approve`
5. Validation failure: re-launch via TeamCreate (NEVER edit directly)

### フェーズ実行フロー（3層モデル — Agent Teams）
```
Orchestrator (lifecycle MCP + TeamCreate + SendMessage のみ)
│
├─ harness_start           ← オーケストレーター直接実行
│
├─ Phase N のサブステップ:
│   ├─ TeamCreate(Coordinator)  ← Coordinatorをチーム定義
│   └─ SendMessage(template)    ← テンプレートをCoordinatorに送信
│         └─ Coordinator が Agent(Worker) を起動
│               └─ Worker → Read/Edit/Write + harness_set_scope + harness_add_ac 等
│
├─ harness_next            ← オーケストレーター直接実行（DoD検証）
│
├─ Phase N+1 のサブステップ:
│   ├─ TeamCreate(Coordinator)  ← 新しいCoordinatorで次フェーズ
│   └─ SendMessage(template)
│
└─ 繰り返し → harness_next (completed)
```
注意: WorkerはLifecycle MCP (_start, _next, _approve, _status, _back, _reset) を呼べない。これらはOrchestrator専用。
注意: Coordinatorは非ライフサイクルMCP + Agent のみ使用可。Skillは使用不可。

### Worker並列化ポリシー
Coordinatorはタスクの依存関係を分析し、独立タスクを最大限並列でAgent()起動する。
- 分割単位: ファイル単位。同一ファイルを複数Workerが編集しない限り並列可
- 起動数は動的: 事前に固定しない。Coordinatorがスコープとファイル依存関係から判断
- 並列判断フロー:
  1. スコープ内ファイル一覧を取得
  2. ファイル間の依存関係を分析（import/require）
  3. 独立グループごとに1 Worker = 1 Agent()で同時起動
  4. 依存があるファイル群は逐次実行
- 制約: 同一ファイルへの並列Write/Edit禁止（競合防止）

### Template & Model Rules
- NEVER construct prompts from scratch. Get from `harness_next` or `harness_get_subphase_template`. Use VERBATIM.
- SoT: model → `registry.ts (PHASE_REGISTRY)`。null=親モデル継承(CLI起動時モデル)、haiku=明示指定
- null(inherit): 分析・推論・コード生成・code_review — CLI起動時のモデルを継承
- haiku: コマンド実行のみ (build_check, testing, regression_test, commit, push, ci_verification, deploy, completed)
- Escalation: haiku→inherit after 2 failed retries; 3rd+ always inherit
- Extended Thinking: scope_definition, research, requirements, threat_modeling, impact_analysis, design_review, test_design

### Context Handoff (TOON-first)
- Files in `{docsDir}/` bridge subagent-to-subagent context
- 次subagentはまず `{docsDir}/{prevPhase}.toon` を読む（JSON比40-50%トークン削減）
- TOONが無い場合: MDの `## サマリー` (Delta Entry形式) をフォールバック
- TOON `next.readFiles` が次フェーズの読むべきファイルを明示
- Context techniques: differential reading (`git diff --stat`), index-first, negative space (`NOT_RELEVANT`)

### Phase Completion Reporting
`[{phase} phase complete] Completed: {description}. Next: {next_phase}. Remaining: {count} phases.`

---

## 2. MCP Tool Reference

### Core Lifecycle (6)
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_start | Create task | taskName, userIntent (>= 20 chars) |
| harness_status | Get state + sessionToken | taskId (required for token) |
| harness_next | Advance phase | taskId, sessionToken, retryCount |
| harness_approve | Gate approval | taskId, type, sessionToken |
| harness_complete_sub | Sub-phase done | taskId, subPhase, sessionToken |
| harness_list | List tasks | - |

### Navigation (2)
| Tool | Purpose |
|------|---------|
| harness_back | Roll back to targetPhase |
| harness_reset | Reset to scope_definition |

### Scope & Feedback (2)
| Tool | Purpose |
|------|---------|
| harness_set_scope | Set files/dirs/glob (addMode) |
| harness_record_feedback | Append feedback |

### Traceability (6)
| Tool | Purpose |
|------|---------|
| harness_add_ac | Add AC |
| harness_add_rtm | Add RTM (id, requirement, designRef, codeRef, testRef) |
| harness_update_ac_status | Update AC status (open/met/not_met) |
| harness_update_rtm_status | Update RTM status (pending/implemented/tested/verified) |
| harness_record_proof | Record L1-L4 proof |
| harness_pre_validate | Dry-run DoD |

### Testing (5)
| Tool | Purpose |
|------|---------|
| harness_capture_baseline | Record baseline (totalTests, passedTests, failedTests[]) |
| harness_record_test | Register test file |
| harness_record_test_result | Record result (subagent OK, output >= 50 chars) |
| harness_get_test_info | Get tests + baseline |
| harness_record_known_bug | Record known bug (testName, description, severity) |

### Query (2)
| Tool | Purpose |
|------|---------|
| harness_get_known_bugs | List bugs |
| harness_get_subphase_template | Get template (phase, taskId) |

### DCI (4)
| Tool | Purpose |
|------|---------|
| dci_build_index | Build design-code index |
| dci_query_docs | Query design documents |
| dci_query_files | Query source files |
| dci_validate | Validate design-code alignment |

---

## 3. Memory Curator Protocol (ACE)

After task completion (`completed` phase), Orchestrator runs memory curation:

1. Scan: Read `MEMORY.md` + linked topic files
2. Staleness: Compare entries against recent task learnings
3. Dedup: Merge overlapping entries into more specific one
4. Prune: Remove entries referencing deleted files/obsolete patterns
5. Record: Add 1-3 new stable patterns (not session-specific)

Rules: Never add session-specific context. Never exceed 200 lines in MEMORY.md. Never duplicate CLAUDE.md/skill files. Prefer updating over adding. Delete wrong entries.
