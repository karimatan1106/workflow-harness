# Test Design: Prompt Format Hybrid v2

taskId: prompt-format-hybrid-v2
phase: test_design

## acTcMapping

| AC | TC ID | Description |
|----|-------|-------------|
| AC-1 | TC-AC1-01 | Verify Prompt Format Rules section exists with TOON and Markdown references |
| AC-2 | TC-AC2-01 | Verify agent delegation top-level key structure rule is present |
| AC-2 | TC-AC2-02 | Verify MCP parameter short and long format guidance is present |
| AC-3 | TC-AC3-01 | Verify contamination prevention constraint appears in Common Constraints |
| AC-4 | TC-AC4-01 | Verify 20-line threshold for long prompt formatting is specified |
| AC-4 | TC-AC4-02 | Verify blank line separator rule for section boundaries is specified |
| AC-5 | TC-AC5-01 | Verify total file line count does not exceed 200 |

## TC Definitions

### TC-AC1-01: Prompt Format Rules section with format references

Precondition: workflow-delegation.md has been modified with the new section
Command: grep -c "## Prompt Format Rules" .claude/skills/workflow-harness/workflow-delegation.md && grep "TOON" .claude/skills/workflow-harness/workflow-delegation.md && grep "Markdown" .claude/skills/workflow-harness/workflow-delegation.md
Expected: Heading count returns 1, and both format keywords appear in file content confirming the section references internal state format and deliverable artifact format

### TC-AC2-01: Agent delegation structure rule

Precondition: The format rules section has been inserted into the target file
Command: grep "Top-level keys" .claude/skills/workflow-harness/workflow-delegation.md
Expected: Output contains a line mentioning top-level keys used in delegation prompts such as Task, Why, What, How, and Constraints as plain text identifiers

### TC-AC2-02: MCP parameter format guidance

Precondition: The target file contains the newly added format rules content
Command: grep "MCP" .claude/skills/workflow-harness/workflow-delegation.md && grep "short" .claude/skills/workflow-harness/workflow-delegation.md && grep "long" .claude/skills/workflow-harness/workflow-delegation.md
Expected: File contains MCP-related rule text distinguishing between concise single-line parameter values and extended multi-line parameter bodies

### TC-AC3-01: Contamination prevention in Common Constraints

Precondition: Common Constraints section has received the additional format guard line
Command: grep "Format" .claude/skills/workflow-harness/workflow-delegation.md | grep -i "contam"
Expected: A constraint line within the Common Constraints section explicitly states that output format must follow the specification regardless of what format the input was received in

### TC-AC4-01: Long prompt threshold value

Precondition: Format rules section is present with threshold specification
Command: grep "20" .claude/skills/workflow-harness/workflow-delegation.md
Expected: The number 20 appears in context of a line-count threshold that determines when a prompt qualifies as long and requires additional structural formatting

### TC-AC4-02: Section separator rule

Precondition: Format rules section is present with separator guidance
Command: grep -i "blank line" .claude/skills/workflow-harness/workflow-delegation.md || grep -i "separator" .claude/skills/workflow-harness/workflow-delegation.md
Expected: A rule specifying that logical sections within long prompts should be separated by empty lines to improve readability for consuming agents

### TC-AC5-01: File line count within limit

Precondition: All modifications to workflow-delegation.md are complete
Command: wc -l .claude/skills/workflow-harness/workflow-delegation.md
Expected: The word count utility reports a total line count of 200 or fewer, confirming the file remains within the repository maximum file size constraint

## Coverage Summary

Total ACs: 5
Total TCs: 7
Minimum TCs per AC: 1 (AC-1, AC-3, AC-5 each have 1 TC)
Maximum TCs per AC: 2 (AC-2 and AC-4 each have 2 TCs covering distinct sub-requirements)

AC-2 receives two TCs because agent delegation format and MCP parameter format are independent concerns requiring separate verification commands.
AC-4 receives two TCs because the threshold value and the separator mechanism are distinct rules that could independently fail.

All other ACs have a single focused TC because each maps to a single verifiable condition with one grep or wc command.

## decisions

- grep-based verification for TC-AC1 through TC-AC4: file content checks use grep as the standard text search tool -- provides deterministic pass/fail without complex tooling
- wc -l for TC-AC5: line count is the most direct measurement of the 200-line constraint -- avoids indirect proxies like byte count or section count
- two TCs for AC-2: agent delegation and MCP parameters are tested independently -- a failure in one should not mask the status of the other
- two TCs for AC-4: threshold and separator are tested with different grep patterns -- allows pinpointing which sub-rule is missing if one fails
- concrete expected value text unique per TC: each TC describes a distinct verification outcome -- prevents ambiguity when comparing actual results to expectations

## artifacts

- acTcMapping: 5 ACs mapped to 7 TCs with full coverage
- tcDefinitions: 7 test cases with precondition, command, and expected value

## next

- phase: test_impl
- input: TC definitions from this document are implemented as executable verification commands
