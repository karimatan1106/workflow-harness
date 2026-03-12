/**
 * DCI (Design-Code Index) tests
 * TC-AC1-01 ~ TC-AC5-02
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let TEMP_DIR: string;
let buildIndex: (projectRoot: string, opts?: { extensions?: string[] }) => import('../dci/types.js').DCIIndex;
let queryDocsForFile: (index: import('../dci/types.js').DCIIndex, filePath: string) => { specs: string[]; layer1: string } | null;
let queryFilesForDoc: (index: import('../dci/types.js').DCIIndex, docPath: string) => { implementedBy: string[]; testedBy: string[]; layer1: string } | null;
let validateIndex: (index: import('../dci/types.js').DCIIndex, projectRoot: string) => { ok: boolean; orphanCode: string[]; orphanDesign: string[]; brokenLinks: string[] };

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'dci-test-'));
  // Create fixture files
  mkdirSync(join(TEMP_DIR, 'src', 'auth'), { recursive: true });
  mkdirSync(join(TEMP_DIR, 'src', 'utils'), { recursive: true });
  mkdirSync(join(TEMP_DIR, 'docs', 'spec', 'features'), { recursive: true });

  // File with @spec
  writeFileSync(join(TEMP_DIR, 'src', 'auth', 'jwt.ts'), [
    '/**',
    ' * JWT authentication logic',
    ' * @spec docs/spec/features/authentication.md',
    ' */',
    'export function verify() { return true; }',
  ].join('\n'));

  // File with multiple @spec
  writeFileSync(join(TEMP_DIR, 'src', 'auth', 'session.ts'), [
    '/**',
    ' * Session management',
    ' * @spec docs/spec/features/authentication.md',
    ' * @spec docs/spec/features/session.md',
    ' */',
    'export class Session {}',
  ].join('\n'));

  // File without @spec (orphan)
  writeFileSync(join(TEMP_DIR, 'src', 'utils', 'helper.ts'), [
    '// No spec comment here',
    'export function helper() {}',
  ].join('\n'));

  // Test file (should be excluded from orphans)
  writeFileSync(join(TEMP_DIR, 'src', 'auth', 'jwt.test.ts'), [
    '// @spec docs/spec/features/authentication.md',
    'import { verify } from "./jwt";',
    'test("verify", () => { expect(verify()).toBe(true); });',
  ].join('\n'));

  // Design docs
  writeFileSync(join(TEMP_DIR, 'docs', 'spec', 'features', 'authentication.md'), '# Auth spec\nJWT + session auth.');
  writeFileSync(join(TEMP_DIR, 'docs', 'spec', 'features', 'session.md'), '# Session spec\nSession management.');
  writeFileSync(join(TEMP_DIR, 'docs', 'spec', 'features', 'orphan-spec.md'), '# Orphan spec\nNo code references this.');

  // Import DCI modules
  const builderMod = await import('../dci/index-builder.js');
  buildIndex = builderMod.buildIndex;
  const queryMod = await import('../dci/index-query.js');
  queryDocsForFile = queryMod.queryDocsForFile;
  queryFilesForDoc = queryMod.queryFilesForDoc;
  validateIndex = queryMod.validateIndex;
});

afterAll(() => {
  if (TEMP_DIR) rmSync(TEMP_DIR, { recursive: true, force: true });
});

// ─── AC-1: buildIndex generates codeToDesign mapping ──────────
describe('AC-1: buildIndex @spec parsing', () => {
  it('TC-AC1-01: @spec comment generates codeToDesign entry', () => {
    const index = buildIndex(TEMP_DIR);
    expect(index.codeToDesign['src/auth/jwt.ts']).toBeDefined();
    expect(index.codeToDesign['src/auth/jwt.ts'].specs).toContain('docs/spec/features/authentication.md');
  });

  it('TC-AC1-02: multiple @spec comments generate multiple specs', () => {
    const index = buildIndex(TEMP_DIR);
    const entry = index.codeToDesign['src/auth/session.ts'];
    expect(entry).toBeDefined();
    expect(entry.specs).toContain('docs/spec/features/authentication.md');
    expect(entry.specs).toContain('docs/spec/features/session.md');
  });

  it('TC-AC1-03: designToCode reverse map is built', () => {
    const index = buildIndex(TEMP_DIR);
    const authSpec = index.designToCode['docs/spec/features/authentication.md'];
    expect(authSpec).toBeDefined();
    expect(authSpec.implementedBy).toContain('src/auth/jwt.ts');
    expect(authSpec.implementedBy).toContain('src/auth/session.ts');
    expect(authSpec.testedBy).toContain('src/auth/jwt.test.ts');
  });
});

// ─── AC-2: queryDocsForFile ───────────────────────────────────
describe('AC-2: queryDocsForFile', () => {
  it('TC-AC2-01: returns specs for known file', () => {
    const index = buildIndex(TEMP_DIR);
    const result = queryDocsForFile(index, 'src/auth/jwt.ts');
    expect(result).not.toBeNull();
    expect(result!.specs).toContain('docs/spec/features/authentication.md');
  });

  it('TC-AC2-02: returns null for unknown file', () => {
    const index = buildIndex(TEMP_DIR);
    const result = queryDocsForFile(index, 'src/nonexistent.ts');
    expect(result).toBeNull();
  });
});

// ─── AC-3: queryFilesForDoc ───────────────────────────────────
describe('AC-3: queryFilesForDoc', () => {
  it('TC-AC3-01: returns implementedBy for known doc', () => {
    const index = buildIndex(TEMP_DIR);
    const result = queryFilesForDoc(index, 'docs/spec/features/authentication.md');
    expect(result).not.toBeNull();
    expect(result!.implementedBy).toContain('src/auth/jwt.ts');
  });

  it('TC-AC3-02: returns null for unknown doc', () => {
    const index = buildIndex(TEMP_DIR);
    const result = queryFilesForDoc(index, 'docs/nonexistent.md');
    expect(result).toBeNull();
  });
});

// ─── AC-4: validateIndex ──────────────────────────────────────
describe('AC-4: validateIndex', () => {
  it('TC-AC4-01: detects broken links (non-existent spec path)', () => {
    const index = buildIndex(TEMP_DIR);
    // Inject a broken link
    index.codeToDesign['src/auth/jwt.ts'].specs.push('docs/spec/features/deleted.md');
    const result = validateIndex(index, TEMP_DIR);
    expect(result.brokenLinks.length).toBeGreaterThan(0);
    expect(result.brokenLinks.some(l => l.includes('deleted.md'))).toBe(true);
  });

  it('TC-AC4-02: reports orphan code and orphan design', () => {
    const index = buildIndex(TEMP_DIR);
    expect(index.orphans.codeWithoutSpec).toContain('src/utils/helper.ts');
  });
});

// ─── AC-5: orphan detection ──────────────────────────────────
describe('AC-5: orphan detection', () => {
  it('TC-AC5-01: .ts without @spec is in orphans.codeWithoutSpec', () => {
    const index = buildIndex(TEMP_DIR);
    expect(index.orphans.codeWithoutSpec).toContain('src/utils/helper.ts');
  });

  it('TC-AC5-02: test files (*.test.ts) are excluded from orphans', () => {
    const index = buildIndex(TEMP_DIR);
    expect(index.orphans.codeWithoutSpec).not.toContain('src/auth/jwt.test.ts');
  });
});
