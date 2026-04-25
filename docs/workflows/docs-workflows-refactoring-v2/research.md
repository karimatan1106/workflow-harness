# Research: docs-workflows-refactoring-v2

taskId: 5127ee0c-0fad-4088-a2bc-e7c590595738
date: 2026-03-28

## Baseline Metrics

- Total files in docs/workflows/: 1902
- Root-level items: 40 (4 category dirs + 16 uncategorized dirs + 19 loose .md + 1 self dir)
- Category distribution: bugfix(49), feature(37), investigation(34), workflow-harness(93)

## P1: Duplicate Directory Analysis (9 dirs)

All 9 root-level duplicate directories are empty (0 files). The category-side copies are also empty or contain only empty nested subdirectories. Safe to delete root copies without data loss.

| Root Dir | Category Location | Root Files | Category Files | Diff |
|----------|-------------------|------------|----------------|------|
| cli-test | investigation/cli-test/cli-test/ | 0 | 0 (empty nested dir) | identical (both empty) |
| concurrent-n58-0 | feature/ + investigation/ | 0 | 0 | identical (both empty) |
| concurrent-n58-1 | feature/ + investigation/ | 0 | 0 | identical (both empty) |
| concurrent-n58-2 | feature/ + investigation/ | 0 | 0 | identical (both empty) |
| integ-test-n58 | feature/ + investigation/ | 0 | 0 | identical (both empty) |
| list-test-n58 | investigation/list-test-n58/list-test-n58/ | 0 | 0 (empty nested dir) | identical (both empty) |
| persist-test-n58 | investigation/persist-test-n58/persist-test-n58/ | 0 | 0 (empty nested dir) | identical (both empty) |
| scope-test-n58 | investigation/scope-test-n58/scope-test-n58/ | 0 | 0 (empty nested dir) | identical (both empty) |
| test-inv | investigation/test-inv/test-inv/ | 0 | 0 (empty nested dir) | identical (both empty) |

Additional finding: 5 investigation-side dirs (cli-test, list-test-n58, persist-test-n58, scope-test-n58, test-inv) have a redundant nested structure (investigation/X/X/) with the inner dir also empty. These nested empty dirs in category-side should also be cleaned up.

Also: concurrent-n58-0/1/2 and integ-test-n58 have empty dirs in BOTH feature/ and investigation/. Both category-side empty dirs should be deleted as well.

## P2: Uncategorized Directory Analysis (7 dirs)

All 7 directories confirmed to exist with workflow artifacts.

| Dir | Files | Proposed Category | Verification |
|-----|-------|-------------------|--------------|
| agent-delegation-prompt-templates | 27 | feature | Confirmed: prompt template development task |
| article-insights-harness-improvements | 31 | workflow-harness | Confirmed: harness improvement based on article insights |
| harness-analytics-improvement | 17 | workflow-harness | Confirmed: analytics feature for harness |
| harness-detailed-error-analytics | 31 | workflow-harness | Confirmed: error analytics feature for harness |
| harness-observability-logging | 27 | workflow-harness | Confirmed: observability logging for harness |
| prompt-format-hybrid-rule | 15 | workflow-harness | Confirmed: prompt format rule (harness operation) |
| prompt-format-hybrid-v2 | 26 | workflow-harness | Confirmed: prompt format v2 (harness operation) |

Category assignments match scope-definition.md proposals. 1 to feature, 6 to workflow-harness.

## P3: Loose .md File Analysis (19 files)

All 19 files confirmed to exist. Content review validates proposed categorizations from scope-definition.md.

