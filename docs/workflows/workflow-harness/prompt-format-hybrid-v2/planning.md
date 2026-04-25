# Planning: Prompt Format Hybrid v2

taskId: prompt-format-hybrid-v2
phase: planning
target: .claude/skills/workflow-harness/workflow-delegation.md

## Target File Current State

  File: .claude/skills/workflow-harness/workflow-delegation.md
  Current lines: 126
  Insert position: line 117, after docs_update row and before "## Common Constraints"
  Post-change estimate: approximately 137 lines (under 200 limit)

## New Section Structure

  Section heading: ## Prompt Format Rules
  Location: between Phase Parameter Table (ends line 116) and Common Constraints (starts line 118)

  Content (6 bullet items):
    - F-001: Default output format is TOON for internal state, Markdown for deliverable artifacts
    - F-002: Agent delegation prompts use top-level keys (Task/Why/What/How/Constraints) without Markdown heading markers
    - F-003: MCP tool parameters use short single-line values for labels and long multi-line values for body content
    - F-004: Output format must not contaminate input format (e.g., receiving TOON must not cause emitting TOON when Markdown is specified)
    - F-005: Long prompts (20+ lines) use blank line separators between logical sections for readability
    - F-006: Final file must remain at or below 200 lines after insertion

## Common Constraints Addition

  Append one line to the existing Common Constraints section:
    - Format contamination: output format must match spec regardless of input format received

  This reinforces F-004 at the constraints level where all templates inherit it.

## F-NNN Specification Details

  F-001 Prompt Format Rules Section
    Requirement: A new H2 section titled "Prompt Format Rules" exists in workflow-delegation.md
    Verification: grep confirms heading presence
    Acceptance: section contains references to both TOON and Markdown formats

  F-002 Agent Delegation Structure
    Requirement: Rule specifying top-level key structure for delegation prompts
    Verification: grep confirms "Top-level keys" text in the section
    Acceptance: rule text references Task/Why/What/How/Constraints keys

  F-003 MCP Parameter Format
    Requirement: Rule distinguishing short and long MCP parameter value formats
    Verification: grep confirms "MCP" and "short" and "long" in section content
    Acceptance: guidance covers both single-line and multi-line parameter cases

  F-004 Contamination Prevention
    Requirement: Rule preventing input format from leaking into output format
    Verification: grep confirms "Format:" line in Common Constraints
    Acceptance: explicit statement that output format follows spec not input

  F-005 Threshold and Separator Rules
    Requirement: Rule defining 20-line threshold and blank line separators
    Verification: grep confirms "20" in section content
    Acceptance: threshold value and separator guidance both present

  F-006 Line Count Verification
    Requirement: Post-edit file must not exceed 200 lines
    Verification: wc -l on the modified file returns value at or below 200
    Acceptance: measured line count is 200 or fewer

## Implementation Order

  Step 1: Read current workflow-delegation.md to confirm line numbers
  Step 2: Insert "## Prompt Format Rules" section with 6 rules after line 116
  Step 3: Append contamination prevention line to Common Constraints section
  Step 4: Verify total line count does not exceed 200
  Step 5: Run grep checks for each F-NNN requirement

## decisions

- insert position before Common Constraints: keeps format rules adjacent to constraint rules -- logical grouping aids discoverability
- 6 bullet structure: one rule per F-NNN spec -- enables independent verification of each requirement
- contamination rule in both sections: format rules define it, constraints enforce it -- defense in depth without contradiction
- no code fences in planning: 2-space indentation per task constraints -- maintains consistency with planning format rules
- 200-line budget verification as final step: catches overflow before commit -- prevents DoD failure on line count gate
- F-NNN sequential numbering from 001: follows existing RTM convention -- integrates with traceability chain

## artifacts

- planning: technical specification with F-001 through F-006
- implementationOrder: 5-step execution sequence
- lineEstimate: current 126 + 11 inserted = approximately 137

## next

- phase: state_machine
- input: implementation steps from this planning document guide the state transitions
