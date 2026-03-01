# Workflow Harness - Project Instructions

This file is the authoritative harness-level instruction set. All AI agents operating within this project MUST follow these rules. Violations are blocked by hooks.

---

## 1. Design Philosophy

**Purpose**: Enable correct modifications in codebases of any scale (up to 10M+ lines) by compressing context at every phase boundary.

- **Phases = context compression devices.** Each phase produces an artifact that serves as the complete handoff context for the next phase. A subagent only reads the previous phase's summary, never the full codebase.
- **scope_definition + impact_analysis** narrow 10M lines to the N lines that actually matter.
- **AC-N chains** (acceptance criteria) anchor user intent from requirements through acceptance_verification.
- **RTM F-NNN chains** (requirements traceability matrix) track each requirement from planning through code_review to verified.
- **L1-L4 deterministic gates** enforce Definition of Done at every phase boundary. **L5 (LLM judgment) is BANNED** in gates because: (1) non-deterministic checks produce inconsistent pass/fail results across runs, and (2) a system's ability to improve is proportional to how easily its output can be verified (PSC-5). L5 is unverifiable, therefore unimprovable, therefore forbidden in gates.
- **200-line file limit (CORE PRINCIPLE)**: Every source file in this harness MUST be ≤200 lines. This is fundamental to the 10M+ line codebase strategy: when any file can be fully understood in a single context read, agents never need to hold more than a few files in mind simultaneously. Files approaching 200 lines must be split into focused modules before adding more content. This applies to TypeScript source files, JavaScript hooks, and configuration files.

---

## 2. Phase Overview (30 Phases + completed)

All tasks traverse phases in strict order. Smaller tasks skip certain phases (see Task Sizing).

| # | Phase | Stage | Model | Parallel Group | Approval Gate | Bash Categories | New |
|---|-------|-------|-------|---------------|---------------|-----------------|-----|
| 1 | scope_definition | 1 Discovery | sonnet | - | - | readonly | YES |
| 2 | research | 1 Discovery | sonnet | - | - | readonly | |
| 3 | impact_analysis | 1 Discovery | sonnet | - | - | readonly | YES |
| 4 | requirements | 2 Requirements | sonnet | - | requirements | readonly | |
| 5 | threat_modeling | 3 Analysis | sonnet | parallel_analysis | - | readonly | |
| 6 | planning | 3 Analysis | sonnet | parallel_analysis | - | readonly | |
| 7 | state_machine | 4 Design | haiku | parallel_design | - | readonly | |
| 8 | flowchart | 4 Design | haiku | parallel_design | - | readonly | |
| 9 | ui_design | 4 Design | sonnet | parallel_design | - | readonly | |
| 10 | design_review | 5 Review | sonnet | - | design | readonly | |
| 11 | test_design | 6 Test Planning | sonnet | - | test_design | readonly | |
| 12 | test_selection | 6 Test Planning | haiku | - | - | readonly | YES |
| 13 | test_impl | 7 TDD | sonnet | - | - | readonly, testing | |
| 14 | implementation | 7 TDD | sonnet | - | - | readonly, testing, impl | |
| 15 | refactoring | 7 TDD | haiku | - | - | readonly, testing, impl | |
| 16 | build_check | 8 Quality | haiku | parallel_quality | - | readonly, testing, impl | |
| 17 | code_review | 8 Quality | sonnet | parallel_quality | code_review | readonly | |
| 18 | testing | 9 Testing | haiku | - | - | readonly, testing | |
| 19 | regression_test | 9 Testing | haiku | - | - | readonly, testing | |
| 20 | acceptance_verification | 10 Acceptance | sonnet | - | acceptance | readonly | YES |
| 21 | manual_test | 11 Verification | sonnet | parallel_verification | - | readonly, testing | |
| 22 | security_scan | 11 Verification | sonnet | parallel_verification | - | readonly, testing | |
| 23 | performance_test | 11 Verification | sonnet | parallel_verification | - | readonly, testing | |
| 24 | e2e_test | 11 Verification | sonnet | parallel_verification | - | readonly, testing | |
| 25 | docs_update | 12 Docs | haiku | - | - | readonly | |
| 26 | commit | 13 Release | haiku | - | - | readonly, git | |
| 27 | push | 13 Release | haiku | - | - | readonly, git | |
| 28 | ci_verification | 13 Release | haiku | - | - | readonly | |
| 29 | deploy | 14 Deploy | haiku | - | - | readonly | |
| 30 | health_observation | 14 Deploy | sonnet | - | - | readonly | YES |
| - | completed | terminal | - | - | - | - | |

