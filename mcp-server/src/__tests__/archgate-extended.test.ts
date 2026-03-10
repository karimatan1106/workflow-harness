/**
 * archgate-extended.test.ts — TDD Red tests for archgate extension.
 * Tests duplicate_code and ast_grep_pattern checkTypes (not yet implemented).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const fsStore: Map<string, string> = new Map();

vi.mock('fs', () => ({
  default: {},
  existsSync: (p: string) => fsStore.has(p),
  readFileSync: (p: string, _enc: string) => {
    const v = fsStore.get(p);
    if (v === undefined) throw Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
    return v;
  },
  writeFileSync: (p: string, data: string, _enc?: string) => { fsStore.set(p, data); },
  mkdirSync: (_p: string, _opts?: any) => {},
}));

vi.mock('../tools/linter-runner.js', () => ({
  runJscpd: vi.fn(),
  runAstGrepPattern: vi.fn(),
}));

import { addADR, updateADRStatus } from '../tools/adr.js';
import { registerArchRule, runArchGateChecks } from '../tools/archgate.js';
import { runJscpd, runAstGrepPattern } from '../tools/linter-runner.js';

const mockRunJscpd = vi.mocked(runJscpd);
const mockRunAstGrep = vi.mocked(runAstGrepPattern);

function clearStore() { fsStore.clear(); }

function setupADR(id: string, status: 'accepted' | 'deprecated' = 'accepted') {
  addADR({ id, statement: `Rule ${id}`, rationale: 'r', context: 'c', taskId: 't1' });
  updateADRStatus(id, status);
  if (status === 'deprecated') updateADRStatus(id, 'deprecated', 'outdated');
}

describe('Archgate extended — duplicate_code', () => {
  beforeEach(() => { clearStore(); vi.clearAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('TC-AGE-01: duplicate_code with runJscpd passed:true → result.passed=true', () => {
    setupADR('ADR-010');
    registerArchRule({
      id: 'ARCH-010',
      adrId: 'ADR-010',
      description: 'Max 5% duplication',
      checkType: 'duplicate_code' as any,
      threshold: 5,
      glob: 'src/**/*.ts',
    });
    mockRunJscpd.mockReturnValue({ percentage: 2.0, duplicates: 5, passed: true });

    const results = runArchGateChecks([]);
    expect(results.passed).toBe(true);
    expect(results.checks.every(c => c.passed)).toBe(true);
  });

  it('TC-AGE-02: duplicate_code with runJscpd passed:false → check fails with evidence', () => {
    setupADR('ADR-011');
    registerArchRule({
      id: 'ARCH-011',
      adrId: 'ADR-011',
      description: 'Max 5% duplication',
      checkType: 'duplicate_code' as any,
      threshold: 5,
      glob: 'src/**/*.ts',
    });
    mockRunJscpd.mockReturnValue({ percentage: 8.0, duplicates: 30, passed: false });

    const results = runArchGateChecks([]);
    expect(results.passed).toBe(false);
    const check = results.checks.find(c => c.ruleId === 'ARCH-011');
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.evidence).toContain('8');
  });

  it('TC-AGE-05: deprecated ADR skips duplicate_code rule', () => {
    setupADR('ADR-012', 'deprecated');
    registerArchRule({
      id: 'ARCH-012',
      adrId: 'ADR-012',
      description: 'Max 5% duplication',
      checkType: 'duplicate_code' as any,
      threshold: 5,
      glob: 'src/**/*.ts',
    });
    mockRunJscpd.mockReturnValue({ percentage: 99, duplicates: 999, passed: false });

    const results = runArchGateChecks([]);
    expect(results.passed).toBe(true);
  });
});

describe('Archgate extended — ast_grep_pattern', () => {
  beforeEach(() => { clearStore(); vi.clearAllMocks(); });
  afterEach(() => vi.restoreAllMocks());

  it('TC-AGE-03: ast_grep_pattern with count:0 → passed', () => {
    setupADR('ADR-020');
    registerArchRule({
      id: 'ARCH-020',
      adrId: 'ADR-020',
      description: 'No console.log',
      checkType: 'ast_grep_pattern' as any,
      pattern: 'console.log($$$)',
      glob: 'src/**/*.ts',
    });
    mockRunAstGrep.mockReturnValue({ matches: [], count: 0, passed: true });

    const results = runArchGateChecks([]);
    expect(results.passed).toBe(true);
  });

  it('TC-AGE-04: ast_grep_pattern with threshold exceeded → check fails with evidence', () => {
    setupADR('ADR-021');
    registerArchRule({
      id: 'ARCH-021',
      adrId: 'ADR-021',
      description: 'No console.log',
      checkType: 'ast_grep_pattern' as any,
      pattern: 'console.log($$$)',
      glob: 'src/**/*.ts',
    });
    mockRunAstGrep.mockReturnValue({
      matches: [{ filePath: 'src/foo.ts', line: 10, text: 'console.log("x")' }],
      count: 1,
      passed: false,
    });

    const results = runArchGateChecks([]);
    expect(results.passed).toBe(false);
    const check = results.checks.find(c => c.ruleId === 'ARCH-021');
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.evidence).toContain('console.log');
  });
});
