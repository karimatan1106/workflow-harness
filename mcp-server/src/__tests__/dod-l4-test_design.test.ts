/**
 * @spec F-005 / AC-5
 * test_design DoD checks: TC-ID regex acceptance + template bold marker.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { TC_ID_REGEX } from '../gates/dod-l4-test_design.js';

describe('TC-ID regex acceptance', () => {
  it('TC-AC5-01: TC-AC1-01 形式 accept', () => {
    expect(TC_ID_REGEX.test('TC-AC1-01')).toBe(true);
  });

  it('TC-AC5-02: TC-1-01 形式 accept', () => {
    expect(TC_ID_REGEX.test('TC-1-01')).toBe(true);
  });

  it('TC-AC5-03: TC-A-01 形式 reject', () => {
    expect(TC_ID_REGEX.test('TC-A-01')).toBe(false);
  });
});

describe('test_design template bold marker', () => {
  it('TC-AC5-04: defs-stage4.ts 文字列に **TC-AC を含む', () => {
    const stage4Path = fileURLToPath(new URL('../phases/defs-stage4.ts', import.meta.url));
    const src = readFileSync(stage4Path, 'utf8');
    expect(src).toContain('**TC-AC');
  });
});
