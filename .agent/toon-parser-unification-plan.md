# TOON Parser Unification Plan

Unify all hand-rolled TOON parsers/serializers to use @toon-format/toon v2.1.0 encode()/decode().

## 1. Official Library API Summary

Package: @toon-format/toon v2.1.0 (ESM-only, dist/index.mjs)

### encode(input, options?) -> string
- Accepts: any JS value (objects, arrays, primitives)
- Returns: TOON-formatted string
- Options: indent (default 2), delimiter (comma/tab/pipe), keyFolding, replacer
- Objects become key: value lines
- Array of objects become arrayName[] with dash-prefixed items
- Primitive arrays become inline comma-separated

### decode(input, options?) -> JsonValue
- Accepts: TOON string
- Returns: parsed JS value (object, array, primitive)
- Options: indent, strict (default true), expandPaths
- Automatically infers types: numbers, booleans, null, strings
- Strict mode validates array lengths and row counts

### Key Differences from Hand-Rolled Format
The hand-rolled parsers use a custom table array syntax:

    entries[5]{id,name,status}:
      val1, val2, val3

The official library uses a different array-of-objects syntax:

    entries[]:
      - id: val1
        name: val2
        status: val3

This is a BREAKING FORMAT CHANGE. Existing .toon files on disk will not be parseable by
the official decode() without a migration step.

### Gotchas
1. The official library does NOT support the name[N]{col1,col2}: table header syntax used everywhere.
2. The official library auto-converts numeric strings to numbers and true/false to booleans. Hand-rolled parsers leave everything as strings and cast manually.
3. Semicolon-separated arrays-in-cells (e.g., completedPhases: a;b;c) are a custom convention not recognized by the official library.
4. The official library object-array format uses more tokens than the CSV-row format.
## 2. Shared Helpers Inventory

### state/toon-helpers.ts (130 lines)
Canonical shared helpers. Used by state-toon-io.ts, state-toon-parse.ts, index-toon-io.ts, delegate-coordinator.ts.
Provides: esc(), unesc(), toSemiList(), fromSemiList(), parseCsvRow(), tableHeader(), tableRows(), parseToonKv(), parseTableBlock()

### state/toon-io.ts (61 lines)
Older shared helpers. Used by dci-toon-io.ts, progress-json.ts.
Provides: esc(), unesc(), splitRow(), parseKV(), parseTableHeader(), parseListHeader()
Duplicates most of toon-helpers.ts but with slightly different implementations.

### Relationship
- toon-helpers.ts is the newer, more complete version
- toon-io.ts is the older version, still used by 2 files
- Both define esc() and unesc() with slightly different signatures (unknown vs string)

## 3. Full File Inventory

### Files with LOCAL (inline) esc/splitRow/splitCsvRow definitions

| # | File | Lines | Custom Functions | .toon Files | Data Structure | try/catch |
|---|------|-------|-----------------|-------------|----------------|-----------|
| 1 | tools/ace-context-toon.ts | 1-81 | esc(), unesc(), splitRow() | ace-context.toon | AceBullet[] (table array) | NO |
| 2 | tools/adr-toon-io.ts | 1-73 | esc(), splitCsvRow() | adr-store.toon | ADRStore (KV + table) | NO |
| 3 | tools/archgate-toon-io.ts | 1-82 | esc(), splitCsvRow() | archgate-rules.toon | ArchRuleStore (KV + table) | NO |
| 4 | tools/reflector-toon.ts | 1-101 | esc(), unesc(), splitRow() | reflector-log.toon | ReflectorStore (KV + 2 tables) | NO |
| 5 | tools/curator-toon.ts | 1-109 | esc(), unesc(), splitRow() | curator-log.toon | CuratorReport[] (multi-table, indexed) | NO |
| 6 | tools/error-toon.ts | 1-120 | esc() | phase-errors.toon | DoDFailureEntry[] (append-mode) | YES |
| 7 | tools/metrics-toon.ts | 1-61 | esc() | phase-metrics.toon | TaskMetrics (KV + table, write-only) | NO |
| 8 | tools/metrics-toon-io.ts | 1-135 | esc(), splitCsvRow() | metrics.toon | MetricsStore (KV + multi-table) | NO |
| 9 | tools/analytics-toon.ts | 1-104 | esc() | phase-analytics.toon | AnalyticsResult (KV + nested, write-only) | NO |

### Files using SHARED helpers (toon-helpers.ts or toon-io.ts)

