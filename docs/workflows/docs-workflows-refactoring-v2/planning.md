# Planning: docs-workflows-refactoring-v2

taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28
baseline: 1902 files in docs/workflows/

## Implementation Phases

### Phase 1: Baseline Capture (F-004)

Capture the current file count before any changes to enable AC-6 verification.

  find docs/workflows/ -type f | wc -l

Expected result: 1902. Record this value for post-refactoring comparison.

### Phase 2: Delete Empty Duplicate Root Dirs (F-002) - 9 dirs

All 9 dirs confirmed empty in research phase. Use rmdir (not rm -rf) to ensure safety.

  rmdir docs/workflows/cli-test
  rmdir docs/workflows/concurrent-n58-0
  rmdir docs/workflows/concurrent-n58-1
  rmdir docs/workflows/concurrent-n58-2
  rmdir docs/workflows/integ-test-n58
  rmdir docs/workflows/list-test-n58
  rmdir docs/workflows/persist-test-n58
  rmdir docs/workflows/scope-test-n58
  rmdir docs/workflows/test-inv

Verification: confirm none of the 9 paths exist after deletion.

### Phase 3: Delete Empty Category-Side Dirs (F-002) - 13 dirs

Research identified 13 empty dirs inside category directories. Delete inner-most dirs first.

Investigation-side nested empties (5 dirs with X/X/ structure, delete inner then outer):

  rmdir docs/workflows/investigation/cli-test/cli-test
  rmdir docs/workflows/investigation/cli-test
  rmdir docs/workflows/investigation/list-test-n58/list-test-n58
  rmdir docs/workflows/investigation/list-test-n58
  rmdir docs/workflows/investigation/persist-test-n58/persist-test-n58
  rmdir docs/workflows/investigation/persist-test-n58
  rmdir docs/workflows/investigation/scope-test-n58/scope-test-n58
  rmdir docs/workflows/investigation/scope-test-n58
  rmdir docs/workflows/investigation/test-inv/test-inv
  rmdir docs/workflows/investigation/test-inv

Feature-side empties (4 dirs):

  rmdir docs/workflows/feature/concurrent-n58-0
  rmdir docs/workflows/feature/concurrent-n58-1
  rmdir docs/workflows/feature/concurrent-n58-2
  rmdir docs/workflows/feature/integ-test-n58

Investigation-side empties for concurrent/integ (4 dirs):

  rmdir docs/workflows/investigation/concurrent-n58-0
  rmdir docs/workflows/investigation/concurrent-n58-1
  rmdir docs/workflows/investigation/concurrent-n58-2
  rmdir docs/workflows/investigation/integ-test-n58

Verification: none of the 13 category-side empty dirs exist.

### Phase 4: Move 7 Uncategorized Dirs to Categories (F-002)

Use git mv for history preservation (REQ-NF1).

  git mv docs/workflows/agent-delegation-prompt-templates docs/workflows/feature/
  git mv docs/workflows/article-insights-harness-improvements docs/workflows/workflow-harness/
  git mv docs/workflows/harness-analytics-improvement docs/workflows/workflow-harness/
  git mv docs/workflows/harness-detailed-error-analytics docs/workflows/workflow-harness/
  git mv docs/workflows/harness-observability-logging docs/workflows/workflow-harness/
  git mv docs/workflows/prompt-format-hybrid-rule docs/workflows/workflow-harness/
  git mv docs/workflows/prompt-format-hybrid-v2 docs/workflows/workflow-harness/

Verification: 7 source paths absent, 7 destination paths present with correct file counts (27+31+17+31+27+15+26 = 174 files).

### Phase 5: Create Target Dirs and Move 19 Loose .md Files (F-001, F-003)

Create 14 new directories, then git mv each file. Grouped files share a target dir.

Group A - ai-slop-detection (2 files):
  mkdir -p docs/workflows/investigation/ai-slop-detection
  git mv docs/workflows/ai-slop-detection-investigation.md docs/workflows/investigation/ai-slop-detection/
  git mv docs/workflows/ai-slop-p3-impact-analysis.md docs/workflows/investigation/ai-slop-detection/

Group B - p5-retry-pivot (2 files):
  mkdir -p docs/workflows/investigation/p5-retry-pivot
  git mv docs/workflows/p5-retry-pivot-investigation.md docs/workflows/investigation/p5-retry-pivot/
  git mv docs/workflows/p5-retry-pivot-impact-analysis.md docs/workflows/investigation/p5-retry-pivot/

Group C - p6-ac-min-count (2 files):
  mkdir -p docs/workflows/investigation/p6-ac-min-count
  git mv docs/workflows/p6-ac-min-count-investigation.md docs/workflows/investigation/p6-ac-min-count/
  git mv docs/workflows/p6-ac-min-change-impact-analysis.md docs/workflows/investigation/p6-ac-min-count/

Group D - planning-code-fence-exclusion (2 files):
  mkdir -p docs/workflows/investigation/planning-code-fence-exclusion
  git mv docs/workflows/planning-code-fence-exclusion-analysis.md docs/workflows/investigation/planning-code-fence-exclusion/
  git mv docs/workflows/planning-nocodefences-impact-analysis.md docs/workflows/investigation/planning-code-fence-exclusion/