| File | Content Type | Target Category | Grouping |
|------|-------------|-----------------|----------|
| ai-slop-detection-investigation.md | Investigation report | investigation/ai-slop-detection/ | Group with ai-slop-p3-impact-analysis.md |
| ai-slop-p3-impact-analysis.md | Impact analysis | investigation/ai-slop-detection/ | Group with above |
| artifact-drift-investigation.md | Investigation report | investigation/artifact-drift/ | Standalone |
| codebase-analysis-for-enhancements.md | Analysis report | investigation/codebase-analysis-for-enhancements/ | Standalone |
| code-reuse-review.md | Code review | investigation/code-reuse-review/ | Standalone |
| code-review-delegation-files.md | Code review | investigation/code-review-delegation-files/ | Standalone |
| efficiency-review-delegation.md | Efficiency review | investigation/efficiency-review-delegation/ | Standalone |
| file-capacity-report.md | Capacity report | investigation/file-capacity-report/ | Standalone |
| file-structure-analysis.md | Structure analysis | investigation/file-structure-analysis/ | Standalone |
| p5-retry-pivot-investigation.md | Investigation report | investigation/p5-retry-pivot/ | Group with p5-retry-pivot-impact-analysis.md |
| p5-retry-pivot-impact-analysis.md | Impact analysis | investigation/p5-retry-pivot/ | Group with above |
| p6-ac-min-count-investigation.md | Investigation report | investigation/p6-ac-min-count/ | Group with p6-ac-min-change-impact-analysis.md |
| p6-ac-min-change-impact-analysis.md | Impact analysis | investigation/p6-ac-min-count/ | Group with above |
| planning-code-fence-exclusion-analysis.md | Analysis report | investigation/planning-code-fence-exclusion/ | Group with planning-nocodefences-impact-analysis.md |
| planning-nocodefences-impact-analysis.md | Impact analysis | investigation/planning-code-fence-exclusion/ | Group with above |
| refactoring.md | Refactoring plan | workflow-harness/code-quality-refactoring/ | Standalone |
| security-scan-error-toon.md | Security scan | investigation/security-scan-error-toon/ | Standalone |
| tdd-red-phase-report.md | Test report | investigation/tdd-red-phase-report/ | Standalone |
| test-selection-error-analytics.md | Test analysis | investigation/test-selection-error-analytics/ | Standalone |

Grouping: 5 pairs (10 files) grouped into shared directories, 9 standalone files. 18 to investigation, 1 to workflow-harness. 14 new directories to create.

## Risk Analysis

- Risk-1 (duplicate content divergence): Eliminated. All 9 duplicate root dirs are empty. No data loss risk.
- Risk-2 (path references): Low. docs/workflows/ is an artifact archive. No code references these paths.
- Risk-3 (nested empty dirs in categories): investigation/ contains 5 dirs with redundant nesting (X/X/). Should clean these during P1 to avoid confusion.
- Risk-4 (empty category-side dirs): concurrent-n58-0/1/2 and integ-test-n58 exist as empty dirs in both feature/ and investigation/. Should delete these too.

## Operation Summary

| Operation | Count |
|-----------|-------|
| Delete empty root dirs (P1) | 9 |
| Delete empty category-side dirs (P1 cleanup) | 13 (5 nested in investigation + 4 in feature + 4 in investigation) |
| Move uncategorized dirs to categories (P2) | 7 |
| Create new dirs for loose .md files (P3) | 14 |
| Move loose .md files (P3) | 19 |
| Total operations | 62 |

Expected post-refactoring root items: 5 (bugfix/ + feature/ + investigation/ + workflow-harness/ + docs-workflows-refactoring-v2/)

## decisions

- D-001: All 9 duplicate root dirs are safe to delete (all empty, no content to preserve)
- D-002: Category-side empty dirs for duplicates should also be cleaned (13 empty dirs in feature/ and investigation/)
- D-003: All 7 uncategorized dir category assignments confirmed (1 feature, 6 workflow-harness)
- D-004: All 19 loose .md categorizations confirmed (18 investigation, 1 workflow-harness)
- D-005: 5 file pairs share target directories (ai-slop, p5-retry-pivot, p6-ac-min-count, planning-code-fence, combined into grouped dirs)
- D-006: File count baseline for AC-6 verification is 1902 files

## artifacts

- research.md: Investigation results with diff analysis, categorization verification, and baseline metrics (this file)

## next

- impact_analysis: Assess risk of directory moves and deletions, confirm no external references
