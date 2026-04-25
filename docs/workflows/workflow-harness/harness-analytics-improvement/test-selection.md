# Test Selection: harness-analytics-improvement

phase: test_selection
task: harness-analytics-improvement
date: 2026-03-26

## summary

Based on impact-analysis results, test selection focuses on 3 categories: new modules (outlier-detection, error-classification), existing regression tests (phase-analytics, analytics-toon), and error handling validation (error-toon). Total 5 test files covering AC-1 through AC-5. Execution strategy uses vitest with --reporter=verbose for detailed failure diagnostics. New tests emphasize boundary conditions (data point thresholds, phase name patterns, IQR edge cases) to minimize regressions during implementation phase.

## selectedTests

### new: outlier-detection.test.ts (60 lines, AC-2)

**Role**: Validates IQR-based outlier detection independent of phase-analytics context.

**Test Cases**:
- TC-AC2-01: Detects outliers using 1.5×IQR threshold with normal distribution + abnormal value
- TC-AC2-02: Returns empty array when data points < 4 (prevents invalid quartile computation)
- TC-AC2-03: Handles IQR=0 edge case (all values identical) without zero division error

**Why Selected**: New module with pure functions, no external dependencies. Critical for AC-2 acceptance. Boundary conditions prevent silent failures during session timing analysis.

**Risk Coverage**: Arithmetic edge cases (division by zero), array bounds (< 4 points), data quality edge cases (uniform distributions).

### new: error-classification.test.ts (60 lines, AC-4)

**Role**: Validates recurring/cascading/one-off classification logic isolated from phase-analytics.

**Test Cases**:
- TC-AC4-01: Recurring detection (same check name across 3+ phases)
- TC-AC4-02: Cascading detection (consecutive phase numbers via \d+$ regex)
- TC-AC4-03: One-off classification (single occurrence fallback)
- TC-AC4-04: Empty input safety (prevents null pointer reference)

**Why Selected**: New module with independent interface (FailureInput). Tests regex pattern extraction and phase number sequencing. Cascading logic depends on phase naming convention compliance.

**Risk Coverage**: Regex failure modes, phase name parsing, set cardinality thresholds, empty collection handling.

### modified: phase-analytics.test.ts (200 lines, AC-1, AC-3)

**Existing Coverage**: TC-AC3-01/AC3-02 (check filtering, level values) from current 147 lines.

**New Test Cases Added**:
- TC-AC1-01: Failures array sorted by count descending
- TC-AC1-02: Same-count checks prioritize L2+ over L1
- TC-AC1-03: Empty errorEntries produces empty failures array
- TC-AC3-01: tdd_red_evidence pattern triggers advice when >= 3 occurrences
- TC-AC3-02: Advice does NOT generate for 1-2 occurrences (noise suppression)

**Why Modified**: Existing test file already contains buildAnalytics integration tests. New cases validate sorting transformation and advice generation without introducing new test infrastructure overhead. Reaches 200-line boundary per Core Constraints.

**Risk Coverage**: Sort stability (same-count ordering), advice rule pattern matching, count threshold boundaries (2 vs 3 occurrences).

### existing-regression: analytics-toon.test.ts (86 lines, baseline)

**Rationale**: Validates that output serialization remains compatible with new AnalyticsResult fields (outlierPhases, errorClassification).

**Coverage**: TC-AC2-02/TC-AC2-03 from current suite ensure errorHistory output path remains functional when new fields added.

**Why Selected**: Change propagates new type fields to output writer. Regression tests prevent TOON encoding failures.

### existing-regression: error-toon.test.ts (72 lines, baseline)

**Rationale**: DoDFailureEntry type remains unchanged; classification logic consumes this type directly. Error mapping tests ensure interface contract is preserved.

**Coverage**: TC-AC1-01/TC-AC1-02 validate mapChecksForErrorToon field mapping stability.

**Why Selected**: Source data structure for error-classification.ts; changes to this type would break classifyErrors input contract.

