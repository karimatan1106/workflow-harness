## research

Task: prompt-format-hybrid-v2
Phase: research

## summary

workflow-delegation.md (126 lines) contains 3 delegation prompt templates (A: coordinator, B: worker-write, C: worker-verify), a Phase Parameter Table mapping 22 phases to templates/roles/sections, and a Common Constraints section with 6 universal rules. No prompt format rules currently exist anywhere in the file. The file is a skill file read by the orchestrator at delegation time to construct subagent prompts.

## current file structure

| section | lines | purpose |
|---------|-------|---------|
| YAML frontmatter | 1-4 | name and description |
| 4-Layer Template Structure intro | 6-11 | explains Why/What/How/Constraints |
| Template A: coordinator | 13-37 | delegation template for analysis phases |
| Template B: worker-write | 39-62 | delegation template for write phases |
| Template C: worker-verify | 64-88 | delegation template for verify phases |
| Phase Parameter Table | 90-116 | 22 rows mapping phase to template/role/sections/failures |
| Common Constraints | 118-126 | 6 universal rules for all templates |

## user intent analysis

- surface intent: add prompt format rules to workflow-delegation.md
- deep intent: standardize the format of delegation prompts to prevent output contamination, where subagent output format is inadvertently influenced by the input prompt format (TOON input producing TOON output when Markdown is expected, or vice versa)
- unclear points: none remaining (all clarified during hearing phase)
- assumptions: existing template structure (A/B/C) and Common Constraints items remain unchanged; the new section is purely additive

## insertion point analysis

The optimal insertion point is immediately before Common Constraints (line 118). Rationale:

1. The new Prompt Format Rules section is a cross-cutting concern like Common Constraints, but more specific (format-related vs general quality)
2. Placing it before Common Constraints groups all "rules" sections together at the end of the file
3. The Phase Parameter Table (ending line 116) is a reference lookup; rules naturally follow after reference data
4. Inserting between templates and the parameter table would break the logical flow from "how to write prompts" to "what parameters to use"

The alternative of embedding format rules within each template was rejected because it would add redundant content to 3 templates and increase maintenance burden.

## content to add

The Prompt Format Rules section will contain approximately 10 lines covering:
- TOON+MD hybrid format specification for subagent prompts
- Input format isolation rule (prevent output format contamination from input)
- Output format explicit declaration requirement
- Reference to feedback_prompt-format-hybrid.md for rationale

Plus 1 line added to Common Constraints referencing the new section.

## decisions

- insertion location: before Common Constraints, after Phase Parameter Table -- groups rule sections together at file end, maintains logical reading order
- section heading level: H2 (##) matching Common Constraints -- consistent hierarchy within the file
- no template body changes: format rules are cross-cutting, not template-specific -- avoids 3x duplication and maintenance divergence
- content scope: 4 rules maximum in the new section -- keeps section focused and avoids overlap with existing Common Constraints items
- reference style: add 1 line in Common Constraints pointing to Prompt Format Rules -- ensures readers of Common Constraints discover the related section
- no new file creation: all changes within existing workflow-delegation.md -- preserves single-file delegation knowledge principle

## artifacts

- this file: docs/workflows/prompt-format-hybrid-v2/research.md

## next

- impact_analysis phase: verify no reverse dependencies or downstream effects
