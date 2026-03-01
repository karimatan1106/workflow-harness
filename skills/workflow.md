---
name: harness
description: Intent-driven 30-phase workflow harness. Start here for all code change tasks.
user-invocable: true
---

# Workflow Harness — Entry Point

30-phase, 8-stage development lifecycle. Every code change flows through this
pipeline. Phases cannot be skipped. Gates use ONLY deterministic L1-L4 checks.
**LLM judgment (L5) is forbidden in gates** (PSC-5: improvability requires verifiability).

**Design philosophy**: Phases = context compression devices. Each phase produces
an artifact that is the complete handoff for the next phase. Subagents read only
the previous summary, never the full codebase. This enables correct modifications
even in 10M+ line codebases.

**Skill files** (loaded on `/harness` invocation):
- `workflow-phases.md` — Phase table, all 30 phase work descriptions, task sizing
- `workflow-orchestrator.md` — Orchestrator protocol, MCP tools, model selection
- `workflow-gates.md` — Control levels L1-L4, intent accuracy IA-1~7, user intent UI-1~7, traceability
- `workflow-rules.md` — AI directives (23 rules), prohibited actions, retry, completion language, artifact quality
- `workflow-subagent.md` — Subagent templates, bash categories, phase-edit mapping
- `workflow-operations.md` — Test output placement, MCP cache, package install rules
- `workflow-project-structure.md` — Enterprise project structure (frontend/backend)
- `workflow-api-standards.md` — OpenAPI/Hono API design standards
- `workflow-docs-structure.md` — Document directory structure, naming conventions
- `workflow-docs-phases.md` — Per-phase document creation guide with CDD+TDD

---

## 1. Commands

| Command | Action |
|---------|--------|
| `/harness start <name>` | Start task (UI-1 check; 3-axis intent analysis; AskUserQuestion if unclear) |
| `/harness status` | Show current task state |
| `/harness next` | Run DoD checks and advance |
| `/harness approve <type>` | Approve gate (requirements/design/test_design/code_review/acceptance) |
| `/harness list` | List all active tasks |
| `/harness reset [reason]` | Reset to scope_definition |
| `/harness back <phase>` | Roll back to earlier phase |
| `/harness complete-sub <sub>` | Complete sub-phase in parallel group |
| `/harness switch <task-id>` | Switch active task |

---

## 2. Command Routing

**`/harness start <name>`**
1. Pre-start checks: active tasks <= 5, git status clean, branch fresh vs origin
2. Validate userIntent >= 20 characters (UI-1: block if too short)
3. Analyze userIntent on 3 axes: purpose (why), success criteria (definition of done), impact scope (which files/modules); if all 3 axes are clear, skip to step 6
4. Invoke AskUserQuestion for unclear axes (max 3 questions, 2-4 options each):
   - Purpose unclear → ask: "What is the goal of this task? (why are you doing it?)"
   - Success criteria unclear → ask: "How will you know this task is complete? (what should work?)"
   - Impact scope unclear → ask: "Which files, modules, or features will be affected?"
5. Integrate answers into userIntent (append responses to original intent string)
6. Call `harness_start(taskName, enriched userIntent)`
7. Call `harness_set_scope` if files/dirs are known
8. Report: taskId, phase, size, docsDir, sessionToken

**`/harness next`**
1. Call `harness_next(taskId, sessionToken)`
2. On DoD failure: re-launch subagent with retry prompt (never edit directly)
3. On approval required: report required type to user
4. On success: report next phase, remaining count, phaseGuide

**`/harness approve <type>`**
1. Present artifacts to user for review FIRST
2. Call `harness_approve(taskId, type, sessionToken)`
3. Report: approved type, previous phase, next phase

**`/harness complete-sub <sub>`**
1. Call `harness_complete_sub(taskId, subPhase, sessionToken)`
2. Report remaining sub-phases in group
3. When all complete, call `harness_next` to advance

**Other commands** (`status`, `list`, `reset`, `back`, `switch`):
Use corresponding `harness_*` MCP tool with taskId and sessionToken.

---

## 3. Workflow Usage Decision

| User Request | Action |
|-------------|--------|
| Code/file changes ("~して", "add X", "fix Y") | Start workflow: `/harness start` |
| Questions, reviews, analysis ("~か？", "is X correct?") | Answer directly, no workflow |

If the user asks a question (ending with "?"), it is usually review/analysis -- no workflow needed.
If the user gives a directive ("do X", "fix X", "add X"), start the workflow.
