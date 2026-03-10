/**
 * Verification tests for existing skill rule constants (AC-2).
 * These test existing code — expected to pass (Green).
 */

import { describe, it, expect } from 'vitest';
import { FORBIDDEN_PATTERNS } from '../gates/dod-helpers.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import { PHASE_APPROVAL_GATES } from '../tools/handler-shared.js';

describe('skill rule constants', () => {
  it('TC-AC2-01: FORBIDDEN_PATTERNS contains all 12 words', () => {
    const expected = [
      'TODO', 'TBD', 'WIP', 'FIXME',
      '未定', '未確定', '要検討', '検討中',
      '対応予定', 'サンプル', 'ダミー', '仮置き',
    ];
    expect(FORBIDDEN_PATTERNS).toHaveLength(12);
    for (const word of expected) {
      expect(FORBIDDEN_PATTERNS).toContain(word);
    }
  });

  it('TC-AC2-02: PHASE_REGISTRY test_design entry has requiredSections', () => {
    const td = PHASE_REGISTRY.test_design;
    expect(td).toBeDefined();
    expect(td.requiredSections).toBeDefined();
    expect(Array.isArray(td.requiredSections)).toBe(true);
    expect(td.requiredSections!.length).toBeGreaterThan(0);
  });

  it('TC-AC2-03: PHASE_APPROVAL_GATES contains 5 gates', () => {
    const keys = Object.keys(PHASE_APPROVAL_GATES);
    expect(keys).toHaveLength(5);
    expect(keys).toContain('requirements');
    expect(keys).toContain('design_review');
    expect(keys).toContain('test_design');
    expect(keys).toContain('code_review');
    expect(keys).toContain('acceptance_verification');
  });

  it('TC-AC2-04: PHASE_REGISTRY entries have bashCategories', () => {
    for (const [name, config] of Object.entries(PHASE_REGISTRY)) {
      expect(config.bashCategories, `${name} missing bashCategories`).toBeDefined();
      expect(Array.isArray(config.bashCategories), `${name} bashCategories not array`).toBe(true);
      expect(config.bashCategories.length, `${name} bashCategories empty`).toBeGreaterThan(0);
    }
  });

  it('TC-AC2-05: PHASE_REGISTRY entries have minLines defined', () => {
    for (const [name, config] of Object.entries(PHASE_REGISTRY)) {
      if (config.minLines !== undefined) {
        expect(typeof config.minLines, `${name} minLines not number`).toBe('number');
      }
    }
  });
});
