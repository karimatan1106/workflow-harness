# TDD Red Phase Task Decomposition

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: test_impl (TDD Red)

## Analysis Summary

Current `checkTDDRedEvidence(state, phase)` in `dod-l1-l2.ts:76` takes `(TaskState, string)`.
It does NOT accept `scopeFiles` parameter and has no doc-only exemption logic.
The new tests will call `checkTDDRedEvidence` expecting scopeFiles-based exemption, which does not exist yet -- so tests will fail (Red).

`ARTIFACT_QUALITY_RULES` in `definitions-shared.ts:26-29` has `同一行3回以上繰り返し禁止` but no explicit "全行ユニーク" constraint wording. TC-AC3-01 expects unique-line constraint text -- will fail (Red).

## Worker Task: Add TDD Red Tests

### Files to modify
1. `workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts` -- add 4 test cases
2. `workflow-harness/mcp-server/src/__tests__/handler-templates-validation.test.ts` -- add 1 test case

### Test cases for dod-tdd.test.ts (append inside existing describe block)

Add a new `describe('TDD-1 scopeFiles exemption', ...)` block after the existing describe at line 79.

TC-AC1-01: scopeFiles all doc-only (.md/.mmd) => passed:true
- `state = makeMinimalState('test_impl', tempDir, docsDir)`
- `state.scopeFiles = ['docs/planning.md', 'docs/diagram.mmd']`
- `state.proofLog = []`
- `const result = checkTDDRedEvidence(state, 'test_impl')`
- `expect(result.passed).toBe(true)` -- will FAIL because current impl has no scopeFiles logic

TC-AC1-02: single .md scopeFile => passed:true with exemption evidence
- `state = makeMinimalState('test_impl', tempDir, docsDir)`
- `state.scopeFiles = ['docs/readme.md']`
- `state.proofLog = []`
- `const result = checkTDDRedEvidence(state, 'test_impl')`
- `expect(result.passed).toBe(true)` -- will FAIL

TC-AC2-01: mixed code+doc scopeFiles => falls through, passed:false (no proofLog)
- `state = makeMinimalState('test_impl', tempDir, docsDir)`
- `state.scopeFiles = ['src/index.ts', 'docs/readme.md']`
- `state.proofLog = []`
- `const result = checkTDDRedEvidence(state, 'test_impl')`
- `expect(result.passed).toBe(false)` -- will PASS (existing behavior already returns false when no proofLog)

TC-AC2-02: empty scopeFiles => falls through, passed:false (no proofLog)
- `state = makeMinimalState('test_impl', tempDir, docsDir)`
- `state.scopeFiles = []`
- `state.proofLog = []`
- `const result = checkTDDRedEvidence(state, 'test_impl')`
- `expect(result.passed).toBe(false)` -- will PASS (existing behavior)

Note: TC-AC1-01 and TC-AC1-02 will fail (Red). TC-AC2-01 and TC-AC2-02 will pass because they test existing behavior. This is correct TDD Red -- the NEW functionality tests fail.

### Test case for handler-templates-validation.test.ts (append new describe block)

TC-AC3-01: ARTIFACT_QUALITY_RULES contains unique line constraint
- `import { ARTIFACT_QUALITY_RULES } from '../phases/definitions-shared.js'`
- `expect(ARTIFACT_QUALITY_RULES).toContain('全行ユニーク')` or similar uniqueness wording
- Will FAIL because current text only has `同一行3回以上繰り返し禁止`, not explicit unique-line constraint

### Execution
- Run: `cd workflow-harness/mcp-server && npx vitest --run src/__tests__/dod-tdd.test.ts`
- Run: `cd workflow-harness/mcp-server && npx vitest --run src/__tests__/handler-templates-validation.test.ts`
- Expect: TC-AC1-01, TC-AC1-02, TC-AC3-01 FAIL. TC-AC2-01, TC-AC2-02 PASS.
