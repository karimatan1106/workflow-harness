# Docs Update — fix-hook-layer-detection

## summary

The docs_update phase records the architectural decision behind the
`detectLayer` correction by authoring ADR-030. The new ADR captures the Context
(opaque agent_id in Claude Code hook schema vs. name-based matching), the
Decision (agent_id presence implies worker layer, HARNESS_LAYER env overrides
for coordinator), Rationale grounded in ADR-001's determinism requirement, and
Alternatives considered (name-matching, env-only, parent-PID heuristic — all
rejected with reasons). Cross-references point to phase docs under
`docs/workflows/fix-hook-layer-detection/`, the `.agent/` investigation files,
and the regression test that locks the invariant. No CLAUDE.md modification is
warranted because existing hook rules already cover tool-delegation and
deterministic-gate invariants at the policy layer; ADR-030 sits under the Why
layer (see ADR-004/ADR-005 documentation-layers rule) and does not require
rule-text changes.

## artifacts changed

- ADR-030 (new): `C:\ツール\Workflow\docs\adr\ADR-030-hook-layer-detection.md`
- No CLAUDE.md change — existing hook rules (`.claude/rules/tool-delegation.md`,
  `.claude/rules/core-constraints.md`) already encode the deterministic-gate
  and 2-layer-delegation invariants at the normative layer. ADR-030 provides
  the Why-layer record and the regression suite encodes the How-layer contract.

## decisions

- D-001: ADR-030 authored. The Why layer now has an immutable record of the
  `agent_id`-presence-implies-worker decision, matching the house style
  demonstrated by ADR-028 and ADR-001 (Status / Date / Context / Decision /
  Rationale / Consequences / Alternatives / References / Notes sections).
- D-002: No CLAUDE.md change needed. The top-level project instructions and
  the `.claude/rules/*.md` files already define the normative constraints that
  ADR-030 reasons about; editing CLAUDE.md would duplicate content across
  documentation layers and violate ADR-004/ADR-005.
- D-003: Advance to deploy. All docs_update acceptance criteria are satisfied —
  the ADR exists, cross-links are consistent, and no rule files require
  revision. The next phase is `deploy`.
- D-004: Phase docs remain under `docs/workflows/fix-hook-layer-detection/`.
  The task's 30-phase artifacts are preserved in-tree under the canonical
  location used by the harness; no reorganisation or relocation is performed
  during docs_update.
- D-005: Cross-reference to `.agent/` investigation files preserved. ADR-030
  explicitly cites `.agent/hook-state-bug-analysis.md` and
  `.agent/tdd-red-green-proof.md` so future readers can trace the Why back to
  the original investigation transcripts and the Red/Green TDD proof.

## artifacts

Primary outputs of this phase:

1. `C:\ツール\Workflow\docs\adr\ADR-030-hook-layer-detection.md` (new ADR)
2. `C:\ツール\Workflow\docs\workflows\fix-hook-layer-detection\docs-update.md` (this document)

Prior phase docs live under `docs/workflows/fix-hook-layer-detection/` and
comprise the following filenames produced by earlier phases: hearing.md,
scope-definition.md, research.md, impact-analysis.md, requirements.md,
threat-model.md, planning.md, ui-design.md, design-review.md, test-design.md,
test-selection.md, implementation.md, refactoring.md, build-check.md,
code-review.md, testing.md, regression-test.md, acceptance-report.md,
manual-test.md, security-scan.md, performance-test.md, and e2e-test.md.

Supporting investigation records outside the phase directory:

* `.agent/hook-state-bug-analysis.md`
* `.agent/tdd-red-green-proof.md`

## next

Advance to `deploy`. The docs_update phase has recorded the architectural
decision immutably under `docs/adr/ADR-030-hook-layer-detection.md` and this
phase document under `docs/workflows/fix-hook-layer-detection/docs-update.md`.
The `deploy` phase will handle any remaining release-side tasks for the hook
fix (submodule pointer bump, tagging, or rollout verification as applicable),
after which the harness will close out the 30-phase run with all gates
satisfied.
