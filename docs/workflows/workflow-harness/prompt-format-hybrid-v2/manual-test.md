# Manual Test Report: prompt-format-hybrid-v2

task: prompt-format-hybrid-v2
phase: manual_test
date: 2026-03-28
target: .claude/skills/workflow-harness/workflow-delegation.md

## テストシナリオ

### Scenario 1: Prompt Format Rules heading placement

Objective: Open workflow-delegation.md and verify that the `## Prompt Format Rules` heading exists between the Phase Parameter Table and the Common Constraints section.

Steps:
1. Open .claude/skills/workflow-harness/workflow-delegation.md
2. Locate the Phase Parameter Table (ends at line 115)
3. Confirm blank line at line 117 before the heading
4. Confirm `## Prompt Format Rules` appears at line 118
5. Confirm `## Common Constraints (all templates)` follows at line 127

Result: PASS. The heading is correctly positioned at line 118, with a blank line separator (line 117) after the table and before the section.

### Scenario 2: Six bullet items in Prompt Format Rules

Objective: Verify the section contains exactly 6 bullet items covering the specified topics.

Steps:
1. Read lines 120-125 of workflow-delegation.md
2. Confirm bullet 1: Agent delegation (TOON top-level keys + Markdown inner content)
3. Confirm bullet 2: MCP short params (summary, evidence) as single-sentence plain text
4. Confirm bullet 3: MCP long params (instruction, output) as hybrid format
5. Confirm bullet 4: Section separator (blank line between top-level keys)
6. Confirm bullet 5: Long prompt threshold (20+ lines -> file path reference)
7. Confirm bullet 6: Format contamination cross-reference to Common Constraints

Result: PASS. All 6 bullets present at lines 120-125. Each covers exactly one topic with no overlap or omission.

### Scenario 3: Common Constraints Format bullet

Objective: Verify that Common Constraints has a new "Format:" bullet at the end of its list.

Steps:
1. Read the Common Constraints section starting at line 127
2. Scroll to the last bullet item in the section
3. Confirm the final bullet reads: `- Format: artifacts in Markdown. Prompt input format (TOON keys) must not contaminate output format`

Result: PASS. The Format bullet is present at line 135 as the last item in Common Constraints. It clearly states the Markdown artifact rule and TOON non-contamination constraint.

### Scenario 4: Total line count within 200-line limit

Objective: Verify the file total line count is 135 (under the 200-line core constraint).

Steps:
1. Run `wc -l workflow-delegation.md`
2. Confirm output shows 135 lines

Result: PASS. File is 135 lines. This is 65 lines under the 200-line limit, leaving room for future additions.

### Scenario 5: Blank line before Prompt Format Rules heading

Objective: Verify proper Markdown formatting with a blank line before the new section heading.

Steps:
1. Read line 117 of workflow-delegation.md
2. Confirm it is an empty line (no whitespace characters)
3. Confirm line 118 starts with `## Prompt Format Rules`

Result: PASS. Line 117 is blank. Line 118 contains the heading. This follows standard Markdown section separation conventions.

## decisions

- heading-placement: correct position between table and constraints -- verified line 118 sits after table end (115) and before constraints (127)
- bullet-count: exactly 6 items as designed -- each covers one distinct concern with no redundancy
- constraint-addition: Format bullet correctly appended -- last item in Common Constraints at line 135, does not disrupt existing items
- line-budget: 135 lines well within 200-line limit -- 65 lines of headroom remains for future additions
- markdown-formatting: blank lines properly separate sections -- line 117 blank before new heading follows Markdown best practice
- content-accuracy: all bullet text matches design intent -- Agent delegation, MCP params, separator, threshold, contamination all addressed

## artifacts

- target-file: .claude/skills/workflow-harness/workflow-delegation.md (135 lines)
- verification-scope: 5 manual scenarios covering placement, content, formatting, and constraints

## next

- Proceed to security-scan phase
- No corrective actions required