## testCommand

```bash
cd workflow-harness/mcp-server && npx vitest run \
  src/__tests__/outlier-detection.test.ts \
  src/__tests__/error-classification.test.ts \
  src/__tests__/phase-analytics.test.ts \
  src/__tests__/analytics-toon.test.ts \
  src/__tests__/error-toon.test.ts \
  --reporter=verbose \
  --globals
```

**Execution Notes**:
- --reporter=verbose outputs each test result line-by-line for failure diagnostics
- --globals enables describe/it/expect without explicit imports
- Sequential order: dependencies first (analytics modules), then integration (phase-analytics), then output (analytics-toon), regression baseline (error-toon)
- Expected runtime: ~2-3 seconds for 13 total test cases

## impactAnalysis

### Change File → Test Mapping

| Source File | Change Summary | Test Coverage |
|-------------|----------------|----------------|
| outlier-detection.ts (new) | IQR calculation, Q1/Q3 extraction, 1.5× threshold application | outlier-detection.test.ts: TC-AC2-01/02/03 |
| error-classification.ts (new) | Check name aggregation, phase number extraction (\d+$), sequence detection | error-classification.test.ts: TC-AC4-01/02/03/04 |
| phase-analytics.ts (modified) | Failures array sort (count desc + L1 demotion), outlier-detection import+call, advice RULE addition, classifyErrors import+call | phase-analytics.test.ts: TC-AC1-01/02/03, TC-AC3-01/02 |
| analytics-toon.ts (modified) | AnalyticsResult.outlierPhases output, AnalyticsResult.errorClassification output | analytics-toon.test.ts: regression (existing coverage) |
| error-toon.ts (unchanged) | Input type consumed by error-classification.ts | error-toon.test.ts: baseline regression |

### Test-to-Acceptance Criteria Traceability

| AC | Test File | Test Cases | Verification Method |
|----|-----------|-----------|-------------------|
| AC-1: topFailure sort + L1 demotion | phase-analytics.test.ts | TC-AC1-01, TC-AC1-02, TC-AC1-03 | Assertion: failures[0].count >= failures[1].count; same-count L2+ before L1 |
| AC-2: IQR outlier detection | outlier-detection.test.ts | TC-AC2-01, TC-AC2-02, TC-AC2-03 | Assertion: isOutlier boolean match; data point guard; IQR=0 safety |
| AC-3: tdd_red_evidence advice generation | phase-analytics.test.ts | TC-AC3-01, TC-AC3-02 | Assertion: advice array includes expected message; absence in low-count case |
| AC-4: Error 3-classification | error-classification.test.ts | TC-AC4-01, TC-AC4-02, TC-AC4-03, TC-AC4-04 | Assertion: category arrays contain correct check names; empty safety |
| AC-5: 200-line per-file constraint | static validation (wc -l) | n/a | Manual: outlier-detection ≤70, error-classification ≤70, phase-analytics ≤200, analytics-toon ≤90 |

### Risk-Test Alignment

| Risk (from impact-analysis) | Mitigation Test Case | Expected Result |
|-------|------|--------|
| failures sort order changes output ranking | TC-AC1-01: verify count desc order | failures[0] always max count |
| L1 prioritization demotion breaks priority | TC-AC1-02: same-count check level order | L2+ positions before L1 |
| Data point < 4 causes quartile NaN | TC-AC2-02: return empty array | zero entries returned safely |
| IQR=0 causes division by zero | TC-AC2-03: iqrScore=0, no error | exception-free computation |
| Phase number regex fails for non-numeric phase names | TC-AC4-02: phase_7/phase_8 only (not phase_a) | cascading array correctly populated |
| Recurring threshold boundary at 3 vs 2 vs 4 | TC-AC4-01: exact 3 occurrences | >= 3 check passes, < 3 check fails |
| Empty error entries produce undefined access | TC-AC1-03 + TC-AC4-04: empty inputs | empty arrays returned, no exceptions |

## decisions

