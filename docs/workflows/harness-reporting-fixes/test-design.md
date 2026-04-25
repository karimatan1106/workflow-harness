# Test Design: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: test_design
size: small

## testCases

### TC-AC1-01: checkTDDRedEvidence passes when scopeFiles are all .md/.mmd

- target: checkTDDRedEvidence doc-only exemption path with multiple extensions (.md, .mmd)
- precondition: state.scopeFiles = ['docs/planning.md', 'docs/diagram.mmd'], state.proofLog = [], phase = 'test_impl'
- action: call checkTDDRedEvidence(state, 'test_impl') with scopeFiles containing .md and .mmd files only
- expected: passed = true, evidence contains doc-only exemption reason with extension information
- acMapping: AC-1
- rtmMapping: F-001 (doc-only exemption returns pass)
- testFile: dod-tdd.test.ts (docsOnlyScopeFiles免除テスト)

### TC-AC1-02: checkTDDRedEvidence evidence includes exemption reason and extensions

- target: checkTDDRedEvidence evidence string content for single .md file scope
- precondition: state.scopeFiles = ['docs/readme.md'], state.proofLog = [], phase = 'test_impl'
- action: call checkTDDRedEvidence(state, 'test_impl') with single .md scopeFile, assert evidence text
- expected: passed = true, evidence string includes indication of document-only scope
- acMapping: AC-1
- rtmMapping: F-001 (evidence string content validation)
- testFile: dod-tdd.test.ts (空scopeFilesフォールスルーテスト)

### TC-AC2-01: checkTDDRedEvidence falls through when scopeFiles contain code files

- target: checkTDDRedEvidence non-exemption path with mixed code (.ts) and doc (.md) files
- precondition: state.scopeFiles = ['src/index.ts', 'docs/readme.md'], state.proofLog = [], phase = 'test_impl'
- action: call checkTDDRedEvidence(state, 'test_impl') with scopeFiles containing .ts file, verify exemption skipped
- expected: passed = false (existing logic: no L2 proof recorded)
- acMapping: AC-2
- rtmMapping: F-001 (mixed files bypass exemption, fall through to existing check)
- testFile: dod-tdd.test.ts (コードファイル含む既存ロジック維持テスト)

### TC-AC2-02: checkTDDRedEvidence falls through when scopeFiles is empty

- target: checkTDDRedEvidence non-exemption path with empty scopeFiles array
- precondition: state.scopeFiles = [], state.proofLog = [], phase = 'test_impl'
- action: call checkTDDRedEvidence(state, 'test_impl') with empty scopeFiles [], verify no exemption granted
- expected: passed = false (empty array does not qualify for exemption, existing logic applies)
- acMapping: AC-2
- rtmMapping: F-001 (empty scopeFiles array does not trigger exemption)
- testFile: dod-tdd.test.ts (混合拡張子scopeFiles既存ロジックテスト)

### TC-AC3-01: ARTIFACT_QUALITY_RULES contains unique line constraint

- target: ARTIFACT_QUALITY_RULES constant (definitions-shared.ts)
- precondition: import ARTIFACT_QUALITY_RULES from definitions-shared
- action: inspect the string content of ARTIFACT_QUALITY_RULES
- expected: string contains text about line uniqueness constraint (2 occurrences max, 3+ duplicates fail DoD)
- acMapping: AC-3
- rtmMapping: F-002
- testFile: workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts

### TC-AC4-01: existing tests pass without regression

- target: full test suite (vitest run)
- precondition: all implementation changes applied (Step 1, Step 2, Step 3 from planning)
- action: run npx vitest run in workflow-harness/mcp-server
- expected: all existing tests pass (5 existing dod-tdd tests + handler-templates-validation tests), zero failures
- acMapping: AC-4
- rtmMapping: F-003
- testFile: all test files in workflow-harness/mcp-server/src/__tests__/

### TC-AC5-01: modified files remain under 200 lines

- target: dod-l1-l2.ts, definitions-shared.ts
- precondition: all implementation changes applied
- action: run wc -l on both files
- expected: dod-l1-l2.ts <= 200 lines (baseline 167, expected ~177), definitions-shared.ts <= 200 lines (baseline 135, expected ~136)
- acMapping: AC-5
- rtmMapping: F-003
- testFile: manual verification via wc -l

## acTcMapping

- AC-1: TC-AC1-01, TC-AC1-02
- AC-2: TC-AC2-01, TC-AC2-02
- AC-3: TC-AC3-01
- AC-4: TC-AC4-01
- AC-5: TC-AC5-01

## testStrategy

- unit tests for checkTDDRedEvidence: use makeMinimalState helper, set scopeFiles directly, call function with phase='test_impl'
- unit test for ARTIFACT_QUALITY_RULES: import constant and assert string content
- regression: run full vitest suite to confirm zero regressions
- line count: shell command wc -l as a manual gate check

## decisions

- D-001: TC-AC1-01 and TC-AC1-02 are separated to test both the pass result and the evidence content independently, ensuring exemption logic correctness and debuggability
- D-002: TC-AC2-01 tests mixed files (code + doc) and TC-AC2-02 tests empty scopeFiles to cover both non-exemption paths per requirements D-004
- D-003: TC-AC3-01 validates the ARTIFACT_QUALITY_RULES string content directly rather than through template rendering, because the constant is the single source of truth injected into all templates
- D-004: TC-AC4-01 is a full suite regression test rather than selective test execution, because AC-4 explicitly requires all tests to pass including handler-templates-validation.test.ts
- D-005: TC-AC5-01 uses wc -l rather than a programmatic check because the 200-line constraint is a project-level policy enforced at review time, not a runtime assertion
- D-006: All new test cases are added to existing test files (dod-tdd.test.ts, handler-templates-validation.test.ts) rather than creating new files, per planning D-005
- D-007: checkTDDRedEvidence is tested via direct function call (not runDoDChecks) per planning D-006, isolating the function from other DoD check side effects

## artifacts

- docs/workflows/harness-reporting-fixes/test-design.md: test: TC definitions with AC/RTM mapping for 5 acceptance criteria

## next

- criticalDecisions: D-001 (separate pass/evidence tests for AC-1), D-002 (two non-exemption paths for AC-2)
- readFiles: workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts, workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts
- warnings: TC-AC3-01 may need adjustment if ARTIFACT_QUALITY_RULES wording changes during implementation; verify exact string after Step 2