Standalone investigation files (9 files, 9 new dirs):
  mkdir -p docs/workflows/investigation/artifact-drift
  git mv docs/workflows/artifact-drift-investigation.md docs/workflows/investigation/artifact-drift/

  mkdir -p docs/workflows/investigation/codebase-analysis-for-enhancements
  git mv docs/workflows/codebase-analysis-for-enhancements.md docs/workflows/investigation/codebase-analysis-for-enhancements/

  mkdir -p docs/workflows/investigation/code-reuse-review
  git mv docs/workflows/code-reuse-review.md docs/workflows/investigation/code-reuse-review/

  mkdir -p docs/workflows/investigation/code-review-delegation-files
  git mv docs/workflows/code-review-delegation-files.md docs/workflows/investigation/code-review-delegation-files/

  mkdir -p docs/workflows/investigation/efficiency-review-delegation
  git mv docs/workflows/efficiency-review-delegation.md docs/workflows/investigation/efficiency-review-delegation/

  mkdir -p docs/workflows/investigation/file-capacity-report
  git mv docs/workflows/file-capacity-report.md docs/workflows/investigation/file-capacity-report/

  mkdir -p docs/workflows/investigation/file-structure-analysis
  git mv docs/workflows/file-structure-analysis.md docs/workflows/investigation/file-structure-analysis/

  mkdir -p docs/workflows/investigation/security-scan-error-toon
  git mv docs/workflows/security-scan-error-toon.md docs/workflows/investigation/security-scan-error-toon/

  mkdir -p docs/workflows/investigation/tdd-red-phase-report
  git mv docs/workflows/tdd-red-phase-report.md docs/workflows/investigation/tdd-red-phase-report/

  mkdir -p docs/workflows/investigation/test-selection-error-analytics
  git mv docs/workflows/test-selection-error-analytics.md docs/workflows/investigation/test-selection-error-analytics/

Standalone workflow-harness file (1 file, 1 new dir):
  mkdir -p docs/workflows/workflow-harness/code-quality-refactoring
  git mv docs/workflows/refactoring.md docs/workflows/workflow-harness/code-quality-refactoring/

Verification: 0 .md files at docs/workflows/ root level. 19 files present in new locations.

### Phase 6: Final Verification (F-004)

  find docs/workflows/ -type f | wc -l
  Expected: 1902 (unchanged from baseline)

  ls -d docs/workflows/*/
  Expected: bugfix/ feature/ investigation/ workflow-harness/ docs-workflows-refactoring-v2/ (5 dirs only)

  find docs/workflows/ -maxdepth 1 -name "*.md" | wc -l
  Expected: 0

Verify no uncategorized dirs remain at root (AC-2).

## Operation Count Summary

| Phase | Operation | Count |
|-------|-----------|-------|
| 2 | rmdir (root duplicates) | 9 |
| 3 | rmdir (category-side empties) | 13 |
| 4 | git mv (dirs) | 7 |
| 5 | mkdir -p (new dirs) | 14 |
| 5 | git mv (files) | 19 |
| Total | | 62 |

## Execution Order Constraints

- Phase 1 before all others (captures baseline)
- Phase 2 before Phase 3 (root dirs first, then category-side)
- Phase 3 inner dirs before outer dirs (child rmdir before parent)
- Phase 4 and Phase 5 are independent but both depend on Phase 2/3 completion
- Phase 6 after all others (final verification)

## decisions

- PL-01: Execute phases sequentially (1-6) to maintain clear audit trail and enable rollback at each step
- PL-02: Use rmdir instead of rm -rf for empty directory deletion to prevent accidental data loss if a dir is unexpectedly non-empty
- PL-03: Use git mv for all file and directory moves to preserve git history (REQ-NF1)
- PL-04: Delete inner nested dirs before outer dirs in Phase 3 to avoid directory-not-empty errors
- PL-05: Create 14 new target dirs in Phase 5 rather than pre-creating all dirs upfront, keeping each phase self-contained
- PL-06: Baseline file count (1902) serves as the single source of truth for AC-6 data integrity verification
- PL-07: Phase 4 and Phase 5 can be parallelized by workers since they operate on disjoint sets (dirs vs loose files)

## artifacts

- planning.md: Implementation plan with 6 phases, 62 operations, execution order constraints (this file)

## next

- Implementation phase: Execute Phases 1-6 in order. Workers can parallelize Phase 4 and Phase 5.
- readFiles: planning.md (this file)
- criticalDecisions: PL-02 (rmdir safety), PL-03 (git mv for history), PL-06 (baseline 1902)

## RTM

- F-001: AC-1 (no .md at root) - Phase 5
- F-002: AC-2, AC-3, AC-4 (directory cleanup and moves) - Phases 2, 3, 4
- F-003: AC-5 (md files categorized) - Phase 5
- F-004: AC-6 (data integrity, baseline 1902) - Phases 1, 6