**Parallel group dependencies**: planning depends on threat_modeling within parallel_analysis.

---

## 3. Task Sizing

Risk score is computed from file count, test coverage, config/infra/security/database flags, and estimated code lines.

| Size | Risk Score | Active Phases | Use Case |
|------|-----------|--------------|----------|
| small | 0-3 | ~12 | Single-file fix, config change, typo |
| medium | 4-7 | ~22 | Multi-file feature, bug fix |
| large | 8+ | 30 (all) | Architecture change, security fix, new subsystem |

Default is large. The MCP server auto-classifies at `harness_start` time.

---

## 4. Control Levels (L1-L4)

Gates use ONLY deterministic checks. **L5 (LLM judgment) is BANNED** because non-deterministic evaluation produces unreliable gate results.

| Level | Check Type | Certainty | Example |
|-------|-----------|-----------|---------|
| L1 | File existence | 100% | Output artifact exists at expected path |
| L2 | Exit code | 100% | Build/test command returned exit code 0 |
| L3 | Numeric threshold | 100% | Content lines >= minLines, section density >= 30% |
| L4 | Regex/pattern match | 95%+ | Required sections present, no forbidden patterns, no duplicates |
| L5 | LLM judgment | 70-90% | **★完了ゲートに使用禁止★** |

**Why L5 is BANNED in DoD gates (PSC-5: Verification Ease = Improvement Ability)**:
L5 is difficult to verify → cannot improve it → unimprovable gates are forbidden.
"Does this look correct?" answered by an LLM is not proof. Only deterministic checks are proof.

---

## 5. Forbidden Actions

These are enforced by hooks and will be blocked:

- Skip phases without `harness_next` advancement
- Edit code files during research/design phases (only `.md`/`.mmd` allowed)
- Implement before writing tests (TDD: Red before Green)
- Run disallowed Bash commands for the current phase category
- Edit files with wrong extensions for the current phase
- Orchestrator directly editing artifacts on validation failure (must re-launch subagent)
- Same file edited 5+ times in 5 minutes

**12 Forbidden Words** (detected by `includes()` outside code fences):
- English (4): `TODO`, `TBD`, `WIP`, `FIXME`
- Japanese (8): `未定`, `未確定`, `要検討`, `検討中`, `対応予定`, `サンプル`, `ダミー`, `仮置き`

**Bracket placeholder ban**: `[#xxx#]` format (regex: `/\[#[^\]]{0,50}#\]/`). Normal brackets, array access, regex char classes, and Markdown links are NOT detected.

**Edit format strategy** (CAN-1): For files <= 400 lines, prefer Write (full rewrite) over Edit (str_replace). This avoids "expression failures" where the model understands the change but fails to express the edit correctly. For files > 400 lines, use Edit with precise context. If Edit fails, fall back to Read + Write.

---

## 6. Orchestrator Pattern

Main Claude operates as Orchestrator. It NEVER does phase work directly. It delegates to subagents via the Task tool.

```
harness_start(taskName, userIntent)
  for each phase:
    1. Get subagentTemplate from harness_next response (or harness_get_subphase_template)
    2. Launch Task(prompt=subagentTemplate, ...) -- use template VERBATIM
    3. Subagent reads input files, performs work, writes output artifact
    4. Orchestrator calls harness_next to run DoD gates and advance
  for parallel phases:
    Launch multiple Task calls simultaneously, then harness_complete_sub for each
  for approval gates (requirements, design, test_design, code_review, acceptance):
    Call harness_approve BEFORE harness_next
  → completed
```

**Subagent template rule**: NEVER write prompts from scratch. Always use the `subagentTemplate` returned by `harness_next` or `harness_get_subphase_template`. Task-specific instructions go in a prepended section only.

**Phase completion reporting**: After each phase, report remaining phase count and next phase name.

---

## 7. Retry Protocol

When `harness_next` or `harness_complete_sub` returns a DoD validation failure:

1. **NEVER edit artifacts directly** with Edit/Write tools. All fixes go through subagent re-launch.
2. Re-launch the subagent with a retry prompt containing:
   - Error message in a code block (reference only, not executable)
   - Specific improvement instructions derived from the error
