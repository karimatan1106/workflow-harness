# File Structure Analysis Report

Date: 2026-03-25
Purpose: READ-ONLY structural analysis of 6 core harness files

---

## 1. workflow-harness/hooks/pre-tool-guard.sh

- Lines: 107
- Role: 2-Layer Tool Access Guard (Orchestrator vs Subagent)
- Key sections:
  - L17-23: Emergency bypass (TOOL_GUARD_DISABLE env)
  - L26-30: stdin JSON parsing (tool_name, agent_id extraction without jq)
  - L35-37: Subagent bypass (any agent_id = full access)
  - L44-50: `is_lifecycle_mcp()` - MCP tool whitelist (blocks harness_get_subphase_template)
  - L53-58: Orchestrator .toon/.mmd write allowance
  - L61-72: Agent subagent_type whitelist (coordinator|worker|hearing-worker only)
  - L75-79: Control-plane tool whitelist (Agent, Skill, ToolSearch, AskUserQuestion, TeamCreate, SendMessage, Task*, Read, Bash)
  - L82-98: Edit authorization check (reads .agent/edit-auth.txt)
  - L102-104: Lifecycle MCP fallthrough
  - L106-107: Default BLOCKED exit
- Exit codes: 0 (allow), 2 (block)

## 2. workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts

- Lines: 178 (within 200-line limit)
- Role: Phase advancement with DoD gate checks
- Key functions:
  - L26-120: `handleHarnessNext()` - Main handler
    - L31-35: taskId/session validation
    - L37-47: Retry count management (max 5 attempts, VDB-1 warning at 3+)
    - L48-60: Approval gate enforcement
    - L61-82: Output file existence + size pre-check (min 100 bytes)
    - L83-86: DoD check execution and failure response
    - L92-119: Phase advancement, next phase guide, parallel group info, completion handling
  - L122-165: `buildDoDFailureResponse()` - Constructs retry prompt with VDB-1 warning
  - L167-178: `addNextPhaseOutputFile()` - Resolves next phase output path
- Key imports: dod.ts (runDoDChecks), retry.ts, reflector.ts, metrics.ts, error-toon.ts, lifecycle-completion.ts

## 3. workflow-harness/mcp-server/src/tools/handlers/lifecycle-start-status.ts

- Lines: 138 (within 200-line limit)
- Role: Task creation (harness_start) and status reporting (harness_status)
- Key functions:
  - L23-77: `handleHarnessStart()`
    - L18-21: AMBIGUOUS_PATTERNS (Japanese ambiguity detection)
    - L30-35: userIntent minimum 20 chars
    - L36-43: Ambiguous expression rejection
    - L46: Size always forced to 'large'
    - L48-49: GC abandoned tasks
    - L50: Task creation via StateManager
    - L52-62: Git dirty working tree warning
  - L79-138: `handleHarnessStatus()`
    - L84-105: Single task status (with expectedOutputFile)
    - L106-136: Verbose mode (timings, analytics TOON)
    - L137: List all tasks mode

## 4. workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts

- Lines: 174 (within 200-line limit)
- Role: Spawn isolated coordinator subprocess (claude CLI)
- Key functions:
  - L25: DEFAULT_DISALLOWED_TOOLS constant (long comma-separated list)
  - L28-39: `findMcpConfig()` - Searches .mcp.json in cwd and projectRoot
  - L42-46: `allocateWorkerId()` - Sequential counter-based ID
  - L49-91: `buildFullInstruction()` - Combines instruction, files, planOnly mode, approvedPlan
  - L94-174: `handleDelegateCoordinator()` - Main handler
    - L98-103: taskId/session validation
    - L108-109: planOnly / approvedPlan extraction
    - L119-124: Allowed tools (strips Write/Edit in planOnly mode)
    - L126: System prompt built server-side (C-4 enforcement)
    - L131-139: CLI args construction
    - L144-149: Worker ID allocation, log/progress file setup
    - L151-158: Child environment (HARNESS_SESSION_TOKEN, HARNESS_TASK_ID, HARNESS_LAYER)
    - L160-173: Spawn execution with timing

## 5. workflow-harness/mcp-server/src/gates/dod-l1-l2.ts

- Lines: 166 (within 200-line limit)
- Role: L1 (file existence) and L2 (exit code / TDD / regression) checks
- Key functions:
  - L15-31: `checkL1FileExists()` - Verifies phase output file exists
  - L34-53: `checkInputFilesExist()` - IFV-1: Validates all required input files (respects skippedPhases)
  - L55-73: `checkL2ExitCode()` - Exit code validation (with dodExemptions config support, RC-1)
  - L76-96: `checkTDDRedEvidence()` - TDD-1: Ensures test_impl has at least one failing test recorded
  - L98-131: `checkTestResultsExist()` - Verifies test results for testing/regression_test phases
  - L133-166: `checkTestRegression()` - Compares baseline.failedTests vs latest testResult.failedTests
- Re-export: L13 re-exports `checkSpecPathsExist` from dod-spec.ts

## 6. workflow-harness/mcp-server/src/gates/dod.ts

- Lines: 82 (well within 200-line limit)
- Role: DoD orchestrator - delegates to L1-L4 check modules
- Key functions:
  - L28-70: `runDoDChecks()` - Runs all 27+ checks sequentially
    - L38-39: L1 checks (file exists, input files)
    - L40: L1 spec paths
    - L41: L2 exit code
    - L42: L3 quality
    - L43-44: L4 TOON safety, content validation
    - L45-48: L3 RTM/AC/invariant completeness
    - L49-52: L4 AC format, not-in-scope, open questions, intent consistency
    - L53-54: L3 baseline required, artifact freshness
    - L55: L4 delta entry format
    - L56-59: L4 IA checks (AC-design, AC-TC, achievement table, TC coverage)
    - L60-61: L4 artifact drift, package-lock sync
    - L62-64: L2 TDD red evidence, test results, test regression
    - L65: L2 hearing user response
    - L66: L4 dead references
    - L67: L4 DCI validation (array, multiple results)
  - L72-82: `formatDoDResult()` - Human-readable DoD output
- Imports from 10 sub-modules: dod-l1-l2, dod-l2-hearing, dod-l3, dod-l4-content, dod-l4-requirements, dod-l4-delta, dod-l4-ia, dod-l4-art, dod-l4-commit, dod-l4-refs, dod-l4-toon, dod-l4-dci

---

## Directory Checks

### workflow-harness/mcp-server/src/observability/
- Does NOT exist

### workflow-harness/hooks/*.sh files (3 files)
1. `hooks/pre-tool-guard.sh` (107 lines) - Tool access guard
2. `hooks/test-guard.sh` - Test execution guard
3. `hooks/__tests__/pre-tool-guard.test.sh` - Unit tests for pre-tool-guard

---

## Summary Statistics

| File | Lines | Functions | Within 200-line limit |
|------|------:|----------:|:---------------------:|
| pre-tool-guard.sh | 107 | 1 (is_lifecycle_mcp) | Yes |
| lifecycle-next.ts | 178 | 3 | Yes |
| lifecycle-start-status.ts | 138 | 2 | Yes |
| delegate-coordinator.ts | 174 | 4 | Yes |
| dod-l1-l2.ts | 166 | 6 | Yes |
| dod.ts | 82 | 2 | Yes |
| **Total** | **845** | **18** | All pass |
