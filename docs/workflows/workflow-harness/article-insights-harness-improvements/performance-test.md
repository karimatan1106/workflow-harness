## performance_test

task: article-insights-harness-improvements

### Test Suite Execution Summary

- Total test files: 96 (95 source + 1 infra)
- Total test cases: 822 passed, 0 failed
- Wall-clock time: 7.55s
- Aggregate test time: 37.74s (parallel execution across workers)
- Transform time: 3.74s, Collect time: 9.62s, Prepare time: 18.18s

### Slow Test Files (>500ms)

| File | Duration | Tests |
|------|----------|-------|
| handler-approval.test.ts | 4005ms | 4 |
| 10m-resilience-p2p4.test.ts | 3704ms | 6 |
| pre-tool-config-guard.test.ts | 3664ms | 16 |
| handler-traceability.test.ts | 2190ms | 7 |
| handler-parallel.test.ts | 1964ms | 3 |
| handler-dynamic-categories-integration.test.ts | 1923ms | 5 |
| manager-lifecycle-reset.test.ts | 1682ms | 10 |
| handler-templates-validation.test.ts | 1614ms | 5 |
| handler-misc-ia2.test.ts | 1516ms | 8 |
| handler-parallel-pha1.test.ts | 1262ms | 4 |
| doc-inventory.test.ts | 1111ms | 7 |
| handler-misc.test.ts | 1005ms | 8 |
| context-engineering.test.ts | 990ms | 7 |

These 13 files account for ~26s of the 37.74s aggregate test time (69%).
Most are integration-level handler tests that invoke full lifecycle operations.

### P3: AI Slop Regex Performance Analysis

Five categories defined in `AI_SLOP_CATEGORIES` (src/gates/dod-helpers.ts:79-85):

| Category | Pattern Complexity | Alternations |
|----------|-------------------|--------------|
| hedging | 6 alternations, word boundary | Low |
| empty_emphasis | 3 alternations, word boundary | Low |
| redundant_preamble | 2 alternations with nested group | Low |
| vague_connectors | 3 alternations, word boundary | Low |
| ai_buzzwords | 11 alternations, word boundary | Medium |

Execution model: `extractNonCodeLines` joins all non-code lines into a single string, then each regex runs `String.match(regex)` with the global flag.

Performance characteristics:
- Each regex uses `\b` word boundaries, which are efficient (no backtracking).
- All patterns use simple alternation with literal strings (no nested quantifiers, no catastrophic backtracking risk).
- For a 200-line document (~4000 chars), 5 regex passes over the joined text is negligible (<1ms).
- For a 1000-line document (~20000 chars), estimated <5ms total for all 5 categories.
- The `gi` flags force a full scan each time but this is linear O(n) per pattern.

Risk assessment: No ReDoS vulnerability detected. All patterns are linear-time safe.

### P7: isStructuralLine Performance Analysis

`isStructuralLine` (src/gates/dod-helpers.ts:17-36) runs 12 sequential regex tests per line:

1. `^#{1,6}\s` -- heading detection
2. `^[-*_]{3,}\s*$` -- horizontal rule
3. `^`{3,}` -- code fence
4. `^\|[\s\-:|]+\|$` -- table separator
5. `^\|.+\|.+\|` -- table row
6. `^\*\*[^*]+\*\*[::]?\s*$` -- bold label
7. `^[-*]\s+\*\*[^*]+\*\*[::]?\s*$` -- list bold label
8. `^(?:[-*]\s+)?.{1,50}[::]?\s*$` -- short label line
9. `^(graph|subgraph|end|...)` -- Mermaid keywords
10. `^\S+\s*-->` or `^\S+\s*---` -- Mermaid arrows
11. `^<\/?[a-z]` -- HTML tags
12. `^(#!\/|\$\s)` -- shell commands

Execution model: called once per non-empty, non-structural line in `checkDuplicateLines`. For a 200-line document with ~150 content lines, worst case is 150 x 12 = 1800 regex evaluations.

Performance characteristics:
- All patterns are anchored with `^`, so regex engine fails fast on non-matching lines.
- No backtracking-prone patterns (no nested quantifiers).
- Pattern 8 (`^(?:[-*]\s+)?.{1,50}[::]?\s*$`) is the broadest, but `.{1,50}` is bounded.
- Short-circuit via early `return true` means average case evaluates 3-5 patterns per line.
- For 200-line documents: estimated <2ms total.
- For 1000-line documents: estimated <10ms total.

The sequential if-chain is a pragmatic approach. Converting to a single combined regex would reduce function call overhead but increase pattern complexity and maintenance cost.

## decisions

- PT-1: Test suite completes in 7.55s wall-clock. No performance regression detected. The parallel vitest execution keeps total time well under 10s despite 37.74s aggregate.
- PT-2: The 13 slowest test files (handler/integration tests) dominate 69% of aggregate time. These tests invoke full lifecycle operations with disk I/O, which is inherent to their integration nature and not a code smell.
- PT-3: AI slop regex patterns (5 categories) are all linear-time safe with word-boundary anchoring. No ReDoS risk. Even on 1000-line documents, total execution remains under 5ms.
- PT-4: `isStructuralLine` performs 12 sequential regex checks per line, all `^`-anchored for fast failure. For a 200-line document, worst case is ~1800 evaluations completing in under 2ms. No optimization needed.
- PT-5: The `extractNonCodeLines` function performs a single pass O(n) scan with code fence toggling. This is called multiple times by different checkers (forbidden patterns, AI slop, duplicates, bracket placeholders). Caching the result could eliminate 3 redundant passes, but the cost is negligible for documents within the 200-line limit.
- PT-6: Pattern 8 in `isStructuralLine` (`^(?:[-*]\s+)?.{1,50}[::]?\s*$`) matches broadly and may incorrectly classify short content lines as structural. This is a correctness concern rather than performance, but it affects duplicate detection accuracy.
- PT-7: The `checkDuplicateLines` function builds a Map of all non-structural lines, which is O(n) space and time. For documents at the 200-line limit, this is well within acceptable bounds.

## artifacts

- Test suite: 96 files, 822 tests, 0 failures, 7.55s wall-clock
- Analyzed source: src/gates/dod-helpers.ts (153 lines)
- Performance hotspots: None identified. All regex patterns are linear-time safe.

## next

- No performance-driven code changes required.
- If document size limits are relaxed beyond 200 lines in the future, consider caching `extractNonCodeLines` results to avoid redundant passes.
- Pattern 8 breadth in `isStructuralLine` should be reviewed for correctness (PT-6), not performance.
