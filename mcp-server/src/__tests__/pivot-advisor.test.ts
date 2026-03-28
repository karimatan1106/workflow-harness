/**
 * Tests for pivot-advisor: repeated DoD failure pattern detection and pivot suggestions.
 * @spec docs/spec/features/workflow-harness.md
 */

import { describe, it, expect } from 'vitest';
import {
  detectRepeatedPattern,
  generatePivotSuggestion,
  type ErrorEntry,
  type PivotSuggestion,
} from '../tools/handlers/pivot-advisor.js';

describe('pivot-advisor', () => {
  describe('TC-AC11-01: 3 consecutive identical check names -> shouldPivot=true', () => {
    it('returns the repeated check name when same check appears 3+ times consecutively', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'missing header section' },
        { check: 'content_validation', evidence: 'missing header section' },
        { check: 'content_validation', evidence: 'missing header section' },
      ];
      const pattern = detectRepeatedPattern(errors);
      expect(pattern).toBe('content_validation');
      const suggestion = generatePivotSuggestion(pattern!, errors);
      expect(suggestion.shouldPivot).toBe(true);
    });
  });

  describe('TC-AC12-01: different check names -> shouldPivot=false or null', () => {
    it('returns null when errors have different check names', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'issue A' },
        { check: 'artifact_quality', evidence: 'issue B' },
        { check: 'tdd_red_evidence', evidence: 'issue C' },
      ];
      const pattern = detectRepeatedPattern(errors);
      expect(pattern).toBeNull();
    });

    it('returns null when only 2 consecutive identical checks exist', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'issue A' },
        { check: 'content_validation', evidence: 'issue B' },
        { check: 'artifact_quality', evidence: 'issue C' },
      ];
      const pattern = detectRepeatedPattern(errors);
      expect(pattern).toBeNull();
    });
  });

  describe('TC-AC13-01: error entries have {check, evidence} and pattern identification', () => {
    it('correctly identifies the repeated pattern from mixed error entries', () => {
      const errors: ErrorEntry[] = [
        { check: 'artifact_quality', evidence: 'format mismatch in section 1' },
        { check: 'tdd_red_evidence', evidence: 'no test failure screenshot' },
        { check: 'tdd_red_evidence', evidence: 'no test failure screenshot' },
        { check: 'tdd_red_evidence', evidence: 'no test failure screenshot' },
      ];
      const pattern = detectRepeatedPattern(errors);
      expect(pattern).toBe('tdd_red_evidence');
    });

    it('validates that each error entry has check and evidence fields', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'specific evidence text' },
      ];
      expect(errors[0]).toHaveProperty('check');
      expect(errors[0]).toHaveProperty('evidence');
      expect(typeof errors[0].check).toBe('string');
      expect(typeof errors[0].evidence).toBe('string');
    });
  });

  describe('TC-AC14-01: generatePivotSuggestion returns required fields', () => {
    it('returns an object with currentPattern, suggestion, and rationale', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'fail 1' },
        { check: 'content_validation', evidence: 'fail 2' },
        { check: 'content_validation', evidence: 'fail 3' },
      ];
      const result: PivotSuggestion = generatePivotSuggestion('content_validation', errors);
      expect(result).toHaveProperty('currentPattern');
      expect(result).toHaveProperty('suggestion');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('shouldPivot');
      expect(typeof result.currentPattern).toBe('string');
      expect(typeof result.suggestion).toBe('string');
      expect(typeof result.rationale).toBe('string');
      expect(result.currentPattern).toContain('content_validation');
      expect(result.suggestion).toBe('成果物の構造を根本的に見直す');
    });

    it('uses default suggestion for unknown check names', () => {
      const errors: ErrorEntry[] = [
        { check: 'unknown_check', evidence: 'fail' },
        { check: 'unknown_check', evidence: 'fail' },
        { check: 'unknown_check', evidence: 'fail' },
      ];
      const result = generatePivotSuggestion('unknown_check', errors);
      expect(result.suggestion).toBe('異なるアプローチで再実装する');
    });
  });

  describe('TC-AC15-01: fewer than 3 identical patterns -> null', () => {
    it('returns null for empty error array', () => {
      expect(detectRepeatedPattern([])).toBeNull();
    });

    it('returns null for single error entry', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'fail' },
      ];
      expect(detectRepeatedPattern(errors)).toBeNull();
    });

    it('returns null for exactly 2 identical consecutive errors', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'fail 1' },
        { check: 'content_validation', evidence: 'fail 2' },
      ];
      expect(detectRepeatedPattern(errors)).toBeNull();
    });
  });

  describe('TC-AC16: cross-retry pattern detection with retryCount', () => {
    it('detects same check failing across 3 different retries', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'fail', retryCount: 1 },
        { check: 'content_validation', evidence: 'fail', retryCount: 2 },
        { check: 'content_validation', evidence: 'fail', retryCount: 3 },
      ];
      expect(detectRepeatedPattern(errors)).toBe('content_validation');
    });

    it('returns null when same check only appears in 2 retries', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'fail', retryCount: 1 },
        { check: 'content_validation', evidence: 'fail', retryCount: 2 },
        { check: 'artifact_quality', evidence: 'fail', retryCount: 3 },
      ];
      expect(detectRepeatedPattern(errors)).toBeNull();
    });

    it('detects pattern among mixed checks across retries', () => {
      const errors: ErrorEntry[] = [
        { check: 'artifact_quality', evidence: 'fail', retryCount: 1 },
        { check: 'tdd_red_evidence', evidence: 'fail', retryCount: 1 },
        { check: 'tdd_red_evidence', evidence: 'fail', retryCount: 2 },
        { check: 'artifact_quality', evidence: 'fail', retryCount: 2 },
        { check: 'tdd_red_evidence', evidence: 'fail', retryCount: 3 },
      ];
      expect(detectRepeatedPattern(errors)).toBe('tdd_red_evidence');
    });

    it('falls back to consecutive detection when no retryCount present', () => {
      const errors: ErrorEntry[] = [
        { check: 'content_validation', evidence: 'fail 1' },
        { check: 'content_validation', evidence: 'fail 2' },
        { check: 'content_validation', evidence: 'fail 3' },
      ];
      expect(detectRepeatedPattern(errors)).toBe('content_validation');
    });
  });
});
