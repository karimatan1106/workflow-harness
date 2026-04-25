# Code Quality Review: Delegation & Prompt Contract Files

Date: 2026-03-28
Reviewer: Coordinator (L2)

## Findings

### 1. Unnecessary comments or redundant explanations

OK - workflow-delegation.md is concise; templates use placeholders without over-explaining.
OK - Agent definition files (.claude/agents/*.md) are minimal and functional.
SKIP - No code comments to review (all Markdown).

### 2. Inconsistency in language (English vs Japanese)

ISSUE [LOW] - coordinator.md mixes English section headers with Japanese body text (e.g., "## Role" in English, "prompt に指定されたファイルパス" in Japanese). Same pattern in worker.md and hearing-worker.md. This is consistent across all three files so it is an intentional bilingual style, but the Prompt Contract section is fully English while Context Handoff is mixed. Consider standardizing within each section.
OK - workflow-delegation.md: templates are English, parameter table is English. Consistent.
OK - workflow-phases.md: Stage headers English, Why lines Japanese. Consistent pattern (Why is user-facing rationale, Japanese is appropriate).
OK - tool-delegation.md: fully Japanese except technical terms. Consistent with other rule files.

### 3. Stringly-typed references that could break

ISSUE [MED] - All three agent files reference "workflow-delegation.md" by filename without path. If this file moves from .claude/skills/workflow-harness/, the reference breaks. Full path or a stable alias would be safer.
  - coordinator.md line 18: "workflow-delegation.md 4-layer structure"
  - worker.md line 17: same
  - hearing-worker.md line 18: same
  - tool-delegation.md line 7: same
ISSUE [LOW] - workflow-delegation.md line 123 references "forbidden-actions.md" by name only. The actual file is at `.claude/rules/forbidden-actions.md`.
OK - Phase names in parameter table match workflow-phases.md phase names exactly (verified by extraction).

### 4. Prompt Contract wording: clarity and actionability

OK - The three-bullet Prompt Contract is identical across coordinator.md, worker.md, and hearing-worker.md. Consistent.
ISSUE [LOW] - "Use Why/Context as decision axis; when uncertain, return to user intent" is abstract. "decision axis" is not a standard term. Suggest: "Use Why/Context to guide decisions; when uncertain, prioritize user intent."
OK - "Include all required sections from What/Output spec" is clear and actionable.
OK - "Obey Constraints" is direct and unambiguous.

### 5. Parameter table: phase coverage

ISSUE [MED] - Parameter table has 23 phases but workflow-phases.md describes 30+ phases. The following 8 phases are missing from the table:
  - acceptance_verification (Stage 6)
  - design_review (Stage 3)
  - refactoring (Stage 5)
  - ci_verification (Stage 7)
  - commit (Stage 7)
  - push (Stage 7)
  - deploy (Stage 7)
  - health_observation (Stage 7)
  These are legitimate phases that an orchestrator might need to delegate. Missing entries mean orchestrator has no template guidance for them.
OK - All 23 listed phases have correct Template/Role assignments.
OK - Common Failures column provides actionable information.

### 6. Why statements: style and grammar consistency

ISSUE [LOW] - 6 of 8 Why lines follow the pattern "Xし、Yを防ぐ" (do X, prevent Y). Two deviate:
  - Stage 6: "設計との整合性と回帰を検証し、意図からの逸脱を検出する" (ends with 検出する, not 防ぐ)
  - Stage 7: "安全にリリースし、問題を早期検出する" (ends with 検出する, not 防ぐ)
  These are not wrong but break the parallel structure. If uniformity is desired: "設計との不整合と回帰を防ぐ" / "リリース後の問題を防ぐ" would match the pattern.
OK - All Why lines are at stage level (not phase level), which matches the design intent of one Why per stage.
OK - impact_analysis (Stage 1) has no Why line, which is correct since it shares Stage 1's Why with research.

### 7. Formatting issues or broken Markdown

OK - workflow-delegation.md: code fences properly opened/closed, table aligned.
OK - All agent files: YAML frontmatter valid, sections properly headed.
OK - tool-delegation.md: bullet list formatting correct.
ISSUE [LOW] - workflow-delegation.md line 35: "decisions: minimum 5 items" uses lowercase key style, but line 120 in Common Constraints uses the same. However, "decisions" appears as both a constraint key and table column concept without clear distinction. Minor clarity issue.
OK - No broken links or unclosed formatting detected.

## Summary

| Severity | Count |
|----------|-------|
| MED      | 2     |
| LOW      | 4     |
| OK/SKIP  | 16    |

### MED issues requiring attention:
1. 8 phases missing from parameter table (acceptance_verification, design_review, refactoring, ci_verification, commit, push, deploy, health_observation)
2. Stringly-typed "workflow-delegation.md" filename referenced in 4 files without path

### LOW issues (consider fixing):
3. Mixed English/Japanese within sections (consistent across files but Prompt Contract vs Context Handoff differ)
4. "decision axis" wording in Prompt Contract is abstract
5. Why line style breaks parallel structure in Stages 6 and 7
6. "forbidden-actions.md" referenced without path