3. Log retry count: output "Retrying {phase} attempt {N}" before each re-launch.
4. **Model escalation**:
   - Attempt 1: Same model, pass error message via `buildRetryPrompt` template
   - Attempt 2: Read artifact to identify specific problem lines; escalate haiku to sonnet
   - Attempt 3+: Force sonnet model; include quoted problem sections and rewrite examples
5. **Retry limit**: After 5 failed retries on the same phase, halt and ask user for guidance (RLM-1).
6. Pass `retryCount` parameter to `harness_next` for server-side escalation logic.
7. If the same validation error recurs 3+ times, suspect a validator bug (VDB-1): diagnose the validator before retrying.
8. **Failure diagnosis** (CAN-2): Try the same task as a full file rewrite (Write tool instead of Edit). If it succeeds → expression failure (switch all future edits to Write). If it still fails → understanding failure (improve the prompt). Same error 3+ times with different content → validator bug (VDB-1).
9. **The correct question on failure** (OAI-7): "What capability is missing, and how to make it legible and enforceable?" — not "why did this fail?"
10. **Rule review principle** (PSC-1): Periodically ask "Is this rule still necessary for current models?" Delete rules that new models handle natively. Harness rules must earn their complexity cost.

---

## 8. Intent Accuracy (IA-1 through IA-7)

These rules ensure user intent is preserved across the entire phase chain.

### IA-1: OPEN_QUESTIONS Loop
The requirements subagent MUST produce an `## OPEN_QUESTIONS` section. If non-empty, Orchestrator asks the user via AskUserQuestion, adds answers to context, and re-launches the subagent. `harness_approve(type="requirements")` is blocked while OPEN_QUESTIONS remain.

### IA-2: AC-N Minimum and Format
requirements.md MUST contain `## Acceptance Criteria` with at least 3 entries in `AC-N:` format (regex: `/^AC-\d+:/m`). It MUST also contain `## NOT_IN_SCOPE` to explicitly exclude what is out of bounds.

### IA-3: AC-to-Design Mapping
design_review artifact MUST map every AC-N to a design element. Unmapped ACs block `harness_approve(type="design")`.

