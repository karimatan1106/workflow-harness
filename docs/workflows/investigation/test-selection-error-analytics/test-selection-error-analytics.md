# Test Selection Investigation: harness-detailed-error-analytics

## 1. Source File Paths (all confirmed to exist)

| File | Full Path |
|------|-----------|
| error-toon.ts | workflow-harness/mcp-server/src/tools/error-toon.ts |
| phase-analytics.ts | workflow-harness/mcp-server/src/tools/phase-analytics.ts |
| analytics-toon.ts | workflow-harness/mcp-server/src/tools/analytics-toon.ts |
| lifecycle-next.ts | workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts |

## 2. All Existing Test Files

Total: 86 test files under `src/__tests__/` + 1 under `src/observability/__tests__/`.

Full listing in `src/__tests__/`: 84 `.test.ts` files + 2 helper `.ts` files (`handler-test-setup.ts`, `dod-test-helpers.ts`, `_gen_unit.tmp`).

Subdirectory `src/__tests__/hooks/`: `hook-existence.test.ts`, `pre-tool-config-guard.test.ts`.

Subdirectory `src/observability/__tests__/`: `trace-writer.test.ts`.

## 3. vitest --related Result

vitest 1.6.1 does NOT support the `--related` flag. This is a vitest 2.x+ feature. Manual dependency analysis was performed instead.

## 4. Dedicated Test Files for Target Modules

| Test File | Exists? |
|-----------|---------|
| phase-analytics.test.ts | NO - does not exist anywhere |
| error-toon.test.ts | NO - does not exist anywhere |
| analytics-toon.test.ts | NO - does not exist anywhere |

None of the 4 target source files have dedicated test files.

## 5. tools/__tests__/ Directory

`src/tools/__tests__/` does NOT exist. No `test-design.md` file was found anywhere under `workflow-harness/`.

All tests live in `src/__tests__/` (flat structure with a `hooks/` subdirectory).

## 6. Dependency Graph (Import Chain)

```
lifecycle-next.ts
  imports: error-toon.ts (appendErrorToon)

lifecycle-completion.ts
  imports: phase-analytics.ts (buildAnalytics)
  imports: analytics-toon.ts (writeAnalyticsToon)

lifecycle-start-status.ts
  imports: phase-analytics.ts (buildAnalytics)
  imports: analytics-toon.ts (writeAnalyticsToon)

phase-analytics.ts
  imports: error-toon.ts (readErrorToon)

analytics-toon.ts
  imports: phase-analytics.ts (AnalyticsResult type)

lifecycle.ts (barrel)
  re-exports: lifecycle-next.ts (handleHarnessNext)
```

## 7. Related Tests (by indirect dependency through handlers)

The following test file directly references lifecycle-next: `stale-task-hmac.test.ts`.

24 test files reference lifecycle/harness_next/harness_start/harness_status keywords. Most relevant (directly testing handler behavior):

- handler-lifecycle.test.ts (primary - tests handleHarnessNext/Start/Status)
- manager-lifecycle.test.ts
- manager-lifecycle-reset.test.ts
- handler-misc.test.ts
- handler-misc-ia2.test.ts
- e2e-mcp-chain.test.ts
- stale-task-hmac.test.ts
- handler-parallel.test.ts
- handler-approval.test.ts
- metrics.test.ts

No test file directly imports `buildAnalytics`, `writeAnalyticsToon`, `appendErrorToon`, or `readErrorToon`. These functions are only tested indirectly through handler integration tests.

## 8. Conclusion

All 4 target source files lack dedicated unit tests. New test files need to be created. Recommended test file names:
- `src/__tests__/error-toon.test.ts`
- `src/__tests__/phase-analytics.test.ts`
- `src/__tests__/analytics-toon.test.ts`
- (lifecycle-next.ts is partially covered by handler-lifecycle.test.ts)
