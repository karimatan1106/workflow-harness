---
name: harness-orchestrator
description: Orchestrator protocol, two-layer execution model, model selection, context handoff, and MCP tool reference.
---
> CLAUDE.md Sec5(Orchestrator)/Sec9(sessionToken) が権威仕様。本ファイルはプロトコル詳細とMCPツール一覧。

## 1. Orchestrator Protocol

Main Claude = Orchestrator. Never does phase work directly. Delegates via Agent() subagents.

### Two-Layer Execution Model (Agent Subagents)
```
Orchestrator (state management, delegation, retry tracking)
  → Agent(coordinator) → analysis, task decomposition, writes results to files
  → Agent(worker) × N → file operations, writes artifacts to files
```
| 層 | 移譲方法 | 責務 | 使用可能ツール |
|----|---------|------|--------------|
| Orchestrator | - | 状態管理・フェーズ遷移 | ライフサイクルMCP、Agent、Skill、AskUserQuestion |
| Coordinator | Agent(subagent_type="coordinator") | 分析・タスク分解・ファイル出力 | Read、Glob、Grep、Bash、Skill、ToolSearch |
| Worker | Agent(subagent_type="worker") | ファイル読み書き・成果物生成 | Read、Write、Edit、Bash、Glob、Grep |

### Execution Flow (Agent Subagents)
1. `harness_start(taskName, userIntent)`
2. For each phase:
   a. `harness_next` → advance (returns hasTemplate flag)
   b. If hasTemplate: `harness_get_subphase_template` → get prompt
   c. `Agent(subagent_type="coordinator", prompt=template)` → 分析・タスク分解
      - coordinator は入力ファイルを読み、結果をファイルに書き出す
      - L1 には1行サマリとファイルパスのみ返却
   d. coordinator の出力ファイルパスを prompt に含め、Worker に移譲:
      `Agent(subagent_type="worker", prompt="...")` × N（並列可）
      - worker は coordinator が書いたファイルを読み、成果物を書き出す
      - L1 には1行サマリとファイルパスのみ返却
   e. Orchestrator が `harness_next` → DoD検証+遷移
3. Parallel phases: 複数 Agent(worker) を同時発行 → `harness_complete_sub`
4. Approval gates: present artifacts to user → `harness_approve`
5. Validation failure: 再移譲 via Agent (NEVER edit directly)

### フェーズ実行フロー（2層モデル）
```
Orchestrator (lifecycle MCP + Agent のみ)
│
├─ harness_start           ← オーケストレーター直接実行
│
├─ Phase N のサブステップ:
│   ├─ Agent(coordinator)    ← 分析・タスク分解 → ファイル書き出し
│   └─ Agent(worker) × N    ← ファイル読み込み → 成果物書き出し
│
├─ harness_next            ← オーケストレーター直接実行（DoD検証）
│
├─ Phase N+1:
│   ├─ Agent(coordinator)
│   └─ Agent(worker) × N
│
└─ 繰り返し → harness_next (completed)
```
注意: WorkerはLifecycle MCP (_start, _next, _approve, _status, _back, _reset) を呼べない。これらはOrchestrator専用。

### Context Handoff (ファイルベース中継)
- subagent 間の文脈は全てファイルで中継する
- coordinator が分析結果をファイルに書き出し、worker がそれを読む
- L1 のコンテキストにはファイルパスと1行サマリのみ蓄積
- ファイル形式は内容に応じて選択:
  - 構造化データ(AC, RTM, スコープ) → .toon (JSON比40-50%トークン削減)
  - 散文・分析・コード含む内容 → .md
  - ソースコード → 適切な拡張子
- 次subagentはまず前工程の出力ファイルを読む
- Context techniques: differential reading (`git diff --stat`), index-first

### Worker並列化ポリシー
Orchestratorはcoordinatorの分析結果に基づき、独立タスクを最大限並列でAgent(worker)に移譲する。
- 分割単位: ファイル単位。同一ファイルを複数Workerが編集しない限り並列可
- 移譲数は動的: coordinatorの分析結果から判断
- 制約: 同一ファイルへの並列Write/Edit禁止（競合防止）
- 1ターン = 1レスポンス。並列ツール呼び出しは1ターン消費
- 並列数に上限なし（200まで検証済み）。制約はレスポンスのトークン量のみ
- 1つのエラーでバッチ全体がキャンセルされるため、確実なパスのみ並列で投げる

### Worker直接移譲フェーズ（coordinator不要）
以下のフェーズはcoordinatorを経由せず、OrchestratorからWorkerに直接移譲する。
分析・タスク分解が不要で、単一コマンドまたは単一操作で完結するフェーズ。
- build_check, testing, regression_test, commit, push, ci_verification, deploy, completed

これら以外のフェーズは必ずcoordinator→worker の2層で実行する。
Worker直接移譲フェーズはforegroundで実行する（run_in_background: false）。

### Template & Model Rules
- NEVER construct prompts from scratch. Get from `harness_next` or `harness_get_subphase_template`. Use VERBATIM.
- SoT: model → `registry.ts (PHASE_REGISTRY)`。null=親モデル継承(CLI起動時モデル)、haiku=明示指定
- null(inherit): 分析・推論・コード生成・code_review — CLI起動時のモデルを継承
- haiku: コマンド実行のみ (build_check, testing, regression_test, commit, push, ci_verification, deploy, completed)
- Escalation: haiku→inherit after 2 failed retries; 3rd+ always inherit
- Extended Thinking: scope_definition, research, requirements, threat_modeling, impact_analysis, design_review, test_design

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

### Post-Completion Retrospective
completedフェーズ到達後、Memory Curator の前に `/retrospective` を実行する。
手動実行も可能: 任意のタイミングで `/retrospective` を呼び出し。

## 3. Memory Curator Protocol (ACE)

After task completion (`completed` phase), Orchestrator runs memory curation:

1. Scan: Read `MEMORY.md` + linked topic files
2. Staleness: Compare entries against recent task learnings
3. Dedup: Merge overlapping entries into more specific one
4. Prune: Remove entries referencing deleted files/obsolete patterns
5. Record: Add 1-3 new stable patterns (not session-specific)

Rules: Never add session-specific context. Never exceed 200 lines in MEMORY.md. Never duplicate CLAUDE.md/skill files. Prefer updating over adding. Delete wrong entries.
