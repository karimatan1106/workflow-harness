:toon hearing v1
:summary Improve harness first-pass rate by adding phase output rules to coordinator.md, edit safeguards to worker.md, and baseline/RTM reminders to phase templates

userResponse: Q1=A(coordinator.mdにインライン追加), Q2=A(Worker edit all-or-nothing), Q3=A(implementationテンプレートにbaseline), Q4=A(implementation+code_reviewにRTM), Q5=A(4ファイル限定)

:section intent-analysis
:surfaceRequest Add coordinator delegation rules, Worker edit safeguards, and baseline/RTM procedure reminders to reduce retry rate from 29% to near-zero
:deepNeed Reduce wasted time from DoD retry loops caused by three root causes: (1) coordinator not conveying phase-specific output format requirements, (2) Worker silently dropping edits, (3) missing baseline/RTM lifecycle steps
:unclearPoints [4]
  - coordinator.md vs separate file vs template embedding for phase output rules
  - Worker edit safeguard strategy (all-or-nothing vs count verification)
  - baseline capture timing (implementation phase vs testing phase)
  - RTM update scope (implementation+code_review vs code_review only)
:assumptions [3]
  - Changes target coordinator.md, worker.md, and defs-stage4.ts/defs-stage5.ts (submodule files)
  - The 200-line limit per file is respected (coordinator.md at 38 lines has ample headroom)
  - Existing subagentTemplate format (TOON skeleton + Markdown body) remains unchanged

:section implementation-plan
:approach Three-pronged fix targeting each root cause independently
:estimatedScope small -- approximately 25 lines added across 4 files
:risks [2]
  - coordinator.md rule additions may conflict with workflow-delegation.md Phase Parameter Table (mitigate: cross-reference and keep consistent)
  - defs-stage4.ts changes require submodule commit (mitigate: standard submodule workflow)

## decisions
- phase-output-rules-location: coordinator.md inline -- closest to delegation context, coordinator always reads it without extra file loads, grows from 38 to ~50 lines which is well within 200-line limit
- edit-safeguard-strategy: worker.md all-or-nothing rule -- add "apply all N edits or report FAIL; never silently skip" rule, simpler than count-verification and catches the root cause
- baseline-capture-timing: add instruction to implementation phase template (defs-stage4.ts) -- fixes sequencing issue where baseline instruction was only in testing phase (stage 5, after implementation), keep existing testing phase note for redundancy
- rtm-update-phases: add harness_update_rtm_status reminders to both implementation and code_review templates -- implementation sets "implemented", code_review sets "verified", covers full RTM lifecycle
- change-scope-boundary: limit changes to coordinator.md, worker.md, defs-stage4.ts, defs-stage5.ts only -- do not modify defs-stage0.ts through defs-stage3.ts since those phases did not exhibit retry failures

## artifacts
- C:\ツール\Workflow\.claude\agents\coordinator.md -- add Phase Output Rules section (~12 lines)
- C:\ツール\Workflow\.claude\agents\worker.md -- add Edit Completeness rule (~3 lines)
- C:\ツール\Workflow\workflow-harness\mcp-server\src\phases\defs-stage4.ts -- add baseline capture and RTM update instructions to implementation and code_review templates (~6 lines total)
- C:\ツール\Workflow\workflow-harness\mcp-server\src\phases\defs-stage5.ts -- keep existing baseline note, no changes needed

## next
:criticalDecisions coordinator.md gets inline phase rules; worker.md gets all-or-nothing edit rule; baseline instruction moves to pre-implementation; RTM reminders added to implementation and code_review
:readFiles .claude/agents/coordinator.md, .claude/agents/worker.md, workflow-harness/mcp-server/src/phases/defs-stage4.ts, .claude/skills/workflow-harness/workflow-delegation.md
:warnings submodule files (defs-stage4.ts) require separate commit in workflow-harness submodule before parent repo commit
