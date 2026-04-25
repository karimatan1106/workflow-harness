# Subprocess Spawning Audit Report

Date: 2026-04-08

## 1. child_process Usage in mcp-server/src/ (Source)

### Legitimate (non-delegation) uses:

| File | Usage | Purpose |
|------|-------|---------|
| `utils/project-root.ts` | `execSync('git rev-parse ...')` | Detect git project root |
| `tools/linter-runner.ts` | `execSync('npx jscpd ...')` | Run jscpd duplicate detection |
| `tools/handlers/lifecycle-start-status.ts` | `execSync('git status --porcelain')` | Check dirty working tree on harness start |

All three are utility/tool executions (git, jscpd), not subprocess delegation to coordinator/worker layers.

### Stale reference (comment only):

| File | Content |
|------|---------|
| `tools/handlers/stream-progress-tracker.ts` | JSDoc comments reference "coordinator subprocess" but the class itself only writes progress to a file via `writeFileSync`. No actual subprocess spawning. |

## 2. Delegate/Spawn Files

### Source (src/tools/handlers/): NONE

No `delegate-*.ts`, `coordinator-spawn.ts`, or similar files exist in `src/tools/handlers/`.

### Compiled dist/ only (stale build artifacts):

| File | Status |
|------|--------|
| `dist/tools/handlers/delegate-work.js` | Stale artifact, no source |
| `dist/tools/handlers/delegate-coordinator.js` | Stale artifact, no source |
| `dist/tools/handlers/coordinator-spawn.js` | Stale artifact, no source |

These are leftover compiled files from a previous architecture. The source files have been removed.

## 3. Tool Definitions

Searched `defs-a.ts`, `defs-b.ts`, `defs-c.ts`, `handler.ts` for "delegate" or "spawn": **zero matches**.

No `harness_delegate_work`, `harness_delegate_coordinator`, or spawn-based tools are registered in the current tool definitions.

## 4. Remaining References to harness_delegate

Found in hooks and test files only:
- `hooks/tool-gate.js` — allowlist entry for `harness_delegate_coordinator`
- `hooks/__tests__/pre-tool-guard.test.sh` — test reference
- Various log files and old workflow state files

These are configuration/test references, not active delegation code.

## 5. Conclusions

1. **No subprocess delegation remains in source code.** All `child_process` usage is limited to utility commands (git, jscpd).
2. **Stale dist/ artifacts exist** for `delegate-work.js`, `delegate-coordinator.js`, and `coordinator-spawn.js`. These should be cleaned up with a fresh build.
3. **`stream-progress-tracker.ts` has stale JSDoc** referencing "coordinator subprocess" but performs no subprocess operations.
4. **`tool-gate.js` still lists `harness_delegate_coordinator`** in its allowlist, which is dead configuration.
5. **Agent(coordinator/worker) is now the sole delegation mechanism** as defined in `tool-delegation.md`.

## 6. Cleanup Recommendations

- Delete stale `dist/` artifacts or rebuild from source
- Remove `harness_delegate_coordinator` from `hooks/tool-gate.js` allowlist
- Update JSDoc in `stream-progress-tracker.ts` to remove "subprocess" references
