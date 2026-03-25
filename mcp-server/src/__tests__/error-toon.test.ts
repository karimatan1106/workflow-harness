/**
 * Tests for error-toon.ts — mapChecksForErrorToon field mapping
 * TDD Red: mapChecksForErrorToon does not exist yet.
 * @spec docs/spec/features/workflow-harness.md
 */
import { describe, it, expect } from 'vitest';
import { mapChecksForErrorToon } from '../tools/error-toon.js';

describe('mapChecksForErrorToon', () => {
  it('TC-AC1-01: maps all fields correctly', () => {
    const input = [
      {
        check: 'toon_safety',
        passed: false,
        evidence: 'missing required field',
        level: 'L2',
        fix: 'Add the required field to the TOON file',
        example: 'field: value',
      },
      {
        check: 'line_count',
        passed: true,
        evidence: '150 lines',
        level: 'L1',
        fix: 'Split file if over 200 lines',
        example: 'max 200 lines per file',
      },
    ];

    const result = mapChecksForErrorToon(input);

    expect(result).toEqual([
      {
        name: 'toon_safety',
        passed: false,
        message: 'missing required field',
        level: 'L2',
        fix: 'Add the required field to the TOON file',
        example: 'field: value',
      },
      {
        name: 'line_count',
        passed: true,
        message: '150 lines',
        level: 'L1',
        fix: 'Split file if over 200 lines',
        example: 'max 200 lines per file',
      },
    ]);
  });

  it('TC-AC1-02: optional fields are undefined when omitted', () => {
    const input = [
      {
        check: 'basic_check',
        passed: false,
        evidence: 'failed validation',
      },
    ];

    const result = mapChecksForErrorToon(input);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('basic_check');
    expect(result[0].passed).toBe(false);
    expect(result[0].message).toBe('failed validation');
    expect(result[0].level).toBeUndefined();
    expect(result[0].fix).toBeUndefined();
    expect(result[0].example).toBeUndefined();
  });
});
