# Refactoring Report

## Analysis Results

| File | Before | After | Status |
|------|--------|-------|--------|
| src/gates/dod-helpers.ts | 152 | 152 | OK (no change needed) |
| src/gates/dod-l4-content.ts | 107 | 107 | OK (no change needed) |
| src/gates/dod-l4-requirements.ts | 168 | 160 | Refactored (-8 lines) |
| src/state/types-core.ts | 199 | 199 | OK (boundary, no change needed) |
| src/phases/registry.ts | 156 | 156 | OK (no change needed) |
| src/tools/handlers/pivot-advisor.ts | 95 | 95 | OK (no change needed) |
| src/tools/handlers/lifecycle-next.ts | 198 | 198 | OK (boundary, no change needed) |
| src/gates/approval.ts | N/A | N/A | File does not exist (listed in task but absent) |

All files are within the 200-line limit.

## Refactoring Performed

### dod-l4-requirements.ts: Duplicate pattern extraction

Problem: 4 exported functions (checkACFormat, checkNotInScope, checkIntentConsistency, checkOpenQuestions) each repeated the same 3-step pattern:
1. Build `reqPath` via `resolveProjectPath(docsDir) + '/requirements.md'`
2. Check `existsSync(reqPath)` and return a "not found" DoDCheckResult
3. Call `readRequirementsMarkdown(docsDir)` and return a "could not be parsed" DoDCheckResult

Additionally, each function had a verbose early-return for non-requirements phases with near-identical boilerplate.

Changes:
- Extracted `loadRequirementsFile(docsDir)` returning `{ reqPath, content, sections }` or null, consolidating the old `readRequirementsMarkdown` with path resolution and existence check
- Extracted `skipForNonRequirements(check, phase)` for the phase-gate early return
- Extracted `reqFileMissing(check, docsDir)` for the missing/unparseable file error
- `checkIntentConsistency` retained direct file reading (existsSync + readFileSync) because it only needs raw content for keyword/line-count checks, not parsed sections. Using `loadRequirementsFile` here would incorrectly reject files without Markdown `##` headings (such as TOON-formatted requirements files).
- Net reduction: 8 lines removed, 5 duplicated code paths consolidated into 3 shared helpers

## Not Refactored (with rationale)

### dod-helpers.ts (152 lines)
Well-structured with single-responsibility functions. `extractNonCodeLines` is called by multiple functions but is already shared. No duplication or dead code.

### dod-l4-content.ts (107 lines)
Compact, single exported function with clear linear flow. No refactoring needed.

### types-core.ts (199 lines)
At the 200-line boundary but consists entirely of type/interface/const definitions. Splitting type definitions across files would harm discoverability. The file is a natural cohesive unit.

### registry.ts (156 lines)
Data-driven configuration registry. The long lines in PHASE_REGISTRY are intentional (each phase is a single config object). Splitting would fragment the phase configuration.

### pivot-advisor.ts (95 lines)
Clean, focused module with well-separated concerns (detection vs. suggestion generation). No issues.

### lifecycle-next.ts (198 lines)
At the boundary but already extracted `buildDoDFailureResponse` and `addNextPhaseOutputFile` as private helpers. The main handler `handleHarnessNext` is a coordination function that naturally references many dependencies. Further splitting would scatter the lifecycle flow.

## Test Results

```
Test Files:  96 passed (96)
Tests:       822 passed (822)
Duration:    6.63s
```

All 822 tests pass after refactoring.