| # | File | Lines | Imports From | .toon Files | Data Structure | try/catch |
|---|------|-------|-------------|-------------|----------------|-----------|
| 10 | state/state-toon-io.ts | 1-179 | toon-helpers.ts | workflow-state.toon | TaskState (KV + semi-lists + 10+ tables) | NO |
| 11 | state/state-toon-parse.ts | 1-175 | toon-helpers.ts | workflow-state.toon | TaskState (parse side) | NO |
| 12 | state/index-toon-io.ts | 1-61 | toon-helpers.ts | task-index.toon | TaskIndex (KV + 1 table) | NO |
| 13 | state/progress-json.ts | 1-128 | toon-io.ts | claude-progress.toon | ProgressData (KV + 1 table) | YES |
| 14 | dci/dci-toon-io.ts | 1-109 | toon-io.ts | design-code-index.toon | DCIIndex (KV + 2 tables + 2 lists) | NO |
| 15 | utils/hmac.ts | 24-48 | none (inline) | hmac-keys.toon | HmacKeys (KV only, 3-4 fields) | NO |
| 16 | tools/handlers/delegate-coordinator.ts | 309-335 | toon-helpers.ts | (inline KV output) | (write-only, single KV lines) | NO |

### Gate files already using @toon-format/toon decode

| File | Usage |
|------|-------|
| gates/dod-l4-delta.ts | decode() for .toon validation |
| gates/dod-l3.ts | decode() for .toon parse check |
| gates/dod-l4-content.ts | decode() for .toon key validation |
| tools/handlers/approval.ts | dynamic import for decode |

### NOT in scope (Markdown/text analysis, not TOON I/O)
- gates/dod-helpers.ts, gates/dod-l4-requirements.ts, gates/dod-l4-toon.ts
- gates/dod-l4-ia.ts, gates/dod-l1-l2.ts
- tools/comment-ratio.ts, tools/linter-runner.ts, tools/instruction-counter.ts
## 4. Complexity Classification

### BLOCKER: Format Incompatibility

The official @toon-format/toon library uses a DIFFERENT array serialization format than the
hand-rolled code. The hand-rolled CSV-row table format and the official dash-item format
are NOT interchangeable. A direct switch to encode()/decode() would:
1. Break all existing .toon files on disk
2. Change the on-disk format for all state files
3. Require migration of all existing workflow state

### Strategy Options

Option A: Full Migration (high risk, high reward)
- Switch all files to official encode()/decode()
- Write a one-time migration script for on-disk .toon files
- Risk: subtle type coercion bugs (numbers auto-parsed, booleans auto-converted)

Option B: Hybrid (medium risk)
- Keep the custom table-array format for serialization (write side)
- Use official decode() where it already works (gate files)
- Consolidate all custom parsers to use toon-helpers.ts (eliminate duplication)

Option C: Consolidate Only (low risk, recommended first step)
- Eliminate all 9 inline esc()/splitRow()/splitCsvRow() definitions
- Make all files import from state/toon-helpers.ts
- Keep the custom table-array format (no on-disk change)
- Add missing try/catch wrappers
- Then evaluate official library adoption separately

### Recommendation: Option C first, then evaluate Option A

## 5. Minimum Change Set (Option C)

### Group 1: Simple (direct helper replacement, no logic change)

| File | Change | Effort |
|------|--------|--------|
| tools/error-toon.ts:9-11 | Delete local esc(), import from toon-helpers | S |
| tools/metrics-toon.ts:10-11 | Delete local esc(), import from toon-helpers | S |
| tools/analytics-toon.ts:12-13 | Delete local esc(), import from toon-helpers (BUG: missing quote doubling) | S |
| utils/hmac.ts:24-48 | Delete local serialize/parse, import parseToonKv/use KV helpers | S |
| tools/handlers/delegate-coordinator.ts | Already imports from toon-helpers. No change needed. | - |

### Group 2: Medium (replace local esc + splitCsvRow/splitRow with shared parseCsvRow)

| File | Change | Effort |
|------|--------|--------|
| tools/ace-context-toon.ts:9-41 | Delete local esc/unesc/splitRow (33 lines), import from toon-helpers | M |
| tools/adr-toon-io.ts:8-28 | Delete local esc/splitCsvRow (21 lines), import from toon-helpers | M |
| tools/archgate-toon-io.ts:8-28 | Delete local esc/splitCsvRow (21 lines), import from toon-helpers | M |
| tools/reflector-toon.ts:9-41 | Delete local esc/unesc/splitRow (33 lines), import from toon-helpers | M |
| tools/curator-toon.ts:12-43 | Delete local esc/unesc/splitRow (32 lines), import from toon-helpers | M |
| tools/metrics-toon-io.ts:8-28 | Delete local esc/splitCsvRow (21 lines), import from toon-helpers | M |
| state/progress-json.ts | Switch from toon-io.ts to toon-helpers.ts | M |
| dci/dci-toon-io.ts | Switch from toon-io.ts to toon-helpers.ts | M |

