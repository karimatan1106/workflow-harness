# Code Reuse Review: Delegation Templates & Prompt Contract Changes

Date: 2026-03-28

## Findings

### Q1: workflow-delegation.md Common Constraints vs existing rules

OK - forbidden-actions.md reference (not copy): workflow-delegation.md line 123 says "Forbidden words: see forbidden-actions.md (do not list them here)" -- correctly references without duplicating the word list.

OK - "No duplicate lines" rule: workflow-delegation.md line 122 states "same text 3+ times triggers DoD failure". workflow-rules.md line 95 states "3+ identical non-structural lines = error". These express the same rule but in different contexts (delegation prompt template vs runtime rule definition). Acceptable: the template is a user-facing instruction that paraphrases the rule for subagent consumption.

OK - "decisions: 5+ items" rule: workflow-delegation.md line 120 and workflow-rules.md line 96 both require minimum 5 entries. Same justification as above -- template restates the rule for subagent context.

OK - "Grounding" rule: workflow-delegation.md line 122 ("facts from code/files only, mark speculation") is a delegation-specific instruction not present in forbidden-actions.md or workflow-rules.md as a standalone rule. No duplication.

SKIP - workflow-delegation.md Common Constraints section (lines 118-125) is a compact summary of rules that exist in detail elsewhere. This is intentional: subagents receive the delegation prompt but do NOT read workflow-rules.md directly, so the summary serves as their constraint interface. No action needed.

### Q2: Prompt Contract section across 3 agent files

ISSUE - Prompt Contract is identical across coordinator.md (lines 17-20), worker.md (lines 17-20), and hearing-worker.md (lines 17-20). All three contain the exact same 3 lines:
  - "Orchestrator prompts follow workflow-delegation.md 4-layer structure (Why/What/How/Constraints)."
  - "Use Why/Context as decision axis; when uncertain, return to user intent"
  - "Include all required sections from What/Output spec"
  - "Obey Constraints: forbidden actions, scope limits, quality rules"

Severity: LOW. Agent .md files are standalone definitions loaded independently per invocation. Extracting to a shared file would require each agent to read an additional file at startup, adding latency and complexity. The duplication is 4 lines and unlikely to drift since changes to the prompt contract would naturally touch all 3 files in the same commit. Recommendation: acceptable duplication -- document in a comment that changes must be applied to all 3 files.

### Q3: workflow-delegation.md vs workflow-execution.md

OK - No semantic duplication. workflow-execution.md covers: (1) phase-to-model mapping, (2) bash permission categories, (3) error-to-improvement conversion, (4) editable file restrictions, (5) required context fields (taskId, sessionToken, docsDir). workflow-delegation.md covers: prompt template structure (Why/What/How/Constraints), phase-to-template mapping, and required output sections per phase.

ISSUE - workflow-execution.md "subagent委譲時の必須コンテキスト" section (lines 64-71) overlaps with workflow-delegation.md template fields. Both specify that taskId, output path (docs/workflows/{taskId}/), and .md format are required in delegation prompts. The execution file frames these as "must include in prompt" while the delegation file embeds them in the template structure. Severity: LOW. The execution file predates the delegation file and its context section could be replaced with a reference: "See workflow-delegation.md templates for prompt structure." Recommendation: simplify workflow-execution.md lines 64-71 to a one-line reference to workflow-delegation.md in a future cleanup.

## Summary

| # | Check | Result | Action |
|---|-------|--------|--------|
| 1 | Common Constraints vs forbidden-actions.md | OK | No duplication; references correctly |
| 1 | Common Constraints vs workflow-rules.md | SKIP | Intentional restatement for subagent context |
| 2 | Prompt Contract across 3 agents | ISSUE (LOW) | Acceptable; add sync comment |
| 3 | Delegation vs Execution overlap | ISSUE (LOW) | Future cleanup: replace execution lines 64-71 with reference |
