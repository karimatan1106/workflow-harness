## 更新対象

### 変更済みファイル (このタスクで実施)

| # | file | change type | description |
|---|------|------------|-------------|
| 1 | .claude/skills/workflow-harness/workflow-delegation.md | new | 4-layer delegation templates (coordinator/worker-write/worker-verify) + 23-phase parameter table |
| 2 | .claude/skills/workflow-harness/workflow-phases.md | edit | Added 8 stage-level Why statements (1 per Stage 0-7) |
| 3 | .claude/agents/coordinator.md | edit | Added Bash to tools, added Prompt Contract section |
| 4 | .claude/agents/worker.md | edit | Added Bash to tools, added Prompt Contract section |
| 5 | .claude/agents/hearing-worker.md | edit | Fixed hearing.toon to hearing.md, added Prompt Contract section |
| 6 | .claude/rules/tool-delegation.md | edit | Added delegation template reference line |

### 更新不要 (notInScope)

| item | reason |
|------|--------|
| SKILL.md File Index | workflow-delegation.md needs to be added to File Index, but this is out of scope per requirements.md notInScope |
| SKILL.md File Routing | delegation.md needs routing entry, but out of scope per requirements.md |
| workflow-execution.md | Existing subagent context section overlaps with delegation.md, but responsibility separation is a separate task per requirements.md |
| workflow-orchestrator.md | Template Rules section may need alignment, but deferred per requirements.md (R-4 risk) |
| README.md | No user-facing changes |
| CHANGELOG.md | Will be updated at commit phase |

### ADR

No new ADR created for this task. The 4-layer template structure is a How-level implementation detail of the existing delegation protocol. The Why (reducing DoD retries by giving Workers clear success criteria) is already captured in the evaluation reports and requirements.md deep intent.

## 変更内容

The 4-layer delegation template system provides structured prompts for all coordinator/worker/hearing-worker delegations:
- Why layer: stage-level purpose from workflow-phases.md + phase-specific supplements
- What layer: output file, required sections, content descriptions from parameter table
- How layer: numbered steps with tools and file paths
- Constraints layer: scope limits, forbidden actions, quality rules, prior failure patterns

This addresses the root cause identified in 3 harness evaluation reports: "Workers did not know what to write", leading to 5+ DoD retries on phases like test_design.

## decisions

- ADR creation: not needed for this change -- 4-layer template is a How-level implementation, not an architectural decision requiring Why documentation. The decision to use structured delegation is implicit in the existing Rule 5 ("use server templates")
- SKILL.md updates: deferred to separate task -- requirements.md explicitly lists File Index and File Routing as notInScope to prevent scope creep
- workflow-execution.md cleanup: deferred -- responsibility separation between execution.md and delegation.md requires careful analysis to avoid breaking existing references
- CHANGELOG entry: deferred to commit phase -- standard practice for this repository
- Permanent vs temporary docs: all workflow artifacts in docs/workflows/ are temporary (.gitignore). The 6 changed files in .claude/ are the permanent deliverables

## artifacts

| # | file | status |
|---|------|--------|
| 1 | docs/workflows/agent-delegation-prompt-templates/docs-update.md | new |

## next

- commit phase
