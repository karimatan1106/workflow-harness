/**
 * doc-inventory-on-scope: docPaths integration tests
 * TC-AC1-01 ~ TC-AC4-02
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

const INTENT = 'Test docPaths integration for existing project document inventory discovery.';

let buildDocCategories: (traits?: Record<string, boolean>, docPaths?: string[]) => string;
let DEFS_STAGE1: Record<string, { subagentTemplate: string }>;

beforeAll(async () => {
  vi.resetModules();
  const defsMod = await import('../phases/definitions.js');
  buildDocCategories = defsMod.buildDocCategories as typeof buildDocCategories;
  const stage1Mod = await import('../phases/defs-stage1.js');
  DEFS_STAGE1 = stage1Mod.DEFS_STAGE1 as typeof DEFS_STAGE1;
});

// ─── AC-1: scope_definition template has doc exploration step ──
describe('AC-1: scope_definition template doc exploration', () => {
  it('TC-AC1-01: template contains document exploration step with docPaths', () => {
    const tpl = DEFS_STAGE1['scope_definition'].subagentTemplate;
    expect(tpl).toMatch(/ドキュメント探索|docPaths/);
    expect(tpl).toMatch(/\.md|\.rst|\.adoc/);
  });
});

// ─── AC-2: harness_set_scope accepts docPaths ──────────────────
describe('AC-2: harness_set_scope docPaths persistence', () => {
  it('TC-AC2-01: docPaths array persists to TaskState', async () => {
    const ctx: TestCtx = await setupHandlerTest();
    try {
      const { createMgr, call } = ctx;
      const mgr = createMgr();
      const res = await call(mgr, 'harness_start', { taskName: 'dp-test', userIntent: INTENT });
      const taskId = res.taskId as string;
      const token = res.sessionToken as string;
      await call(mgr, 'harness_set_scope', {
        taskId, sessionToken: token,
        files: ['src/index.ts'],
        docPaths: ['docs/api.md', 'README.md'],
      });
      const status = await call(mgr, 'harness_status', { taskId });
      expect((status as any).docPaths).toEqual(['docs/api.md', 'README.md']);
    } finally {
      teardownHandlerTest(ctx);
    }
  });

  it('TC-AC2-02: omitting docPaths leaves it undefined', async () => {
    const ctx: TestCtx = await setupHandlerTest();
    try {
      const { createMgr, call } = ctx;
      const mgr = createMgr();
      const res = await call(mgr, 'harness_start', { taskName: 'dp-omit', userIntent: INTENT });
      const taskId = res.taskId as string;
      const token = res.sessionToken as string;
      await call(mgr, 'harness_set_scope', { taskId, sessionToken: token, files: ['src/a.ts'] });
      const status = await call(mgr, 'harness_status', { taskId });
      expect((status as any).docPaths).toBeUndefined();
    } finally {
      teardownHandlerTest(ctx);
    }
  });
});

// ─── AC-3: buildDocCategories includes docPaths ────────────────
describe('AC-3: buildDocCategories with docPaths', () => {
  it('TC-AC3-01: docPaths entries appear in category list', () => {
    const output = buildDocCategories(undefined, ['docs/api.md', 'wiki/setup.md']);
    expect(output).toContain('docs/api.md');
    expect(output).toContain('wiki/setup.md');
    expect(output).toContain('既存プロジェクトドキュメント');
  });

  it('TC-AC3-02: docPaths deduplicates against FALLBACK_ITEMS', () => {
    const output = buildDocCategories(undefined, ['README.md', 'docs/custom.md']);
    const matches = output.match(/README\.md/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(output).toContain('docs/custom.md');
  });
});

// ─── AC-4: backward compatibility ──────────────────────────────
describe('AC-4: backward compatibility without docPaths', () => {
  it('TC-AC4-01: undefined docPaths produces same output as before', () => {
    const withoutDocPaths = buildDocCategories(undefined);
    const withEmptyDocPaths = buildDocCategories(undefined, undefined);
    expect(withoutDocPaths).toBe(withEmptyDocPaths);
  });

  it('TC-AC4-02: empty docPaths array produces same output as undefined', () => {
    const without = buildDocCategories(undefined);
    const withEmpty = buildDocCategories(undefined, []);
    expect(without).toBe(withEmpty);
  });
});
