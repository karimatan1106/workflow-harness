# 2-Layer Agent Model Consistency Check

Date: 2026-03-21
Files checked:
1. .claude/agents/coordinator.md
2. .claude/agents/worker.md
3. workflow-harness/.claude/skills/workflow-harness/workflow-orchestrator.md
4. workflow-harness/CLAUDE.md
5. workflow-harness/hooks/tool-gate.js

---

## Results (19 checks: A-S)

### A. coordinator.md tools matches orchestrator skill Coordinator row (line 20)
**PASS**
- coordinator.md L4: `tools: Read, Glob, Grep, Bash, Skill, ToolSearch`
- skill file L20: `Read、Glob、Grep、Bash、Skill、ToolSearch`
- Exact match (6 tools, same order).

### B. worker.md tools matches orchestrator skill Worker row (line 21)
**PASS**
- worker.md L4: `tools: Read, Write, Edit, Bash, Glob, Grep`
- skill file L21: `Read、Write、Edit、Bash、Glob、Grep`
- Exact match (6 tools, same order).

### C. No SendMessage in coordinator.md or worker.md tools fields
**PASS**
- coordinator.md L4: no SendMessage
- worker.md L4: no SendMessage

### D. CLAUDE.md Tool Delegation lists Agent(coordinator/worker/Explore/Plan)
**PASS**
- CLAUDE.md L11: `許可: lifecycle MCP, Agent(coordinator/worker/Explore/Plan), Skill, ToolSearch, AskUserQuestion。`

### E. orchestrator skill says "Two-Layer" not "Agent Teams"
**PASS**
- skill file L11: `### Two-Layer Execution Model (Agent Subagents)`
- No occurrence of "Agent Teams" in the file.

### F. tool-gate.js L1_ALLOWED does NOT contain TeamCreate/TeamDelete/SendMessage
**PASS**
- tool-gate.js L29: `const L1_ALLOWED = new Set(['Skill', 'AskUserQuestion', 'ToolSearch']);`
- None of TeamCreate, TeamDelete, SendMessage present.

### G. tool-gate.js error message says "Agent(coordinator/worker)"
**PASS**
- tool-gate.js L44: `'L1 (Orchestrator) cannot use "' + toolName + '". Delegate via Agent(coordinator/worker).'`

### H. tool-gate.js detectLayer: agent_id starting with "worker" returns 'worker'
**PASS**
- tool-gate.js L24: `if (agentId.startsWith('worker')) return 'worker';`
- L25: fallback returns 'coordinator' (any other agent_id).

### I. tool-gate.js checkL1: allows custom subagent_type, blocks general-purpose
**PASS**
- tool-gate.js L40: `if (st && st !== 'general-purpose') return null;` (allows any custom type)
- L41: `return 'L1 Agent() restricted. Use named subagent_type or team_name.';` (blocks general-purpose and empty)

### J. No stale "Agent Teams"/"TeamCreate" in orchestrator skill or CLAUDE.md
**PASS**
- orchestrator skill: no "Agent Teams", no "TeamCreate"
- CLAUDE.md: no "Agent Teams", no "TeamCreate"

### K. Context Handoff describes file-based relay
**PASS**
- skill file L60-68: section "Context Handoff (ファイルベース中継)" describes file-based relay
- coordinator.md L17-22: Context Handoff section with file output paths
- worker.md L16-22: Context Handoff section with file input/output paths
- CLAUDE.md L15: `subagent間の文脈はファイルベースで中継。L1はファイルパスと1行サマリのみ保持。`

### L. tool-gate.js L2_BLOCKED is empty
**PASS**
- tool-gate.js L48: `const L2_BLOCKED = new Set([]);`

### M. Coordinator has Skill in tools (coordinator.md and skill file)
**PASS**
- coordinator.md L4: `tools: Read, Glob, Grep, Bash, Skill, ToolSearch`
- skill file L20: `Bash、Skill、ToolSearch`

### N. Coordinator has Bash in tools (coordinator.md and skill file)
**PASS**
- coordinator.md L4: `tools: Read, Glob, Grep, Bash, Skill, ToolSearch`
- skill file L20: `Read、Glob、Grep、Bash、...`

