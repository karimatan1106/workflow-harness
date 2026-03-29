import { describe, it, expect } from 'vitest';
import { DEFS_STAGE5 } from '../phases/defs-stage5.js';

describe('testing template baseline reminder', () => {
  describe('TC-AC3-01: testing template contains baseline_capture reminder', () => {
    it('should contain baseline_capture or harness_capture_baseline reminder', () => {
      const template = DEFS_STAGE5.testing.subagentTemplate;
      expect(template).toMatch(/baseline_capture|harness_capture_baseline/);
    });
  });
});
