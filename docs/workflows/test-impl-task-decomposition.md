# test_impl Phase Task Decomposition

Task: hearing-worker-real-choices (47bc7d35)
Phase: test_impl
Session: 1de184be8ab924ba1ed06f046c0bee282fccc96338b4ca427958434218cecbcd

## Analysis

### Current State
- `hearing-worker.md` (27 lines): No confirmation-prohibition rule, no merit/demerit requirement, no "2+ different approaches" requirement. TC-AC1-01, TC-AC2-01, TC-AC3-01 will FAIL (Red). TC-AC5-01 (200 lines) will PASS.
- `defs-stage0.ts` (44 lines): No "bad example"/"good example" patterns. TC-AC4-01 will FAIL (Red).
- `hearing-template.test.ts` (33 lines): 4 existing test cases, all passing.

### Path Calculation
- Test file location: `workflow-harness/mcp-server/src/__tests__/`
- Target file: `.claude/agents/hearing-worker.md` (parent repo root)
- From `__dirname` (the `__tests__` dir): 4 levels up reaches repo root
- Correct: `resolve(__dirname, '..', '..', '..', '..', '.claude', 'agents', 'hearing-worker.md')`

## Worker Tasks

### Worker Task 1: Create hearing-worker-rules.test.ts
- Type: file-create
- Path: `workflow-harness/mcp-server/src/__tests__/hearing-worker-rules.test.ts`
- Content: See below
- Expected TDD Red: TC-AC1-01 FAIL, TC-AC2-01 FAIL, TC-AC3-01 FAIL, TC-AC5-01 PASS

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentMdPath = resolve(
  __dirname, '..', '..', '..', '..', '.claude', 'agents', 'hearing-worker.md'
);

describe('hearing-worker.md AskUserQuestion Quality Rules', () => {
  const content = readFileSync(agentMdPath, 'utf-8');

  it('TC-AC1-01: should contain confirmation-only prohibition rule', () => {
    expect(content).toMatch(/禁止|prohibited|confirmation.*prohibit/i);
    expect(content).toMatch(/Yes.*No|はい.*いいえ|確認だけ/i);
  });

  it('TC-AC2-01: should require 2+ substantively different approaches', () => {
    expect(content).toMatch(/2.*以上|2\+|two.*or.*more/i);
    expect(content).toMatch(/異なる|different|substantiv/i);
  });

  it('TC-AC3-01: should require merit and demerit for each option', () => {
    expect(content).toMatch(/メリット|merit|trade-off|トレードオフ/i);
    expect(content).toMatch(/デメリット|demerit|downside/i);
  });

  it('TC-AC5-01: should be 200 lines or fewer', () => {
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(200);
  });
});
```

### Worker Task 2: Add TC-AC4-01 to hearing-template.test.ts
- Type: file-edit
- Path: `workflow-harness/mcp-server/src/__tests__/hearing-template.test.ts`
- Action: Add new describe block before closing `});`
- Expected TDD Red: TC-AC4-01 FAIL

```typescript
  describe('TC-AC4-01: hearing template contains bad/good example patterns', () => {
    it('should contain bad example pattern', () => {
      const template = DEFS_STAGE0.hearing.subagentTemplate;
      expect(template).toMatch(/悪い例|bad.*example|NG.*例/i);
    });

    it('should contain good example pattern', () => {
      const template = DEFS_STAGE0.hearing.subagentTemplate;
      expect(template).toMatch(/良い例|good.*example|OK.*例/i);
    });
  });
```

### Worker Task 3: Run TDD Red and record evidence
- Type: test-execution
- Commands:
  1. `cd /c/ツール/Workflow/workflow-harness/mcp-server && npx vitest run src/__tests__/hearing-worker-rules.test.ts`
  2. `cd /c/ツール/Workflow/workflow-harness/mcp-server && npx vitest run src/__tests__/hearing-template.test.ts`
- Expected: New tests FAIL (3 from worker-rules + 2 from AC4-01), existing 4 tests PASS
- Output: `.agent/tdd-red-evidence.md`

## Execution Order
1. Worker Task 1 and Worker Task 2 can run in parallel (independent file operations)
2. Worker Task 3 depends on both Task 1 and Task 2 completing
