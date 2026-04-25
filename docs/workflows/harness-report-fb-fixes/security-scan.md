# Security Scan: harness-report-fb-fixes

phase: security_scan
task: harness-report-fb-fixes
scanned-at: 2026-03-30
scanner: coordinator (L2)

## Scan Scope

| File | Lines | FB |
|------|-------|----|
| coordinator-prompt.ts | 96 | FB-1, FB-5 |
| dod-helpers.ts | 154 | FB-2 |
| manager-write.ts | 163 | FB-4 |
| manager-lifecycle.ts | 158 | FB-6 |

## Finding 1: Write/Edit Filter Bypass (FB-1 + FB-5)

file: coordinator-prompt.ts (L29-34)
risk: low (server-side registry generation prevents bypass)
verdict: safe (PHASE_REGISTRY is immutable)

buildAllowedTools removes Write/Edit when bashCategories is readonly. bashCategories is derived from PHASE_REGISTRY on the server side, not from client input. An external caller cannot inject arbitrary bashCategories values because the PhaseGuide object is constructed internally by buildPhaseGuide from the immutable registry. No bypass vector exists.

## Finding 2: Regular Expression ReDoS (FB-2)

file: dod-helpers.ts (L15-36, L80-86)
risk: low (linear match only, no backtracking required)
verdict: safe (no ReDoS pattern detected)

All regex patterns in isStructuralLine use anchored patterns (^) with non-overlapping character classes. BRACKET_PLACEHOLDER_REGEX uses a negated class `[^\]]{0,50}` with a hard upper bound of 50 characters, preventing catastrophic backtracking. AI_SLOP_CATEGORIES patterns use word boundaries and alternation of fixed strings without nested quantifiers. No pattern contains the `(a+)+` or `(a|a)*` structures that cause exponential backtracking. Input length is bounded by file content already validated at the DoD gate (200-line limit per checkFileLineLimit).

## Finding 3: RTM Upsert ID Validation (FB-4)

file: manager-write.ts (L126-135)
risk: low (Zod schema enforces ID format upstream)
verdict: safe (input validation layer provides protection)

applyAddRTM performs upsert by matching entry.id via findIndex. The RTMEntry.id field is validated upstream by the harness_add_rtm MCP tool schema, which enforces the `F-NNN` format pattern through Zod validation before the handler is reached. No free-form string reaches applyAddRTM without schema enforcement. The upsert logic (splice on match, push on miss) is deterministic and cannot corrupt the array.

## Finding 4: artifactHashes Full Clear on goBack (FB-6)

file: manager-lifecycle.ts (L127)
risk: low (full clear is a fail-safe design decision)
verdict: safe (normalizeForSigning guarantees HMAC consistency)

goBack sets `state.artifactHashes = {}` to clear all cached artifact hashes when reverting to a previous phase. Full clear is the safer approach compared to selective deletion because partial clearing risks stale hashes surviving for phases that will be re-executed. After goBack, all affected phases re-run their DoD checks, which regenerate artifact hashes from scratch. The empty object is also handled correctly by normalizeForSigning (manager-write.ts L90), which deletes empty artifactHashes before HMAC signing to ensure roundtrip consistency.

## decisions

- SEC-001: All 4 FB fixes carry no security risk. No OWASP Top 10 vulnerability patterns detected.
- SEC-002: FB-2 regex patterns are ReDoS-resistant. Only anchored patterns with bounded quantifiers are used.
- SEC-003: FB-4 upsert is protected by Zod schema ID format validation. Arbitrary ID injection is not possible.
- SEC-004: FB-6 full clear poses no data loss risk. artifactHashes is derived data that is regenerated on re-execution.
- SEC-005: FB-1+5 Write/Edit filter depends on server-side PHASE_REGISTRY. Client manipulation cannot circumvent it.

## Artifacts

- coordinator-prompt.ts: 96 lines, 0 issues
- dod-helpers.ts: 154 lines, 0 issues
- manager-write.ts: 163 lines, 0 issues
- manager-lifecycle.ts: 158 lines, 0 issues

## Next

- proceed to implementation phase with confirmed security clearance for all 4 FB fixes
