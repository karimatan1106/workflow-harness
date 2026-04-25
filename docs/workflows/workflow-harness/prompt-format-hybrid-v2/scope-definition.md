## scope-definition

Task: prompt-format-hybrid-v2
Phase: scope_definition

## entry points

- .claude/skills/workflow-harness/workflow-delegation.md (126 lines, skill file read by orchestrator at delegation time)

## affected files

| file | change type | line delta |
|------|------------|------------|
| .claude/skills/workflow-harness/workflow-delegation.md | add section | +11 lines |

Total affected files: 1
Total line delta: +11

## change description

Add a new "Prompt Format Rules" section to workflow-delegation.md between Phase Parameter Table and Common Constraints. The section codifies prompt format standardization rules that prevent output contamination from input format leakage. Additionally, add 1 reference line in Common Constraints pointing to the new section.

No downstream code changes are required. This is a documentation-only change to a skill file. No tests reference this file. No build artifacts depend on it.

## decisions

- insertion point: between Phase Parameter Table (line 117) and Common Constraints (line 118) -- this is the natural location because format rules apply across all templates but are not per-phase parameters
- file count: restrict to 1 file only -- the change is self-contained within workflow-delegation.md; splitting would fragment related delegation knowledge
- line budget: +11 lines keeps file under 140 total, well within 200-line limit -- no file split needed
- no template modification: existing Templates A/B/C remain unchanged -- the new rules are additive guidance, not structural template changes
- no test impact: skill files have no unit test coverage by design -- verification is via DoD content checks at runtime
- no code import dependency: workflow-delegation.md is read as raw text by orchestrator, not imported as module -- zero risk of breaking code paths

## artifacts

- this file: docs/workflows/prompt-format-hybrid-v2/scope-definition.md

## next

- research phase: analyze current file structure and confirm insertion point details
