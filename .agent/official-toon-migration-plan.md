# Migration Plan: Custom TOON I/O to Official @toon-format/toon Library

## 1. Library API Summary

Library: @toon-format/toon v2.1.0 (spec v3.0)

### encode(input, options?) -> string
- Accepts any JS value (objects, arrays, primitives)
- Nested objects: indentation-based (YAML-like)
- Uniform arrays of objects: tabular entries[N]{col1,col2}: followed by val1,val2
- Primitive arrays: inline items[3]: a,b,c
- Record<string,T>: rendered as nested KV object
- null rendered as literal null, undefined as null, empty string as double-quoted empty
- Booleans: true/false literals
- Comma in values: auto double-quoted
- Options: indent (default 2), delimiter (default comma), keyFolding, replacer

### decode(input, options?) -> JsonValue
- Auto-detects types: numbers, booleans (true/false), null, strings
- Tabular rows: parsed with spaces after delimiters tolerated
- expandPaths: safe reconstructs dotted keys into nested objects
- strict: true (default) validates array lengths
- Returns JsonValue (needs type cast)

### Key Behaviors Verified by Testing
- Scalar KV roundtrips perfectly with auto type detection
- Nested objects produce indented blocks (NOT dotted keys)
- null in tabular rows: rendered as null, decoded back as null
- Primitive arrays use inline format: files[3]: a.ts,b.ts,c.ts
- Empty arrays: items[0]:
- Roundtrip of TaskState-like structures: perfect fidelity

## 2. Format Differences: Custom vs Official

| Aspect | Custom (toon-helpers.ts) | Official (encode/decode) |
|--------|--------------------------|--------------------------|
| Nested objects | Flattened dotted keys: riskScore.total: 5 | Indented: riskScore: / total: 5 |
| Primitive arrays | Semicolon-separated: phases: a;b;c | Comma inline: phases[3]: a,b,c |
| Tabular arrays | entries[N]{cols}: + v1, v2 (space after comma) | entries[N]{cols}: + v1,v2 (no space) |
| null/undefined | Omitted or empty string | null literal |
| Boolean | String true/false | Native true/false (auto-typed on decode) |
| Number | String (manual parseInt on decode) | Auto-typed on decode |
| Escaping | CSV-style double-quote doubling | Backslash escaping |
| Record<K,V> maps | Custom table: retryCount[2]{phase,count}: | Nested KV: retryCount: / research: 2 |

### Breaking Change: Dotted Keys
Custom format uses riskScore.total: 5 (flat). Official uses nested indentation.
The official decode with expandPaths: safe CAN read dotted keys, but encode will NEVER produce them.
This means existing .toon files with dotted keys need migration.

### Breaking Change: Semicolon Arrays
Custom format: completedPhases: research;design;implement
Official format: completedPhases[3]: research,design,implement
Official decode reads semicolons as a literal string, NOT as an array.

## 3. File-by-File Analysis

### 3a. state-toon-io.ts + state-toon-parse.ts (TaskState)
- Data type: TaskState (complex: nested objects, arrays, table arrays, maps)
- Serialization: 178 lines of manual KV + table building
- Parsing: 180 lines of manual line-by-line parsing
- Dotted keys for riskScore, checkpoint, baseline, projectTraits -> official uses nesting (natural fit)
- Semicolon arrays (completedPhases, scopeFiles, etc.) -> official uses [N]: a,b,c
- Table arrays (acceptanceCriteria, rtmEntries, proofLog, etc.) -> official tabular format matches
- Maps (subPhaseStatus, retryCount, approvals) -> official nested KV
- encode(state) handles the FULL TaskState directly
- decode(content) returns correct types for numbers/booleans automatically
- Verdict: encode() handles directly. decode() needs type assertion only.

### 3b. dci-toon-io.ts (DCIIndex)
- Data type: DCIIndex (codeToDesign/designToCode as Record<string, object>, orphan lists)
- Custom format uses semicolon-joined sub-arrays inside CSV cells
- Official encode uses nested format for non-uniform data, eliminating the semicolon-in-cell pattern
- Verdict: encode() handles directly.

### 3c. metrics-toon-io.ts (MetricsStore)
- Custom format uses dynamic table names (taskPhases_{taskId})
- Solution: use the natural JSON shape where phases are nested inside each task object
- Verdict: encode() handles after ensuring structure matches JSON expectations.

### 3d. ace-context-toon.ts (AceBullet[])
- Uniform array of objects, single table bullets[N]{cols}:
- Verdict: Direct encode/decode. Numbers auto-typed on decode.

### 3e. curator-toon.ts (CuratorReport[])
- Custom format uses indexed tables: reportActions_0[N]{...}:
- Solution: store actions nested inside each report object
- Verdict: Restructure data shape, then direct encode/decode.

### 3f. archgate-toon-io.ts (ArchRuleStore)
- version + rules array, single table
- Verdict: Direct encode/decode.

### 3g. adr-toon-io.ts (ADRStore)
- version + entries array, single table
- Verdict: Direct encode/decode.

### 3h. error-toon.ts (DoDFailureEntry)
- Append-only log with separator-delimited blocks
- Solution: store as { entries: DoDFailureEntry[] }, rewrite entire file on each append
- Verdict: Restructure to array-of-objects, encode/decode full file.

### 3i. analytics-toon.ts (write-only, AnalyticsResult)
- Complex nested analytics
- Verdict: Direct encode(). No decoder needed.

### 3j. metrics-toon.ts (write-only, TaskMetrics)
- Verdict: Direct encode(). No decoder needed.

