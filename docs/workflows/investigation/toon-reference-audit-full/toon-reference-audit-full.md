# Complete .toon Reference Audit - workflow-harness codebase

Date: 2026-03-23
Scope: ALL files under workflow-harness/ (src, hooks, .claude, docs, config, tests)
Total unique .toon references found: ~112 across 40+ files

---

## 1. INTERNAL_STATE (Keep - 32 refs)

State management files in .claude/state/:
- state/manager-read.ts:18,36,72 - workflow-state.toon
- state/manager-write.ts:38,52 - workflow-state.toon, task-index.toon
- state/manager-lifecycle.ts:16 - DEFAULT_ALLOWED_EXTENSIONS
- state/progress-json.ts:29 - claude-progress.toon
- utils/hmac.ts:20 - hmac-keys.toon
- tools/reflector.ts:5,17 - reflector-log.toon
- tools/metrics.ts:13 - metrics.toon
- tools/ace-context.ts:4,16,90 - ace-context.toon
- tools/adr.ts:13 - adr-store.toon
- tools/archgate.ts:15 - archgate-rules.toon
- tools/curator-helpers.ts:11 - curator-log.toon
- tools/gc.ts:40 - baseName.toon
- tools/metrics-toon.ts:2,3,15,19 - phase-metrics.toon
- tools/handlers/dci.ts:15 - design-code-index.toon
- tools/error-toon.ts:26,65 - phase-errors.toon
- tools/analytics-toon.ts:98 - phase-analytics.toon
- hooks/context-watchdog.js:35,69,77,141 - checkpoint.toon
- hooks/session-boundary.js:39 - HANDOFF.toon

## 2. GATE_LOGIC (Keep - 7 refs)

- gates/dod-l3.ts:35 - endsWith .toon dispatch
- gates/dod-l3.ts:48 - fix message
- gates/dod-l4-content.ts:64 - extname .toon dispatch
- gates/dod-l4-content.ts:84 - fix messages
- gates/dod-l4-delta.ts:67,75 - decode path + fix

## 3. LIBRARY_IMPORT (Keep - 3 refs)

- phases/definitions.ts:20,21 - import toon-skeletons-a/b
- phases/toon-skeletons-a.ts:154 - :toon hearing v1

## 4. COMMENT_DOC (Keep - 14 refs)

- state/progress-json.ts:3
- state/state-toon-io.ts:3
- state/state-toon-parse.ts:2
- tools/ace-context-toon.ts:2
- tools/adr-toon-io.ts:2
- tools/archgate-toon-io.ts:2
- tools/curator-toon.ts:2
- tools/metrics-toon-io.ts:2
- tools/handlers/dci.ts:3
- tools/handlers/lifecycle.ts:191,204
- gates/dod-l3.ts:13
- gates/dod-l4-content.ts:63
- gates/dod-l4-delta.ts:67

## 5. TEST_FIXTURE (Keep 20, Evaluate 2)

Keep (all internal state paths):
- ace-reflector-curator.test.ts:31,32,111
- ace-reflector.test.ts:38
- gc.test.ts:61,77,93,108
- hmac.test.ts:30,35,44,46,56
- manager-core.test.ts:57,145
- manager-lifecycle.test.ts:129
- metrics.test.ts:33
- progress-json.test.ts:3,60
- reflector-failure-loop.test.ts:32
- reflector-quality.test.ts:29
- stale-task-hmac.test.ts:43,47

Evaluate (use .toon as phase artifact path):
- n63-n72.test.ts:16 - spec.toon in test input
- rtm-intent-gate.test.ts:182-202 - .toon in OPEN_QUESTIONS assertions

## 6. HOOK_POLICY - correct (Keep - 4 refs)

- pre-tool-guard.sh:52,55
- test-guard.sh:212
- setup.sh:150

---

## BUGS FOUND

### BUG-1 (CRITICAL): hooks/tool-gate.js lines 97-123

27 phase-to-extension mappings use .toon for phase artifact output.
Per core-constraints.md, phase artifacts should be .md.

Affected phases (change .toon to .md):
- scope_definition (line 97)
- research (line 98)
- impact_analysis (line 99)
- requirements (line 100)
- threat_modeling (line 101)
- planning (line 102)
- design_review (line 103)
- test_design (line 104)
- test_selection (line 105)
- code_review (line 106)
- manual_test (line 107)
- acceptance_verification (line 108)
- docs_update (line 109)
- ci_verification (line 110)
- deploy (line 111)
- health_observation (line 112)
- security_scan (line 113)
- performance_test (line 114)
- state_machine (line 115, keep .mmd)
- flowchart (line 116, keep .mmd)
- ui_design (line 117, keep .mmd)
- testing (line 118, keep .ts/.tsx/.js)
- regression_test (line 119, keep .ts/.tsx/.js)
- test_impl (line 120, keep .test.ts etc)
- implementation (line 121, keep code exts)
- refactoring (line 122, keep code exts)
- e2e_test (line 123, keep .test.ts/.spec.ts)

### BUG-2: hooks/context-watchdog.js line 94

Regex /scope_definition\.toon|test_design\.toon|test_selection\.toon/
will never match once artifacts are .md. Must update to .md.

### BUG-3: .claude/agents/coordinator.md line 20

Says structured data (AC, RTM, scope) should be .toon.
These are phase deliverables and should be .md.

### BUG-4: .claude/agents/worker.md line 49

Says structured data should be .toon. Same issue as BUG-3.

### BUG-5 (minor): .claude/skills/.../workflow-orchestrator.md line 77

Ambiguous: says internal state but lists AC/RTM/scope.

---

## Correctly .toon (internal state, no action needed)

workflow-state.toon, task-index.toon, claude-progress.toon,
hmac-keys.toon, reflector-log.toon, metrics.toon,
ace-context.toon, adr-store.toon, archgate-rules.toon,
curator-log.toon, design-code-index.toon, checkpoint.toon,
HANDOFF.toon, phase-errors.toon, phase-analytics.toon, phase-metrics.toon
