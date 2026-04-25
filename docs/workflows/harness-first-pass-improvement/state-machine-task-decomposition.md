# Task Decomposition: state_machine Phase

## Phase Objective
Generate Mermaid state-machine diagram and update agent role definitions with phase output rules and edit completeness rules.

## Analysis Summary

### Task 1: Generate state-machine.mmd (NEW FILE)
**Scope**: Create Mermaid state diagram for Coordinator-Worker-Phase execution flow
**Requirements**:
- Minimum 15 lines
- Section: %% decisions (5+ entries in %% - SM-NNN: format)
- Include: orchestrator task decomposition → coordinator analysis → worker edit → phase execution (test_impl → implementation → refactoring → build_check → code_review)
- Clear state names: "Orchestrator: Task Decompose", "Coordinator: Analyze", "Worker: Edit", "Phase: test_impl", etc.

**Outputs**:
- C:\ツール\Workflow\docs\workflows\harness-first-pass-improvement\state-machine.mmd

---

### Task 2: Edit coordinator.md (ADD SECTION)
**Target File**: C:\ツール\Workflow\.claude\agents\coordinator.md
**Location**: After "## Context Handoff" section
**New Section**: "## Phase Output Rules"
**Content**: Coordinator output file conventions
- File placement rules (docs/workflows/ directory)
- File extension rules (.md for structured/analysis, .toon for internal state)
- Documentation requirements per file type

**Outputs**:
- C:\ツール\Workflow\.claude\agents\coordinator.md (updated)

---

### Task 3: Edit worker.md (ADD SECTION)
**Target File**: C:\ツール\Workflow\.claude\agents\worker.md
**Location**: After "## Edit Modes" section
**New Section**: "## Edit Completeness Rule"
**Content**: Worker edit-preview mode compliance
- edit-auth.txt registration requirement (one path per line, append mode)
- Multi-file edit checklist
- Orchestrator dependency (hook validation before Edit tool)

**Outputs**:
- C:\ツール\Workflow\.claude\agents\worker.md (updated)

---

### Task 4: Edit defs-stage4.ts (ADD CONTENT)
**Target File**: C:\ツール\Workflow\workflow-harness\mcp-server\src\phases\defs-stage4.ts
**Location 4A**: implementation phase → subagentTemplate (after @spec comment block)
**Addition 4A**: Section with baseline capture instructions
- Section header: "★必須: baseline capture & RTM baseline"
- Content: harness_capture_baseline call rule, baseline artifact requirements

**Location 4B**: code_review phase → subagentTemplate (before exit rule section)
**Addition 4B**: Section with RTM verification instructions
- Section header: "★必須: RTM verification"
- Content: RTM F-NNN update/registration rule, verification checklist

**Outputs**:
- C:\ツール\Workflow\workflow-harness\mcp-server\src\phases\defs-stage4.ts (updated, ≤200 lines)

---

## Task Execution Order
Tasks can be executed in parallel since they target independent files:
- **Parallel Group 1**: Task 1 (new file), Task 2 (coordinator.md), Task 3 (worker.md)
- **Parallel Group 2**: Task 4 (defs-stage4.ts) — can start after Group 1 is ready

---

## Acceptance Criteria Decomposition

### AC-1: state-machine.mmd Quality
- [ ] File exists at output path
- [ ] Minimum 15 lines
- [ ] Contains %% decisions section with ≥5 %% - SM-NNN: entries
- [ ] States include all required layers (Orchestrator, Coordinator, Worker, Phase)
- [ ] Transitions show complete flow: decomposition → analysis → edit → phases

### AC-2: coordinator.md Phase Output Rules
- [ ] "## Phase Output Rules" section added after Context Handoff
- [ ] Includes file placement rules
- [ ] Includes extension rules (.md vs .toon)
- [ ] Includes per-file-type documentation requirements

### AC-3: worker.md Edit Completeness Rule
- [ ] "## Edit Completeness Rule" section added after Edit Modes
- [ ] Includes edit-auth.txt registration requirement
- [ ] Includes multi-file edit checklist
- [ ] Includes hook-gated dependencies

### AC-4: defs-stage4.ts Baseline/RTM Updates
- [ ] implementation phase has "★必須: baseline capture & RTM baseline" section
- [ ] code_review phase has "★必須: RTM verification" section
- [ ] File remains ≤200 lines
- [ ] Content follows existing template style

---

## Traceability (Requirements → Artifacts)
- F-100: state_machine diagram generation → state-machine.mmd
- F-101: coordinator output convention → coordinator.md (Phase Output Rules)
- F-102: worker edit completeness → worker.md (Edit Completeness Rule)
- F-103: baseline/RTM procedure → defs-stage4.ts (both additions)

---

## Dependencies
- No external dependencies between tasks
- All edits are additive (no conflicts)
- File size constraints: defs-stage4.ts must remain ≤200 lines

---

## Exit Criteria
All 4 tasks completed + artifact quality meets AC-1 to AC-4.
