/**
 * N-29/N-30/N-32/N-27: Extended DoD helpers + FEEDBACK_SPEED_LAYERS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn(actual.existsSync) };
});

import { existsSync } from 'fs';
import { checkFileLineLimit, checkBrokenPointers, detectGhostFiles } from '../gates/dod-helpers.js';
import { FEEDBACK_SPEED_LAYERS } from '../tools/archgate.js';

describe('N-29: checkFileLineLimit', () => {
  it('returns false for content with exactly 200 lines', () => {
    const content = Array(200).fill('line').join('\n');
    const result = checkFileLineLimit(content);
    expect(result.exceeded).toBe(false);
    expect(result.lineCount).toBe(200);
  });

  it('returns true for content with 201 lines', () => {
    const content = Array(201).fill('line').join('\n');
    const result = checkFileLineLimit(content);
    expect(result.exceeded).toBe(true);
    expect(result.lineCount).toBe(201);
  });
});

describe('N-30: checkBrokenPointers', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('returns empty array when all paths exist', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const toon = 'artifacts[output]:\n  src/index.ts,\n  src/util.ts,\n';
    expect(checkBrokenPointers(toon, '/base')).toEqual([]);
  });

  it('returns broken paths when file does not exist', () => {
    vi.mocked(existsSync).mockImplementation((p) => !String(p).includes('missing'));
    const toon = 'artifacts[output]:\n  src/missing.ts,\n  src/ok.ts,\n';
    const result = checkBrokenPointers(toon, '/base');
    expect(result).toContain('src/missing.ts');
  });
});

describe('N-32: detectGhostFiles', () => {
  it('detects duplicate basenames', () => {
    const result = detectGhostFiles(['new/dir/util.ts'], ['old/dir/util.ts']);
    expect(result).toEqual(['new/dir/util.ts']);
  });

  it('returns empty when no duplicates', () => {
    const result = detectGhostFiles(['new/dir/foo.ts'], ['old/dir/bar.ts']);
    expect(result).toEqual([]);
  });
});

describe('N-27: FEEDBACK_SPEED_LAYERS', () => {
  it('has 4 speed layer keys', () => {
    expect(Object.keys(FEEDBACK_SPEED_LAYERS)).toEqual(['ms', 's', 'min', 'h']);
  });
});
