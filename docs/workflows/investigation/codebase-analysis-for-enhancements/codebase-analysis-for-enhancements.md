# Codebase Analysis: Files Relevant to P1-P4 Enhancements

Analysis date: 2026-03-28
Purpose: Map existing file structures to planned enhancements P1(assumption tags), P2(code_review separation), P3(AI slop patterns), P4(planning code example exclusion).

---

## File 1: workflow-harness/CLAUDE.md

- Path: C:\ツール\Workflow\workflow-harness\CLAUDE.md
- Lines: 37
- Structure: Mission, What (.claude/rules/), How (skill files), Why (docs/adr/), Cross-Platform Agent Discovery
- P1 relevance: No assumption tag mechanism referenced. Rules link to .claude/rules/ and skill files.
- P2 relevance: No code_review-specific logic. Phase routing is in skill files.
- P3 relevance: Forbidden words listed in .claude/rules/forbidden-actions.md (12 words). No AI slop pattern detection.
- P4 relevance: No planning-specific content. Planning defined in skill files.
- Key: This is a thin routing document. All substantive rules are in skill files and .claude/rules/.

---

## File 2: .claude/skills/workflow-harness/workflow-rules.md

- Path: C:\ツール\Workflow\.claude\skills\workflow-harness\workflow-rules.md
- Lines: 113
- Sections:
  - Section 1 "AI Directives (23 Rules)" lines 7-31
  - Section 2 "Prohibited Actions (22 Rules)" lines 35-58
  - Section 3 "Retry Protocol" lines 62-74
  - Section 4 "Completion Language" lines 78-87
  - Section 5 "Artifact Quality" lines 91-98
  - Section 6 "Bash Categories" lines 102-113
- P1 relevance (assumption tags):
  - Line 96: delta entry categories include "assumption" as a valid category
  - No dedicated assumption tagging mechanism exists
  - No forced assumption surfacing or tracking. Gap identified.
- P2 relevance (code_review separation):
  - Directive 18 (line 18): code_review must report design-implementation diff
  - Prohibited action 18 (line 48): implement without reading all design docs
  - No separation between self-review and design-review. Single code_review phase handles both.
- P3 relevance (AI slop patterns):
  - Line 93: 12 forbidden words defined (TODO, TBD, WIP, FIXME, etc.)
  - Line 97: L4 check for 3+ identical non-structural lines
  - Line 54: bracket placeholder ban
  - No AI-specific slop patterns (hedge words, filler phrases, over-qualification). Gap identified.
- P4 relevance (planning code example exclusion):
  - No explicit rule about code examples in planning phase. Gap identified.

---

## File 3: .claude/skills/workflow-harness/workflow-gates.md

- Path: C:\ツール\Workflow\.claude\skills\workflow-harness\workflow-gates.md
- Lines: 63
- Sections:
  - Section 1 "Control Levels (L1-L4)" lines 7-15
  - Section 2 "DoD Gate Checks by Phase" lines 19-47
  - Section 3 "User Intent Policy (UI-1 through UI-7)" lines 49-56
  - Section 4 "Orchestrator Direct Edit Policy" lines 58-63
- P1 relevance: No assumption-related gate checks exist. No L4 check for assumption tags.
- P2 relevance: code_review DoD (line 41): L1 file exists, L3 >= 30 lines, L4 AC table zero failures. Single gate.
- P3 relevance: Common checks (line 23): L4 no forbidden patterns, no brackets, no 3+ duplicate lines. Structural only.
- P4 relevance: Planning DoD (line 32): L1 exists, L3 >= 40 lines, L4 F-NNN with spec. No code fence check.

---

## File 4: .claude/skills/workflow-harness/workflow-phases.md

- Path: C:\ツール\Workflow\.claude\skills\workflow-harness\workflow-phases.md
- Lines: 79
- Key sections:
  - planning definition (line 26-27): Technical spec with F-NNN. No code example prohibition.
  - code_review definition (line 52): opus model, 4 required sections, approve gate.
- P1: research phase (line 14) mentions assumptions in intent analysis but no structured tagging.
- P2: code_review is single phase with 4 sections. No structural separation.
- P3: No AI slop detection in any phase.
- P4: planning says "Technical spec" but does not prohibit code examples.

---

## File 5: delegate-coordinator.ts and related code

- Path: C:\ツール\Workflow\workflow-harness\mcp-server\src\tools\handlers\delegate-coordinator.ts
- Lines: 198
- Related files:
  - handler-shared.ts (116 lines): PHASE_APPROVAL_GATES, USER_APPROVAL_REQUIRED, buildPhaseGuide, SKILL_FILE_ROUTING
  - coordinator-prompt.ts (90 lines): buildAllowedTools, buildCoordinatorPrompt, buildCmdArgs
  - registry.ts (157 lines): PHASE_REGISTRY with all 32 phase configs
- P2 relevance:
  - handler-shared.ts line 23: code_review mapped to approval gate "code_review"
  - handler-shared.ts line 34: code_review is Claude self-approval (USER_APPROVAL_REQUIRED = false)
  - handler-shared.ts line 48: code_review in parallel_quality group with build_check
  - registry.ts line 42: code_review config: model=opus, stage=8, requiredSections=[decisions,artifacts,next], minLines=30, allowedExtensions=[.md], bashCategories=[readonly]
- P4 relevance: planning config (registry.ts line 26): allowedExtensions=[.md,.mmd]. Code fences within .md not blocked.

---

## Gap Summary for P1-P4

| Enhancement | Current State | Gap |
|-------------|--------------|-----|
| P1: Assumption tags | 1 of 7 delta entry categories (rules L96). No forced surfacing, no gate, no tracking. | Need L4 gate check + tracking mechanism |
| P2: code_review separation | Single phase (registry L42, phases L52). Self-approval. 4 sections. | Need sub-phase split or structured section validation |
| P3: AI slop patterns | 12 forbidden words + structural checks only. | Need L4 regex for hedge words, filler, over-qualification |
| P4: Planning code exclusion | .md/.mmd allowed. Code fences in .md unchecked. | Need L4 code fence detection in planning.md |

---

## Key Line References for Implementation

- workflow-rules.md L93-98: Artifact Quality (extend for P3)
- workflow-rules.md L96: Delta entry categories (extend for P1)
- workflow-gates.md L19-47: DoD Gate Checks table (add for P1, P3, P4)
- workflow-gates.md L32: Planning DoD (add code fence check for P4)
- workflow-gates.md L41: code_review DoD (restructure for P2)
- workflow-phases.md L52: code_review definition (restructure for P2)
- workflow-phases.md L26-27: planning definition (add exclusion for P4)
- registry.ts L42: code_review PhaseConfig (modify for P2)
- registry.ts L26: planning PhaseConfig (add dodChecks for P4)
- handler-shared.ts L23: PHASE_APPROVAL_GATES (modify if P2 splits phases)
