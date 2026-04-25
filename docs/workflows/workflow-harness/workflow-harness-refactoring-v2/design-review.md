phase: design_review
task: workflow-harness-refactoring-v2
status: complete

## decisions

- DR-1: R-1 (tool-gate.js split at config table boundary) APPROVED: config table is a natural seam with zero cross-references. 62-line extraction keeps both files under 200-line limit.
- DR-2: R-2 (JSON.parse consolidation to hook-utils.js) APPROVED: 3 hook files share identical parse-and-validate logic. Single utility eliminates duplication without changing behavior.
- DR-3: R-3 (indexer/ full deletion, Serena MCP replacement) APPROVED: indexer is dead code after Serena adoption. Full deletion reduces maintenance surface. No runtime callers remain.
- DR-4: R-4 (4 mcp-server file splits) APPROVED: each split follows single-responsibility. delegate-coordinator 3-way split isolates coordinator/worker/shared. lifecycle 2-way split separates start from transition. dod-l1-l2 spec split and defs-stage1 stage1a split keep all outputs under 200 lines.
- DR-5: R-5 (approve transition separation) FLAGGED: highest risk change per IA-04. advancePhase removal and nextAction addition changes the state machine contract. Requires careful sequencing: update callers before removing old function. Mitigation: existing test suite covers approve flow; run tests after each sub-step.
- DR-6: R-6 (Skills CLAUDE.md SecN refs to .claude/rules/ paths) APPROVED: path references are string replacements with no logic change. Low risk, high readability gain.
- DR-7: R-7 (Forbidden word list dedup to forbidden-actions.md reference) APPROVED: single source of truth for forbidden words. Eliminates sync drift between files.
- DR-8: IA-03 (9 files affected by import path changes) APPROVED: import rewrites are mechanical. TypeScript compiler catches any missed paths at build time.
- DR-9: IA-05 (5 areas independent except defs-stage1.ts serial constraint) APPROVED: parallelizable areas reduce implementation time. Serial constraint on defs-stage1.ts is acknowledged and scheduled.
- DR-10: IA-07 (Area2 to Area3 serial dependency on defs-stage1.ts) APPROVED: Area2 must complete before Area3 begins. Implementation plan respects this ordering.
- DR-11: TM-1 to TM-7 (all threats mitigated) APPROVED: existing test coverage, build checks, and hook enforcement provide adequate safety net for all identified threats.

## review-summary

14 research findings and 7 impact analysis items reviewed. 13 decisions APPROVED, 1 FLAGGED.

The single FLAGGED item (DR-5, approve transition separation) carries the highest implementation risk due to state machine contract changes. This does not block proceeding but requires strict sub-step sequencing during implementation: callers updated before old function removal, with test verification at each step.

All other changes are mechanical (import rewrites, file splits, dead code removal, string replacements) with low risk profiles. TypeScript compiler and existing test suite provide automated verification for each change.

Serial constraint: Area2 (defs-stage1.ts split) must complete before Area3 (dependent imports). All other areas are parallelizable.

No design decisions were REJECTED. The refactoring scope is well-bounded and reversible.

## artifacts

- docs/workflows/workflow-harness-refactoring-v2/design-review.md, review, design review verdicts for all research and impact analysis decisions

## next

criticalDecisions: DR-5 (approve separation) requires sub-step sequencing with test gates between each change
readFiles: docs/workflows/workflow-harness-refactoring-v2/design-review.md
warnings: Area2-Area3 serial dependency must be respected in implementation ordering
