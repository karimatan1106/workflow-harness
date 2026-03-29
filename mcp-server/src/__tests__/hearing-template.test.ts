import { describe, it, expect } from 'vitest';
import { TOON_SKELETON_HEARING } from '../phases/toon-skeletons-a.js';
import { DEFS_STAGE0 } from '../phases/defs-stage0.js';

describe('hearing template reliability', () => {
  describe('TC-AC1-01: TOON_SKELETON_HEARING contains userResponse key', () => {
    it('should contain userResponse key in skeleton', () => {
      expect(TOON_SKELETON_HEARING).toMatch(/userResponse/);
    });
  });

  describe('TC-AC2-01: hearing template requires AskUserQuestion', () => {
    it('should contain AskUserQuestion mandatory instruction', () => {
      const template = DEFS_STAGE0.hearing.subagentTemplate;
      expect(template).toMatch(/AskUserQuestion/i);
      expect(template).toMatch(/必須/);
    });
  });

  describe('TC-AC2-02: hearing template requires 2+ options', () => {
    it('should require at least 2 options in choices', () => {
      const template = DEFS_STAGE0.hearing.subagentTemplate;
      expect(template).toMatch(/選択肢.*2|2.*選択肢|options.*2|2.*options/i);
    });
  });

  describe('TC-AC7-01: hearing template contains SUMMARY_SECTION', () => {
    it('should contain SUMMARY_SECTION placeholder', () => {
      const template = DEFS_STAGE0.hearing.subagentTemplate;
      expect(template).toMatch(/\{SUMMARY_SECTION\}/);
    });
  });

  it('TC-AC4-01: hearing template contains concrete quality rules with examples', () => {
    const template = DEFS_STAGE0.hearing.subagentTemplate;
    expect(template).toMatch(/悪い例|bad example/i);
    expect(template).toMatch(/良い例|good example/i);
  });
});