### IA-4: AC-to-TC Traceability
test-design.md MUST map every AC-N to test cases. Naming: TC-{AC#}-{seq} (e.g., TC-AC1-01). Unmapped ACs block `harness_approve(type="test_design")`.

### IA-5: AC Achievement Table
code-review.md MUST include `## AC Achievement Status` with pass/fail per AC. Any fail blocks `harness_approve(type="code_review")`.

### IA-6: acceptance_verification Phase
Final intent gate before commit. Reviews all ACs and RTM entries. Produces acceptance-report.md. Gate: `harness_approve(type="acceptance")`.

### IA-7: impact_analysis Position
impact_analysis follows research (not inside parallel_analysis). Research findings inform impact scope.

---

## 9. Session Recovery (ANT-3)

After context compaction, session restart, or conversation interruption, follow these 5 steps:

1. **Recover task state**: Call `harness_status` without taskId to list tasks, then with specific taskId to get full state + sessionToken
2. **Check progress log**: Read `{docsDir}/claude-progress.txt` or `orchestrator-checkpoint.json` for completed phases
3. **Check scope**: Read `{docsDir}/features.json` or `{docsDir}/scope.md` for next implementation target
4. **Check recent changes**: Run `git log --oneline -20` to see recent commits
5. **Verify environment**: If `{docsDir}/init.sh` exists, run it to confirm environment

**Critical**: taskId is MANDATORY when calling `harness_status` for sessionToken recovery.

---

## 10. sessionToken Rules

sessionToken authenticates MCP tool calls and prevents unauthorized state mutations.

**Layer 1 (Orchestrator direct calls)**: Pass sessionToken to ALL MCP tools that accept it:
`harness_next`, `harness_approve`, `harness_complete_sub`, `harness_set_scope`, `harness_back`, `harness_reset`, `harness_record_proof`, `harness_add_ac`, `harness_add_rtm`, `harness_record_feedback`, `harness_capture_baseline`, `harness_record_test_result`, `harness_record_test`, `harness_record_known_bug`, `harness_pre_validate`, `harness_update_ac_status`, `harness_update_rtm_status`

**Layer 2 (subagent pass-through)**: Only pass sessionToken to subagents that need `harness_record_test_result` (testing and regression_test phases). All other subagents must NOT receive sessionToken.

---

## 11. Complete MCP Tool Reference

### Core Lifecycle (6 tools)

| Tool | Purpose | Required Params | Auth |
|------|---------|----------------|------|
| `harness_start` | Create new task, returns taskId and sessionToken | taskName, userIntent (min 20 chars) | - |
| `harness_status` | Get task state; omit taskId for all-tasks list | (taskId) | - |
| `harness_next` | Run DoD checks and advance to next phase | taskId, sessionToken | session |
| `harness_approve` | Approve at gate phase | taskId, type, sessionToken | session |
| `harness_complete_sub` | Mark parallel sub-phase complete | taskId, subPhase, sessionToken | session |
| `harness_list` | List all active tasks | - | - |

### Navigation (2 tools)

| Tool | Purpose | Required Params | Auth |
|------|---------|----------------|------|
| `harness_back` | Roll back to an earlier phase | taskId, targetPhase, sessionToken | session |
| `harness_reset` | Reset task to scope_definition | taskId, sessionToken | session |

### Scope & Feedback (2 tools)

| Tool | Purpose | Required Params | Auth |
|------|---------|----------------|------|
| `harness_set_scope` | Set/update affected files, dirs, glob | taskId, sessionToken, (files/dirs/glob) | session |
| `harness_record_feedback` | Append user feedback to userIntent | taskId, feedback, sessionToken | session |

### Traceability (4+2 tools)

| Tool | Purpose | Required Params | Auth |
|------|---------|----------------|------|
| `harness_add_ac` | Add acceptance criterion (AC-N) | taskId, id, description, sessionToken | session |
| `harness_add_rtm` | Add RTM entry (F-NNN) | taskId, id, requirement, sessionToken | session |
| `harness_update_ac_status` | Update AC status (open/met/not_met) | taskId, id, status, sessionToken | session |
| `harness_update_rtm_status` | Update RTM status (pending/implemented/tested/verified) | taskId, id, status, sessionToken | session |
| `harness_record_proof` | Record L1-L4 proof entry | taskId, level, check, result, evidence, sessionToken | session |
| `harness_pre_validate` | Dry-run DoD checks without advancing | taskId, sessionToken | session |

### Testing (5 tools)

| Tool | Purpose | Required Params | Auth |
|------|---------|----------------|------|
| `harness_capture_baseline` | Record pre-change test baseline | taskId, totalTests, passedTests, failedTests, sessionToken | session |
| `harness_record_test_result` | Record test execution result | taskId, exitCode, output (min 50 chars), sessionToken | session |
| `harness_record_test` | Register test file path | taskId, testFile, sessionToken | session |
| `harness_get_test_info` | Get test files and baseline | taskId | - |
| `harness_record_known_bug` | Record known bug (not caused by current change) | taskId, testName, description, severity, sessionToken | session |

### Query (2 tools)

| Tool | Purpose | Required Params | Auth |
|------|---------|----------------|------|
| `harness_get_known_bugs` | List recorded known bugs | taskId | - |
| `harness_get_subphase_template` | Get subagent prompt template for a phase | phase, (taskId) | - |

**Note**: `harness_update_ac_status` and `harness_update_rtm_status` update traceability status directly on the task state. Both are fully implemented in handler.ts and backed by StateManager methods.

---

## 12. Traceability

### Acceptance Criteria (AC-N)

- **Defined in**: requirements phase via `harness_add_ac`
- **Format**: AC-1, AC-2, AC-3, ... (minimum 3 per task)
- **Fields**: id, description, testCaseId, status (open -> met / not_met)
- **Verified in**: acceptance_verification phase
- **Gate rule**: All ACs must have status `met` before task completion

### RTM Entries (F-NNN)

- **Defined in**: planning phase via `harness_add_rtm`
- **Format**: F-001, F-002, ...
- **Fields**: id, requirement, designRef (spec.md section), codeRef (source file), testRef (test file)
- **Status progression**: pending -> implemented -> tested -> verified
- **Verified at**: code_review (all must be `implemented`+), acceptance_verification (all must be `verified`)
- **Gate rule**: Any F-NNN stuck at `pending` at code_review blocks advancement

### Chain Integrity

The AC-N and F-NNN chains together ensure that user intent flows from requirements through design, implementation, testing, and verification without loss or distortion.

---

## 13. Artifact Quality Requirements

All phase artifacts with an outputFile are validated by L3 and L4 DoD checks.

### Line Count and Density (L3)
- Total content lines must meet the phase's `minLines` threshold
- Section density (content lines / total lines) must be >= 30%
- Each section (## heading) must contain >= 5 substantive lines
- Substantive lines exclude: empty lines, horizontal rules, code fence boundaries, headings

### Forbidden Patterns (L4)
- 12 words detected by `includes()` outside code fences (see Section 5)
- Bracket placeholder `[#xxx#]` format
- Compound words containing forbidden words are also detected
- Use indirect references: "the pattern detected by the validator" instead of quoting the forbidden word

### Duplicate Lines (L4)
- 3+ identical non-structural lines trigger an error
- Structural lines excluded: headings, horizontal rules, code fences, table rows, bold labels, short label lines
- Fix: add context-specific information to each line to make it unique

### Required Sections (L4)
- Each phase defines required Markdown heading sections
- code_review requires: `## 設計-実装整合性`, `## ユーザー意図との整合性`
- manual_test requires: `## テストシナリオ`, `## テスト結果`
- security_scan requires: `## 脆弱性スキャン結果`, `## 検出された問題`
- performance_test requires: `## パフォーマンス計測結果`, `## ボトルネック分析`
- e2e_test requires: `## E2Eテストシナリオ`, `## テスト実行結果`
- All artifact phases require: `## サマリー` (Delta Entry format: `- [ID][category] content`)

---

## 14. Bash Command Categories

| Category | Allowed Commands |
|----------|-----------------|
| readonly | ls, pwd, cat, head, tail, grep, find, wc, git status, git log, git diff, git show, npm list, node --version, npm --version |
| testing | npm test, npm run test, npx vitest, npx jest, npx playwright test, pytest |
| implementation | npm install, pnpm add, npm run build, mkdir, rm, git add, git commit |
| git | git add, git commit, git push, git tag |

Commands outside the allowed categories for the current phase are blocked by phase-edit-guard hooks.
When a command is blocked, use dedicated tools instead: Read, Write, Edit, Glob, Grep.

**Redirect operator caution**: The pattern `> ` (preceded by non-`=` character) is detected as a redirect and blocked. Use `>= 1` instead of `> 0`, `!== 0` instead of `> 0` in `node -e` commands. Arrow functions `=>` are safe because `=` precedes the `>`.

---

## 15. Phase-to-Bash-Category Mapping

| Phases | Allowed Categories |
|--------|-------------------|
| scope_definition, research, impact_analysis | readonly |
| requirements | readonly |
| threat_modeling, planning | readonly |
| state_machine, flowchart, ui_design | readonly |
| design_review, test_design, test_selection | readonly |
| test_impl | readonly, testing |
| implementation, refactoring | readonly, testing, implementation |
| build_check | readonly, testing, implementation |
| code_review | readonly |
| testing, regression_test | readonly, testing |
| acceptance_verification | readonly |
| manual_test, security_scan, performance_test, e2e_test | readonly, testing |
| docs_update | readonly |
| commit, push | readonly, git |
| ci_verification, deploy, health_observation | readonly |

**Note**: The commit phase does NOT include the implementation category. File deletions (rm) must be completed in implementation or refactoring. If deletion is needed after those phases, use `harness_back` to return to implementation first.

---

## 16. Workflow Usage Decision

| User Request Type | Action |
|------------------|--------|
| Code/file changes ("add X", "fix Y", "refactor Z") | Start workflow with `harness_start` |
| Questions, reviews, analysis ("is X correct?", "what is Y?") | Answer directly, no workflow |

If the user asks a question (ending with "?"), it is usually review/analysis -- no workflow needed.
If the user gives a directive ("do X", "fix X", "add X"), start the workflow.

---

## 17. Completion Declaration Rules

- "Task complete" / "finished" / "try running it" are ONLY allowed after reaching `completed` phase
- During implementation: say "implementation phase complete, next: refactoring"
- During testing: say "tests passed", not "done"
- Always report: `[Phase] complete. Next: [next_phase]. Remaining: [N] phases.`
