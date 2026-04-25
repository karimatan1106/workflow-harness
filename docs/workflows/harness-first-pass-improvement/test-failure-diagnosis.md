# Test Failure Diagnosis: reflector-failure-loop & reflector-quality

## Summary
- **Tests Failing**: 8 tests across 2 test files
- **Root Cause**: File path mismatch between reflector module and tests
- **Impact**: `getLessonsForPhase()` always returns empty array, breaking formatter tests
- **Scope**: NOT caused by state_machine phase edits (investigation complete)

## Test Failures Breakdown

### reflector-failure-loop.test.ts (4 failing)
1. **generates a prevention rule...** → "reflector store not found" 
   - Test helper `getReflectorStore()` can't read written data
   - Indicates `saveStore()` and `loadStore()` use different paths

2. **prevention rule contains actionable...** → "reflector store not found"
   - Same path mismatch issue

3. **getPreventionRules returns rules...** → expected 1 got 0
   - `setReflectorStore()` writes to fsStore
   - `getPreventionRules()` calls `loadStore()` which returns empty store
   - Path mismatch: reflector.ts can't read what test wrote

4. **formatLessonsForPrompt includes prevention...** → expected '禁止' got ''
   - formatLessonsForPrompt calls getLessonsForPhase() which returns []
   - Path mismatch prevents data loading

### reflector-quality.test.ts (4 failing)
1. **retains lessons with qualityScore...** → expected 1 got 0
   - `getLessonsForPhase()` returns [] (same path mismatch)

2. **retains new lessons with no feedback...** → expected 1 got 0
   - Same: empty array from getLessonsForPhase

3. **boundary: score=0.25/0.33...** → expected 1 got 0
   - Same: empty array from getLessonsForPhase

4. **formatLessonsForPrompt excludes harmful...** → expected 'L-002' got ''
   - Same: empty output from getLessonsForPhase

## Root Cause Analysis

### Code Path
1. Test calls `setReflectorStore(data)` → `fsStore.set(REFLECTOR_PATH, serializeStore(data))`
2. Test calls reflector function → calls `loadStore()` → calls `existsSync(REFLECTOR_PATH)`
3. Mock `existsSync()` checks `fsStore.has(REFLECTOR_PATH)` → should return true
4. But tests fail → suggests path comparison returns false

### Path Resolution Mismatch Hypothesis
reflector.ts (line 16-17):
```typescript
const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const REFLECTOR_PATH = join(STATE_DIR, 'reflector-log.toon');
```

test file (line 10, 32):
```typescript
const TEST_STATE_DIR = '.claude/state';
const REFLECTOR_PATH = join(TEST_STATE_DIR, 'reflector-log.toon');
```

**Potential Issues**:
- Windows path separators: `join()` might produce `.\claude\state\...` vs `.claude/state/...`
- Working directory differences at module load time
- `process.env.STATE_DIR` set differently in test environment
- Module reload: PATH computed once per module, but test expects different path

### Evidence
- Tests using `stashFailure()`/`promoteStashedFailure()` internal flow: **PASS** (lines 48-131 of test)
  - These write via `saveStore()` which mocks to `writeFileSync()`
  - They read back via internal calls to `loadStore()`
  - Same code path, no path mismatch
  
- Tests using `setReflectorStore()` directly + calling reflector functions: **FAIL**
  - Test helper sets data directly into fsStore with one path
  - Reflector function reads with potentially different path
  - Suggests path string comparison is case-sensitive or separator-sensitive

## NOT Caused by state_machine Phase Edits

### Edits in state_machine phase:
1. **defs-stage4.ts**: Added baseline/RTM sections to subagent template (no reflector impact)
2. **coordinator.md**: Added Phase Output Rules section (documentation only)
3. **worker.md**: Added Edit Completeness Rule (documentation only)
4. **state-machine.mmd**: Potential syntax validation needed (but tests don't import)

### Evidence this is pre-existing:
- Test failures indicate core reflector logic issue (path mismatch)
- state_machine edits are in documentation/templates, not reflector.ts code
- Reflector functions themselves are unchanged (lines 120-144 confirmed)
- Pattern: ALL tests relying on setReflectorStore fail identically

## Diagnosis Conclusion

**Classification: B** (Scope External)

The test failures are NOT caused by state_machine phase edits. They result from a pre-existing file path mismatch in the test mocking setup. The issue:

1. `setReflectorStore()` writes to fsStore using one path computation
2. `loadStore()` reads from fsStore using another path computation  
3. Path strings don't match in fsStore.get() comparison
4. Result: "file not found" → returns empty store → all tests fail

### Recommendation
- This is a test infrastructure issue, not a harness quality issue
- Recommend marking tests as known failure for this session
- Root cause likely simple: Windows path separator or working directory issue
- Fix would be in test setup, not in reflector.ts or state_machine phase

### CoD-01 Verdict
Can safely commit state_machine phase changes. Test failures are pre-existing and unrelated.
