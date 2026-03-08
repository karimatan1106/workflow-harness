/**
 * Serena CLI Integration Tests
 * Validates: enforce-workflow.js bash rules, package.json postinstall,
 * defs-stage1.ts templates, setup.sh existence and content.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setupHandlerTest, teardownHandlerTest, type TestCtx } from './handler-test-setup.js';

/* ------------------------------------------------------------------ */
/*  Extract isBashAllowed from enforce-workflow.js via direct eval     */
/* ------------------------------------------------------------------ */

// enforce-workflow.js is CJS with no exports; we extract the function
// by reading the source and evaluating only the pure data + function.

const HOOKS_DIR = resolve(__dirname, '..', '..', '..', 'hooks');
const ENFORCE_SRC = readFileSync(join(HOOKS_DIR, 'enforce-workflow.js'), 'utf8');

// Build a self-contained module that exposes isBashAllowed
function extractIsBashAllowed(): (cmd: string, phase: string) => { allowed: boolean; reason: string } {
  // Strip the CJS require line and 'use strict' — we only need the pure data + function
  const pureSource = ENFORCE_SRC
    .split('\n')
    .filter(line => !line.includes('require(') && !line.includes("'use strict'"))
    .join('\n')
    .split('function runHook')[0];
  const fn = new Function(`${pureSource}\nreturn isBashAllowed;`);
  return fn() as (cmd: string, phase: string) => { allowed: boolean; reason: string };
}

const isBashAllowed = extractIsBashAllowed();

/* ------------------------------------------------------------------ */
/*  Project paths                                                      */
/* ------------------------------------------------------------------ */

const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
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
/*  TC-AC4-01 / TC-AC4-02: enforce-workflow.js bash rules             */
/* ================================================================== */

describe('enforce-workflow.js: Serena commands in readonly phases', () => {
  it('TC-AC4-01: allows "python serena-query.py find_symbol" in scope_definition', () => {
    const result = isBashAllowed(
      'python serena-query.py find_symbol --name_path_pattern X',
      'scope_definition',
    );
    expect(result.allowed).toBe(true);
  });

  it('TC-AC4-01: allows full venv python path in research', () => {
    const result = isBashAllowed(
      'indexer/.venv/Scripts/python.exe indexer/serena-query.py symbols src/auth.ts',
      'research',
    );
    expect(result.allowed).toBe(true);
  });

  it('TC-AC4-02: blocks serena commands in completed phase', () => {
    const result = isBashAllowed('python serena-query.py find_symbol', 'completed');
    expect(result.allowed).toBe(false);
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