### O. Worker does NOT have ToolSearch in tools (worker.md and skill file)
**PASS**
- worker.md L4: `tools: Read, Write, Edit, Bash, Glob, Grep` (no ToolSearch)
- skill file L21: `Read、Write、Edit、Bash、Glob、Grep` (no ToolSearch)

### P. tool-gate.js L3: SendMessage NOT in L3_ALWAYS_ALLOWED
**PASS**
- tool-gate.js L61: `const L3_ALWAYS_ALLOWED = new Set(['Read', 'Glob', 'Grep', 'ToolSearch']);`
- SendMessage is not present. (Note: ToolSearch is in L3_ALWAYS_ALLOWED but NOT in worker.md tools -- see Other Issues below.)

### Q. orchestrator skill Execution Flow: Agent(coordinator) then Agent(worker) x N
**PASS**
- skill file L28: `Agent(subagent_type="coordinator", prompt=template)` -> analysis
- skill file L32: `Agent(subagent_type="worker", prompt="...") x N (並列可)`
- Correct order: coordinator first, then worker(s).

### R. tool-gate.js checkL1 does NOT have team_name passthrough
**FAIL**
- tool-gate.js L41: `return 'L1 Agent() restricted. Use named subagent_type or team_name.';`
- The error MESSAGE still mentions "team_name" as a valid option, but there is no actual team_name passthrough logic in the code.
- The code itself correctly blocks general-purpose and allows custom subagent_type (L38-40). No team_name check exists.
- Severity: cosmetic. The error message is misleading but the gate logic is correct.

### S. CLAUDE.md Coordinator/Worker descriptions do NOT list specific tools (just role descriptions)
**PASS**
- CLAUDE.md L13: `Coordinator: 分析・タスク分解。結果はファイルに書き出し。` (role only)
- CLAUDE.md L14: `Worker: ファイル操作実行。` (role only)
- No tool lists in these descriptions.

---

## Summary

| Check | Result |
|-------|--------|
| A | PASS |
| B | PASS |
| C | PASS |
| D | PASS |
| E | PASS |
| F | PASS |
| G | PASS |
| H | PASS |
| I | PASS |
| J | PASS |
| K | PASS |
| L | PASS |
| M | PASS |
| N | PASS |
| O | PASS |
| P | PASS |
| Q | PASS |
| R | FAIL - error message mentions "team_name" (cosmetic, logic is correct) |
| S | PASS |

**18 PASS / 1 FAIL**

---

## Other Inconsistencies Found

### 1. ToolSearch in L3_ALWAYS_ALLOWED but NOT in worker.md tools
- tool-gate.js L61: `L3_ALWAYS_ALLOWED = new Set(['Read', 'Glob', 'Grep', 'ToolSearch'])`
- worker.md L4: `tools: Read, Write, Edit, Bash, Glob, Grep` (no ToolSearch)
- skill file L21: Worker row also has no ToolSearch
- Impact: The hook allows ToolSearch for workers, but the agent definition does not grant it. The agent definition is the effective constraint (Claude will not attempt to use a tool not in its tools list). The hook allowlist is overly permissive but harmless since the agent never gets the tool.
- Recommendation: Remove ToolSearch from L3_ALWAYS_ALLOWED for consistency, or add it to worker.md if workers should have it.

### 2. harness_delegate_coordinator in HARNESS_LIFECYCLE
- tool-gate.js L10: `'harness_delegate_coordinator'` is in HARNESS_LIFECYCLE set
- This tool is not listed in the orchestrator skill MCP Tool Reference (Section 2)
- Impact: Unknown. May be a leftover from a previous design or a tool not yet documented.
- Recommendation: Verify if this MCP tool still exists. If not, remove from HARNESS_LIFECYCLE.

### 3. Stale "team_name" in error message (same as check R)
- tool-gate.js L41: error message says "Use named subagent_type or team_name."
- "team_name" is an Agent Teams concept that no longer applies in the 2-layer model.
- Recommendation: Change to `'L1 Agent() restricted. Use named subagent_type (coordinator/worker/Explore/Plan).'`
