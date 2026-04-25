# File Capacity Report (2026-03-28)

8 files analyzed for line count, exports, and 200-line capacity.

NOTE: Paths in the request used incorrect directories (dod/, tools/). Correct paths shown below.

## Summary Table

| # | File (correct path) | Lines | Remaining | Status |
|---|---------------------|-------|-----------|--------|
| 1 | gates/dod-helpers.ts | 123 | 77 | OK |
| 2 | gates/dod-l4-content.ts | 86 | 114 | OK |
| 3 | tools/retry.ts | 198 | 2 | CRITICAL |
| 4 | tools/handlers/lifecycle-next.ts | 198 | 2 | CRITICAL |
| 5 | state/types-core.ts | 198 | 2 | CRITICAL |
| 6 | phases/defs-stage2.ts | 175 | 25 | CAUTION |
| 7 | tools/handlers/approval.ts | 119 | 81 | OK |
| 8 | gates/dod-l4-requirements.ts | 166 | 34 | CAUTION |

Base path: workflow-harness/mcp-server/src/

## Exports Per File

### 1. gates/dod-helpers.ts (123 lines, remaining: 77)
- `FORBIDDEN_PATTERNS` (const string[])
- `BRACKET_PLACEHOLDER_REGEX` (const RegExp)
- `isStructuralLine(line: string): boolean`
- `extractNonCodeLines(content: string): string[]`
- `checkForbiddenPatterns(content: string): string[]`
- `checkBracketPlaceholders(content: string): boolean`
- `checkDuplicateLines(content: string): string[]`
- `checkRequiredSections(content: string, requiredSections: string[]): string[]`
- `checkFileLineLimit(content: string, limit?): { exceeded, lineCount }`
- `checkBrokenPointers(content: string, basePath: string): string[]`
- `detectGhostFiles(newFiles: string[], existingFiles: string[]): string[]`

### 2. gates/dod-l4-content.ts (86 lines, remaining: 114)
- `checkL4ContentValidation(phase: string, docsDir: string, workflowDir: string): DoDCheckResult`

### 3. tools/retry.ts (198 lines, remaining: 2)
- `RetryContext` (interface)
- `RetryPromptResult` (interface)
- `classifyComplexity(checks, errorClass): 'trivial' | 'moderate' | 'critical'`
- `ERROR_ADR_MAP` (const Record)
- `formatStructuredError(error, file, adrIds, fix): string`
- `buildRetryPrompt(ctx: RetryContext, checks?): RetryPromptResult`

### 4. tools/handlers/lifecycle-next.ts (198 lines, remaining: 2)
- `handleHarnessNext(args, sm): Promise<HandlerResult>`

### 5. state/types-core.ts (198 lines, remaining: 2)
- `ControlLevel` (type)
- `DoDCheck` (interface)
- `GateContext` (interface)
- `PHASE_NAMES` (const)
- `PhaseName` (type)
- `TaskSize` (type)
- `RiskScore` (interface)
- `ProjectTraits` (interface)
- `PARALLEL_GROUPS` (const)
- `ParallelGroupName` (type)
- `APPROVAL_GATES` (const)
- `ApprovalType` (type)
- `RTMEntry` (interface)
- `ProofTier` (type)
- `PROOF_TIERS` (const)
- `AcceptanceCriterion` (interface)
- `ProofEntry` (interface)
- `Checkpoint` (interface)
- `SubPhaseStatus` (interface)
- `DoDExemptionType` (type)
- `InputFileMode` (type)
- `PhaseConfig` (interface)
- `TaskSizeSchema` (Zod)
- `PhaseNameSchema` (Zod)
- `ApprovalTypeSchema` (Zod)
- `TaskStateSchema` (Zod)

### 6. phases/defs-stage2.ts (175 lines, remaining: 25)
- `DEFS_STAGE2` (const Record with 5 phase definitions: threat_modeling, planning, state_machine, flowchart, ui_design)

### 7. tools/handlers/approval.ts (119 lines, remaining: 81)
- `handleHarnessApprove(args, sm): Promise<HandlerResult>`

### 8. gates/dod-l4-requirements.ts (166 lines, remaining: 34)
- `checkACFormat(state, phase, docsDir): DoDCheckResult`
- `checkNotInScope(state, phase, docsDir): DoDCheckResult`
- `checkIntentConsistency(state, phase, docsDir): DoDCheckResult`
- `isOpenQuestion(q: unknown): boolean`
- `checkOpenQuestions(state, phase, docsDir): DoDCheckResult`

## Risk Assessment

3 files at 198 lines (remaining: 2) are at critical capacity. Any addition will breach the 200-line limit:
- tools/retry.ts
- tools/handlers/lifecycle-next.ts
- state/types-core.ts

2 files have limited headroom (25-34 lines):
- phases/defs-stage2.ts (25 remaining)
- gates/dod-l4-requirements.ts (34 remaining)
