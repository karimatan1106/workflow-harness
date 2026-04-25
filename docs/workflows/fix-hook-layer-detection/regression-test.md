# Regression Test — fix-hook-layer-detection

## Summary

Ran the full workflow-harness test suite plus the hook-specific node test runner to confirm
this task's code changes (hooks layer-detection fix in `pre-tool-gate.sh` / related
`mcp-server` plumbing) introduce zero new regressions. Baseline delta is 0: the 10 failing
tests observed are identical to the pre-existing failures already catalogued in
`build-check.md` D-004 (hearing-worker.md minimal rewrite + coordinator.md / worker.md
phase-output rule removal predate this task and are documented as out-of-scope).

Dedicated hook tests (`hooks/__tests__/tool-gate.test.js`) pass 10/10 with exit code 0,
directly exercising the layer-detection logic touched by this task.

## Commands Run

- `npm test --prefix C:/ツール/Workflow/workflow-harness`
- `node --test C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js`

## Output

### vitest tallies (npm test)

```
 Test Files  2 failed | 101 passed (103)
      Tests  10 failed | 854 passed (864)
   Start at  00:44:19
   Duration  7.15s
```

### node --test tallies (tool-gate.test.js)

```
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# duration_ms 62.3112
```

All 10 TC-AC* cases (TC-AC1-01/02, TC-AC2-01/02, TC-AC3-01/02/03, TC-AC4-01/02, TC-AC5-01)
returned `ok`. Exit code 0.

### Failing test names (vitest) — baseline capture

- `first-pass-improvement.test.ts > AC-1 > TC-AC1-01: Phase Output Rules section exists`
- `first-pass-improvement.test.ts > AC-1 > TC-AC1-02: decisions quantitative rule (5 or more)`
- `first-pass-improvement.test.ts > AC-1 > TC-AC1-03: artifacts enumeration rule`
- `first-pass-improvement.test.ts > AC-1 > TC-AC1-04: next field must not be empty`
- `first-pass-improvement.test.ts > AC-2 > TC-AC2-01: Edit Completeness section exists`
- `first-pass-improvement.test.ts > AC-2 > TC-AC2-02: partial application prohibition`
- `first-pass-improvement.test.ts > AC-2 > TC-AC2-03: all-or-nothing principle`
- `hearing-worker-rules.test.ts > TC-AC1-01: confirmation-only prohibition rule exists`
- `hearing-worker-rules.test.ts > TC-AC2-01: 2+ substantively different approaches required`
- `hearing-worker-rules.test.ts > TC-AC3-01: merit and demerit required for each option`

## Baseline Delta

Pre-existing failures enumerated in `build-check.md` D-004:

- `hearing-worker-rules.test.ts` (3 cases) — hearing-worker.md was rewritten to a minimal
  prompt and no longer contains prose-level prohibition/options/merit phrases the assertions
  regex-match for. Out-of-scope per D-004.
- `first-pass-improvement.test.ts` (7 cases) — coordinator.md and worker.md were
  restructured and the Phase Output Rules / Edit Completeness sections those assertions
  expect are not present in the current agent prompts. Out-of-scope per D-004.

Delta vs. baseline: **0 new failures, 0 newly passing**. All 10 failures match the
pre-existing set exactly by file, describe block, and test name. None of the 864 passing
tests regressed. Hook-layer tests (10/10) directly validate the code path modified by this
task and all pass.

## Decisions

- **D-001**: Baseline delta = 0 new failures. The 10 vitest failures match the documented
  pre-existing set (build-check.md D-004) one-for-one; this task's hook changes neither
  caused nor masked any of them.
- **D-002**: Hook changes do not break existing behavior. `tool-gate.test.js` 10/10 green,
  vitest green test count (854) unchanged vs. baseline recorded in build-check.md.
- **D-003**: Scope adherence preserved. Out-of-scope hearing-worker-rules and
  first-pass-improvement failures are not triaged in this task per planning.md scope.
- **D-004**: Exit-code policy satisfied. Hook test runner returns 0; npm test non-zero is
  attributable entirely to known baseline failures.
- **D-005**: Regression gate passed. No blocker identified for advancing to
  acceptance_verification.

## Artifacts

- `C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/regression-test.md` (this file)
- `C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js` (10/10 pass)
- Reference baseline: `docs/workflows/fix-hook-layer-detection/build-check.md` D-004

## Next

Advance to `acceptance_verification` phase. Verify each AC against the hook tests and
gather the final acceptance-matrix evidence.
