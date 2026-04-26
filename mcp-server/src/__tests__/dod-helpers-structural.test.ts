/**
 * @spec F-001 / AC-1
 * Boundary tests for isStructuralLine and regression tests for checkDuplicateLines.
 *
 * Goal:
 *   Hyphen-bullet lines whose body length is short (<=40 chars total) and that
 *   carry no trailing punctuation should be treated as structural lines, so they
 *   are excluded from duplicate detection in checkDuplicateLines.
 *
 * Current (Red) behavior:
 *   isStructuralLine only treats hyphen bullets ending with ':' or '：' as structural
 *   (line 27 of dod-helpers.ts). Short hyphen bullets WITHOUT trailing colon are not
 *   structural, so identical short bullets repeated DUPLICATE_THRESHOLD times trigger
 *   duplicate detection. These tests assert the post-fix behavior and are Red.
 *
 * Note on repetition count:
 *   checkDuplicateLines uses DUPLICATE_THRESHOLD = 5 (see dod-helpers.ts).
 *   To make duplicate-detection assertions meaningful, we repeat lines 5 times.
 */

import { describe, it, expect } from 'vitest';
import { isStructuralLine, checkDuplicateLines } from '../gates/dod-helpers.js';

const DUP_REPEAT = 5;

describe('isStructuralLine boundary', () => {
  it('TC-AC1-01: 39字 ハイフン箇条書き (末尾記号なし) は構造行扱いで DUPLICATE 出ない', () => {
    // '- ' (2) + 37 body chars = 39 total
    const line = '- ' + 'a'.repeat(37);
    expect(line.length).toBe(39);

    expect(isStructuralLine(line)).toBe(true);

    const content = Array(DUP_REPEAT).fill(line).join('\n');
    const dups = checkDuplicateLines(content);
    expect(dups.some(d => d.includes('a'.repeat(10)))).toBe(false);
  });

  it('TC-AC1-04: 40字 ハイフン箇条書き (境界値, 末尾記号なし) も構造行扱い', () => {
    // '- ' (2) + 38 body chars = 40 total (boundary)
    const line = '- ' + 'b'.repeat(38);
    expect(line.length).toBe(40);

    expect(isStructuralLine(line)).toBe(true);

    const content = Array(DUP_REPEAT).fill(line).join('\n');
    const dups = checkDuplicateLines(content);
    expect(dups.some(d => d.includes('b'.repeat(10)))).toBe(false);
  });

  it('TC-AC1-03: 末尾コロン構造行は引き続き構造扱い (回帰)', () => {
    const line = '- foo:';
    expect(isStructuralLine(line)).toBe(true);

    const lineFullWidth = '- foo：';
    expect(isStructuralLine(lineFullWidth)).toBe(true);
  });
});

describe('checkDuplicateLines regression', () => {
  it('TC-AC1-02: 41字 ハイフン箇条書き (本文長さ超過) は従来通り DUPLICATE 検出', () => {
    // '- ' (2) + 39 body chars = 41 total (over the 40-char structural cap)
    const line = '- ' + 'c'.repeat(39);
    expect(line.length).toBe(41);

    expect(isStructuralLine(line)).toBe(false);

    const content = Array(DUP_REPEAT).fill(line).join('\n');
    const dups = checkDuplicateLines(content);
    expect(dups.length).toBeGreaterThan(0);
    expect(dups.some(d => d.includes('c'.repeat(10)))).toBe(true);
  });
});
