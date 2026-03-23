/**
 * TDD Red: context-engineering-improvements
 * TC-AC1-01 ~ TC-AC4-01 — InputFileMode suffix + refinedIntent tests
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

const INTENT = 'This is a test user intent that is long enough to pass the minimum length requirement for testing.';

// ─── Unit test env ───────────────────────────────
let TEMP_DIR: string;
let buildSubagentPrompt: (...args: unknown[]) => string;
let PHASE_REGISTRY: Record<string, Record<string, unknown>>;

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'ctx-eng-test-'));
  mkdirSync(join(TEMP_DIR, 'docs'), { recursive: true });
  vi.stubEnv('STATE_DIR', join(TEMP_DIR, 'state'));
  vi.stubEnv('DOCS_DIR', join(TEMP_DIR, 'docs'));
  vi.resetModules();
  const defsMod = await import('../phases/definitions.js');
  buildSubagentPrompt = defsMod.buildSubagentPrompt as (...args: unknown[]) => string;
  const regMod = await import('../phases/registry.js');
  PHASE_REGISTRY = regMod.PHASE_REGISTRY as unknown as Record<string, Record<string, unknown>>;
});

afterAll(() => {
  vi.unstubAllEnvs();
  if (TEMP_DIR) rmSync(TEMP_DIR, { recursive: true, force: true });
});

// ─── AC-1: inputFileMode suffix generation ──────
describe('AC-1: inputFileMode suffixes in buildSubagentPrompt', () => {
  it('TC-AC1-01: design_review emits [ref] suffix for state-machine.mmd and flowchart.mmd', () => {
    const docsDir = join(TEMP_DIR, 'docs');
    const prompt = buildSubagentPrompt('design_review', 'task', docsDir, '/wf', INTENT) as string;
    expect(prompt).toContain('state-machine.mmd[ref]');
    expect(prompt).toContain('flowchart.mmd[ref]');
  });

  it('TC-AC1-02: acceptance_verification emits [sum] for requirements.md and [full] for test-design.md', () => {
    const docsDir = join(TEMP_DIR, 'docs');
    const prompt = buildSubagentPrompt('acceptance_verification', 'task', docsDir, '/wf', INTENT) as string;
    expect(prompt).toContain('requirements.md[sum]');
    expect(prompt).toContain('test-design.md[full]');
  });

  it('TC-AC1-03: file without inputFileModes entry defaults to [full] suffix', () => {
    const docsDir = join(TEMP_DIR, 'docs');
    // research has inputFiles: [scope-definition.md] and no inputFileModes setting
    const prompt = buildSubagentPrompt('research', 'task', docsDir, '/wf', INTENT) as string;
    // default mode = full → suffix [full] or no suffix (current impl has no suffix at all)
    // After implementation, should have [full]; before implementation it won't — test will fail
    expect(prompt).toMatch(/scope-definition\.md\[full\]/);
  });
});

// ─── AC-2: refinedIntent in buildSubagentPrompt ─
describe('AC-2: refinedIntent header fallback', () => {
  it('TC-AC2-02: buildSubagentPrompt uses userIntent when refinedIntent is undefined', () => {
    const docsDir = join(TEMP_DIR, 'docs');
    const prompt = buildSubagentPrompt('research', 'task', docsDir, '/wf', INTENT, undefined, undefined, undefined) as string;
    expect(prompt).toContain(`intent:${INTENT}`);
  });

  it('TC-AC2-01: harness_approve(requirements) sets task.refinedIntent to AC join string (integration)', async () => {
    const ctx: TestCtx = await setupHandlerTest();
    try {
      const { createMgr, call, advanceUntilPhase, StateManagerClass } = ctx;
      const mgr = createMgr();
      const startRes = await call(mgr, 'harness_start', { taskName: 'refined-intent-test', userIntent: INTENT });
      const taskId = startRes.taskId as string;
      let token = startRes.sessionToken as string;
      token = await advanceUntilPhase(mgr, taskId, token, 'requirements');

      const acDescs = [
        'Acceptance criterion 1 for testing approval',
        'Acceptance criterion 2 for testing approval',
        'Acceptance criterion 3 for testing approval',
      ];
      for (let i = 0; i < acDescs.length; i++) {
        await call(mgr, 'harness_add_ac', { taskId, id: `AC-${i + 1}`, description: acDescs[i], sessionToken: token });
      }
      await call(mgr, 'harness_approve', { taskId, type: 'requirements', sessionToken: token });

      const mgr2 = new StateManagerClass();
      const state = mgr2.loadTask(taskId) as Record<string, unknown>;
      const expected = acDescs.join(' / ');
      expect(state.refinedIntent).toBe(expected);
    } finally {
      teardownHandlerTest(ctx);
    }
  });
});

// ─── AC-3: PHASE_REGISTRY inputFileModes presence ─
describe('AC-3: PHASE_REGISTRY inputFileModes configuration', () => {
  it('TC-AC3-01: design_review/acceptance_verification/docs_update have inputFileModes with at least one key', () => {
    for (const phase of ['design_review', 'acceptance_verification', 'docs_update']) {
      const cfg = PHASE_REGISTRY[phase];
      expect(cfg, `${phase} missing in PHASE_REGISTRY`).toBeDefined();
      const modes = cfg['inputFileModes'] as Record<string, string> | undefined;
      expect(modes, `${phase}.inputFileModes should exist`).toBeDefined();
      expect(Object.keys(modes ?? {}).length).toBeGreaterThan(0);
    }
  });
});

// ─── AC-4: types-core.ts line count ─────────────
describe('AC-4: types-core.ts line count constraint', () => {
  it('TC-AC4-01: types-core.ts is 200 lines or fewer', () => {
    const filePath = join(import.meta.dirname ?? __dirname, '../state/types-core.ts');
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;
    expect(lines).toBeLessThanOrEqual(200);
  });
});
