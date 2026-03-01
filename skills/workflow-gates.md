---
name: harness-gates
description: Control levels (L1-L4), intent accuracy chain (IA-1~7), user intent policy (UI-1~7), and traceability (AC-N, F-NNN).
---

# Workflow Harness — Gates & Traceability

## 1. Control Levels (L1-L4)

| Level | Type | Reliability | Example |
|-------|------|-------------|---------|
| L1 | File existence | 100% | `fs.existsSync(artifact)`, SHA-256 compare |
| L2 | Exit code | 100% | `npm run build` exit 0, `tsc --noEmit` exit 0 |
| L3 | Numeric threshold | 100% | lines >= 50, density >= 30%, AC count >= 3 |
| L4 | Regex/pattern | 95%+ | Required sections, forbidden words, F-NNN format |
| L5 | LLM judgment | 70-90% | **BANNED in gates.** Advisory only. |

**Why L5 is banned (PSC-5)**: Improvability = verifiability. L5 is non-deterministic, unverifiable, therefore unimprovable.

### DoD Gate Checks by Phase

**Common checks (every phase)**:
- Before start: L1 previous artifacts exist, L1 approved artifacts SHA-256 unchanged, L3 scope files <= 100
- Before end: L1 output artifact exists, L3 minLines met, L4 `## サマリー` present, L4 no forbidden patterns, L4 no `[#xxx#]`, L4 no 3+ duplicate lines, L3 section lines >= 5

| Phase | L1 | L2 | L3 | L4 |
|-------|----|----|----|----|
| scope_definition | file exists | - | files <= 100 | entry_points non-empty |
| research | file exists | - | minLines >= 30 | `## サマリー`, `## ユーザー意図の分析` |
| impact_analysis | file exists | - | minLines >= 20 | required fields present |
| requirements | file exists | - | AC >= 3, minLines >= 40 | OPEN_QUESTIONS empty, NOT_IN_SCOPE, 整合性確認 |
| threat_modeling | file exists | - | minLines >= 30 | required sections |
| planning | file exists | - | minLines >= 40 | F-NNN with spec |
| state_machine | file exists | - | minLines >= 15 | valid stateDiagram-v2 |
| flowchart | file exists | - | minLines >= 15 | valid flowchart |
| ui_design | file exists | - | minLines >= 30 | required sections |
| test_design | file exists | - | minLines >= 40 | AC-to-TC coverage |
| test_selection | file exists | - | minLines >= 15 | test lists present |
| test_impl | test files | tests executed | >= 1 FAILS | - |
| implementation | source files | tsc exit 0 | all tests GREEN | no out-of-scope edits |
| refactoring | - | tests pass, tsc exit 0 | - | /simplify executed (SMP-1) |
| build_check | - | build/tsc/eslint/madge exit 0 | - | - |
| code_review | file exists | - | minLines >= 30 | AC table zero failures, 設計-実装整合性, 意図整合性 |
| testing | - | all tests exit 0 | - | baseline captured |
| regression_test | - | tests executed | new failures = 0 | - |
| acceptance_verification | file exists | - | minLines >= 20 | all ACs met, RTM verified |
| verification phases | files exist | - | minLines >= 30 | required sections |
| health_observation | file exists | - | minLines >= 15 | metrics within thresholds |

---

## 2. Intent Accuracy Chain (IA-1 through IA-7)

### IA-1: OPEN_QUESTIONS Loop (requirements)
- requirements.md MUST include `## OPEN_QUESTIONS`
- If non-empty: Orchestrator asks user via AskUserQuestion, re-runs subagent
- `harness_approve(type="requirements")` blocked while questions remain

### IA-2: AC-N Format + NOT_IN_SCOPE (requirements)
- `## Acceptance Criteria` (or `## 受け入れ条件`) with >= 3 entries in `AC-N: description` format
- `## NOT_IN_SCOPE` (or `## スコープ外`) mandatory
- L3 check: regex `/^AC-\d+:/m` matches >= 3 times

### IA-3: AC-to-Design Mapping (design_review)
- Every AC-N maps to a design element. Required table:
```
| AC-N | Design Component | Spec Reference |
|------|-----------------|----------------|
| AC-1 | AuthService.login() | spec.md Section 3.1 |
```

### IA-4: AC-to-TC Traceability (test_design)
- Naming: `TC-{AC#}-{seq}` (e.g., TC-AC1-01). Every AC needs >= 1 TC.

### IA-5: AC Achievement Table (code_review)
- code-review.md MUST include `## AC Achievement Status`:
```
| AC-N | Status | Evidence |
|------|--------|----------|
| AC-1 | pass | src/auth.ts:42 |
```
- Any "fail" blocks `harness_approve(type="code_review")`

### IA-6: acceptance_verification Phase
- Final intent gate. Produces acceptance-report.md. Gate: `harness_approve(type="acceptance")`

### IA-7: impact_analysis Position
- AFTER research, BEFORE requirements (not inside parallel_analysis)

---

## 3. User Intent Policy (UI-1 through UI-7)

### UI-1: Minimum Intent Length (PF-3)
- userIntent < 20 chars -> block at `harness_start`
- Forces user to articulate clear intent

### UI-2: Ambiguous Expression Detection (PF-4)
- Detect vague expressions: とか, など, いい感じ, 適当に, よしなに
- Request rephrasing with specific examples

### UI-3: Non-Functional Requirements Detection
- Before `harness_approve("requirements")`: verify NFRs are quantitatively defined
- Pattern: "make an API" without performance requirements -> prompt user for thresholds

### UI-4: Post-Approval Scope Change Protocol
- Post-approval additions: record via `harness_record_feedback`
- After current phase completes: ask user to return to requirements or create new task

### UI-5: code_review Intent Alignment Checklist
- userIntent keywords reflected in implementation code
- NOT_IN_SCOPE items not implemented (no unauthorized additions)
- System achieves the purpose stated in userIntent

### UI-6: Feedback Structuring (Sprint 3)
- `harness_record_feedback` should structure as Q&A pairs

### UI-7: Purpose/Success Criteria Detection (PF-5)
- At `harness_start`: verb + noun present but no "why"/"to what degree" -> warning
- Example: "implement login" -> suggest adding purpose/success criteria

---

## 4. Traceability Chains

### AC-N (Acceptance Criteria)
- Defined: requirements via `harness_add_ac`
- Status: open -> met / not_met via `harness_update_ac_status`
- Gate: All ACs "met" before completion

### F-NNN (RTM Entries)
- Defined: planning via `harness_add_rtm(taskId, id, requirement, designRef, codeRef, testRef, sessionToken)`
- Status: pending -> implemented -> tested -> verified via `harness_update_rtm_status`
- Chain: Requirement -> Design -> Source -> Test

### RTM Verification Checkpoints
1. requirements -> planning: F-NNN count match
2. planning -> test_design: F-NNN count match
3. test_design -> test_impl: TC files exist for all TCs
4. implementation -> code_review: all F-NNN implemented
5. code_review -> acceptance: AC achievement complete

### Inter-Phase Consistency (C-20)
- Hash F-NNN definition text in requirements.md
- Hash F-NNN reference text in spec.md
- If hashes differ -> warn "content has diverged", require user approval

### Proof Recording
`harness_record_proof(taskId, level, check, result, evidence, sessionToken)` -- after each DoD check

### Pre-validation
`harness_pre_validate(taskId, sessionToken)` -- dry-run DoD before `harness_next`

### State Integrity
HMAC-SHA256 protects workflow-state.json. Only MCP StateManager can update.
