/**
 * @spec F-006a / AC-4
 * Registry .lock extension scope tests.
 *
 * Verifies that:
 * - PHASE_REGISTRY.implementation.allowedExtensions INCLUDES '.lock'
 *   (Cargo.lock / package-lock.json などの lockfile を実装フェーズで書ける)
 * - PHASE_REGISTRY.testing.allowedExtensions does NOT include '.lock'
 *   (限定許可の境界値: testing では lockfile 書き込み不要 = 権限最小化)
 *
 * TDD Red:
 * - TC-AC4-01: 現状 implementation.allowedExtensions に '.lock' 無し → 失敗
 * - TC-AC4-02: 現状 testing.allowedExtensions に '.lock' 無し → 既に通る (境界値確認)
 */

import { describe, it, expect } from 'vitest';
import { PHASE_REGISTRY } from '../phases/registry.js';

describe('registry .lock extension scope (F-006a / AC-4)', () => {
  it('TC-AC4-01: implementation phase の allowedExtensions に .lock が含まれる', () => {
    const config = PHASE_REGISTRY.implementation;
    expect(config).toBeDefined();
    expect(config.allowedExtensions).toBeDefined();
    expect(config.allowedExtensions.includes('.lock')).toBe(true);
  });

  it('TC-AC4-02: testing phase の allowedExtensions に .lock が含まれない (限定許可確認)', () => {
    const config = PHASE_REGISTRY.testing;
    expect(config).toBeDefined();
    expect(config.allowedExtensions).toBeDefined();
    expect(config.allowedExtensions.includes('.lock')).toBe(false);
  });
});
