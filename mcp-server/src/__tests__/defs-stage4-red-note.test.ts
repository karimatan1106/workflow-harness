/**
 * defs-stage4-red-note.test.ts — test_impl subagentTemplate Red note guard.
 *
 * @spec F-202 / AC-2
 *
 * test_impl フェーズは TDD Red を明示的にテンプレートへ記載すべきであり、
 * subagentTemplate には `result:false` と `Red 確認` の両方の文言が
 * 含まれる必要がある。現状の defs-stage4.ts には両方とも欠落しているため、
 * この AC-2 テストは Red となる。
 */

import { describe, it, expect } from 'vitest';
import { DEFS_STAGE4 } from '../phases/defs-stage4.js';

describe('defs-stage4 test_impl template Red note (F-202 / AC-2)', () => {
  it('TC-AC2-01: test_impl subagentTemplate 文字列に result:false と Red 確認 の両方が含まれる', () => {
    const config = DEFS_STAGE4.test_impl;
    expect(config).toBeDefined();

    const template = config.subagentTemplate;
    expect(typeof template).toBe('string');

    expect(template).toContain('result:false');
    expect(template).toContain('Red 確認');
  });
});