### Group 3: Complex (structural changes needed)

| File | Change | Effort |
|------|--------|--------|
| state/toon-io.ts | DELETE ENTIRELY after migrating its 2 consumers | M |
| state/state-toon-io.ts + state-toon-parse.ts | Already use toon-helpers.ts. Add try/catch to parseState. | S |
| tools/error-toon.ts:61-119 | Custom append-mode parsing with --- retry delimiters. Unique format. | L |
### Additional: Add Error Handling

Files that need try/catch around parse functions (currently missing):

| File | Function | Risk if Corrupt |
|------|----------|----------------|
| tools/ace-context-toon.ts | parseBullets() | Silent crash |
| tools/adr-toon-io.ts | parseADRStore() | Silent crash |
| tools/archgate-toon-io.ts | parseRuleStore() | Silent crash |
| tools/reflector-toon.ts | parseStore() | Silent crash |
| tools/curator-toon.ts | parseReports() | Silent crash |
| tools/metrics-toon-io.ts | parseMetrics() | Silent crash |
| state/state-toon-parse.ts | parseState() | Silent crash |
| state/index-toon-io.ts | parseTaskIndex() | Silent crash |
| dci/dci-toon-io.ts | parseDCI() | Silent crash |

Files with existing try/catch (OK):
- tools/error-toon.ts: readErrorToon()
- state/progress-json.ts: readProgressJSON()

### Bug Found: analytics-toon.ts esc() Missing Quote Doubling

File: tools/analytics-toon.ts line 13.
The local esc() does NOT double internal quotes. If a value contains a double-quote character,
the output will be malformed TOON. All other esc() implementations correctly double quotes.
This is fixed automatically by switching to toon-helpers.ts esc().

## 6. Decommission Plan for toon-io.ts

After migration:
1. state/progress-json.ts: change import from ./toon-io.js to ./toon-helpers.js
   - esc -> same name
   - splitRow -> parseCsvRow
   - parseKV -> use parseToonKv or inline
   - parseTableHeader -> not needed (parseTableBlock handles it)
2. dci/dci-toon-io.ts: change import from ../state/toon-io.js to ../state/toon-helpers.js
   - esc, splitRow -> esc, parseCsvRow
   - parseKV -> use parseToonKv
   - parseTableHeader, parseListHeader -> inline or add to toon-helpers
3. Delete state/toon-io.ts

Note: parseListHeader() from toon-io.ts is used only by dci-toon-io.ts. It needs to be
moved to toon-helpers.ts or inlined in dci-toon-io.ts.

## 7. Worker Task Decomposition

| Worker | Files | Type | Depends On |
|--------|-------|------|-----------|
| W1 | toon-helpers.ts: add parseKV, parseListHeader from toon-io.ts | prep | - |
| W2 | analytics-toon.ts, metrics-toon.ts, error-toon.ts (write side only) | Group 1 | W1 |
| W3 | hmac.ts | Group 1 | W1 |
| W4 | ace-context-toon.ts, adr-toon-io.ts, archgate-toon-io.ts | Group 2 | W1 |
| W5 | reflector-toon.ts, curator-toon.ts, metrics-toon-io.ts | Group 2 | W1 |
| W6 | progress-json.ts, dci-toon-io.ts | Group 2 (toon-io.ts migration) | W1 |
| W7 | Delete toon-io.ts, add try/catch to all parse functions | Group 3 | W4,W5,W6 |
| W8 | Run full test suite, fix regressions | validation | W7 |

## 8. Lines of Code Impact Summary

- Lines deleted (inline esc/splitRow/splitCsvRow): ~215 lines across 9 files
- Lines deleted (toon-io.ts): 61 lines
- Lines added (toon-helpers.ts additions): ~20 lines (parseKV, parseListHeader)
- Lines added (try/catch wrappers): ~45 lines across 9 files
- Lines modified (import changes): ~16 lines
- Net reduction: ~195 lines
- Bug fixed: 1 (analytics-toon.ts esc missing quote doubling)
