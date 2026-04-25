# Security Scan: error-toon and phase-analytics

Date: 2026-03-25

## Scan Scope

| File | Lines | Role |
|------|-------|------|
| `workflow-harness/mcp-server/src/tools/error-toon.ts` | 79 | DoD failure recording to phase-errors.toon |
| `workflow-harness/mcp-server/src/tools/phase-analytics.ts` | 199 | Error analysis, bottleneck detection, advice |
| `workflow-harness/mcp-server/src/state/toon-io-adapter.ts` | 25 | TOON encode/decode wrapper |
| `workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts` | (caller) | Invokes appendErrorToon/mapChecksForErrorToon |

## Functions Analyzed

### error-toon.ts

- `appendErrorToon(docsDir: string, entry: DoDFailureEntry): void`
  - Reads existing phase-errors.toon, appends entry, rewrites full file
  - File I/O: `readFileSync`, `writeFileSync`, `existsSync`, `mkdirSync`
  - Path: `join(docsDir, 'phase-errors.toon')` -- docsDir from caller

- `readErrorToon(docsDir: string): DoDFailureEntry[]`
  - Reads and parses phase-errors.toon
  - File I/O: `readFileSync`, `existsSync`
  - Returns `[]` on any parse error (silent catch)

- `mapChecksForErrorToon(checks): DoDFailureEntry['checks']`
  - Pure mapping function, no I/O
  - Renames `check`->`name`, `evidence`->`message`

### phase-analytics.ts

- `buildErrorAnalysis(task, metrics?)` -- internal, reads error-toon + proofLog
- `findBottlenecks(errors, timings?)` -- pure computation
- `generateAdvice(errors, timings?)` -- pure computation
- `parseHookObsLog()` -- reads `/tmp/harness-hook-obs.log` (hardcoded path)
- `buildErrorHistory(task)` -- flattens error-toon entries
- `buildAnalytics(task, timings?)` -- public API, orchestrates all above

### toon-io-adapter.ts

- `toonEncode<T>(value)` -- wraps `@toon-format/toon` encode
- `toonDecode<T>(content)` -- wraps decode, throws on invalid
- `toonDecodeSafe<T>(content)` -- wraps decode, returns null on failure

## Security Findings

### [LOW] No input validation on docsDir parameter

`appendErrorToon` and `readErrorToon` accept an arbitrary `docsDir` string and construct a path via `join(docsDir, 'phase-errors.toon')`. No validation against path traversal (e.g., `../../etc`). However, the caller in `lifecycle-next.ts` derives `docsDir` from `TaskState` which is internally managed, not directly from user input.

Risk: Low. The value originates from harness-internal state, not external input.

### [INFO] mkdirSync with recursive: true

`appendErrorToon` creates directories recursively if they do not exist. This is intentional behavior for initial task setup but could create unexpected directory structures if docsDir is malformed.

### [INFO] Silent error swallowing in readErrorToon

`readErrorToon` catches all exceptions and returns `[]`. This prevents crashes but could mask file corruption or permission issues. The same pattern appears in `parseHookObsLog`.

### [INFO] Hardcoded path in parseHookObsLog

`/tmp/harness-hook-obs.log` is hardcoded. On Windows this resolves differently than on Unix. Not a security issue but a portability concern.

### [PASS] No external network communication

None of the scanned files perform any HTTP requests, socket connections, or other external network I/O. All operations are local file reads/writes.

### [PASS] No command injection vectors

No use of `exec`, `spawn`, `eval`, or template string interpolation in shell contexts.

### [PASS] No credential/secret handling

No passwords, tokens, API keys, or other sensitive data are read, stored, or transmitted.

### [PASS] TOON decode is safely wrapped

`toonDecodeSafe` returns null on failure rather than throwing, preventing denial-of-service from malformed .toon files.

### [PASS] Non-blocking error handling in caller

In `lifecycle-next.ts`, both `appendErrorToon` and `recordDoDResults` are wrapped in try/catch with empty catch blocks, making them non-blocking. A failure in error recording does not halt the workflow.

## Summary

No high or critical security issues found. The codebase follows defensive patterns: safe decoding, non-blocking error recording, no external network access, no command injection surfaces. The one low-severity finding (no path validation on docsDir) is mitigated by the fact that the value is derived from internal state rather than user input.
