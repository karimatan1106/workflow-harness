# TOON File Error Risk Audit

Audited: 2026-03-23
Scope: 14 internal .toon files in workflow-harness
Method: Static analysis of all read/write paths, error handling, and LLM context injection

## Risk Rating Summary

| File | Writer | Reader | Parse Error Handling | LLM Context? | Risk |
|------|--------|--------|---------------------|---------------|------|
| workflow-state.toon | TS (serializeState) | TS (parseState) | partial: loadStateFromDir has try/catch, loadTaskFromDisk does NOT | No | RISKY |
| task-index.toon | TS (serializeTaskIndex) | TS only | No try/catch on read path found | No | RISKY |
| claude-progress.toon | TS (serializeProgress) | TS (parseProgress) | Yes: both read/write wrapped in try/catch | No | SAFE |
| hmac-keys.toon | TS (serializeHmacToon) | TS (parseHmacToon) | NO try/catch around parseHmacToon in loadHmacKeys | No | DANGEROUS |
| reflector-log.toon | TS (serializeStore) | TS (parseStore) + LLM prompt | Yes: loadStore has try/catch, returns fresh store | YES (formatLessonsForPrompt -> subagent prompt) | RISKY |
| ace-context.toon | TS (serializeBullets) | TS (parseBullets) + LLM prompt | Yes: loadBullets + getTopCrossTaskBullets both try/catch | YES (buildArtifactFirstSection -> subagent prompt) | RISKY |
| curator-log.toon | TS (serializeReports) | TS (parseReports) | Yes: saveCuratorReport has try/catch on read and write | No | SAFE |
| design-code-index.toon | TS (serializeDCI) | TS (parseDCI) | Yes: loadOrBuildIndex has try/catch, rebuilds on failure | No | SAFE |
| adr-store.toon | TS (serializeADRStore) | TS (parseADRStore) | Yes: loadADRStore has try/catch, returns empty store | No | SAFE |
| archgate-rules.toon | TS (serializeRuleStore) | TS (parseRuleStore) | Yes: loadRuleStore has try/catch, returns empty store | No | SAFE |
| metrics.toon | TS (serializeMetrics) | TS (parseMetrics) | Yes: loadMetrics has try/catch, returns freshStore() | No | SAFE |
| phase-metrics.toon | TS (writeMetricsToon) | Not read by TS (output-only) | N/A (write-only) | No (human/LLM readable artifact) | SAFE |
| phase-analytics.toon | TS (writeAnalyticsToon) | Not read by TS (output-only) | N/A (write-only) | No (human/LLM readable artifact) | SAFE |
| phase-errors.toon | TS (appendErrorToon) | TS (readErrorToon) | Yes: readErrorToon has try/catch, returns [] | No | SAFE |

## Detailed Findings

### DANGEROUS: hmac-keys.toon

Location: `src/utils/hmac.ts:54-69` (loadHmacKeys)

```typescript
export function loadHmacKeys(stateDir: string): HmacKeys {
  const toonPath = getToonPath(stateDir);
  if (existsSync(toonPath)) {
    return parseHmacToon(readFileSync(toonPath, 'utf8'));  // NO try/catch
  }
  // ...creates new keys
}
```

- parseHmacToon does NOT throw on malformed input (it silently returns partial object), but the returned object may have `undefined` fields (current, rotatedAt).
- Callers like ensureHmacKeys return `loadHmacKeys(stateDir).current` which would return `undefined` if the file is corrupt.
- This propagates to computeHmac where `undefined` key causes crypto errors.
- Impact: Corrupted hmac-keys.toon crashes the entire harness (all state integrity operations fail).
- No LLM writes to this file, so corruption risk is low but not zero (disk errors, partial writes).

### RISKY: workflow-state.toon

Location: `src/state/manager-read.ts:28-50` (loadTaskFromDisk)

- loadTaskFromDisk calls `parseState(readFileSync(...))` at line 39 with NO try/catch.
- If parseState throws (malformed TOON), the entire MCP tool call crashes.
- loadStateFromDir (line 71-78) DOES have try/catch, but loadTaskFromDisk does NOT.
- This is the primary read path used by harness_advance, harness_status, etc.
- Writer: Only TypeScript serializeState writes this file, so corruption is unlikely during normal operation.
- Not exposed to LLM context directly.

### RISKY: task-index.toon

Location: `src/state/manager-write.ts:49-55` (writeTaskIndex)

- Written by TypeScript only (serializeTaskIndex).
- Read path (buildTaskIndex in manager-read.ts) does not read task-index.toon at all -- it rebuilds from workflow-state.toon files.
- The file exists primarily as a cache. No direct read-and-parse path found in production code.
- Risk is low in practice but the file has no documented parse error handling.

### RISKY: reflector-log.toon

Location: `src/tools/reflector.ts:25-31` (loadStore)

- Error handling: Good. loadStore has try/catch, returns fresh store on corruption.
- LLM context injection: YES. formatLessonsForPrompt (line 128) reads lessons from this file and appends them directly to subagent prompts via definitions.ts:173.
- Risk vector: If an LLM-generated error message contains prompt injection content, it gets stored as `errorPattern` in reflector-log.toon, then later injected into future subagent prompts via formatLessonsForPrompt.
- The errorPattern is extracted via extractErrorPattern (line 146) which truncates to 80 chars, limiting but not eliminating injection risk.

### RISKY: ace-context.toon

Location: `src/tools/ace-context.ts:29-36` (loadBullets)

- Error handling: Good. Both loadBullets and getTopCrossTaskBullets have try/catch.
- LLM context injection: INDIRECT. The content field of AceBullet is composed from reflector lessons (`${l.phase}: ${l.errorPattern} -> ${l.lesson}`). While buildArtifactFirstSection in definitions.ts only lists file paths (not bullet content), the ace-context.toon is available to be read by subagents via the file system.
- Risk vector: Cross-task lesson propagation means a malicious pattern from one task can persist and affect future tasks.

## Custom Parser vs. @toon-format/toon Library Usage

Critical finding: The 14 files use TWO different parsing approaches:

1. Custom hand-rolled parsers (state-toon-parse.ts, reflector-toon.ts, hmac.ts, progress-json.ts, error-toon.ts, metrics-toon.ts, etc.) -- Used for ALL 14 internal files.
2. @toon-format/toon library (toonDecode/toonEncode) -- Used ONLY in DoD gate checks (dod-l3.ts, dod-l4-content.ts, dod-l4-delta.ts) for validating LLM-written artifact files.

This means: The internal files are never validated by the standard toonDecode parser. Each file has its own bespoke parser with its own edge-case handling. The custom parsers are more lenient (they silently skip malformed lines) which makes them less likely to crash but more likely to silently lose data.

## Recommendations

1. hmac-keys.toon: Add try/catch to loadHmacKeys. On parse failure, regenerate keys and re-sign all active task states.
2. workflow-state.toon: Add try/catch to loadTaskFromDisk's parseState call (like loadStateFromDir already has).
3. reflector-log.toon: Sanitize errorPattern content before injection into prompts (strip control characters, limit to alphanumeric + basic punctuation).
4. Consider adding a common `safeParseToon(content, fallback)` wrapper to standardize error handling across all 14 files.
