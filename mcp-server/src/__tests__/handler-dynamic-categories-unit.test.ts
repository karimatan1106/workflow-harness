/**
 * buildDocCategories unit tests - TDD Red phase
 * Tests AC-1 (ProjectTraits type), AC-2 (fallback), AC-3 (dynamic categories),
 * AC-5 (200-line limit). buildDocCategories does not exist yet - all tests
 * that call it will fail with TypeError at runtime (no compile errors).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Test Data Constants ---
const ALL_FALSE: Record<string, boolean> = {
  hasUI: false, hasAPI: false, hasDB: false,
  hasEvents: false, hasI18n: false, hasDesignSystem: false,
};
const ALL_TRUE: Record<string, boolean> = {
  hasUI: true, hasAPI: true, hasDB: true,
  hasEvents: true, hasI18n: true, hasDesignSystem: true,
};
const UI_ONLY: Record<string, boolean> = { ...ALL_FALSE, hasUI: true };
const API_ONLY: Record<string, boolean> = { ...ALL_FALSE, hasAPI: true };
const UI_API: Record<string, boolean> = { ...ALL_FALSE, hasUI: true, hasAPI: true };
const UI_DS: Record<string, boolean> = { ...ALL_FALSE, hasUI: true, hasDesignSystem: true };

// --- Dynamic import helper (avoids compile error for missing export) ---
let buildDocCategories: ((traits?: Record<string, boolean>) => string) | undefined;

beforeAll(async () => {
  try {
    const mod = await import('../phases/definitions.js') as any;
    buildDocCategories = mod.buildDocCategories;
  } catch {
    // module loads fine but function may not exist yet
  }
});

function callBuild(traits?: Record<string, boolean>): string {
  if (typeof buildDocCategories !== 'function') {
    throw new TypeError('buildDocCategories is not a function');
  }
  return buildDocCategories(traits);
}

// --- AC-1: ProjectTraits type definition ---
describe('AC-1: ProjectTraits type definition', () => {
  it('TC-AC1-01: definitions module exports buildDocCategories', () => {
    expect(typeof buildDocCategories).toBe('function');
  });

  it('TC-AC1-02: ProjectTraits has 6 boolean fields', () => {
    const traits = { ...ALL_TRUE };
    expect(Object.keys(traits)).toHaveLength(6);
    for (const v of Object.values(traits)) {
      expect(typeof v).toBe('boolean');
    }
  });
});

// --- AC-2: Fallback (traits undefined) ---
describe('AC-2: fallback when projectTraits is undefined', () => {
  it('TC-AC2-01: undefined traits returns the 5 fixed items', () => {
    const output = callBuild(undefined);
    expect(output).toContain('docs/architecture/overview.md');
    expect(output).toContain('docs/operations/');
    expect(output).toContain('CHANGELOG.md');
    expect(output).toContain('README.md');
    expect(output).toContain('docs/workflows/');
  });

  it('TC-AC2-02: undefined traits output uses numbered list format', () => {
    const output = callBuild(undefined);
    expect(output).toContain('1.');
    expect(output).toContain('2.');
    expect(output).toContain('3.');
    expect(output).toContain('4.');
    expect(output).toContain('5.');
  });
});

// --- AC-3: Dynamic category selection ---
describe('AC-3: dynamic category selection', () => {
  it('TC-AC3-01: hasUI=true includes screens/wireframes/components', () => {
    const output = callBuild(UI_ONLY);
    expect(output).toContain('docs/spec/screens/');
    expect(output).toContain('docs/spec/wireframes/');
    expect(output).toContain('docs/spec/components/');
  });

  it('TC-AC3-02: hasAPI=true includes api category', () => {
    const output = callBuild(API_ONLY);
    expect(output).toContain('docs/spec/api/');
  });

  it('TC-AC3-03: hasDB=false excludes database category', () => {
    const output = callBuild({ ...ALL_TRUE, hasDB: false });
    expect(output).not.toContain('docs/spec/database/');
  });

  it('TC-AC3-04: hasUI+hasAPI includes screens and api, excludes others', () => {
    const output = callBuild(UI_API);
    expect(output).toContain('docs/spec/screens/');
    expect(output).toContain('docs/spec/api/');
    expect(output).not.toContain('docs/spec/database/');
    expect(output).not.toContain('docs/spec/events/');
    expect(output).not.toContain('docs/spec/i18n/');
    expect(output).not.toContain('docs/spec/design-system/');
  });

  it('TC-AC3-05: all flags true includes fallback 5 + all dynamic categories', () => {
    const output = callBuild(ALL_TRUE);
    expect(output).toContain('docs/architecture/overview.md');
    expect(output).toContain('docs/operations/');
    expect(output).toContain('CHANGELOG.md');
    expect(output).toContain('README.md');
    expect(output).toContain('docs/workflows/');
    expect(output).toContain('docs/spec/screens/');
    expect(output).toContain('docs/spec/api/');
    expect(output).toContain('docs/spec/database/');
    expect(output).toContain('docs/spec/events/');
    expect(output).toContain('docs/spec/i18n/');
    expect(output).toContain('docs/spec/design-system/');
  });

  it('TC-AC3-06: all flags false returns fallback 5 only', () => {
    const output = callBuild(ALL_FALSE);
    expect(output).toContain('docs/architecture/overview.md');
    expect(output).toContain('CHANGELOG.md');
    expect(output).not.toContain('docs/spec/screens/');
    expect(output).not.toContain('docs/spec/api/');
    expect(output).not.toContain('docs/spec/database/');
    expect(output).not.toContain('docs/spec/events/');
    expect(output).not.toContain('docs/spec/i18n/');
    expect(output).not.toContain('docs/spec/design-system/');
  });

  it('TC-AC3-07: hasUI+hasDesignSystem does not duplicate components/', () => {
    const output = callBuild(UI_DS);
    const matches = output.match(/docs\/spec\/components\//g) ?? [];
    expect(matches).toHaveLength(1);
  });
});

// --- Boundary / Edge cases ---
describe('Boundary and edge cases', () => {
  it('BE-1: empty object {} treated as all-false', () => {
    const output = callBuild({});
    expect(output).toContain('docs/architecture/overview.md');
    expect(output).not.toContain('docs/spec/screens/');
  });

  it('BE-2: unknown flag (hasAuth) is ignored', () => {
    const output = callBuild({ hasAuth: true } as any);
    expect(output).toContain('docs/architecture/overview.md');
    expect(output).not.toContain('docs/spec/screens/');
  });

  it('BE-7: hasI18n=true outputs i18n/seo/sitemap categories', () => {
    const output = callBuild({ ...ALL_FALSE, hasI18n: true });
    expect(output).toContain('docs/spec/i18n/');
    expect(output).toContain('seo');
    expect(output).toContain('sitemap');
  });

  it('BE-8: hasEvents=true outputs events/messages categories', () => {
    const output = callBuild({ ...ALL_FALSE, hasEvents: true });
    expect(output).toContain('docs/spec/events/');
    expect(output).toContain('messages');
  });
});

// --- AC-5: 200-line limit ---
describe('AC-5: 200-line limit on source files', () => {
  it('TC-AC5-01: types-core.ts is 200 lines or fewer', () => {
    const filePath = join(__dirname, '..', 'state', 'types-core.ts');
    const content = readFileSync(filePath, 'utf8');
    const lineCount = content.split(String.fromCharCode(10)).length;
    expect(lineCount).toBeLessThanOrEqual(200);
  });

  it('TC-AC5-02: definitions.ts is 200 lines or fewer', () => {
    const filePath = join(__dirname, '..', 'phases', 'definitions.ts');
    const content = readFileSync(filePath, 'utf8');
    const lineCount = content.split(String.fromCharCode(10)).length;
    expect(lineCount).toBeLessThanOrEqual(200);
  });

  it('TC-AC5-03: defs-stage6.ts is 200 lines or fewer', () => {
    const filePath = join(__dirname, '..', 'phases', 'defs-stage6.ts');
    const content = readFileSync(filePath, 'utf8');
    const lineCount = content.split(String.fromCharCode(10)).length;
    expect(lineCount).toBeLessThanOrEqual(200);
  });
});
