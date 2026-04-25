# TOON Format Divergence Analysis: Custom Encoders vs Official Library

## Executive Summary

There are TWO fundamentally incompatible escaping conventions in use:

1. **Official @toon-format/toon v2.1.0** (spec v3.0.0): Uses backslash escaping (`\"`, `\`, `\n`, `\r`, `\t`)
2. **Custom hand-rolled encoders** (14+ files): Use CSV-style double-quote escaping (`""` for embedded quotes, no newline escaping)

These are NOT interchangeable. However, the risk to internal state files is currently LOW because DoD gates do NOT validate internal state files with the official library. The risk to phase artifacts is REAL and has already caused production failures.

## Finding 1: Escaping Convention Mismatch

### Official library (index.mjs lines 36-37)

```
function escapeString(value) {
  return value.replace(/\/g, `\\`).replace(/"/g, `\\"`).replace(/\n/g, `\n`).replace(/\r/g, `\r`).replace(/\t/g, `\t`);
}
```

The official `decode()` expects backslash-escaped strings inside double quotes:
- `"hello \"world\""` -- backslash-escaped quote
- `"line1\nline2"` -- backslash-escaped newline
- A raw `""` inside a string would be parsed as an empty string followed by unexpected characters

### Custom encoders (toon-helpers.ts, toon-io.ts, reflector-toon.ts, metrics-toon-io.ts)

All 4+ copies of `esc()` use CSV-style escaping:
```
function esc(v) {
  if (v.includes(',') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
```

- `"hello ""world"""` -- doubled-quote escaping (CSV convention)
- Newlines within values are NOT escaped at all

### Concrete failure scenario

If a value contains a literal quote (e.g., error message `Missing colon after key`), the custom encoder outputs:
```
  L-011, scope_definition, "Duplicate lines (3+ times): ""impl..."" (3x)"
```
The official `decode()` would see the first `""` and throw `SyntaxError("Unexpected characters after closing quote")` because it interprets `""` as: closing-quote then opening-quote-of-next-token.

## Finding 2: DoD Gates and Internal State Files -- Scope Analysis

### DoD gates that use `toonDecode()` from official library

| Gate file | What it validates |
|-----------|-------------------|
| dod-l3.ts (checkL3Quality) | Phase artifact outputFile (from PHASE_REGISTRY) |
| dod-l4-content.ts (checkRequiredToonKeys) | Phase artifact outputFile |
| dod-l4-delta.ts (checkDeltaEntryFormat) | Phase artifact outputFile |
| handlers/approval.ts | requirements.md (via toonDec) |

### What are the phase artifact outputFiles?

From registry.ts: ALL phase artifacts are `.md` or `.mmd` files. There are ZERO `.toon` outputFiles in the phase registry. This means:

- DoD L3 TOON parse check: only runs on `.toon` extension files, but no phase outputs are `.toon`
- DoD L4 content: checks `.toon` extension for required keys, but no phase outputs are `.toon`
- DoD L4 delta: tries `toonDecode` on non-.md files, but all outputs are `.md`

### Internal state files (custom-encoded)

| File | Encoder | Read by official decode? |
|------|---------|--------------------------|
| workflow-state.toon | state-toon-io.ts (toon-helpers.ts) | NO -- read by custom state-toon-parse.ts |
| task-index.toon | index-toon-io.ts (toon-helpers.ts) | NO -- read by custom parseTaskIndex |
| metrics.toon | metrics-toon-io.ts (own esc) | NO -- read by custom parseMetrics |
| reflector-log.toon | reflector-toon.ts (own esc) | NO -- read by custom parseStore |
| design-code-index.toon | dci-toon-io.ts | NO -- read by custom parser |
| hmac-keys.toon | utils/hmac.ts | NO -- read by custom parser |
| ace-context.toon | ace-context-toon.ts | NO -- read by custom parser |
| adr-store.toon | adr-toon-io.ts | NO -- read by custom parser |
| archgate-rules.toon | archgate-toon-io.ts | NO -- read by custom parser |
| curator-log.toon | curator-toon.ts | NO -- read by custom parser |
| error-toon.ts outputs | error-toon.ts | NO -- read by custom parser |
| analytics outputs | analytics-toon.ts | NO -- read by custom parser |
| metrics-toon outputs | metrics-toon.ts | NO -- read by custom parser |
| progress-json.ts outputs | progress-json.ts | NO -- read by custom parser |

Result: Internal state files form a closed loop -- custom write, custom read. The official library is never invoked on them.

## Finding 3: Past Failures from Reflector Log

The reflector-log.toon itself contains evidence of TOON parse failures on phase artifacts:

- L-010: `[L3] TOON parse failed: Unexpected characters after closing quote` -- This is exactly the `""` vs `\"` mismatch symptom
- L-011: `TOON parse error: Expected 3 tabular` -- Count mismatch from malformed rows
- L-012: `[L3] TOON parse failed: Missing colon after key` -- Structural format error
- stashedFailures entry for task d49cca02: `TOON decode failed: Missing colon after key`

These failures occurred when LLM-generated `.toon` phase artifacts were validated by the official library. The LLM likely produced CSV-style TOON (matching the custom encoder style it sees in codebase) rather than official-spec TOON.

## Finding 4: Embedded Newline Corruption in reflector-log.toon

The actual reflector-log.toon file has corrupted rows. Lines 6-7:
```
  L-002, security_scan, [L1] File missing: docs\workflows\inv-n-cli-migration/security-scan.toon
[L3] Ca, ...
```

The error message contains a literal newline, which the custom `esc()` does NOT escape (it only checks for comma and double-quote). This breaks the table row across two lines. The custom parser happens to tolerate this partially (it just truncates at the newline boundary), but the data is silently corrupted.

The toon-helpers.ts `esc()` function DOES handle newlines (checks for `\n`), but the copy-pasted `esc()` in reflector-toon.ts and metrics-toon-io.ts does NOT.

## Risk Assessment

| Risk | Severity | Current Status |
|------|----------|----------------|
| Internal state files rejected by official decode | LOW | Not happening -- closed loop |
| Phase artifact TOON files rejected by official decode | MEDIUM | Already happened (L-010, L-012) but registry now uses .md only |
| Embedded newlines corrupting internal .toon state | HIGH | Already happening in reflector-log.toon |
| Future migration to official library for state files | HIGH | Would require rewriting all custom encoders |
| LLM generating wrong TOON style for artifacts | MEDIUM | Mitigated by switching artifacts to .md format |
| 4+ duplicate esc() implementations diverging | MEDIUM | reflector-toon.ts and metrics-toon-io.ts already diverged (missing newline handling) |

## Recommendations

1. IMMEDIATE: Fix `esc()` in reflector-toon.ts and metrics-toon-io.ts to handle newlines (match toon-helpers.ts version)
2. SHORT-TERM: Consolidate all custom esc/unesc into a single shared module (eliminate copy-paste drift)
3. MEDIUM-TERM: Decide whether to migrate internal state to official TOON spec (backslash escaping) or formalize the CSV-style variant as an intentional "TOON-CSV" dialect
4. DOCUMENTATION: Add a comment/ADR documenting that internal .toon files use CSV-escaping, NOT official TOON-spec escaping

## File Inventory: Custom esc() Implementations

| File | Handles newlines? | Handles null/undefined? |
|------|-------------------|------------------------|
| state/toon-helpers.ts | YES (line 13) | YES (line 11) |
| state/toon-io.ts | NO | NO |
| tools/reflector-toon.ts | NO | NO |
| tools/metrics-toon-io.ts | NO | NO |

The toon-helpers.ts version is the most complete. The other three are weaker copies.
