# Test Design: docs-workflows-refactoring-v2

taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28

## Test Cases

### TC-AC1-01: No loose .md files at docs/workflows/ root (AC-1)

検証方法: find docs/workflows/ -maxdepth 1 -name '*.md' で0件確認
Command:
  find docs/workflows/ -maxdepth 1 -name "*.md" -type f | wc -l
Expected: 0
Pass criteria: The count is exactly 0. No .md files remain at docs/workflows/ root level.

### TC-AC2-01: Only category dirs remain at docs/workflows/ root (AC-2)

検証方法: ls -d docs/workflows/*/ でカテゴリ5件のみ確認
Command:
  ls -d docs/workflows/*/ | xargs -I{} basename {} | sort
Expected: Exactly 5 entries in sorted order: bugfix, docs-workflows-refactoring-v2, feature, investigation, workflow-harness
Pass criteria: The sorted directory list matches the 5 expected names with no additional entries.

### TC-AC3-01: 9 duplicate root dirs deleted (AC-3)

検証方法: 9件の絶対パスそれぞれの不在を確認
Commands (each must return non-zero exit code):
  test -d docs/workflows/cli-test
  test -d docs/workflows/concurrent-n58-0
  test -d docs/workflows/concurrent-n58-1
  test -d docs/workflows/concurrent-n58-2
  test -d docs/workflows/integ-test-n58
  test -d docs/workflows/list-test-n58
  test -d docs/workflows/persist-test-n58
  test -d docs/workflows/scope-test-n58
  test -d docs/workflows/test-inv
Expected: All 9 test -d commands return exit code 1 (directory does not exist)
Pass criteria: None of the 9 paths exist as directories.

### TC-AC4-01: 7 uncategorized dirs moved to correct categories (AC-4)

検証方法: 移動先パスの存在と移動元パスの不在を確認
Commands (each must return zero exit code):
  test -d docs/workflows/feature/agent-delegation-prompt-templates
  test -d docs/workflows/workflow-harness/article-insights-harness-improvements
  test -d docs/workflows/workflow-harness/harness-analytics-improvement
  test -d docs/workflows/workflow-harness/harness-detailed-error-analytics
  test -d docs/workflows/workflow-harness/harness-observability-logging
  test -d docs/workflows/workflow-harness/prompt-format-hybrid-rule
  test -d docs/workflows/workflow-harness/prompt-format-hybrid-v2
Additional verification (source paths absent):
  test -d docs/workflows/agent-delegation-prompt-templates  (must fail)
  test -d docs/workflows/article-insights-harness-improvements  (must fail)
  test -d docs/workflows/harness-analytics-improvement  (must fail)
  test -d docs/workflows/harness-detailed-error-analytics  (must fail)
  test -d docs/workflows/harness-observability-logging  (must fail)
  test -d docs/workflows/prompt-format-hybrid-rule  (must fail)
  test -d docs/workflows/prompt-format-hybrid-v2  (must fail)
Expected: 7 destination paths exist (exit 0), 7 source paths absent (exit 1), total file count in moved dirs = 174 (27+31+17+31+27+15+26)
Pass criteria: All 7 dirs present at destination, absent at source, with 174 files across them.

### TC-AC5-01: 19 .md files exist in target category dirs (AC-5)

