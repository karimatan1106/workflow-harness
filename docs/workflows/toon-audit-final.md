# Final .toon Reference Audit — 2026-03-23

## Summary

- Total .toon references found: 89
- PHASE_ARTIFACT_BUG: 0
- INTERNAL_STATE_OK: 72
- GATE_LOGIC_OK: 11
- OTHER: 6 (all assessed as OK)

## PHASE_ARTIFACT_BUG entries

**NONE.** No phase artifact files (hearing.toon, scope-definition.toon, research.toon, requirements.toon, etc.) are referenced anywhere in the codebase.

The core-constraints.md rule ("Markdown形式(.md)で成果物生成。内部状態ファイルはTOON(.toon)を継続使用。") is correctly enforced.

## Category Breakdown

### INTERNAL_STATE_OK (72 matches)

All of these refer to legitimate internal state files:

| File | Count | Referenced .toon files |
|------|-------|----------------------|
| state/manager-read.ts | 3 | workflow-state.toon |
| state/manager-write.ts | 2 | workflow-state.toon, task-index.toon |
| state/progress-json.ts | 2 | claude-progress.toon |
| state/state-toon-io.ts | 1 | .toon format generic |
| state/state-toon-parse.ts | 1 | .toon format generic |
| state/manager-lifecycle.ts | 1 | .toon extension allowlist |
| tools/reflector.ts | 2 | reflector-log.toon |
| tools/metrics.ts | 1 | metrics.toon |
| tools/metrics-toon.ts | 4 | phase-metrics.toon, phase-analytics.toon |
| tools/metrics-toon-io.ts | 1 | metrics.toon |
| tools/analytics-toon.ts | 2 | phase-analytics.toon |
| tools/error-toon.ts | 5 | phase-errors.toon |
| tools/phase-analytics.ts | 1 | phase-errors.toon |
| tools/gc.ts | 1 | generic .toon |
| tools/curator-helpers.ts | 1 | curator-log.toon |
| tools/curator-toon.ts | 1 | curator-log.toon |
| tools/ace-context.ts | 3 | ace-context.toon |
| tools/ace-context-toon.ts | 1 | ace-context.toon |
| tools/adr.ts | 1 | adr-store.toon |
| tools/adr-toon-io.ts | 1 | adr-store.toon |
| tools/archgate.ts | 1 | archgate-rules.toon |
| tools/archgate-toon-io.ts | 1 | archgate-rules.toon |
| tools/handlers/dci.ts | 2 | design-code-index.toon |
| tools/handlers/lifecycle.ts | 2 | phase-analytics.toon, phase-metrics.toon |
| utils/hmac.ts | 1 | hmac-keys.toon |
| hooks/context-watchdog.js | 5 | checkpoint.toon |
| hooks/session-boundary.js | 1 | HANDOFF.toon |
| dci/dci-toon-io.ts | 1 | .toon format generic |
| __tests__/ace-reflector.test.ts | 1 | reflector-log.toon |
| __tests__/ace-reflector-curator.test.ts | 3 | reflector-log.toon, ace-context.toon |
| __tests__/hmac.test.ts | 5 | hmac-keys.toon |
| __tests__/manager-core.test.ts | 2 | workflow-state.toon |
| __tests__/manager-lifecycle.test.ts | 1 | workflow-state.toon |
| __tests__/gc.test.ts | 4 | reflector-log.toon, metrics.toon |
| __tests__/metrics.test.ts | 1 | metrics.toon |
| __tests__/progress-json.test.ts | 2 | claude-progress.toon |
| __tests__/reflector-failure-loop.test.ts | 1 | reflector-log.toon |
| __tests__/reflector-quality.test.ts | 1 | reflector-log.toon |
| __tests__/stale-task-hmac.test.ts | 2 | workflow-state.toon, hmac-keys.toon |

### GATE_LOGIC_OK (11 matches)

Extension-dispatch logic that correctly differentiates .toon from .md:

| File:Line | Context |
|-----------|---------|
| gates/dod-l3.ts:13 | JSDoc: ".toon files" quality check description |
| gates/dod-l3.ts:35 | `if (!outputFile.endsWith('.toon'))` — extension dispatch |
| gates/dod-l3.ts:48 | Error message for malformed .toon files |
| gates/dod-l4-delta.ts:67 | Comment: "Internal .toon files: TOON decode path" |
| gates/dod-l4-delta.ts:75 | Error fix message for .toon format |
| gates/dod-l4-content.ts:63 | Comment: "TOON key checks only apply to .toon files" |
| gates/dod-l4-content.ts:64 | `if (extname(outputFile) === '.toon')` — extension dispatch |
| gates/dod-l4-content.ts:84 | Error fix message: ".toonファイルに ## ヘッダーやMarkdown記法を書かないこと" |
| hooks/pre-tool-guard.sh:52 | Comment: "Allow .toon and .mmd artifact writes" |
| hooks/pre-tool-guard.sh:55 | `if [[ "$FILE_PATH" == *.toon` — extension check |
| hooks/context-watchdog.js:91 | `content.includes('.toon')` — TOON format detection |

### OTHER (6 matches — all OK)

| File:Line | Content | Assessment |
|-----------|---------|------------|
| .claude/rules/core-constraints.md:6 | "内部状態ファイルはTOON(.toon)を継続使用" | POLICY_DOC_OK — correctly states the rule |
| hooks/test-guard.sh:212 | `echo ".ts,.js,.toon"` — test extension allowlist | TEST_INFRA_OK |
| hooks/test-guard.sh.bak4:251 | `/tmp/test.toon` — backup test file | BACKUP_OK (not active code) |
| hooks/test-guard.sh.bak4:256 | `.toon,.mmd` — backup test file | BACKUP_OK (not active code) |
| hooks/test-guard.sh.bak4:261 | `.ts,.tsx,.js,.jsx,.toon` — backup test file | BACKUP_OK (not active code) |
| __tests__/n63-n72.test.ts:16 | `'docs/workflows/test/spec.toon'` | TEST_FIXTURE_OK — test data for formatStructuredError, not a real phase artifact path |
| __tests__/rtm-intent-gate.test.ts:182-202 | AC-6 test: OPEN_QUESTIONS message references .toon | TEST_OK — verifies error messages mention .toon format |

## Conclusion

**Zero PHASE_ARTIFACT_BUG instances found.** The migration from .toon phase artifacts to .md is complete. All remaining .toon references are legitimate:
- Internal state files (workflow-state, metrics, reflector-log, etc.)
- Gate logic dispatching on file extension
- Policy documentation
- Test fixtures and infrastructure
