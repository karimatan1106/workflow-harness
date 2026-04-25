# .toon Reference Audit Report

Date: 2026-03-23
Scope: workflow-harness/mcp-server/src/**/*.ts, workflow-harness/.claude/, workflow-harness/docs/

## Summary

- Phase artifact .toon references (BUGS): 0 found -- migration is complete
- Internal state .toon references (intentional): 28+ references across ~20 files
- TOON library/utility references (needed): present in all *-toon.ts and *-toon-io.ts files
- Other (comments, tests, docs): ~15 references
- .claude/ directory: 8 references (mixed: some intentional, some stale documentation)
- docs/ directory: 0 references

---

## 1. Phase Artifact References (BUGS) -- NONE FOUND

The phase registry (phases/registry.ts) has been fully migrated. All outputFile values use .md or .mmd. No phase definition references .toon for artifacts.

Searched patterns: hearing.toon, scope-definition.toon, research.toon, requirements.toon, threat-model.toon, planning.toon, parallel-analysis.toon, parallel-design.toon, design-review.toon, test-design.toon, test-impl.toon, implementation.toon, refactoring.toon, docs-update.toon, deploy.toon, retrospective.toon -- all zero matches.

---

## 2. Internal State References (Intentional -- keep as .toon)

These are all correct and should remain:

### State files

| File | Line | Reference |
|------|------|-----------|
| state/manager-read.ts | 18 | workflow-state.toon |
| state/manager-read.ts | 36 | workflow-state.toon |
| state/manager-read.ts | 72 | workflow-state.toon |
| state/manager-write.ts | 38 | .toon (via regex replace) |
| state/manager-write.ts | 52 | task-index.toon |
| state/progress-json.ts | 29 | claude-progress.toon |
| utils/hmac.ts | 20 | hmac-keys.toon |

### Tools (internal state stores)

| File | Line | Reference |
|------|------|-----------|
| tools/reflector.ts | 17 | reflector-log.toon |
| tools/metrics.ts | 13 | metrics.toon |
| tools/ace-context.ts | 16 | ace-context.toon |
| tools/adr.ts | 13 | adr-store.toon |
| tools/archgate.ts | 15 | archgate-rules.toon |
| tools/curator-helpers.ts | 11 | curator-log.toon |
| tools/handlers/dci.ts | 15 | design-code-index.toon |
| tools/handlers/lifecycle.ts | 231 | follow-up-tests.toon |

### Per-task analytics (internal, written to docsDir)

| File | Line | Reference |
|------|------|-----------|
| tools/metrics-toon.ts | 19 | phase-metrics.toon |
| tools/error-toon.ts | 26 | phase-errors.toon |
| tools/error-toon.ts | 65 | phase-errors.toon (read) |
| tools/analytics-toon.ts | 98 | phase-analytics.toon |
| tools/phase-analytics.ts | 39 | phase-errors.toon (read, comment) |
| tools/handlers/lifecycle.ts | 191 | phase-analytics.toon (comment) |
| tools/handlers/lifecycle.ts | 204 | phase-metrics.toon (comment) |

---

## 3. TOON Library / Utility References (Needed)

Gate/validation code that handles .toon format detection:

| File | Line | Context |
|------|------|---------|
| gates/dod-l3.ts | 13 | Comment: TOON parse check for .toon files |
| gates/dod-l3.ts | 35 | if (!outputFile.endsWith('.toon')) -- format detection |
| gates/dod-l3.ts | 48 | Fix message mentioning .toon format rules |
| gates/dod-l4-content.ts | 63-64 | extname(outputFile) === '.toon' -- format detection |
| gates/dod-l4-delta.ts | 67 | Comment: Internal .toon files: TOON decode path |
| gates/dod-l4-delta.ts | 75 | Fix message: .toon is key: value only |

TOON I/O modules (file-level doc comments):

