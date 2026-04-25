# TOON Format Compatibility Analysis

Question: Are committed .toon files written by toon-helpers.ts custom format, or by the official @toon-format/toon encode()? Are they compatible with official decode()?

## Definitive Answer

**NO, the committed .toon files are NOT written by the official encode().** They are written by toon-helpers.ts custom serialization (esc(), tableHeader(), tableRows(), toSemiList()). However, **YES, the official decode() CAN parse them** -- with caveats.

## Evidence

### 1. Write Path: All Custom

Every .toon file tracked by git is written by custom code, never by official encode():

| File Category | Writer | Import Source |
|---|---|---|
| workflow-state.toon (35 files) | state-toon-io.ts serializeState() | toon-helpers.ts |
| task-index.toon | index-toon-io.ts serializeIndex() | toon-helpers.ts |
| hmac-keys.toon | utils/hmac.ts serializeKeys() | inline custom |
| metrics.toon | metrics-toon-io.ts serializeMetrics() | toon-helpers.ts |
| reflector-log.toon | reflector-toon.ts serializeStore() | toon-helpers.ts |
| scope-definition.toon | ace-context-toon.ts | toon-helpers.ts |
| e2e-test.toon, manual-test.toon, etc. | various tools/*-toon.ts | toon-helpers.ts |

Official encode() is used in exactly 0 write paths. It is only used in 1 test file (dod-ia-coverage.test.ts) to create test fixtures.

### 2. Read Path: Dual

| Reader | Library | Usage |
|---|---|---|
| state-toon-parse.ts parseState() | toon-helpers.ts custom | Primary state reader for all runtime operations |
| dod-l3.ts checkL3Quality() | @toon-format/toon decode() | DoD gate: parse-check only (validates parsability) |
| dod-l4-content.ts checkRequiredToonKeys() | @toon-format/toon decode() | DoD gate: required key existence check |
| dod-l4-delta.ts | @toon-format/toon decode() | DoD gate: delta validation |
| approval.ts | @toon-format/toon decode() | Dynamic import for approval flow |

### 3. Format Compatibility: Mostly Compatible, 3 Gaps

The official @toon-format/toon v2.1.0 decode() successfully parses the custom format's:
- Key-value pairs (key: value)
- Table arrays with named columns (name[N]{col1,col2}: followed by indented CSV rows)
- Double-quoted cells containing commas ("hello, world")
- Dotted keys (riskScore.total, checkpoint.taskId) -- parsed as flat keys, not nested objects

Gaps where decode() produces different results than toon-helpers.ts parsers:

#### Gap 1: Empty value after colon
- Custom: `completedPhases: ` -> empty string "" -> fromSemiList("") -> []
- Official: `completedPhases: ` -> empty object {} (treats trailing colon-space as object/map start)
- Impact: DoD gates that check `"completedPhases" in obj` still pass (key exists). But the value type is wrong.

#### Gap 2: Type coercion
- Custom: `version: 4` -> string "4", manually cast to number where needed
- Official: `version: 4` -> number 4 automatically
- Custom: `riskScore.hasTests: false` -> string "false"
- Official: `riskScore.hasTests: false` -> boolean false
- Impact: DoD gates check key existence, not value types. No breakage.

#### Gap 3: Doubled-quote escaping (RFC 4180 style)
- Custom esc(): value containing `"` becomes `"say ""hello"" world"` (quotes doubled)
- Official decode(): throws "Unexpected characters after closing quote"
- Impact: Currently no committed .toon file contains doubled quotes (verified by grep). If a future value contains a literal `"` character, toon-helpers.ts will write it in a format that official decode() cannot parse, and the DoD L3 gate will FAIL.

### 4. encode() vs Custom Format Comparison

Official encode() output:
```
acceptanceCriteria[2]{id,description,status}:
  AC-1,test,met
  AC-2,test2,open
```

Custom toon-helpers.ts output:
```
acceptanceCriteria[2]{id,description,status}:
  AC-1, test, met
  AC-2, test2, open
```

Difference: custom format adds spaces after commas in table rows. Official decode() handles both.

### 5. Semicolon Arrays

Custom convention: `completedPhases: research;requirements;design`
Official decode() returns this as a plain string. The semicolon splitting is a custom convention handled by fromSemiList() in toon-helpers.ts. The official library has no concept of semicolon-delimited arrays.

## Summary Table

| Aspect | Status |
|---|---|
| All writes use custom toon-helpers.ts | YES |
| All writes use official encode() | NO (0 files) |
| Official decode() can parse committed files | YES (currently) |
| Format is identical to official encode() output | NO (spacing differs) |
| Doubled-quote values would break decode() | YES (latent bug) |
| Semicolons parsed as arrays by decode() | NO (returns plain string) |
| Type coercion differs | YES (numbers, booleans, empty values) |
| DoD gates pass with current files | YES |

## Risk Assessment

Current state is STABLE but FRAGILE:
- All committed .toon files happen to avoid the doubled-quote edge case
- DoD gates use decode() for parse-check and key-existence only, not for type-correct data extraction
- Runtime state reading uses custom parsers exclusively, so type coercion gaps do not affect functionality
- If any future AC description, RTM requirement, or user intent contains a literal `"` character, the DoD L3 gate will reject the file
