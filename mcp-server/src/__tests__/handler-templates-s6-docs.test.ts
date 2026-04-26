/**
 * docs_update template rewrite - unit tests
 * Verifies AC-1 (5 doc items), AC-2 (registry config), AC-3 (OUTPUT_FILE_TO_PHASE),
 * AC-4 (200-line limit), AC-5 (no forbidden headers).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

let ctx: TestCtx;
let createMgr: TestCtx['createMgr'];
let call: TestCtx['call'];

beforeAll(async () => {
  ctx = await setupHandlerTest();
  createMgr = ctx.createMgr;
  call = ctx.call;
});

afterAll(() => {
  teardownHandlerTest(ctx);
});

describe('AC-1: docs_update template contains workflow-docs.md 5 items', () => {
  let tmpl: string;

  beforeAll(async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'docs_update' });
    expect(res.error).toBeUndefined();
    tmpl = res.subagentTemplate as string;
  });

  it('TC-AC1-01: contains docs/architecture/overview.md path', () => {
    expect(tmpl).toContain('docs/architecture/overview.md');
  });

  it('TC-AC1-02: contains docs/operations/ path with subdirectory references', () => {
    expect(tmpl).toContain('docs/operations/');
    const subDirs = ['environments', 'deployment', 'monitoring', 'runbooks'];
    const matchCount = subDirs.filter(d => tmpl.includes(d)).length;
    expect(matchCount).toBeGreaterThanOrEqual(2);
  });

  it('TC-AC1-03: contains CHANGELOG.md', () => {
    expect(tmpl).toContain('CHANGELOG.md');
  });

  it('TC-AC1-04: contains README.md', () => {
    expect(tmpl).toContain('README.md');
  });

  it('TC-AC1-05: contains docs/workflows/ temporality note', () => {
    expect(tmpl).toContain('docs/workflows/');
    expect(tmpl).toMatch(/一時/);
  });
});

describe('AC-2: registry.ts docs_update config', () => {
  let config: Record<string, unknown>;

  beforeAll(async () => {
    const { PHASE_REGISTRY } = await import('../phases/registry.js');
    config = PHASE_REGISTRY.docs_update as unknown as Record<string, unknown>;
  });

  it('TC-AC2-01: outputFile is {docsDir}/docs-update.md', () => {
    expect(config.outputFile).toBe('{docsDir}/docs-update.md');
  });

  it('TC-AC2-02: inputFiles contains planning.md and requirements.md', () => {
    const inputFiles = config.inputFiles as string[];
    expect(inputFiles).toEqual(['{docsDir}/planning.md', '{docsDir}/requirements.md']);
  });

  it('TC-AC2-03: requiredSections is [decisions, artifacts, next]', () => {
    expect(config.requiredSections).toEqual(['decisions', 'artifacts', 'next']);
  });

  it('TC-AC2-04: minLines is 30', () => {
    expect(config.minLines).toBe(30);
  });

  it('TC-AC2-05: model is haiku (mechanical phase)', () => {
    expect(config.model).toBe('haiku');
  });

  it('TC-AC2-06: bashCategories contains readonly only (no implementation)', () => {
    const cats = config.bashCategories as string[];
    expect(cats).toContain('readonly');
    expect(cats).not.toContain('implementation');
  });
});

describe('AC-3: OUTPUT_FILE_TO_PHASE contains docs-update.md', () => {
  it('TC-AC3-01: definitions.ts source contains docs-update.md mapping', () => {
    const defsPath = join(__dirname, '..', 'phases', 'definitions.ts');
    const source = readFileSync(defsPath, 'utf8');
    expect(source).toContain("'docs-update.md': 'docs_update'");
  });
});

describe('AC-4: defs-stage6.ts line count', () => {
  let lineCount: number;

  beforeAll(() => {
    const filePath = join(__dirname, '..', 'phases', 'defs-stage6.ts');
    const content = readFileSync(filePath, 'utf8');
    lineCount = content.split('\n').length;
  });

  it('TC-AC4-01: line count is 200 or fewer', () => {
    expect(lineCount).toBeLessThanOrEqual(200);
  });

  it('TC-AC4-02: line count is 190 or more (no over-compression)', () => {
    expect(lineCount).toBeGreaterThanOrEqual(190);
  });
});

describe('AC-5: no forbidden headers in docs_update template', () => {
  let tmpl: string;

  beforeAll(async () => {
    const mgr = createMgr();
    const res = await call(mgr, 'harness_get_subphase_template', { phase: 'docs_update' });
    expect(res.error).toBeUndefined();
    tmpl = res.subagentTemplate as string;
  });

  it('TC-AC5-01: does not contain ## タスク情報', () => {
    expect(tmpl).not.toContain('## タスク情報');
    expect(tmpl).not.toContain('=== タスク情報');
  });

  it('TC-AC5-02: does not contain ## 入力', () => {
    expect(tmpl).not.toContain('## 入力');
    expect(tmpl).not.toContain('=== 入力');
  });

  it('TC-AC5-03: does not contain ## 出力', () => {
    expect(tmpl).not.toContain('## 出力');
    expect(tmpl).not.toContain('=== 出力');
  });
});