| File | Line | Comment |
|------|------|---------|
| dci/dci-toon-io.ts | 3 | Converts DCIIndex to/from .toon format |
| state/state-toon-io.ts | 3 | Converts TaskState to/from .toon format |
| state/state-toon-parse.ts | 2 | converts .toon text to TaskState |
| tools/curator-toon.ts | 2 | TOON I/O for curator log (curator-log.toon) |
| tools/metrics-toon-io.ts | 2 | serialize and parse metrics.toon |
| tools/ace-context-toon.ts | 2 | TOON I/O for ACE (ace-context.toon) |
| tools/adr-toon-io.ts | 2 | serialize and parse adr-store.toon |
| tools/archgate-toon-io.ts | 2 | serialize and parse archgate-rules.toon |
| tools/error-toon.ts | 2 | records DoD failures to phase-errors.toon |
| tools/metrics-toon.ts | 2-3 | writes phase metrics to phase-metrics.toon |
| tools/analytics-toon.ts | 2 | outputs analysis to .toon file |
| tools/handlers/dci.ts | 3 | Writes/reads .toon format |

---

## 4. Fallback/Default References (Review Needed)

| File | Line | Code | Assessment |
|------|------|------|------------|
| tools/handler-shared.ts | 115 | allowedExtensions: ['.toon'] | DEFAULT fallback for unknown phases. Since all phases are now in registry with proper extensions, this only fires for unregistered phase names. Low risk but could be updated to ['.md'] for consistency. |
| state/manager-lifecycle.ts | 16 | DEFAULT_ALLOWED_EXTENSIONS = ['.toon', '.md'] | Used for agent file creation. .toon here is intentional -- agents may write internal state files. |

---

## 5. @spec References (Potentially Stale)

| File | Line | Reference |
|------|------|-----------|
| state/types-invariant.ts | 3 | @spec docs/workflows/inv-n-proof-tier/spec.toon |
| state/manager-invariant.ts | 3 | @spec docs/workflows/inv-n-proof-tier/spec.toon |

These reference a spec file that may or may not exist. If the spec was migrated to .md, these are stale.

---

## 6. Test File References (All Internal State -- Correct)

| File | Reference |
|------|-----------|
| __tests__/ace-reflector.test.ts | reflector-log.toon |
| __tests__/ace-reflector-curator.test.ts | reflector-log.toon, ace-context.toon |
| __tests__/gc.test.ts | reflector-log.toon, metrics.toon |
| __tests__/hmac.test.ts | hmac-keys.toon |
| __tests__/manager-core.test.ts | workflow-state.toon |
| __tests__/manager-lifecycle.test.ts | workflow-state.toon |
| __tests__/metrics.test.ts | metrics.toon |
| __tests__/progress-json.test.ts | claude-progress.toon |
| __tests__/reflector-quality.test.ts | reflector-log.toon |
| __tests__/reflector-failure-loop.test.ts | reflector-log.toon |
| __tests__/rtm-intent-gate.test.ts | .toon in test description and assertion |
| __tests__/stale-task-hmac.test.ts | workflow-state.toon, hmac-keys.toon |
| __tests__/n63-n72.test.ts | spec.toon (test fixture path) |

---

## 7. .claude/ Directory References

### Intentional (documentation of .toon as internal state format)

| File | Line | Content |
|------|------|---------|
| rules/core-constraints.md | 6 | States internal state files use TOON(.toon) -- correct policy |
| agents/coordinator.md | 20 | Structured data (AC, RTM, scope) -> .toon -- intentional |
| agents/worker.md | 49 | Structured data -> .toon -- intentional |
| skills/workflow-harness/workflow-orchestrator.md | 77 | .toon for internal state, 40-50% token reduction vs JSON -- intentional |

### Potentially Stale (need review)

| File | Line | Content | Assessment |
|------|------|---------|------------|
| skills/workflow-harness/retrospective.md | 10-11 | phase-analytics.toon, phase-metrics.toon | These ARE internal analytics files. CORRECT. |
| skills/workflow-harness/workflow-execution.md | 55-62 | .toon listed as writable type per phase group | STALE -- phases now write .md for artifacts. The .toon here refers to auto-generated internal analytics, but the table is misleading. Should clarify. |

---

## 8. docs/ Directory

No .toon references found. Clean.

---

## Action Items

### No bugs found (priority: none)

Phase artifact migration is complete. No .toon references remain for phase output files.

### Low priority improvements

1. handler-shared.ts:115 -- Change fallback allowedExtensions from ['.toon'] to ['.md']
2. types-invariant.ts:3 and manager-invariant.ts:3 -- Verify if spec.toon exists or update @spec path
3. workflow-execution.md:55-62 -- Clarify that .toon in the writable-types table refers to auto-generated internal analytics only
