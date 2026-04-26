/**
 * @spec F-007 / AC-7
 * DoD L4 hearing consistency: AskUserQuestion must be mentioned in both
 *   - .claude/agents/hearing-worker.md
 *   - mcp-server/src/phases/defs-stage0.ts (hearing template)
 *
 * TDD Red phase: stub returns passed=false unconditionally,
 * so TC-AC7-01 (true expected) fails as expected.
 */

import { describe, it, expect } from 'vitest';
import { checkHearingConsistency } from '../gates/dod-l4-requirements.js';

const HEARING_WORKER_WITH_ASK = [
  '---',
  'name: hearing-worker',
  'tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion',
  '---',
  '',
  '## AskUserQuestion Guidelines',
  '- Use AskUserQuestion to interview the user with structured choices',
].join('\n');

const HEARING_WORKER_WITHOUT_ASK = [
  '---',
  'name: hearing-worker',
  'tools: Read, Write, Edit, Glob, Grep, Bash',
  '---',
  '',
  '## Guidelines',
  '- Interview the user with structured choices',
].join('\n');

const DEFS_STAGE0_WITH_ASK = [
  "import type { PhaseDefinition } from './definitions-shared.js';",
  '',
  'export const DEFS_STAGE0: Record<string, PhaseDefinition> = {',
  '  hearing: {',
  '    subagentTemplate: `hearingフェーズ',
  '    AskUserQuestion で確認事項をヒアリング（1回のAskで最大4問）',
  '    `',
  '  },',
  '};',
].join('\n');

const DEFS_STAGE0_WITHOUT_ASK = [
  "import type { PhaseDefinition } from './definitions-shared.js';",
  '',
  'export const DEFS_STAGE0: Record<string, PhaseDefinition> = {',
  '  hearing: {',
  '    subagentTemplate: `hearingフェーズ',
  '    確認事項をヒアリング',
  '    `',
  '  },',
  '};',
].join('\n');

describe('hearing-consistency AskUserQuestion mention', () => {
  it('TC-AC7-01: 双方記載で passed=true', () => {
    const result = checkHearingConsistency(HEARING_WORKER_WITH_ASK, DEFS_STAGE0_WITH_ASK);
    expect(result.passed).toBe(true);
  });

  it('TC-AC7-02: hearing-worker.md のみ記載で passed=false', () => {
    const result = checkHearingConsistency(HEARING_WORKER_WITH_ASK, DEFS_STAGE0_WITHOUT_ASK);
    expect(result.passed).toBe(false);
  });

  it('TC-AC7-03: defs-stage0.ts のみ記載で passed=false', () => {
    const result = checkHearingConsistency(HEARING_WORKER_WITHOUT_ASK, DEFS_STAGE0_WITH_ASK);
    expect(result.passed).toBe(false);
  });
});
