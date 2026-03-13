/**
 * DoD gate tests: L4 TOON pre-parse safety checks (colon spacing, field count).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkToonSafety } from '../gates/dod-l4-toon.js';
import { createTempDir, removeTempDir } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── Check A: Missing space after colon ──────────

describe('Check A: colon spacing', () => {
  it('fails when key:value has no space after colon', () => {
    writeFileSync(join(docsDir, 'research.toon'), 'phase:research\ntaskId: test\n', 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('phase:research');
    expect(result.fix).toContain('コロンの後にスペースが必要');
  });

  it('passes when key: value has space after colon', () => {
    writeFileSync(join(docsDir, 'research.toon'), 'phase: research\ntaskId: test\n', 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });

  it('does not flag URLs (http://)', () => {
    writeFileSync(join(docsDir, 'research.toon'), 'phase: research\nurl: http://example.com\n', 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });

  it('does not flag indented array row data', () => {
    const content = 'items[1]{id,name}:\n  1, foo:bar\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });
});

// ─── Check B: Tabular array field count ──────────

describe('Check B: field count mismatch', () => {
  it('passes when field count matches declaration', () => {
    const content = 'items[2]{id,name}:\n  1, foo\n  2, bar\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });

  it('fails when row has fewer fields than declared', () => {
    const content = 'items[2]{id,name,desc}:\n  1, foo\n  2, bar\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('フィールド数 2 != 宣言数 3');
  });

  it('respects quoted commas (does not count them as separators)', () => {
    const content = 'items[1]{id,name}:\n  1, "foo, bar"\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });
});

// ─── Check B+C: quoting hint in fix message ──────

describe('Check B+C: quoting guidance', () => {
  it('includes quoting hint when field count mismatch is detected', () => {
    const content = 'items[1]{id,name,desc}:\n  1, foo\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(false);
    expect(result.fix).toContain('"..."');
  });
});

// ─── Integration / skip scenarios ────────────────

describe('Integration', () => {
  it('passes with valid TOON content', () => {
    const content = 'phase: research\ntaskId: test-id\nitems[2]{id,name}:\n  1, foo\n  2, bar\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
    expect(result.evidence).toContain('TOON pre-parse safety OK');
  });

  it('passes when phase has no outputFile', () => {
    const result = checkToonSafety('refactoring', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });

  it('passes when output file does not exist (L1 handles)', () => {
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(true);
  });

  it('prioritizes Check A over Check B', () => {
    const content = 'phase:research\nitems[1]{id,name,desc}:\n  1, foo\n';
    writeFileSync(join(docsDir, 'research.toon'), content, 'utf8');
    const result = checkToonSafety('research', docsDir, tempDir);
    expect(result.passed).toBe(false);
    expect(result.evidence).toContain('Missing space after colon');
  });
});
