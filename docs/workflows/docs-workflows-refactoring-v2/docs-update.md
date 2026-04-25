# docs_update: docs-workflows-refactoring-v2

phase: docs_update
taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28

## summary

ADR-010 established a 4-category directory structure for docs/workflows.
This v2 task completed the remaining cleanup that ADR-010 scoped but did not fully execute.
The refactoring was purely structural; no documentation content was modified.

Changes performed:
- Deleted 9 empty duplicate root-level directories that were leftover from the v1 migration
- Moved 7 uncategorized task directories into their correct category subdirectories
- Organized 19 loose .md files from docs/workflows root into appropriate category subdirs
- Verified that docs/workflows root now contains only the 4 category directories

## decisions

- D-001: Empty duplicate directories deleted rather than merged, because they contained no files and were artifacts of incomplete v1 cleanup
- D-002: Category assignment for uncategorized dirs followed the ADR-010 taxonomy (infra, feature, refactor, docs) based on each task's primary intent
- D-003: Loose .md files were placed into new task-specific subdirectories within categories, not left as flat files, to maintain the one-dir-per-task convention
- D-004: No content edits were made to any moved files, preserving git history accuracy through pure renames
- D-005: No updates to CLAUDE.md or skill files required, because the harness references docsDir paths per-task and does not hardcode docs/workflows subdirectory names
- D-006: The 4 category directories (infra, feature, refactor, docs) remain the only top-level entries under docs/workflows, enforcing the ADR-010 invariant
- D-007: No harness configuration changes needed since docsDir is set per-task at start time and existing completed tasks retain their original paths

## artifacts

| type | path |
|------|------|
| ADR | docs/adr/ADR-010-docs-workflows-refactoring.md |
| scope | docs/workflows/docs-workflows-refactoring-v2/scope-definition.md |
| planning | docs/workflows/docs-workflows-refactoring-v2/planning.md |
| requirements | docs/workflows/docs-workflows-refactoring-v2/requirements.md |
| impact-analysis | docs/workflows/docs-workflows-refactoring-v2/impact-analysis.md |
| research | docs/workflows/docs-workflows-refactoring-v2/research.md |

## next

- Monitor that future harness tasks correctly create their docsDir under one of the 4 categories
- If a new category is needed beyond infra/feature/refactor/docs, create a new ADR to extend the taxonomy
- Consider adding a hook or gate that validates docsDir placement against the category list at task start
