## テストシナリオ

Scenario MT-1: Template structure verification
- Verify workflow-delegation.md has 3 template types (coordinator, worker-write, worker-verify)
- Each template has 4 layers: Why, What, How, Constraints
- Result: PASS - coordinator template at lines 13-37, worker-write at lines 39-62, worker-verify at lines 64-88

Scenario MT-2: Parameter table completeness
- Verify parameter table covers all delegation phases (23 phases)
- Each row has Phase, Template, Role, Required Sections, Common Failures
- Result: PASS - table at lines 92-117, 23 rows, all columns populated

Scenario MT-3: Stage Why propagation
- Verify workflow-phases.md has Why line for each of 8 stages
- Why lines are actionable (state what to prevent, not just describe)
- Result: PASS - 8 Why lines found, each follows pattern "verb + prevention target"

Scenario MT-4: Prompt Contract consistency
- Verify coordinator.md, worker.md, hearing-worker.md all have identical Prompt Contract section
- Each references workflow-delegation.md
- Result: PASS - all 3 files contain "## Prompt Contract" referencing workflow-delegation.md 4-layer structure

Scenario MT-5: Failure pattern coverage
- Verify 5 specific failure patterns from evaluation reports are reflected
- decisions missing, tdd_red_evidence API misuse, duplicate lines, TOON/Markdown mismatch, required section missing
- Result: PASS - all 5 patterns found in Common Constraints or parameter table Common Failures column

Scenario MT-6: 200-line limit compliance
- Check all 6 files: delegation(125), phases(86), coordinator(43), worker(62), hearing-worker(32), tool-delegation(9)
- Result: PASS - maximum 125 lines, all under 200

## テスト結果

All 6 scenarios PASS. No issues found. Template structure is complete, consistent across files, and reflects all required failure patterns.

## decisions

- MT verification scope: manual structural review sufficient for Markdown-only changes -- no runtime behavior to test
- Template usability: 4-layer structure provides clear delegation guidance via placeholder syntax ({phase}, {taskId}, etc.) -- reduces ambiguity for subagents
- Cross-file consistency: identical Prompt Contract in 3 agent files is acceptable -- agent definitions don't support includes/imports
- Failure pattern granularity: common failures differentiated per phase in parameter table -- prevents DoD duplicate-line detection issues
- 200-line compliance margin: largest file at 125 lines leaves 75-line buffer -- sufficient for future template additions

## artifacts

| # | file | status |
|---|------|--------|
| 1 | docs/workflows/agent-delegation-prompt-templates/manual-test.md | new |

## next

- security_scan phase
