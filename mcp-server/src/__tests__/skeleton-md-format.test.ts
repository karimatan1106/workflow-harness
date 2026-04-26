/**
 * @spec F-204 / AC-4
 * Skeleton MD format tests (TDD Red).
 * Verifies that TOON skeleton templates have been converted to Markdown format
 * with H2 headings (## decisions / ## artifacts / ## next) and no TOON tabular syntax.
 */
import { describe, it, expect } from 'vitest';
import {
  TOON_SKELETON_SCOPE_DEFINITION,
  TOON_SKELETON_RESEARCH,
  TOON_SKELETON_IMPACT_ANALYSIS,
  TOON_SKELETON_REQUIREMENTS,
  TOON_SKELETON_HEARING,
} from '../phases/toon-skeletons-a.js';
import {
  TOON_SKELETON_THREAT_MODELING,
  TOON_SKELETON_PLANNING,
  TOON_SKELETON_UI_DESIGN,
} from '../phases/toon-skeletons-b.js';

describe('toon-skeletons-a MD format', () => {
  const skeletonsA: Array<[string, string]> = [
    ['SCOPE_DEFINITION', TOON_SKELETON_SCOPE_DEFINITION],
    ['RESEARCH', TOON_SKELETON_RESEARCH],
    ['IMPACT_ANALYSIS', TOON_SKELETON_IMPACT_ANALYSIS],
    ['REQUIREMENTS', TOON_SKELETON_REQUIREMENTS],
    ['HEARING', TOON_SKELETON_HEARING],
  ];

  it.each(skeletonsA)(
    'TC-AC4-01: %s skeleton 文字列に ## decisions / ## artifacts / ## next の3 H2 が含まれる',
    (_name, skeleton) => {
      expect(skeleton).toContain('## decisions');
      expect(skeleton).toContain('## artifacts');
      expect(skeleton).toContain('## next');
    }
  );

  it.each(skeletonsA)(
    'TC-AC4-02: %s skeleton 文字列に TOON 構文 [N]{ が含まれない (negative assert)',
    (_name, skeleton) => {
      expect(skeleton).not.toMatch(/\[\d+\]\{/);
      expect(skeleton).not.toMatch(/\[N\]\{/);
    }
  );
});

describe('toon-skeletons-b MD format', () => {
  const skeletonsB: Array<[string, string]> = [
    ['THREAT_MODELING', TOON_SKELETON_THREAT_MODELING],
    ['PLANNING', TOON_SKELETON_PLANNING],
    ['UI_DESIGN', TOON_SKELETON_UI_DESIGN],
  ];

  it.each(skeletonsB)(
    'TC-AC4-03: %s skeleton 文字列に ## decisions / ## artifacts / ## next の3 H2 が含まれる',
    (_name, skeleton) => {
      expect(skeleton).toContain('## decisions');
      expect(skeleton).toContain('## artifacts');
      expect(skeleton).toContain('## next');
    }
  );

  it.each(skeletonsB)(
    'TC-AC4-03: %s skeleton 文字列に TOON 構文 [N]{ が含まれない (negative assert)',
    (_name, skeleton) => {
      expect(skeleton).not.toMatch(/\[\d+\]\{/);
      expect(skeleton).not.toMatch(/\[N\]\{/);
    }
  );
});
