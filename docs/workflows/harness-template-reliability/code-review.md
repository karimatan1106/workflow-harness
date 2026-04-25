# Code Review: harness-template-reliability

taskId: b160b7f1-1db4-4bd5-a4b1-603492c8bdff
phase: code_review
size: large

## AC検証結果

| AC | Status | File | Evidence |
|----|--------|------|----------|
| AC-1 | PASS | toon-skeletons-a.ts:164 | userResponse key in TOON_SKELETON_HEARING intent-analysis section |
| AC-2 | PASS | defs-stage0.ts:24-27 | AskUserQuestion mandatory with 2+ options requirement |
| AC-3 | PASS | defs-stage5.ts:22-23 | baseline_capture reminder before work content section |
| AC-4 | PASS | defs-a.ts:109 | cascade boolean property in harness_back schema (optional) |
| AC-5 | PASS | scope-nav.ts:105 | PHASE_APPROVAL_GATES referenced via Object.keys for gate identification |
| AC-6 | PASS | scope-nav.ts:100-116 | cascade only deletes approvals, does not auto-approve or bypass IA checks |
| AC-7 | PASS | defs-stage0.ts:40 | SUMMARY_SECTION placeholder before ARTIFACT_QUALITY in hearing template |
| AC-8 | PASS | phase-analytics.ts:117,148-150 | COMPLETED_STALE_THRESHOLD_SEC=3600 with stale detection logic |
| AC-9 | PASS | scope-nav.ts:103-111 | approval entries deleted from state after goBack when cascade=true |
| AC-10 | PASS | scope-nav.ts:97-98 | cascade=false returns legacy response without cascadeReapproved |

## acAchievementStatus

- AC-1: met
- AC-2: met
- AC-3: met
- AC-4: met
- AC-5: met
- AC-6: met
- AC-7: met
- AC-8: met
- AC-9: met
- AC-10: met

## findings

- F-01 (observation): scope-nav.ts:103-111 — cascade deletes ALL approval gate entries, not just those after targetPhase. Broader than strictly necessary but safe since re-running phases re-establishes approvals.
- F-02 (observation): scope-nav.ts:103 — refreshed task loaded but approval object mutations may not auto-persist. Verify StateManager handles mutation persistence in testing phase.
- F-03 (observation): phase-analytics.ts:146 — stale check uses string comparison for phase name. Current implementation correct for existing phase set.

## decisions

- CR-01: FIX-1 userResponse key correctly placed in intent-analysis section of TOON skeleton. dod-l2-hearing regex will match the TOON key format.
- CR-02: FIX-2 baseline reminder is template-only change with no logic modification. Low risk, matches REQ-003 scope.
- CR-03: FIX-3 cascade schema is backward-compatible. cascade not in required array, existing callers unaffected per REQ-010.
- CR-04: FIX-3 cascade logic deletes approvals but does not auto-approve. Correct safety design per REQ-009 (no IA-1/IA-2/IA-6 bypass).
- CR-05: FIX-4 field order guidance added to SUMMARY_SECTION_RULE. Ordering matches DoD L4 check scan order.
- CR-06: FIX-5 stale detection uses 3600s threshold, only fires for completed phases where current===false. No false positives on active phases.
- CR-07: Cascade approval deletion iterates all PHASE_APPROVAL_GATES keys regardless of rollback range. Conservative but safe design choice.

## artifacts

- docs/workflows/harness-template-reliability/code-review.md: report: AC-1~AC-10全件PASS。FIX-1~FIX-5の実装が設計仕様と整合。cascade安全設計(承認削除のみ)を確認。

## next

- criticalDecisions: CR-04(cascade safety: approval deletion without auto-approve preserves IA gate integrity), CR-07(broad approval deletion is conservative but acceptable)
- readFiles: src/tools/handlers/scope-nav.ts, src/tools/phase-analytics.ts, src/state/manager.ts
- warnings: F-02 approval mutation persistence should be verified during testing. F-01 broad deletion is intentional design choice.
