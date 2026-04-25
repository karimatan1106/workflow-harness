# TDD Red Phase Report

## Summary

All 7 tests across 3 test files failed as expected. 0 tests passed unexpectedly.

**Total: 7 failed, 0 passed**

## Failure Details

### error-toon.test.ts (2 failures)

| Test ID | Test Name | Failure Reason |
|---------|-----------|----------------|
| TC-AC1-01 | maps all fields correctly | `mapChecksForErrorToon is not a function` - function does not exist yet |
| TC-AC1-02 | optional fields are undefined when omitted | `mapChecksForErrorToon is not a function` - function does not exist yet |

### phase-analytics.test.ts (3 failures)

| Test ID | Test Name | Failure Reason |
|---------|-----------|----------------|
| TC-AC3-01 | excludes passed=true checks from failure count | `expected { check: 'check_a', level: 'L1', ... } to be undefined` - passed=true checks are NOT filtered out (current bug) |
| TC-AC3-02 | uses actual check.level instead of hardcoded L1 | `expected 'L1' to be 'L3'` - level is hardcoded to 'L1' instead of using actual value |
| TC-AC2-01 | flattens all entries and all checks into errorHistory | `expected undefined not to be undefined` - errorHistory property does not exist on AnalyticsResult |

### analytics-toon.test.ts (2 failures)

| Test ID | Test Name | Failure Reason |
|---------|-----------|----------------|
| TC-AC2-02 | includes errorHistory array in output | `expected undefined not to be undefined` - errorHistory not included in TOON output |
| TC-AC2-03 | handles empty/undefined errorHistory without error | `expected undefined not to be undefined` - errorHistory not included in TOON output (defaults missing) |

## Unexpected Passes

None. All tests failed as expected.
