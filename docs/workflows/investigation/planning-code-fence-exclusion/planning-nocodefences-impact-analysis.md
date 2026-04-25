# P4 Planning Phase: Code Fence Exclusion Impact Analysis

## TOON Summary

```
phase_config_type_location: workflow-harness/mcp-server/src/state/types-core.ts L154-L171
phase_config_fields: name, stage, model, inputFiles, outputFile, requiredSections, minLines, allowedExtensions, bashCategories, dodChecks, dodExemptions, inputFileModes, approvalRequired, parallelGroup, dependencies, allowedTools
planning_dod_checks_current: [] (empty array - no custom DoD checks defined)
l4_content_phase_branching: none - dod-l4-content.ts applies uniform checks (forbidden patterns, bracket placeholders, duplicate lines, TOON keys, MD sections) to ALL phases without phase-specific branching
nocodefences_impact: adding noCodeFences boolean to PhaseConfig requires type change in types-core.ts and consumer update in dod-l4-content.ts only; no other phase affected unless they opt in
workflow_phases_planning_section: "Technical spec. Register F-NNN via harness_add_rtm. Output: planning.md. DoD: L1 exists, L3 >= 40 lines, L4 F-NNN with spec."
user_experience_impact: planning subagent that includes code examples (``` blocks) in planning.md would be rejected at DoD gate; requires re-submission without code fences
```

## Detailed Analysis

### 1. PhaseConfig Type (types-core.ts L154-L171)

Current fields (17 total):
- name, stage, model (identity)
- inputFiles, outputFile (I/O)
- requiredSections, minLines (content validation)
- allowedExtensions, bashCategories (permission)
- dodChecks, dodExemptions (quality gates)
- inputFileModes (context compression)
- approvalRequired, parallelGroup, dependencies (flow control)
- allowedTools (tool permissions)

No existing field handles content format restrictions (e.g., code fence prohibition). A new `noCodeFences?: boolean` field is a clean addition with no breaking changes (optional field, defaults to undefined/false).

### 2. Planning DoD Checks (registry.ts L26)

Current: `dodChecks: []` -- completely empty. No custom validation runs for planning phase beyond the universal L4 content checks (forbidden patterns, placeholders, duplicates, required MD sections).

Adding a code fence check requires either:
- (A) Adding an entry to `dodChecks` array in registry.ts (phase-specific)
- (B) Adding flag-based branching in `dod-l4-content.ts` (flag-driven)

Option B is cleaner: read `noCodeFences` from PhaseConfig and add a check in `checkL4ContentValidation`.

### 3. L4 Content Validation (dod-l4-content.ts)

Current flow (no phase branching):
1. Resolve outputFile from PhaseConfig
2. Check forbidden patterns (universal)
3. Check bracket placeholders (universal)
4. Check duplicate lines (skip .mmd)
5. Check TOON keys (only .toon)
6. Check MD sections (only .md)

No phase-specific branching exists. Adding code fence detection:
- Pattern: `/^```/m` in content
- Location: after step 3 (bracket placeholders), gated by `config.noCodeFences === true`
- Impact: only planning phase would trigger (no other phase sets this flag)

### 4. Workflow-phases.md Planning Section

Current description is minimal: "Technical spec. Register F-NNN via harness_add_rtm."
No mention of code fence restrictions. Adding a note like "Code examples (code fences) are prohibited; describe implementations in prose" would be needed.

### 5. User Experience Impact

Scenarios where code fences appear in planning.md:
- LLM includes TypeScript snippets to illustrate implementation approach
- LLM copies existing code from research phase as reference
- LLM writes pseudo-code for algorithm description

Impact: DoD gate rejects planning.md, subagent must rewrite without code fences. This is intentional -- planning phase should describe WHAT to implement, not HOW (code belongs in implementation phase).

Risk: Mermaid code blocks (```mermaid) would also be rejected. Consider exempting mermaid blocks or documenting that diagrams go in state_machine/flowchart phases only.

### 6. Change Scope Summary

Files requiring modification:
1. `types-core.ts` -- add `noCodeFences?: boolean` to PhaseConfig interface (1 line)
2. `registry.ts` -- add `noCodeFences: true` to planning entry (1 line)
3. `dod-l4-content.ts` -- add code fence check gated by flag (5-8 lines)
4. `workflow-phases.md` -- add note to planning section (1 line)
5. `defs-stage2.ts` -- optionally update subagentTemplate to mention restriction

No impact on other phases. No breaking changes to existing behavior.
