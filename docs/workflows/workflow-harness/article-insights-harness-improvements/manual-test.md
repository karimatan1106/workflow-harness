# Manual Test: article-insights-harness-improvements

task: article-insights-harness-improvements
phase: manual_test
date: 2026-03-28

## Test Results

### MT-1: P3 AI Slop Patterns (5 categories)

結果: P3 AI slopパターン5カテゴリ(hedging/empty_emphasis/redundant_preamble/vague_connectors/ai_buzzwords)の正規表現を確認

checkAiSlopPatterns in dod-helpers.ts defines exactly 5 regex categories in the AI_SLOP_PATTERNS map:

- hedging (line 80): `/\b(it seems like|perhaps|maybe|might be|could potentially|it appears that)\b/gi`
- empty_emphasis (line 81): `/\b(it is important to note|it is worth noting|it should be noted)\b/gi`
- redundant_preamble (line 82): `/\b(as mentioned (earlier|above|before|previously))\b/gi`
- vague_connectors (line 83): `/\b(in terms of|with respect to|in the context of)\b/gi`
- ai_buzzwords (line 84): `/\b(delve|tapestry|intricate|landscape|leverag(?:e|ing)|comprehensive|robust|holistic|synerg(?:y|ies|istic))\b/gi`

Evidence: `mcp-server/src/gates/dod-helpers.ts:80-84, 87`

### MT-2: P4 Code Fence Guard on Planning Phase

結果: P4 registry.tsにnoCodeFences:true設定があり、planningフェーズでコードフェンス拒否が有効であることを確認

The planning phase entry in registry.ts (line 26) includes `noCodeFences: true` in its configuration object. This flag triggers code fence rejection during DoD checks for planning artifacts.

Evidence: `mcp-server/src/phases/registry.ts:26`

### MT-3: P5 Pivot Advisor Repeated Pattern Detection (3 consecutive)

結果: P5 pivot-advisor.tsで3エラー未満時の早期リターンガード条件(閾値3)を確認

detectRepeatedPattern in pivot-advisor.ts (line 35) returns null when fewer than 3 errors exist (`if (errors.length < 3) return null`). The function supports two detection modes: cross-retry pattern detection (when retryCount is present) and consecutive-streak fallback. The threshold of 3 is enforced at the entry guard on line 36.

Evidence: `mcp-server/src/tools/handlers/pivot-advisor.ts:35-40`

### MT-4: P6 AC Minimum 5 and Import Chain

結果: P6 MIN_ACCEPTANCE_CRITERIA=5がdod-l4-requirements.tsで定義され、approval.tsからimportされて2箇所で参照されていることを確認

dod-l4-requirements.ts exports `MIN_ACCEPTANCE_CRITERIA = 5` (line 11). The constant is used in three validation checks within the same file (lines 74, 77, 78, 82).

approval.ts imports the constant (line 10: `import { MIN_ACCEPTANCE_CRITERIA } from '../../gates/dod-l4-requirements.js'`) and enforces it in two locations:
- Line 58: blocks requirements approval when acCount < MIN_ACCEPTANCE_CRITERIA
- Line 64: generates refinedIntent only when AC count meets the minimum

Evidence: `mcp-server/src/gates/dod-l4-requirements.ts:11,74`, `mcp-server/src/tools/handlers/approval.ts:10,58,64`

### MT-5: P7 Structural Line Exclusion

結果: P7 isStructuralLineが見出し/水平線/コードフェンス/テーブル/Mermaid等12種の構造パターンを除外していることを確認

isStructuralLine in dod-helpers.ts (lines 17-36) excludes the following structural patterns from content analysis:

- Markdown headings: `^#{1,6}\s` (line 19)
- Horizontal rules: `^[-*_]{3,}\s*$` (line 20)
- Code fences: `^` `` ` `` `{3,}` (line 21)
- Table separators: `^\|[\s\-:|]+\|$` (line 22)
- Table rows: `^\|.+\|.+\|` (line 23)
- Bold-only lines: `^\*\*[^*]+\*\*[::]?\s*$` (line 24)
- Bold list items: `^[-*]\s+\*\*[^*]+\*\*[::]?\s*$` (line 25)
- Label lines: `^(?:[-*]\s+)?.{1,50}[::]?\s*$` (line 26)
- Mermaid keywords: graph, subgraph, end, classDef, etc. (line 28)
- Mermaid arrows: `-->`, `---` patterns (line 30)
- HTML tags (line 32)
- Shell commands (line 34)

Additionally, extractNonCodeLines (lines 38-48) uses code fence toggle to skip all lines inside fenced blocks.

Evidence: `mcp-server/src/gates/dod-helpers.ts:17-36, 38-48`

### MT-6: RTM Bug Fix - filter-based All Match Update

結果: RTM applyUpdateRTMStatusがfind単一マッチからfilter+for-loopによる全マッチ更新に修正されていることを確認

applyUpdateRTMStatus in manager-write.ts (line 148) uses `state.rtmEntries.filter(e => e.id === rtmId)` to collect all entries matching the given rtmId, then iterates with `for (const entry of entries)` to update every match. This fixes the previous bug where only the first matching entry was updated via `find`.

Evidence: `mcp-server/src/state/manager-write.ts:148-157`

## decisions

- MT-1: All 5 AI slop categories confirmed with comprehensive regex patterns covering hedging, empty emphasis, redundant preamble, vague connectors, and AI buzzwords
- MT-2: Planning phase noCodeFences flag is correctly set in the phase registry, preventing code blocks in planning artifacts
- MT-3: Pivot advisor enforces a 3-error minimum before triggering repeated pattern detection, with dual-mode support for retry-aware and consecutive-streak analysis
- MT-4: AC minimum of 5 is centrally defined and enforced in both DoD gate and approval handler through a single exported constant
- MT-5: Structural line exclusion covers code fences, Mermaid syntax, table separators, and 9 additional structural patterns to prevent false positives in content analysis
- MT-6: RTM status update uses filter + for-loop pattern to update all matching entries, fixing the single-match find bug

## artifacts

- manual-test.md (this file): manual verification results for P3-P7 and RTM bug fix
- Source files verified:
  - mcp-server/src/gates/dod-helpers.ts
  - mcp-server/src/phases/registry.ts
  - mcp-server/src/tools/handlers/pivot-advisor.ts
  - mcp-server/src/gates/dod-l4-requirements.ts
  - mcp-server/src/tools/handlers/approval.ts
  - mcp-server/src/state/manager-write.ts

## next

- All 6 manual test items passed. Proceed to acceptance_report phase.
