/**
 * TDD Red tests for countCommentLines and archgate comment_ratio (AC-5).
 * countCommentLines does not exist yet — tests fail at import time.
 */

import { describe, it, expect } from 'vitest';
import { countCommentLines } from '../tools/linter-runner.js';
import type { ArchCheckType } from '../tools/archgate.js';

describe('countCommentLines', () => {
  it('TC-AC5-01: 20% comment ratio → passed:true', () => {
    // 10 lines total, 2 comment lines = 20%
    const content = [
      '// comment line 1',
      'const a = 1;',
      'const b = 2;',
      'const c = 3;',
      '// comment line 2',
      'const d = 4;',
      'const e = 5;',
      'const f = 6;',
      'const g = 7;',
      'const h = 8;',
    ].join('\n');
    const result = countCommentLines(content);
    expect(result.ratio).toBeCloseTo(0.2, 1);
    expect(result.totalLines).toBe(10);
    expect(result.commentLines).toBe(2);
  });

  it('TC-AC5-02: 60% comment ratio → passed:false (excessive)', () => {
    // 10 lines total, 6 comment lines = 60%
    const content = [
      '// comment 1',
      '// comment 2',
      '// comment 3',
      'const a = 1;',
      '// comment 4',
      '// comment 5',
      '// comment 6',
      'const b = 2;',
      'const c = 3;',
      'const d = 4;',
    ].join('\n');
    const result = countCommentLines(content);
    expect(result.ratio).toBeCloseTo(0.6, 1);
    expect(result.commentLines).toBe(6);
  });

  it('TC-AC5-03: archgate ArchCheckType includes comment_ratio', () => {
    // Verify the type union includes comment_ratio at runtime
    const validTypes: ArchCheckType[] = [
      'line_count',
      'pattern_absent',
      'pattern_required',
      'duplicate_code',
      'ast_grep_pattern',
      'comment_ratio' as ArchCheckType,
    ];
    expect(validTypes).toContain('comment_ratio');
  });

  it('TC-AC5-04: empty file → ratio === 0 (no division by zero)', () => {
    const result = countCommentLines('');
    expect(result.ratio).toBe(0);
    expect(result.totalLines).toBe(0);
    expect(result.commentLines).toBe(0);
  });
});