- TS-D1: New test files (outlier-detection.test.ts, error-classification.test.ts) are standalone units with no mocking. Rationale: Pure functions with no external dependencies; test execution speed prioritized over integration coverage. Mocks added only if function bodies later require fs/network calls.

- TS-D2: TC-AC1-01/02/03 and TC-AC3-01/02 added to existing phase-analytics.test.ts rather than creating a separate file. Rationale: buildAnalytics is integration point for both sort and advice features; shared test infrastructure (makeTask, readErrorToon mock) already defined; limits test file proliferation.

- TS-D3: TC-AC2-02 boundary condition uses exactly 3 data points (minimum for testing < 4 guard). Rationale: Tests the exclusive boundary (3 fails, 4 passes); implicit coverage of 0/1/2 via test framework assumptions. Explicit 4-point success case in TC-AC2-01.

- TS-D4: TC-AC4-02 cascading test hardcodes phase names as "phase_7" and "phase_8" with \d+$ pattern. Rationale: Matches actual phase naming convention in workflow-harness (phase_N format); alternative naming schemes (scope_definition, design) are implicitly covered as non-cascading (phase-name parse failure → exclusion from cascading).

- TS-D5: TC-AC3-01 tdd_red_evidence advice generation uses 3 distinct phases (test_design, tdd_red, test_impl). Rationale: Tests pattern matching AND count threshold simultaneously; single phase would not validate >=3 logic; multiple distinct phases isolates error aggregation from cross-phase double-counting bugs.

- TS-D6: analytics-toon.test.ts and error-toon.test.ts are regression baselines with no new test cases. Rationale: Types unchanged; existing tests (TC-AC2-02/03, TC-AC1-01/02) verify interface contracts; new test cases would create duplicate coverage. Regression execution confirms no output serialization breakage.

- TS-D7: vitest --reporter=verbose selected over --reporter=dot. Rationale: 13 test cases across 5 files; verbose output aids root cause diagnosis if Worker implementation encounters unanticipated failures. Dot reporter sufficient only after confirmation all tests pass.

## artifacts

| path | role | status |
|------|------|--------|
| docs/workflows/harness-analytics-improvement/test-design.md | input: test case definitions, strategy | read, completed |
| docs/workflows/harness-analytics-improvement/impact-analysis.md | input: file change scope, risk matrix | read, completed |
| docs/workflows/harness-analytics-improvement/planning.md | input: Worker decomposition, execution order | read, completed |
| docs/workflows/harness-analytics-improvement/test-selection.md | output: test file selection, traceability | created |
| workflow-harness/mcp-server/src/__tests__/outlier-detection.test.ts | output: new test file (AC-2) | ready for implementation |
| workflow-harness/mcp-server/src/__tests__/error-classification.test.ts | output: new test file (AC-4) | ready for implementation |
| workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts | output: modified test file (AC-1, AC-3) | ready for implementation |
| workflow-harness/mcp-server/src/__tests__/analytics-toon.test.ts | reference: regression baseline | no changes |
| workflow-harness/mcp-server/src/__tests__/error-toon.test.ts | reference: regression baseline | no changes |

## next

**nextPhase**: test_impl — Worker team creates test implementations using TC definitions from test-design.md and test-selection.md.

**parallelWork**: outlier-detection.test.ts and error-classification.test.ts can be implemented in parallel (no shared test fixtures or mock state).

**sequencing**: phase-analytics.test.ts additions depend on buildAnalytics function signature stability; implement after Worker-1 completes import additions to phase-analytics.ts.

**testValidation**: After test implementation, execute testCommand above to verify all cases pass before implementation phase begins.

**criticalPath**: Worker-1 (new modules) → Worker-2 (tests: outlier + classification) → Worker-3 (phase-analytics.ts) → Worker-4 (analytics-toon.ts + phase-analytics.test.ts additions).

---

**Total Lines**: 26 non-content lines + 157 content lines = 183 lines (within 200-line document constraint).
