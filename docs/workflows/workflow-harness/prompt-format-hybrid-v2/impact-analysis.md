## impact-analysis

Task: prompt-format-hybrid-v2
Phase: impact_analysis

## impact summary

This change adds a Prompt Format Rules section to workflow-delegation.md. The impact is confined to orchestrator prompt construction behavior at delegation time. No code, tests, or build artifacts are affected. The change is additive: no existing content is modified or removed.

Risk level: LOW

## dependency graph

workflow-delegation.md is a leaf node in the dependency graph. It has no reverse dependencies.

### who reads this file

| consumer | how | when |
|----------|-----|------|
| orchestrator (L1) | reads as skill file to construct delegation prompts | every subagent delegation call |

### who does NOT read this file

- coordinator agents (L2): receive constructed prompts, do not read skill files directly
- worker agents (L3): receive task instructions, do not read skill files directly
- hooks: enforce phase gates via harness state, do not parse skill files
- tests: no test files reference or import workflow-delegation.md
- build system: skill files are not compiled or bundled

### reverse dependency check

No file imports, requires, or includes workflow-delegation.md. Verified by:
- no code import statements reference this path
- no hook scripts parse this file
- no test fixtures depend on this file content
- no CLAUDE.md or rules files include this file (they reference it by name for human readers only)

Dependency graph depth: 0 (leaf node)

## behavioral impact

The orchestrator will include prompt format rules when constructing delegation prompts for subagents. This affects:
- prompt content sent to coordinator/worker/hearing-worker agents
- no change to prompt structure (Why/What/How/Constraints template unchanged)
- no change to phase flow, DoD checks, or harness state transitions

Expected behavioral change: subagent prompts will explicitly specify output format expectations, reducing format contamination incidents where TOON-formatted input causes TOON-formatted output in phases that expect Markdown.

## risk assessment

| risk | likelihood | severity | mitigation |
|------|-----------|----------|------------|
| existing delegation behavior breaks | negligible | low | change is additive, no existing content modified |
| file exceeds 200-line limit | none | medium | current 126 + 11 = 137 lines, well under limit |
| format rules conflict with existing constraints | low | low | reviewed Common Constraints; no overlap with proposed rules |
| orchestrator ignores new section | low | low | section follows same H2 convention as Common Constraints |

## decisions

- impact scope: documentation-only, no code changes -- workflow-delegation.md is a skill file with zero code consumers
- risk classification: LOW -- additive change to a leaf-node file with single consumer
- no migration needed: orchestrator reads file fresh each delegation -- no cached state to invalidate
- no rollback plan required: removing the added section restores original behavior with no side effects
- no test changes: skill files are validated by DoD content checks, not unit tests -- existing test suite unaffected

## artifacts

- this file: docs/workflows/prompt-format-hybrid-v2/impact-analysis.md

## next

- requirements phase: define acceptance criteria for the Prompt Format Rules section content
