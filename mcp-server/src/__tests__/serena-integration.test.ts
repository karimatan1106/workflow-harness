/**
 * Serena CLI Integration Tests
 * Validates: tool-gate.js (successor to enforce-workflow.js), package.json postinstall,
 * defs-stage1.ts templates, setup.sh existence and content.
 *
 * NOTE: enforce-workflow.js was removed and replaced by tool-gate.js.
 * The isBashAllowed tests have been removed as tool-gate.js uses a different architecture.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

/* ------------------------------------------------------------------ */
/*  Project paths                                                      */
/* ------------------------------------------------------------------ */

const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const HOOKS_DIR = resolve(PROJECT_ROOT, 'hooks');
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'mcp-server', 'package.json');
const SETUP_SH_PATH = join(PROJECT_ROOT, 'indexer', 'setup.sh');

/* ------------------------------------------------------------------ */
/*  Handler test context for template tests                            */
/* ------------------------------------------------------------------ */

let ctx: TestCtx;

beforeAll(async () => {
  ctx = await setupHandlerTest();
});

afterAll(() => {
  teardownHandlerTest(ctx);
});

/* ================================================================== */
/*  tool-gate.js existence (successor to enforce-workflow.js)          */
/* ================================================================== */

describe('tool-gate.js: hook file validation', () => {
  it('tool-gate.js exists in hooks directory', () => {
    expect(existsSync(join(HOOKS_DIR, 'tool-gate.js'))).toBe(true);
  });

  it('tool-gate.js contains layer detection', () => {
    const content = readFileSync(join(HOOKS_DIR, 'tool-gate.js'), 'utf8');
    expect(content).toContain('detectLayer');
  });
});

/* ================================================================== */
/*  TC-AC3-01: package.json postinstall                                */
/* ================================================================== */

describe('package.json: postinstall script', () => {
  it('TC-AC3-01: postinstall contains setup.sh reference', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts.postinstall).toBeDefined();
    expect(pkg.scripts.postinstall).toContain('setup.sh');
  });
});

/* ================================================================== */
/*  TC-AC5-01: defs-stage1.ts templates reference serena-query.py      */
/* ================================================================== */

describe('defs-stage1.ts: Serena references in templates', () => {
  it('TC-AC5-01: scope_definition template contains serena-query.py', async () => {
    const res = await ctx.call(ctx.createMgr(), 'harness_get_subphase_template', {
      phase: 'scope_definition',
    });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).toContain('serena-query.py');
  });

  it('TC-AC5-01: impact_analysis template contains serena-query.py or find-refs', async () => {
    const res = await ctx.call(ctx.createMgr(), 'harness_get_subphase_template', {
      phase: 'impact_analysis',
    });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    const hasSerena = tmpl.includes('serena-query.py') || tmpl.includes('find-refs');
    expect(hasSerena).toBe(true);
  });
});

/* ================================================================== */
/*  TC-AC2-03: setup.sh exists with expected markers                   */
/* ================================================================== */

describe('setup.sh: file existence and content', () => {
  it('TC-AC2-03: setup.sh exists', () => {
    expect(existsSync(SETUP_SH_PATH)).toBe(true);
  });

  it('TC-AC2-03: setup.sh contains uv reference', () => {
    const content = readFileSync(SETUP_SH_PATH, 'utf8');
    expect(content).toContain('uv');
  });

  it('TC-AC2-03: setup.sh contains serena-agent reference', () => {
    const content = readFileSync(SETUP_SH_PATH, 'utf8');
    expect(content).toContain('serena-agent');
  });

  it('TC-AC2-03: setup.sh contains python 3.11 reference', () => {
    const content = readFileSync(SETUP_SH_PATH, 'utf8');
    expect(content).toContain('3.11');
  });
});
