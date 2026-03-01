---
name: harness-orchestrator
description: Orchestrator protocol, three-layer execution model, subagent templates, model selection, context handoff, and complete MCP tool reference.
---

# Workflow Harness — Orchestrator & MCP Tools

## 1. Orchestrator Protocol

Main Claude = **Orchestrator**. Never does phase work directly. Delegates via Task tool.

### Three-Layer Execution Model
```
Orchestrator (~100 words: state management, delegation, retry tracking)
  -> Manager (~300 words: ComponentDAG execution, parallel planning)
    -> Worker (~500 words: reads files, writes artifacts atomically)
```

### Execution Flow
1. Pre-start checks (active tasks, git status, branch freshness)
2. `harness_start(taskName, userIntent)`
3. For each phase:
   a. Get template from `harness_next` response (`phaseGuide.subagentTemplate`)
   b. If unavailable: `harness_get_subphase_template(phase, taskId)`
   c. Launch `Task(prompt=template, subagent_type='general-purpose', model=phaseModel)`
   d. Subagent reads inputs, does work, writes output
   e. Call `harness_next` to run DoD gates and advance
4. For parallel phases: launch multiple Task calls simultaneously
5. At approval gates: present artifacts to user, then `harness_approve`
6. On validation failure: re-launch subagent (NEVER edit directly)

### Subagent Prompt Template Rule
**NEVER construct prompts from scratch.** Get template from `harness_next` or `harness_get_subphase_template`. Use VERBATIM. Prepend task-specific instructions only.

### Model Selection & Escalation
- **opus**: code_review ONLY (SRB-1: independent model prevents self-review bias)
- **sonnet**: Analysis, reasoning, code generation, complex reviews
- **haiku**: Structured output, mechanical transforms, simple execution
- Escalation: haiku -> sonnet after 2 failed retries; 3rd+ retry always sonnet
- Extended Thinking phases: scope_definition, research, requirements, threat_modeling, impact_analysis, design_review, test_design

### Context Handoff Between Subagents (TOON-first)
- Files in `{docsDir}/` bridge subagent-to-subagent context
- **TOON優先**: 次subagentはまず `{docsDir}/{prevPhase}.toon` を読む（JSON比40-50%トークン削減）
- TOONが無い場合のフォールバック: MDの `## サマリー` (Delta Entry形式) を読む
- Delta Entry format: `- [ID][category] content` — structured, scannable, no prose loss
- Categories: decision, constraint, risk, finding, next, dependency, assumption
- TOON `next.readFiles` が次フェーズの読むべきファイルを明示
- Context techniques: differential reading (`git diff --stat`), index-first, negative space encoding (`NOT_RELEVANT: [...]`)

### Phase Completion Reporting
Always output after each phase:
```
[{phase} phase complete] Completed: {description}. Next: {next_phase}. Remaining: {count} phases.
```

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
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_back | Roll back | taskId, targetPhase, sessionToken |
| harness_reset | Reset to scope_definition | taskId, sessionToken |

### Scope & Feedback (2)
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_set_scope | Set files/dirs/glob | taskId, sessionToken, addMode |
| harness_record_feedback | Append feedback | taskId, feedback, sessionToken |

### Traceability (6)
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_add_ac | Add AC | taskId, id, description, sessionToken |
| harness_add_rtm | Add RTM | taskId, id, requirement, designRef, codeRef, testRef, sessionToken |
| harness_update_ac_status | Update AC status | taskId, id, status (open/met/not_met), sessionToken |
| harness_update_rtm_status | Update RTM status | taskId, id, status (pending/implemented/tested/verified), sessionToken |
| harness_record_proof | Record L1-L4 proof | taskId, level, check, result, evidence, sessionToken |
| harness_pre_validate | Dry-run DoD | taskId, sessionToken |

### Testing (5)
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_capture_baseline | Record baseline | taskId, totalTests, passedTests, failedTests[], sessionToken |
| harness_record_test | Register test file | taskId, testFile, sessionToken |
| harness_record_test_result | Record result (**subagent OK**) | taskId, exitCode, output (>= 50 chars), sessionToken |
| harness_get_test_info | Get tests + baseline | taskId |
| harness_record_known_bug | Record known bug | taskId, testName, description, severity, sessionToken |

### Query (2)
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_get_known_bugs | List bugs | taskId |
| harness_get_subphase_template | Get template | phase, taskId |

### Task Management (2)
| Tool | Purpose | Key Params |
|------|---------|-----------|
| harness_create_subtask | Decompose (DCP-1) | parentTaskId, subtaskName, taskSize, sessionToken |
| harness_link_tasks | Parent-child link | parentTaskId, childTaskId, sessionToken |

---

## 3. sessionToken Rules

### Layer 1 (Orchestrator direct calls)
Pass sessionToken to ALL MCP tools that accept it: harness_next, harness_approve, harness_complete_sub, harness_set_scope, harness_back, harness_reset, harness_record_proof, harness_add_ac, harness_add_rtm, harness_record_feedback, harness_capture_baseline, harness_record_test_result, harness_record_test, harness_record_known_bug, harness_pre_validate, harness_update_ac_status, harness_update_rtm_status.

### Layer 2 (subagent pass-through)
Only pass sessionToken to subagents that need `harness_record_test_result` (testing and regression_test phases). All other subagents must NOT receive sessionToken.

### Recovery
After context compaction or session restart: call `harness_status(taskId)` to re-obtain sessionToken. taskId-less calls do NOT return sessionToken.

---

## 4. Memory Curator Protocol (ACE)

After task completion (reaching `completed` phase), the Orchestrator runs a lightweight memory curation cycle.

### Trigger
Automatically after `harness_next` returns `completed` as the current phase.

### Curation Steps
1. **Scan**: Read `MEMORY.md` and list all linked topic files
2. **Staleness check**: Compare each memory entry against recent task learnings. Mark entries that contradict current codebase state
3. **Dedup**: If two entries cover the same topic, merge into the more specific one
4. **Prune**: Remove entries that reference deleted files, renamed functions, or obsolete patterns
5. **Record**: Add 1-3 new entries from the completed task ONLY if they represent stable patterns (not session-specific context)

### Rules
- Never add session-specific context (current task details, in-progress work)
- Never exceed 200 lines in MEMORY.md
- Never duplicate information already in CLAUDE.md or skill files
- Prefer updating existing entries over adding new ones
- Delete entries that turned out to be wrong during this task

### What to curate
- Error patterns and their fixes (from Reflector log: `.claude/state/reflector-log.json`)
- Architecture decisions confirmed by successful implementation
- User preferences observed across multiple tasks
- File path conventions and project structure changes

### What NOT to curate
- Task-specific workarounds that won't recur
- Speculative conclusions from a single observation
- Information the Reflector already handles (per-phase error patterns)
