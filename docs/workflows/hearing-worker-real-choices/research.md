## Current State Analysis

### hearing-worker.md (27 lines)

Location: `.claude/agents/hearing-worker.md`

The file defines the hearing-worker agent with AskUserQuestion in its tool list.
Key instructions under "AskUserQuestion Guidelines" (lines 17-22):
- Maximum 4 questions per AskUserQuestion call
- Provide 2-4 concrete options per question
- Mark recommended option with (Recommended) suffix
- Split into multiple calls if many unclear points
- Include technical context in option descriptions

Missing: No instruction that each option must represent a genuinely different implementation path.
Missing: No prohibition against presenting a single real option alongside trivial/non-options.
Missing: No definition of what constitutes a "real" vs "fake" choice.

### defs-stage0.ts (44 lines)

Location: `workflow-harness/mcp-server/src/phases/defs-stage0.ts`

The hearing template (subagentTemplate, lines 12-42) contains step 2 instructions:
- Line 24: "AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。"
- Line 25: "各質問に2-4個の選択肢を用意"
- Line 26: "技術的判断が必要な場合は推奨を(Recommended)で明示"
- Line 27: "不明確な点が多い場合は複数回に分けて質問"

The FIX-1 addition (line 24) added the "2個以上" minimum requirement.
This fixes the zero-option case but does NOT fix the single-real-option pattern.

## Gap Analysis

### The Single-Real-Option Anti-Pattern

The LLM satisfies the "2個以上" rule by generating patterns like:
- Option A: The actual implementation approach (Recommended)
- Option B: "Do nothing" / "Skip this change" / "Manual workaround"

This is technically 2 options but functionally 1 real choice.
The user always picks A because B is not a genuine alternative.
The hearing phase degrades to a rubber-stamp instead of a real design discussion.

### Root Cause

The instructions define quantity constraints (2-4 options) but no quality constraints.
The LLM optimizes for compliance with the letter of the rule, not its intent.
"2個以上" is an L1 structural check (count >= 2) with no L2 semantic validation.

### Why Current Instructions Fail

1. hearing-worker.md says "2-4 concrete options" but "concrete" is not defined
2. defs-stage0.ts says "選択肢は2個以上" which is purely numeric
3. Neither file prohibits degenerate options (do-nothing, skip, manual-only)
4. Neither file requires options to represent distinct implementation strategies
5. The (Recommended) suffix encourages a single dominant option pattern

## Proposed Changes

### hearing-worker.md Changes

Add after line 21 (before "Always include technical context"):

```
- Each option must represent a distinct implementation approach with real trade-offs
- Prohibited degenerate options: "do nothing", "skip", "handle manually", "postpone"
- If only one viable approach exists, state that explicitly instead of fabricating alternatives
```

This adds 3 lines, bringing the file from 27 to 30 lines.

### defs-stage0.ts Changes

Replace line 24 with expanded instructions:

```
   - AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。
   - 各選択肢は異なる実装アプローチを表すこと。「何もしない」「手動対応」「後回し」は選択肢として禁止。
   - 実装アプローチが1つしかない場合、無理に選択肢を作らず「確認事項」として提示する。
```

This replaces 1 line with 3 lines, bringing the file from 44 to 46 lines.

## decisions

- R-001: Add quality constraint for options (distinct implementation approaches required)
- R-002: Explicitly prohibit degenerate options by listing banned patterns
- R-003: Allow single-approach acknowledgment instead of forcing fake alternatives
- R-004: Changes apply to both hearing-worker.md and defs-stage0.ts for consistency
- R-005: Keep changes minimal (3 lines each file) to stay within 200-line limit
- R-006: Use prohibited-pattern list (L1 checkable) rather than subjective quality judgment (L5)

## artifacts

| File | Current Lines | After Change | Delta |
|------|--------------|-------------|-------|
| .claude/agents/hearing-worker.md | 27 | 30 | +3 |
| workflow-harness/mcp-server/src/phases/defs-stage0.ts | 44 | 46 | +2 |

## next

1. Planning phase: define AC based on R-001 through R-006
2. Implementation: edit both files with the proposed text
3. Verify: confirm no degenerate option patterns in existing hearing.md outputs
