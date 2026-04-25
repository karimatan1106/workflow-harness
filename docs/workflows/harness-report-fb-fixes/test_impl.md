phase: test_impl
task: harness-report-fb-fixes
status: complete
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/test-design.md, docs/workflows/harness-report-fb-fixes/test-selection.md

## testFiles

| File | Action | TCs |
|---|---|---|
| delegate-coordinator-readonly.test.ts | new | TC-AC1-01, TC-AC1-02, TC-AC1-03 |
| dod-extended.test.ts | append | TC-AC2-01, TC-AC2-02, TC-AC2-03, TC-AC2-04 |
| manager-write-rtm.test.ts | new | TC-AC3-01, TC-AC3-02, TC-AC3-03 |
| manager-lifecycle-reset.test.ts | append | TC-AC4-01, TC-AC4-02, TC-AC4-03 |

## tddRedResults

| TC ID | Status | Expected Fail Reason |
|---|---|---|
| TC-AC1-01 | FAIL | buildAllowedTools does not filter Write/Edit for readonly bashCategories |
| TC-AC2-01 | FAIL | isStructuralLine lacks test case ID regex pattern |
| TC-AC2-02 | FAIL | isStructuralLine lacks list-prefixed test case ID regex |
| TC-AC2-03 | FAIL | isStructuralLine lacks uppercase prefix ID regex |
| TC-AC3-02 | FAIL | applyAddRTM only pushes, does not upsert existing IDs |
| TC-AC4-01 | FAIL | goBack does not clear artifactHashes |
| TC-AC1-02 | PASS | Mixed categories correctly include Write/Edit |
| TC-AC1-03 | PASS | planOnly double exclusion works (idempotent) |
| TC-AC2-04 | PASS | Plain text correctly returns false |
| TC-AC3-01 | PASS | New ID push works correctly |
| TC-AC3-03 | PASS | applyUpdateRTMStatus works on pushed entry |
| TC-AC4-02 | PASS | goBack retryCount clear (regression guard) |
| TC-AC4-03 | PASS | goBack completedPhases slice (regression guard) |

## evidence

- TDD Red Evidence: .agent/tdd-red-evidence.md
- 6 tests FAIL, 29 tests PASS (35 total across 4 files)
- All failures map to unimplemented FB fixes (FB-1/2/4/6)

## artifacts

- workflow-harness/mcp-server/src/__tests__/delegate-coordinator-readonly.test.ts (new)
- workflow-harness/mcp-server/src/__tests__/manager-write-rtm.test.ts (new)
- workflow-harness/mcp-server/src/__tests__/dod-extended.test.ts (modified)
- workflow-harness/mcp-server/src/__tests__/manager-lifecycle-reset.test.ts (modified)
- .agent/tdd-red-evidence.md (new)
- docs/workflows/harness-report-fb-fixes/test_impl.md (this file)

## next

implementationフェーズでFB-1/2/4/6の修正を実装し、6件のfailテストを全てpassさせる。
