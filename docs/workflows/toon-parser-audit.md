# TOON Parser Audit: Library vs Custom Parser Analysis

Date: 2026-03-23
Scope: All 14 internal .toon files in mcp-server/src/

## 1. @toon-format/toon Library Usage

Files that import @toon-format/toon:

| File | Import | Usage |
|------|--------|-------|
| gates/dod-l3.ts | decode as toonDecode | Validates .toon files parse without error (L3 gate) |
| gates/dod-l4-content.ts | decode as toonDecode | Decodes .toon to check required keys (L4 gate) |
| gates/dod-l4-delta.ts | decode as toonDecode | Decodes .toon for delta diff checks (L4 gate) |
| tools/handlers/approval.ts | decode: toonDec (dynamic) | Parses requirements.md for openQuestions check |
| tests/dod-ia-coverage.test.ts | encode as toonEncode | Test fixture generation |
| tests/dod-l4-sections.test.ts | encode as toonEncode | Test fixture generation |

These 4 production uses are exclusively in DoD GATE validators and one approval handler. They validate user-authored .toon artifacts, NOT the 14 internal state files.

## 2. Per-File Parsing Trace

### 2.1 workflow-state.toon
- READ: state/manager-read.ts -> readFileSync -> parseState() from state/state-toon-parse.ts
- WRITE: state/manager-write.ts -> serializeState() from state/state-toon-io.ts
- Parser: CUSTOM. Hand-rolled KV + table parser (174 lines).
- Library used: NO

### 2.2 task-index.toon
- READ: state/index-toon-io.ts -> parseTaskIndex()
- WRITE: state/manager-write.ts -> serializeTaskIndex() from state/index-toon-io.ts
- Parser: CUSTOM. Uses shared helpers from toon-helpers.ts.
- Library used: NO

### 2.3 hmac-keys.toon
- READ: utils/hmac.ts -> parseHmacToon() (inline, line 34-48)
- WRITE: utils/hmac.ts -> serializeHmacToon() (inline, line 24-31)
- Parser: CUSTOM. Simple regex KV parser.
- Library used: NO

### 2.4 claude-progress.toon
- READ: state/progress-json.ts -> parseProgress() (inline, line 50-85)
- WRITE: state/progress-json.ts -> serializeProgress() (inline, line 31-48)
- Parser: CUSTOM. Uses shared helpers from toon-io.ts.
- Library used: NO

### 2.5 reflector-log.toon
- READ: tools/reflector.ts -> parseStore() from tools/reflector-toon.ts
- WRITE: tools/reflector.ts -> serializeStore() from tools/reflector-toon.ts
- Parser: CUSTOM. Own esc/unesc/splitRow (101 lines).
- Library used: NO

### 2.6 ace-context.toon
- READ: tools/ace-context.ts -> parseBullets() from tools/ace-context-toon.ts
- WRITE: tools/ace-context.ts -> serializeBullets() from tools/ace-context-toon.ts
- Parser: CUSTOM. Own esc/unesc/splitRow (81 lines).
- Library used: NO

### 2.7 curator-log.toon
- READ: tools/curator-helpers.ts -> parseReports() from tools/curator-toon.ts
- WRITE: tools/curator-helpers.ts -> serializeReports() from tools/curator-toon.ts
- Parser: CUSTOM. Own esc/unesc/splitRow (109 lines).
- Library used: NO

### 2.8 design-code-index.toon
- READ: dci/dci-toon-io.ts -> parseDCI()
- WRITE: dci/dci-toon-io.ts -> serializeDCI()
- Parser: CUSTOM. Uses shared helpers from state/toon-io.ts.
- Library used: NO

### 2.9 adr-store.toon
- READ: tools/adr-toon-io.ts -> parseADRStore()
- WRITE: tools/adr-toon-io.ts -> serializeADRStore()
- Parser: CUSTOM. Own splitCsvRow + own esc (73 lines).
- Library used: NO

### 2.10 archgate-rules.toon
- READ: tools/archgate-toon-io.ts -> parseRuleStore()
- WRITE: tools/archgate-toon-io.ts -> serializeRuleStore()
- Parser: CUSTOM. Own splitCsvRow + own esc (82 lines).
- Library used: NO

### 2.11 metrics.toon
- READ: tools/metrics-toon-io.ts -> parseMetrics()
- WRITE: tools/metrics-toon-io.ts -> serializeMetrics()
- Parser: CUSTOM. Own splitCsvRow + own esc (135 lines).
- Library used: NO

### 2.12 phase-metrics.toon
- READ: Not read by production code (write-only).
- WRITE: tools/metrics-toon.ts -> writeMetricsToon()
- Parser: CUSTOM write-only serializer (61 lines).
- Library used: NO

### 2.13 phase-analytics.toon
- READ: Not read by production code (write-only).
- WRITE: tools/analytics-toon.ts -> writeAnalyticsToon()
- Parser: CUSTOM write-only serializer (104 lines).
- Library used: NO

### 2.14 phase-errors.toon
- READ: tools/error-toon.ts -> readErrorToon()
- WRITE: tools/error-toon.ts -> appendErrorToon()
- Parser: CUSTOM. Stateful line-by-line parser (120 lines).
- Library used: NO

## 3. Shared Code Tiers

### Tier 1: Shared helper modules
- state/toon-helpers.ts: esc, unesc, toSemiList, fromSemiList, parseCsvRow, tableHeader, tableRows, parseToonKv, parseTableBlock
  - Used by: workflow-state, task-index, delegate-coordinator
- state/toon-io.ts: esc, unesc, splitRow, parseKV, parseTableHeader, parseListHeader
  - Used by: claude-progress, design-code-index

### Tier 2: Per-module duplicated helpers (copy-paste)
Files defining their own esc/unesc/splitRow or splitCsvRow:
- reflector-toon.ts, ace-context-toon.ts, curator-toon.ts
- adr-toon-io.ts, archgate-toon-io.ts, metrics-toon-io.ts
- analytics-toon.ts, error-toon.ts, metrics-toon.ts, hmac.ts

### Tier 3: Fully inline
- hmac.ts: parseHmacToon/serializeHmacToon self-contained

Duplication count: esc() defined independently in 11 files. CSV row splitting defined in 7 files with two variant implementations (splitRow vs splitCsvRow).

## 4. Format Verification

All parsers parse valid TOON format:
- Key-value lines: key: value
- Table arrays: name[count]{col1,col2,...}: followed by indented CSV rows
- Semicolon-delimited lists within values
- List arrays: name[count]: followed by indented values

## 5. Verdict

The previous audit claim is ACCURATE. All 14 internal .toon files use hand-rolled custom parsers, not @toon-format/toon library.

The @toon-format/toon library is only used for DoD gate validation of user-authored output artifacts and test fixtures. Internal state files have typed, schema-specific parsers mapping directly to TypeScript interfaces.

Main risk: 11 copies of esc(), 7 copies of CSV splitting with two subtly different implementations.
