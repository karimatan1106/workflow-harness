import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const agentMdPath = resolve(repoRoot, '.claude', 'agents', 'hearing-worker.md');

describe('hearing-worker.md AskUserQuestion Quality Rules', () => {
  const content = readFileSync(agentMdPath, 'utf-8');

  it('TC-AC1-01: confirmation-only prohibition rule exists', () => {
    expect(content).toMatch(/禁止|prohibited/i);
    expect(content).toMatch(/確認.*禁止|confirmation.*prohibit|Yes.*No.*禁止|はい.*いいえ.*禁止/i);
  });

  it('TC-AC2-01: 2+ substantively different approaches required', () => {
    expect(content).toMatch(/2.*以上|2\+|two.*or.*more/i);
    expect(content).toMatch(/異なる|different|substantiv/i);
  });

  it('TC-AC3-01: merit and demerit required for each option', () => {
    expect(content).toMatch(/メリット|merit|trade-off|トレードオフ/i);
    expect(content).toMatch(/デメリット|demerit|downside/i);
  });

  it('TC-AC5-01: file is 200 lines or fewer', () => {
    const lineCount = content.split('\n').length;
    expect(lineCount).toBeLessThanOrEqual(200);
  });
});
