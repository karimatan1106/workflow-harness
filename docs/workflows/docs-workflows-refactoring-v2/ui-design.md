# UI Design: docs-workflows-refactoring-v2

phase: ui_design
task: docs-workflows-refactoring-v2
status: complete
inputArtifact: docs/workflows/docs-workflows-refactoring-v2/planning.md

## components

This task has no UI components. The "interface" is the directory structure that users (humans and LLMs) navigate to find workflow documentation.

UID-01: docs/workflows/ root - entry point to all workflow documentation, contains only 4 category directories and the current task directory
UID-02: bugfix/ category - contains bug fix workflow records
UID-03: feature/ category - contains feature development workflow records
UID-04: investigation/ category - contains investigation and analysis workflow records
UID-05: workflow-harness/ category - contains harness improvement workflow records

## layouts

The directory tree below shows the target state after refactoring. Only structural changes are shown; existing content within category directories is unchanged.

Before state (root level):
  docs/workflows/
    bugfix/                              (category - keep)
    feature/                             (category - keep)
    investigation/                       (category - keep)
    workflow-harness/                    (category - keep)
    cli-test/                            (duplicate empty - delete)
    concurrent-n58-0/                    (duplicate empty - delete)
    concurrent-n58-1/                    (duplicate empty - delete)
    concurrent-n58-2/                    (duplicate empty - delete)
    integ-test-n58/                      (duplicate empty - delete)
    list-test-n58/                       (duplicate empty - delete)
    persist-test-n58/                    (duplicate empty - delete)
    scope-test-n58/                      (duplicate empty - delete)
    test-inv/                            (duplicate empty - delete)
    agent-delegation-prompt-templates/   (uncategorized - move to feature/)
    article-insights-harness-improvements/ (uncategorized - move to workflow-harness/)
    harness-analytics-improvement/       (uncategorized - move to workflow-harness/)
    harness-detailed-error-analytics/    (uncategorized - move to workflow-harness/)
    harness-observability-logging/       (uncategorized - move to workflow-harness/)
    prompt-format-hybrid-rule/           (uncategorized - move to workflow-harness/)
    prompt-format-hybrid-v2/            (uncategorized - move to workflow-harness/)
    ai-slop-detection-investigation.md   (loose file - move)
    ai-slop-p3-impact-analysis.md        (loose file - move)
    artifact-drift-investigation.md      (loose file - move)
    ... (19 loose .md files total)

After state (root level):
  docs/workflows/
    bugfix/
      (49件の既存バグ修正タスクディレクトリ)
    feature/
      agent-delegation-prompt-templates/   (moved from root)
      (37件の既存機能開発タスクディレクトリ)
    investigation/
      ai-slop-detection/                   (new dir, 2 files moved in)
      artifact-drift/                      (new dir, 1 file moved in)
      codebase-analysis-for-enhancements/  (new dir, 1 file moved in)
      code-reuse-review/                   (new dir, 1 file moved in)
      code-review-delegation-files/        (new dir, 1 file moved in)
      efficiency-review-delegation/        (new dir, 1 file moved in)
      file-capacity-report/                (new dir, 1 file moved in)
      file-structure-analysis/             (new dir, 1 file moved in)
      p5-retry-pivot/                      (new dir, 2 files moved in)
      p6-ac-min-count/                     (new dir, 2 files moved in)
      planning-code-fence-exclusion/       (new dir, 2 files moved in)
      security-scan-error-toon/            (new dir, 1 file moved in)
      tdd-red-phase-report/                (new dir, 1 file moved in)
      test-selection-error-analytics/      (new dir, 1 file moved in)
      (34件の既存調査タスクディレクトリ)
    workflow-harness/
      article-insights-harness-improvements/ (moved from root)
      code-quality-refactoring/              (new dir, refactoring.md moved in)
      harness-analytics-improvement/         (moved from root)
      harness-detailed-error-analytics/      (moved from root)
      harness-observability-logging/         (moved from root)
      prompt-format-hybrid-rule/             (moved from root)
      prompt-format-hybrid-v2/              (moved from root)
      (93件の既存ハーネスタスクディレクトリ)
    docs-workflows-refactoring-v2/           (this task, self-referential)

## interactions

INT-1: User navigates to docs/workflows/ and sees only 4 category directories (plus the current task dir). No loose files or uncategorized dirs create confusion.
INT-2: User looking for an investigation opens investigation/ and finds all analysis/investigation records organized by topic name.
INT-3: User looking for harness improvements opens workflow-harness/ and finds all harness-related workflow records.
INT-4: User runs git log --follow on any moved file and can trace its history back to the original location.

## navigation patterns

Pattern 1 - Category browsing:
  docs/workflows/ -> pick category -> pick task dir -> read artifacts
  This is the primary discovery path. The 4-category structure maps to the 4 types of work performed.

Pattern 2 - Direct path access:
  docs/workflows/investigation/ai-slop-detection/ai-slop-detection-investigation.md
  LLMs and scripts reference files by full path. All paths are stable after refactoring.

Pattern 3 - History tracing:
  git log --follow docs/workflows/investigation/ai-slop-detection/ai-slop-detection-investigation.md
  Shows the file's full history including its pre-move location at docs/workflows/.

## decisions

- D-001: Use existing 4-category structure as sole organizational scheme (ADR-010 established this, no new categories needed)
- D-002: Create individual directories for each loose .md file (each directory represents one logical investigation or task, avoids catch-all anti-pattern)
- D-003: Group related .md files into shared directories (5 pairs of investigation + impact-analysis analyze the same topic)
- D-004: Place refactoring.md under workflow-harness/code-quality-refactoring/ (documents harness code quality improvement, not an investigation)
- D-005: After-state directory tree serves as acceptance test visualization (actual state matching tree satisfies AC-1 through AC-5)
- D-006: No README or index file at docs/workflows/ root (4 category directories are self-documenting through their names)

## artifacts

docs/workflows/docs-workflows-refactoring-v2/ui-design.md: design - Directory structure design with before/after visualization and navigation patterns (this file)

## next

criticalDecisions: D-001 (4-category structure), D-002 (individual dirs per file), D-005 (tree as acceptance test)
readFiles: docs/workflows/docs-workflows-refactoring-v2/planning.md
warnings: No code or UI changes. Implementation phase executes the 62 filesystem operations defined in planning.md.

## RTM

- F-001: AC-1 (no .md at root) - After state shows 0 loose files at root
- F-002: AC-2, AC-3, AC-4 (directory cleanup) - After state shows only 4 categories + self
- F-003: AC-5 (md files categorized) - After state shows all 19 files in category subdirs
- F-004: AC-6 (data integrity) - Move-only operations preserve file count at 1902
