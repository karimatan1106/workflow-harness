# Test Selection: Prompt Format Hybrid v2

taskId: prompt-format-hybrid-v2
phase: test_selection

## scope

Target file: .claude/skills/workflow-harness/workflow-delegation.md
Change type: documentation-only (skill file content addition)
Source code affected: none
Vitest suites affected: none

## automated-test-analysis

This task modifies a skill file (workflow-delegation.md), not TypeScript source code.
No vitest test suites import, reference, or depend on skill file content.
Running vitest --related against a .md file yields zero matches.
Automated test execution is not applicable for this change.

## selected-tests

All 7 TCs from test-design.md are selected for manual verification.
Each TC uses a shell command (grep or wc) to confirm the presence of required content.

| TC ID | AC | Verification Method | Rationale |
|-------|----|---------------------|-----------|
| TC-AC1-01 | AC-1 | grep for section heading and format keywords | Confirms Prompt Format Rules section exists with TOON and Markdown references |
| TC-AC2-01 | AC-2 | grep for top-level key delegation rule | Confirms agent delegation structure guidance is present |
| TC-AC2-02 | AC-2 | grep for MCP short/long parameter guidance | Confirms MCP parameter format rules are documented |
| TC-AC3-01 | AC-3 | grep for contamination prevention constraint | Confirms format contamination guard exists in Common Constraints |
| TC-AC4-01 | AC-4 | grep for 20-line threshold value | Confirms long prompt threshold is specified |
| TC-AC4-02 | AC-4 | grep for blank line separator rule | Confirms section separator guidance is present |
| TC-AC5-01 | AC-5 | wc -l line count check | Confirms file remains within 200-line limit |

## excluded-tests

No vitest suites excluded because none are relevant.
No integration or E2E tests are affected by skill file documentation changes.

## decisions

- zero automated tests selected: workflow-delegation.md is a skill file with no code consumers that vitest can trace -- running vitest would produce zero relevant results
- all 7 TCs retained from test-design: each TC maps to a distinct AC requirement and none are redundant -- dropping any TC would leave an AC unverified
- manual grep/wc as verification method: shell commands provide deterministic pass/fail results against file content -- no test framework overhead needed for text presence checks
- no regression suite needed: the change adds new content without modifying existing sections -- existing skill file consumers read the file as a whole and additions do not alter prior behavior
- TC execution order follows AC numbering: AC-1 through AC-5 sequential execution ensures earlier structural checks (section exists) run before content-detail checks (threshold values) -- a missing section would cause downstream TCs to fail with clear root cause

## artifacts

- selectedTests: 7 TCs (TC-AC1-01, TC-AC2-01, TC-AC2-02, TC-AC3-01, TC-AC4-01, TC-AC4-02, TC-AC5-01)
- excludedTests: none (no automated tests applicable)
- verificationMethod: manual shell commands (grep, wc)

## next

- phase: test_impl
- input: selected TCs are executed as shell commands against the modified workflow-delegation.md
