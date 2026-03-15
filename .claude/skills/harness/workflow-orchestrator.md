---
name: harness-orchestrator
description: Orchestrator protocol, two-layer execution model, model selection, context handoff, and MCP tool reference.
---
> CLAUDE.md Sec5(Orchestrator)/Sec9(sessionToken) が権威仕様。本ファイルはプロトコル詳細とMCPツール一覧。

## 1. Orchestrator Protocol

Main Claude = **Orchestrator**. Never does phase work directly. Delegates via Task tool.

### Two-Layer Execution Model
```
Orchestrator (lifecycle MCP のみ: state management, delegation, retry tracking)
  -> Subagent (~500 words: reads files, writes artifacts, MCP操作)
```

### Execution Flow
1. `harness_start(taskName, userIntent)`
2. For each phase:
   a. `harness_next` → advance (returns hasTemplate flag)
   b. If hasTemplate: `harness_get_subphase_template` → get prompt
   c. `Task(prompt=template)` — テンプレートをそのまま使用
   d. Subagent reads inputs, does work, writes output
   e. `harness_next` → DoD検証+遷移
3. Parallel phases: launch multiple Task calls simultaneously → `harness_complete_sub`
4. Approval gates: present artifacts to user → `harness_approve`
5. Validation failure: re-launch subagent (NEVER edit directly)

### フェーズ実行フロー（2層モデル）
```
Orchestrator (lifecycle MCP のみ)
│
├─ harness_start           ← オーケストレーター直接実行
│
├─ Phase N のサブステップ:
│   └─ Agent(subagent) → harness_set_scope + Read/Edit/Write + harness_add_ac 等
│                         （MCP操作とファイル操作を同一subagentで実行）
│
├─ harness_next            ← オーケストレーター直接実行（DoD検証）
│
├─ Phase N+1 のサブステップ:
│   └─ Agent(subagent) → 新鮮なコンテキストで次フェーズ実行
│
└─ 繰り返し → harness_next (completed)
```
注意: subagentはlifecycle MCP (_start, _next, _approve, _status, _back, _reset) を呼べない。これらはオーケストレーターのみ。

### Template & Model Rules
- **NEVER construct prompts from scratch.** Get from `harness_next` or `harness_get_subphase_template`. Use VERBATIM.
- **opus**: code_review ONLY (SRB-1: independent model prevents self-review bias)
- **sonnet**: Analysis, reasoning, code generation
- **haiku**: Structured output, mechanical transforms
- Escalation: haiku→sonnet after 2 failed retries; 3rd+ always sonnet
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
| harness_record_test_result | Record result (**subagent OK**, output >= 50 chars) |
| harness_get_test_info | Get tests + baseline |
| harness_record_known_bug | Record known bug (testName, description, severity) |

### Query (2) / Task Management (2)
| Tool | Purpose |
|------|---------|
| harness_get_known_bugs | List bugs |
| harness_get_subphase_template | Get template (phase, taskId) |
| harness_create_subtask | Decompose (DCP-1) |
| harness_link_tasks | Parent-child link |

---

## 3. Memory Curator Protocol (ACE)

After task completion (`completed` phase), Orchestrator runs memory curation:

1. **Scan**: Read `MEMORY.md` + linked topic files
2. **Staleness**: Compare entries against recent task learnings
3. **Dedup**: Merge overlapping entries into more specific one
4. **Prune**: Remove entries referencing deleted files/obsolete patterns
5. **Record**: Add 1-3 new stable patterns (not session-specific)

Rules: Never add session-specific context. Never exceed 200 lines in MEMORY.md. Never duplicate CLAUDE.md/skill files. Prefer updating over adding. Delete wrong entries.
