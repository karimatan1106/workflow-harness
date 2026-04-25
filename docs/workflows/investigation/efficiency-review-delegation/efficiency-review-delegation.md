# Efficiency Review: Delegation File Changes

Date: 2026-03-28
Files reviewed: 6

## Findings

### 1. workflow-delegation.md (125 lines) - Token Efficiency

OK - File size is within range. At 125 lines it is the 3rd largest skill file (max is workflow-orchestrator.md at 186 lines, median ~80). Acceptable for a file read only during delegation.

ISSUE - Phase Parameter Table (lines 92-116, 25 rows) has a "Common Failures" column that duplicates DoD error messages the harness already returns. This column adds ~25 tokens per row (625 tokens total) for information the orchestrator sees at DoD failure time anyway. Consider removing "Common Failures" column and relying on DoD feedback loop. Saves ~40 tokens/row after header overhead.

ISSUE - Template A/B/C share 4 identical constraint lines (decisions: 5+, no duplicate lines, grounding, prior failures). These appear in each template AND again in "Common Constraints" section (lines 118-125). Triple duplication: templates x3 + common section = 4 copies. Fix: remove constraint lines from individual templates, keep only "Common Constraints" section, add one line to each template: "Constraints: see Common Constraints below + {phase-specific additions}".

SKIP - Template detail level is appropriate. The `{placeholder}` style gives structure without over-specifying. No change needed.

### 2. Phase Parameter Table - Column Analysis

ISSUE - "Role" column (e.g., "codebase analyst", "security engineer") is a persona hint. Each role string is 2-3 tokens. 23 rows = ~60 tokens. The persona is already implied by the phase name and template type. Low value per token. Consider removing unless there is evidence it improves output quality.

OK - "Template" column is essential for orchestrator to pick A/B/C.

OK - "Required Sections" column is essential for What block construction.

### 3. workflow-phases.md - Why Statements

OK - Why statements are concise (1 line each, ~15 tokens). 8 stages with Why lines = ~120 tokens total. The delegation templates reference these via `{stage Why from workflow-phases.md}`, so they serve as the single source. Value is proportional to cost.

SKIP - Stage 1 impact_analysis has no Why line (lines 19-20). This is consistent because it shares Stage 1 with research (which has the Why). No action needed unless impact_analysis is delegated independently.

### 4. Agent Files - Prompt Contract Sections

OK - Prompt Contract is 4 lines per file (not 5), appearing in 3 files = 12 lines total. ~50 tokens. This is justified: it tells subagents how to interpret the 4-layer prompt structure they receive. Without it, agents have no instruction to use Why as decision axis. The cost is minimal.

SKIP - The 3 Prompt Contract blocks are identical text. Could be extracted to a shared file, but agent files are already small (32-62 lines) and the duplication is only 4 lines. Extraction would add a file-read hop for ~15 tokens saved. Not worth it.

### 5. tool-delegation.md - Template Enforcement Rule

OK - Line 7 added: "Agent呼び出し時はworkflow-delegation.mdの4層テンプレート(Why/What/How/Constraints)に従う。" This is 1 line (~20 tokens) in a rules file that is always loaded. Justified as the enforcement pointer.

### 6. Hot-Path Concern

OK - workflow-delegation.md is a skill file, loaded only when workflow-harness skill is activated (not on every prompt). Among skill files it is mid-range. The 991-line total across all workflow skill files is the real concern; this file does not disproportionately contribute.

## Summary

| Finding | Type | Token Impact | Recommendation |
|---------|------|-------------|----------------|
| Common Failures column | ISSUE | ~600 tokens removable | Remove column, rely on DoD feedback |
| Constraint duplication x4 | ISSUE | ~200 tokens removable | Deduplicate to Common Constraints only |
| Role column low value | ISSUE | ~60 tokens removable | Remove unless quality evidence exists |
| Why statements | OK | ~120 tokens, justified | Keep |
| Prompt Contract x3 | OK | ~50 tokens, justified | Keep |
| Template enforcement rule | OK | ~20 tokens, justified | Keep |
| File size 125 lines | OK | Mid-range for skill files | Keep |

Total recoverable: ~860 tokens from 3 issues. Post-fix file would be ~95-100 lines.
