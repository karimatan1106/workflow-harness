# Test Selection: docs-workflows-refactoring-v2

taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28

## overview

This task is a docs-only directory refactoring with no source code changes.
No automated test framework (vitest, jest, etc.) is applicable.
All 6 test cases from test-design.md are selected for manual execution via shell commands.

## selected test cases

| TC ID | AC | Method | Rationale |
|-------|-----|--------|-----------|
| TC-AC1-01 | AC-1 | find + wc -l | Verify zero loose .md at root |
| TC-AC2-01 | AC-2 | ls + basename + sort | Verify exactly 5 category dirs |
| TC-AC3-01 | AC-3 | test -d (x9) | Verify 9 duplicate dirs deleted |
| TC-AC4-01 | AC-4 | test -d (x14) + find count | Verify 7 dirs moved, sources absent |
| TC-AC5-01 | AC-5 | test -f (x19) | Verify 19 .md files at target paths |
| TC-AC6-01 | AC-6 | find -type f + wc -l | Verify total file count = 1902 |

## excluded tests

None. All 6 TCs are selected. No test is excluded because each TC maps 1:1 to an AC and all ACs must be verified.

## test runner

No test framework is used. Verification commands are plain POSIX shell (find, test, ls, wc, basename, sort).
Each command produces a deterministic L1 or L2 gate result (exit code or numeric comparison).
Commands will be executed sequentially in a single bash session during the verification phase.

## decisions

- TS-01: Select all 6 TCs because this task has no optional or stretch-goal ACs; every AC is mandatory
- TS-02: No test framework (vitest/jest) needed because no TypeScript/JavaScript code is changed; shell commands are sufficient and more direct
- TS-03: Execution order follows AC numbering (TC-AC1-01 through TC-AC6-01) because later TCs depend on earlier structural changes being valid
- TS-04: TC-AC6-01 runs last as a global invariant check; if earlier TCs pass but TC-AC6-01 fails, it indicates an untracked side effect
- TS-05: No mocking or test doubles required; all verification targets are filesystem state observable via standard shell commands

## artifacts

- test-selection.md: Test selection document specifying all 6 TCs selected for manual shell-based verification (this file)
- test-design.md: Source test case definitions referenced by this selection

## next

- Execute test_selection DoD gate
- Proceed to implementation phase
- readFiles: test-selection.md, test-design.md, planning.md
- criticalDecisions: TS-02 (no test framework), TS-04 (TC-AC6-01 as global invariant)
