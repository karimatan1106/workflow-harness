# P3: AI Slop Pattern Detection - Implementation Investigation

## 1. dod-l4-content.ts Overview

- File: `workflow-harness/mcp-server/src/gates/dod-l4-content.ts`
- Lines: 87
- Exports: `checkL4ContentValidation`

### Export Functions

| Function | Signature | Role |
|----------|-----------|------|
| `checkL4ContentValidation` | `(phase: string, docsDir: string, workflowDir: string) => DoDCheckResult` | L4 content validation entry point |

### L4 Check Call Flow (lines 52-68)

```
checkL4ContentValidation
  -> checkForbiddenPatterns(content)        // line 53
  -> checkBracketPlaceholders(content)      // line 56
  -> checkDuplicateLines(content)           // line 59 (skipped for .mmd)
  -> checkRequiredToonKeys(content, keys)   // line 65 (only .toon)
  -> Markdown section check                 // line 71 (only .md)
```

Each check appends to `errors: string[]`. Final result: passed = (errors.length === 0).

## 2. dod-helpers.ts Overview

- File: `workflow-harness/mcp-server/src/gates/dod-helpers.ts`
- Lines: 124
- Remaining capacity: 76 lines (200-line limit)

### Export Functions

| Function | Signature | Role |
|----------|-----------|------|
| `FORBIDDEN_PATTERNS` | `string[]` (constant) | Forbidden word list (TODO, TBD, WIP, etc.) |
| `BRACKET_PLACEHOLDER_REGEX` | `RegExp` (constant) | `[#...#]` placeholder pattern |
| `isStructuralLine` | `(line: string) => boolean` | Detects headings, separators, table rows, bold labels |
| `extractNonCodeLines` | `(content: string) => string[]` | Strips code fences and inline code, returns prose lines |
| `checkForbiddenPatterns` | `(content: string) => string[]` | Finds forbidden words in non-code lines (with negation context exclusion) |
| `checkBracketPlaceholders` | `(content: string) => boolean` | Detects `[#...#]` placeholders in non-code lines |
| `checkDuplicateLines` | `(content: string) => string[]` | Finds lines repeated 3+ times (excluding structural lines) |
| `checkRequiredSections` | `(content: string, requiredSections: string[]) => string[]` | Checks for required heading sections |
| `checkFileLineLimit` | `(content: string, limit?: number) => { exceeded: boolean; lineCount: number }` | N-29: Line count limit check |
| `checkBrokenPointers` | `(content: string, basePath: string) => string[]` | N-30: TOON artifacts path existence check |
| `detectGhostFiles` | `(newFiles: string[], existingFiles: string[]) => string[]` | N-32: Same-basename collision detection |

### Non-exported (internal)

| Function | Signature | Role |
|----------|-----------|------|
| `isInNegationContext` | `(line: string, pattern: string) => boolean` | Checks if pattern occurs after negation words (e.g., "avoid TODO") |

## 3. extractNonCodeLines

- Exists: YES
- Location: `dod-helpers.ts`, lines 30-40
- Signature: `(content: string) => string[]`
- Behavior: Strips code-fenced blocks (``` ... ```) and removes inline code spans. Returns trimmed prose lines only.
- Already used by: `checkForbiddenPatterns`, `checkBracketPlaceholders`, `checkDuplicateLines`

## 4. Existing Pattern Analysis

### checkForbiddenPatterns (lines 53-65)
- Uses `extractNonCodeLines` to get prose-only lines
- Iterates `FORBIDDEN_PATTERNS` array, filters matches
- Has negation context exclusion (`isInNegationContext`)
- Word boundary check for all-caps patterns (`\bTODO\b`)
- Returns: `string[]` of matched forbidden words

### checkDuplicateLines (lines 71-84)
- Uses `extractNonCodeLines` to get prose-only lines
- Skips empty and structural lines
- Counts occurrences via Map
- Returns: formatted strings for lines with count >= 3

### Common Implementation Pattern
1. Extract non-code lines via `extractNonCodeLines`
2. Apply pattern/logic to filtered lines
3. Return `string[]` of findings (empty = pass)

## 5. Recommended Placement for checkAiSlopPatterns

### Option A: Add to dod-helpers.ts (RECOMMENDED)

- Current: 124 lines. Budget: 76 lines remaining.
- Insert after `checkDuplicateLines` (after line 84).
- Follows the same pattern: export function, uses `extractNonCodeLines`, returns `string[]`.
- Consistent with existing helpers architecture.

### Option B: New file dod-l4-slop.ts

- Only if regex list + function exceeds ~50 lines (would push dod-helpers.ts over 175 lines).
- Would need import in dod-l4-content.ts alongside other helpers.

### Recommended: Option A

Insert at line 85 of dod-helpers.ts. Estimated addition: ~30-40 lines (regex array + function).

### Integration in dod-l4-content.ts

- Add import: `checkAiSlopPatterns` from `./dod-helpers.js` (line 14, extend existing import)
- Add call at line 62 (after duplicates check, before TOON key checks):
  ```typescript
  const slopPatterns = checkAiSlopPatterns(content);
  if (slopPatterns.length > 0) errors.push(`AI slop patterns found: ${slopPatterns.join(', ')}`);
  ```
- Add fix message in the ternary chain (line 84): `'AI slopパターンを具体的な表現に置き換えてください。'`

## 6. AI Slop Regex Design Guidelines

### Design Principles (consistent with existing patterns)

1. Use `extractNonCodeLines` to exclude code blocks (same as forbidden patterns)
2. Use `isStructuralLine` to skip headings/labels (same as duplicate lines)
3. Return `string[]` of matched pattern descriptions (same return type convention)
4. Consider negation context exclusion for false-positive reduction

### Recommended Regex Categories

```json
{
  "hedging_fillers": [
    "it is important to note that",
    "it should be noted that",
    "it is worth mentioning",
    "it goes without saying"
  ],
  "empty_emphasis": [
    "\bdelve\b",
    "\btapestry\b",
    "\bunlock(ing)?\s+(the\s+)?(full\s+)?potential\b",
    "\bleverage\b(?!\s+ratio)",
    "\bgame[- ]?changer\b",
    "\bseamless(ly)?\b",
    "\bholistic(ally)?\b",
    "\brobust\b",
    "\bpivotal\b",
    "\bgroundbreaking\b"
  ],
  "redundant_preamble": [
    "^(certainly|absolutely|of course|great question)[,!.]",
    "as an ai",
    "i don't have personal"
  ],
  "vague_connectors": [
    "\bin today's (digital|modern|fast-paced)\b",
    "\bin the (ever-evolving|rapidly changing)\b",
    "\blandscape\b(?=\s+of)"
  ]
}
```

### Implementation Notes

- Pattern matching should be case-insensitive
- Each category should be a named group for actionable error messages
- Threshold: report if any single pattern matches 2+ times in non-code content
- Single occurrence may be intentional; repeated use signals slop
