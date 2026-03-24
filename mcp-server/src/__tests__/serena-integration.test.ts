/**
 * Serena CLI Integration Tests
 * Validates: tool-gate.js (successor to enforce-workflow.js), package.json postinstall,
 * defs-stage1.ts templates, indexer/ removal verification.
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
// SETUP_SH_PATH removed: indexer/ directory deleted in refactoring

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
  it('TC-AC3-01: postinstall does not reference setup.sh (indexer removed)', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    expect(pkg.scripts).toBeDefined();
    if (pkg.scripts.postinstall) {
      expect(pkg.scripts.postinstall).not.toContain('setup.sh');
    }
  });
});

/* ================================================================== */
/*  TC-AC5-01: defs-stage1.ts templates no longer reference serena     */
/* ================================================================== */

describe('defs-stage1.ts: templates do not reference serena-query.py (indexer removed)', () => {
  it('TC-AC5-01: scope_definition template does not contain serena-query.py', async () => {
    const res = await ctx.call(ctx.createMgr(), 'harness_get_subphase_template', {
      phase: 'scope_definition',
    });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).not.toContain('serena-query.py');
  });

  it('TC-AC5-01: impact_analysis template does not contain serena-query.py', async () => {
    const res = await ctx.call(ctx.createMgr(), 'harness_get_subphase_template', {
      phase: 'impact_analysis',
    });
    expect(res.error).toBeUndefined();
    const tmpl = res.subagentTemplate as string;
    expect(tmpl).not.toContain('serena-query.py');
  });
});

/* ================================================================== */
/*  TC-AC2-03: indexer/setup.sh removed in refactoring                 */
/* ================================================================== */

describe('setup.sh: file no longer exists (indexer removed)', () => {
  it('TC-AC2-03: indexer/setup.sh does not exist', () => {
    const setupShPath = join(PROJECT_ROOT, 'indexer', 'setup.sh');
    expect(existsSync(setupShPath)).toBe(false);
  });
});