検証方法: 19件の移動先パスそれぞれの存在を確認
Commands (each must return zero exit code):
  test -f docs/workflows/investigation/ai-slop-detection/ai-slop-detection-investigation.md
  test -f docs/workflows/investigation/ai-slop-detection/ai-slop-p3-impact-analysis.md
  test -f docs/workflows/investigation/p5-retry-pivot/p5-retry-pivot-investigation.md
  test -f docs/workflows/investigation/p5-retry-pivot/p5-retry-pivot-impact-analysis.md
  test -f docs/workflows/investigation/p6-ac-min-count/p6-ac-min-count-investigation.md
  test -f docs/workflows/investigation/p6-ac-min-count/p6-ac-min-change-impact-analysis.md
  test -f docs/workflows/investigation/planning-code-fence-exclusion/planning-code-fence-exclusion-analysis.md
  test -f docs/workflows/investigation/planning-code-fence-exclusion/planning-nocodefences-impact-analysis.md
  test -f docs/workflows/investigation/artifact-drift/artifact-drift-investigation.md
  test -f docs/workflows/investigation/codebase-analysis-for-enhancements/codebase-analysis-for-enhancements.md
  test -f docs/workflows/investigation/code-reuse-review/code-reuse-review.md
  test -f docs/workflows/investigation/code-review-delegation-files/code-review-delegation-files.md
  test -f docs/workflows/investigation/efficiency-review-delegation/efficiency-review-delegation.md
  test -f docs/workflows/investigation/file-capacity-report/file-capacity-report.md
  test -f docs/workflows/investigation/file-structure-analysis/file-structure-analysis.md
  test -f docs/workflows/investigation/security-scan-error-toon/security-scan-error-toon.md
  test -f docs/workflows/investigation/tdd-red-phase-report/tdd-red-phase-report.md
  test -f docs/workflows/investigation/test-selection-error-analytics/test-selection-error-analytics.md
  test -f docs/workflows/workflow-harness/code-quality-refactoring/refactoring.md
Expected: All 19 test -f commands return exit code 0, confirming 18 files in investigation/ subdirs and 1 file in workflow-harness/code-quality-refactoring/
Pass criteria: All 19 files present at their designated target paths.

### TC-AC6-01: Total file count unchanged after refactoring (AC-6)

検証方法: find docs/workflows/ -type f | wc -l でベースライン比較
Command:
  find docs/workflows/ -type f | wc -l
Expected: 1902 (matches pre-refactoring baseline captured in planning Phase 1)
Pass criteria: The total file count equals 1902 exactly. No files gained or lost during move operations.

## acTcMapping

| AC | TC | Verification |
|----|-----|-------------|
| AC-1 | TC-AC1-01 | L1: zero .md files at root |
| AC-2 | TC-AC2-01 | L1: exactly 5 category dirs |
| AC-3 | TC-AC3-01 | L1: 9 specific paths absent |
| AC-4 | TC-AC4-01 | L1: 7 dirs at destination, absent at source, 174 files |
| AC-5 | TC-AC5-01 | L1: 19 files at designated paths |
| AC-6 | TC-AC6-01 | L2: file count = 1902 |

## decisions

- TD-01: Use exit code verification (test -d / test -f) for path existence checks rather than ls output parsing, because exit codes are deterministic L1 gates
- TD-02: TC-AC4-01 verifies both source absence and destination presence to confirm move (not copy), ensuring git mv was used correctly
- TD-03: TC-AC6-01 uses find -type f count rather than git ls-files to include untracked files that may exist in the working tree
- TD-04: TC-AC2-01 uses sorted basename comparison to be order-independent and platform-agnostic
- TD-05: Each TC maps to exactly one AC to maintain 1:1 traceability. No AC is left uncovered.
- TD-06: TC-AC4-01 includes aggregate file count (174) as secondary validation to detect partial moves where dirs exist but contents are missing

## artifacts

- test-design.md: Test design document with 6 test cases covering all 6 acceptance criteria (this file)

## next

- Execute test_design DoD gate
- Proceed to implementation phase: run planning Phases 1-6 in order
- readFiles: test-design.md, planning.md
- criticalDecisions: TD-01 (exit code verification), TD-03 (find vs git ls-files)

## RTM

- F-001: AC-1 -> TC-AC1-01
- F-002: AC-2 -> TC-AC2-01, AC-3 -> TC-AC3-01, AC-4 -> TC-AC4-01
- F-003: AC-5 -> TC-AC5-01
- F-004: AC-6 -> TC-AC6-01