## 4. Migration Approach

### 4a. Adapter Layer (toon-io-adapter.ts)
Create a thin adapter module with toonEncode<T>() and toonDecode<T>() wrappers around the official encode/decode, adding trailing newline on encode and type assertion on decode.

### 4b. What Gets DELETED from toon-helpers.ts
ALL functions become unnecessary:
- esc() / unesc() -- official handles escaping
- toSemiList() / fromSemiList() -- primitive arrays handled natively
- parseCsvRow() -- tabular parsing handled by decode
- tableHeader() / tableRows() -- tabular encoding handled by encode
- parseToonKv() -- KV parsing handled by decode
- parseTableBlock() -- table block parsing handled by decode
- parseKV() / parseListHeader() -- header detection handled by decode

The entire toon-helpers.ts file is DELETED.

### 4c. Data Shape Changes Required

1. TaskState: No shape change needed. Nested objects are natural JSON. Semicolon arrays become real arrays. Maps become nested KV.

2. DCIIndex: No shape change. Semicolons-in-cells pattern goes away.

3. MetricsStore: Remove dynamic taskPhases_{id} tables. Already nested in TypeScript shape.

4. CuratorReport: Remove indexed reportActions_N tables. Already nested in TypeScript type.

5. DoDFailureEntry: Change from append-only blocks to { entries: DoDFailureEntry[] }.

### 4d. Type Coercion Handling
Official decode auto-converts numbers, booleans, and null. This eliminates all manual toNum(), toBool(), orUndef() helpers. Remaining need: enum narrowing via type assertions.

### 4e. Existing Files on Disk
Strategy: Let them regenerate naturally. All files are rewritten within 1-2 task cycles. Add compatibility decode with fallback to legacy parser for one release cycle.

### 4f. Backward Compatibility
Add fallback parsing in toonDecodeSafe<T>(): try official decode first, fall back to legacy parser if it throws. Remove legacy parsers after one release cycle.

## 5. Worker Task Decomposition

### Worker 1: Core adapter + toon-helpers.ts removal
- Create src/state/toon-io-adapter.ts with toonEncode<T>() and toonDecode<T>() wrappers
- Delete all functions from toon-helpers.ts
- Update all import paths that reference toon-helpers
- Estimated files changed: 2 new, 1 deleted, ~12 import updates

### Worker 2: TaskState migration (state-toon-io.ts + state-toon-parse.ts)
- Replace serializeState() with toonEncode(state)
- Replace parseState() with toonDecode<TaskState>(content) + type validation
- Add fallback: if decode throws, try legacy parseState for backward compat
- Handle enum narrowing in a small post-decode validator function
- Update tests in manager-core.test.ts, manager-lifecycle.test.ts
- Estimated files changed: 2 rewritten, 2-4 test files updated

### Worker 3: DCI + Metrics migration (dci-toon-io.ts + metrics-toon-io.ts)
- Replace serializeDCI() / parseDCI() with encode/decode
- Replace serializeMetrics() / parseMetrics() with encode/decode
- Eliminate dynamic taskPhases_{id} table convention
- Eliminate semicolon-joined sub-arrays in DCI cells
- Update tests in metrics.test.ts
- Estimated files changed: 2 rewritten, 1-2 test files updated

### Worker 4: Small I/O modules (ace-context, adr, archgate, curator)
- ace-context-toon.ts: Replace serialize/parse with encode/decode
- adr-toon-io.ts: Replace serialize/parse with encode/decode
- archgate-toon-io.ts: Replace serialize/parse with encode/decode
- curator-toon.ts: Replace serialize/parse with encode/decode
- Update tests in ace-reflector.test.ts, ace-reflector-curator.test.ts
- Estimated files changed: 4 rewritten, 2-3 test files updated

### Worker 5: Write-only modules + error-toon restructure
- analytics-toon.ts: Replace manual line building with encode()
- metrics-toon.ts: Replace manual line building with encode()
- error-toon.ts: Restructure from append-only to full-file rewrite with encode/decode
- Estimated files changed: 3 rewritten

### Worker 6: Integration tests + cleanup
- Run full test suite, fix any regressions
- Add roundtrip tests: encode -> decode -> deep-equal for each data type
- Remove legacy fallback code if all tests pass
- Delete toon-helpers.ts entirely
- Update HMAC calculation if toon format change affects state integrity hash
- Estimated files changed: 1 deleted, 3-5 test files added/updated

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| HMAC/integrity hash mismatch | High - state rejected | Recalculate HMAC after encode; format change invalidates old HMACs |
| Existing .toon files fail decode | Medium - task state lost | Fallback to legacy parser for one cycle |
| Number auto-typing breaks string fields | Medium - wrong types | Test all fields; ISO timestamps stay strings |
| Tabular row delimiter mismatch | Low - spaces tolerated | Official decode handles both v1,v2 and v1, v2 |
| encode() output larger than custom | Low | Nested format more readable, similar token count |
| error-toon append pattern lost | Low | Full rewrite acceptable for small files |

## 7. Execution Order

1. Worker 1 first (adapter layer, shared dependency)
2. Workers 2-5 in parallel (independent modules)
3. Worker 6 last (integration, cleanup)

## 8. Verification Criteria

- All existing tests pass with no modification to test assertions (only to I/O code)
- New roundtrip tests: for each data type, encode(original) -> decode -> deep-equal to original
- HMAC recalculation verified on state write
- No legacy toon-helpers.ts imports remain in codebase
- vitest --coverage shows no regression in covered lines
