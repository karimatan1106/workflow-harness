/**
 * build-check-runtime-detect.test.ts — build_check subagentTemplate runtime detection guard.
 *
 * @spec F-004a / AC-5
 *
 * build_check フェーズは Cargo.toml / tsconfig.json / pyproject.toml の3ランタイムを
 * 検出可能なテンプレートを持つべきであり、monorepo 同居時は Cargo.toml を
 * tsconfig.json より優先する。現状の defs-stage4.ts では tsc/npm 固定のため、
 * これらの AC-5 テストは Red となる。
 */

import { describe, it, expect } from 'vitest';
import { DEFS_STAGE4 } from '../phases/defs-stage4.js';

describe('defs-stage4 build_check template runtime detection (F-004a / AC-5)', () => {
  it('TC-AC5-01: build_check subagentTemplate 文字列に Cargo.toml / tsconfig.json / pyproject.toml の3パターン全てが含まれる', () => {
    const config = DEFS_STAGE4.build_check;
    expect(config).toBeDefined();

    const template = config.subagentTemplate;
    expect(typeof template).toBe('string');

    expect(template.includes('Cargo.toml')).toBe(true);
    expect(template.includes('tsconfig.json')).toBe(true);
    expect(template.includes('pyproject.toml')).toBe(true);
  });

  it('TC-AC5-02: build_check subagentTemplate 内で Cargo.toml の出現位置が tsconfig.json の出現位置より小さい（Cargo 優先順位）', () => {
    const config = DEFS_STAGE4.build_check;
    expect(config).toBeDefined();

    const template = config.subagentTemplate;
    expect(typeof template).toBe('string');

    const cargoIdx = template.indexOf('Cargo.toml');
    const tsconfigIdx = template.indexOf('tsconfig.json');

    expect(cargoIdx).toBeGreaterThanOrEqual(0);
    expect(tsconfigIdx).toBeGreaterThanOrEqual(0);
    expect(cargoIdx).toBeLessThan(tsconfigIdx);
  });
});
