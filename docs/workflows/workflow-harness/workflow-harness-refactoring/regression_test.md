phase: regression_test
status: complete
taskName: workflow-harness-refactoring
taskId: a0e87be6-7db4-4213-9988-977dae15a4e1

baseline: 784 tests (all passing)
current: 774 tests (all passing)
delta: -10
deltaClassification: intentional removal of small/medium dead code tests

removedTests:
  risk-classifier-classify.test.ts: 4 tests (classifySize small/medium cases)
  phase-skip.test.ts: 4 tests (small/medium skip cases)
  size-argument.test.ts: 3 tests (small/medium argument cases)
  manager-core.test.ts: 2 tests (small size creation/skip cases)
  invariant-dogfooding.test.ts: 3 tests (small/medium invariant cases)
  dod-tdd.test.ts: 1 test (small task TDD exemption)
  dod-basic.test.ts: updated count assertion (29->30, not removed)

Note: some files had test count changes rather than pure removals, net delta is -10.

newFailures: 0
regressions: 0
knownBugs: 0
