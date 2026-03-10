/**
 * archgate.test.ts — Tests for G-13 archgate (executable architecture rules).
 * Each active ADR can have associated rules that are checked during DoD.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

const TEST_STATE_DIR = '.claude/state';
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

import { addADR, updateADRStatus } from '../tools/adr.js';
import {
  registerArchRule, runArchGateChecks, getArchRules,
  type ArchRule, type ArchGateResult,
} from '../tools/archgate.js';

const ADR_PATH = join(TEST_STATE_DIR, 'adr-store.json');
const ARCHGATE_PATH = join(TEST_STATE_DIR, 'archgate-rules.json');

function clearStore() { fsStore.clear(); }

describe('Archgate rule management', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('registerArchRule creates a rule linked to an ADR', () => {
    addADR({ id: 'ADR-001', statement: 'Max 200 lines per file', rationale: 'Readability', context: 'code', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');

    const rule = registerArchRule({
      id: 'ARCH-001',
      adrId: 'ADR-001',
      description: 'Source files must be <= 200 lines',
      checkType: 'line_count',
      threshold: 200,
      glob: 'src/**/*.ts',
    });
    expect(rule.id).toBe('ARCH-001');
    expect(rule.adrId).toBe('ADR-001');
  });

  it('getArchRules returns all registered rules', () => {
    registerArchRule({
      id: 'ARCH-001', adrId: 'ADR-001',
      description: 'Max 200 lines', checkType: 'line_count',
      threshold: 200, glob: 'src/**/*.ts',
    });
    registerArchRule({
      id: 'ARCH-002', adrId: 'ADR-002',
      description: 'No circular deps', checkType: 'pattern_absent',
      pattern: 'circular',
    });
    const rules = getArchRules();
    expect(rules.length).toBe(2);
  });
});

describe('Archgate DoD checks', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('runArchGateChecks returns empty results when no rules exist', () => {
    const results = runArchGateChecks([]);
    expect(results.passed).toBe(true);
    expect(results.checks).toEqual([]);
  });

  it('runArchGateChecks validates line_count rules against file list', () => {
    addADR({ id: 'ADR-001', statement: 'Max 200 lines', rationale: 'r', context: 'c', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');
    registerArchRule({
      id: 'ARCH-001', adrId: 'ADR-001',
      description: 'Max 200 lines', checkType: 'line_count',
      threshold: 200, glob: 'src/**/*.ts',
    });
    const results = runArchGateChecks([
      { path: 'src/tools/foo.ts', lineCount: 150 },
      { path: 'src/tools/bar.ts', lineCount: 250 },
    ]);
    expect(results.passed).toBe(false);
    expect(results.checks.length).toBe(1);
    expect(results.checks[0].passed).toBe(false);
    expect(results.checks[0].evidence).toContain('bar.ts');
  });

  it('runArchGateChecks passes when all files are under threshold', () => {
    addADR({ id: 'ADR-001', statement: 'Max 200 lines', rationale: 'r', context: 'c', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');
    registerArchRule({
      id: 'ARCH-001', adrId: 'ADR-001',
      description: 'Max 200 lines', checkType: 'line_count',
      threshold: 200, glob: 'src/**/*.ts',
    });
    const results = runArchGateChecks([
      { path: 'src/tools/foo.ts', lineCount: 100 },
      { path: 'src/tools/bar.ts', lineCount: 199 },
    ]);
    expect(results.passed).toBe(true);
  });

  it('runArchGateChecks validates pattern_absent rules', () => {
    addADR({ id: 'ADR-002', statement: 'No any type', rationale: 'r', context: 'c', taskId: 't1' });
    updateADRStatus('ADR-002', 'accepted');
    registerArchRule({
      id: 'ARCH-002', adrId: 'ADR-002',
      description: 'No any type', checkType: 'pattern_absent',
      pattern: ': any[^.]',
    });
    const results = runArchGateChecks([], [
      { path: 'src/foo.ts', content: 'const x: any = 5;' },
    ]);
    expect(results.passed).toBe(false);
    expect(results.checks[0].evidence).toContain('foo.ts');
  });

  it('runArchGateChecks skips rules for deprecated ADRs', () => {
    addADR({ id: 'ADR-001', statement: 'old rule', rationale: 'r', context: 'c', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');
    updateADRStatus('ADR-001', 'deprecated', 'outdated');

    registerArchRule({
      id: 'ARCH-001', adrId: 'ADR-001',
      description: 'Max 200 lines', checkType: 'line_count',
      threshold: 200, glob: 'src/**/*.ts',
    });

    const results = runArchGateChecks([
      { path: 'src/foo.ts', lineCount: 500 },
    ]);
    // Rule should be skipped because ADR is deprecated
    expect(results.passed).toBe(true);
  });
});
