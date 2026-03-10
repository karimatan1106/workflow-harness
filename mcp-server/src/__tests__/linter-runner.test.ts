/**
 * linter-runner.test.ts — TDD Red tests for linter-runner module.
 * Tests runJscpd and runAstGrepPattern. Module does not exist yet.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('@ast-grep/napi', () => ({
  parse: vi.fn(),
}));

import { execSync } from 'child_process';
import { parse as astParse } from '@ast-grep/napi';
import { runJscpd, runAstGrepPattern } from '../tools/linter-runner.js';

const mockExecSync = vi.mocked(execSync);
const mockAstParse = vi.mocked(astParse);

describe('runJscpd', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-LR-01: percentage below threshold → passed:true', () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({ statistics: { total: { percentage: 2.5, duplicatedLines: 10 } } }),
    );
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(true);
    expect(result.percentage).toBe(2.5);
    expect(result.duplicates).toBe(10);
  });

  it('TC-LR-02: percentage above threshold → passed:false', () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({ statistics: { total: { percentage: 8.0, duplicatedLines: 40 } } }),
    );
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(false);
    expect(result.percentage).toBe(8.0);
  });

  it('TC-LR-03: ETIMEDOUT → graceful degradation passed:true', () => {
    const err = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    mockExecSync.mockImplementation(() => { throw err; });
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(true);
  });

  it('TC-LR-04: ENOENT (not installed) → graceful degradation passed:true', () => {
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockExecSync.mockImplementation(() => { throw err; });
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(true);
  });

  it('TC-LR-05: malformed JSON → graceful degradation passed:true', () => {
    mockExecSync.mockReturnValue('not valid json {{{');
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(true);
  });

  it('TC-BV-01: percentage exactly equals threshold → passed:true (<=)', () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({ statistics: { total: { percentage: 5.0, duplicatedLines: 20 } } }),
    );
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(true);
    expect(result.percentage).toBe(5.0);
  });

  it('TC-BV-02: percentage 0.1 above threshold → passed:false', () => {
    mockExecSync.mockReturnValue(
      JSON.stringify({ statistics: { total: { percentage: 5.1, duplicatedLines: 21 } } }),
    );
    const result = runJscpd('src/**/*.ts', 5);
    expect(result.passed).toBe(false);
  });
});

describe('runAstGrepPattern', () => {
  beforeEach(() => vi.clearAllMocks());

  it('TC-LR-06: no matches → passed:true', () => {
    mockAstParse.mockReturnValue({ root: () => ({ findAll: () => [] }) } as any);
    const result = runAstGrepPattern('src/**/*.ts', 'console.log($$$)', 0);
    expect(result.passed).toBe(true);
    expect(result.count).toBe(0);
    expect(result.matches).toEqual([]);
  });

  it('TC-LR-07: matches below threshold → passed:true', () => {
    const fakeMatches = [
      { range: () => ({ start: { line: 10 } }), text: () => 'console.log("a")' },
    ];
    mockAstParse.mockReturnValue({ root: () => ({ findAll: () => fakeMatches }) } as any);
    const result = runAstGrepPattern('src/**/*.ts', 'console.log($$$)', 5);
    expect(result.passed).toBe(true);
    expect(result.count).toBe(1);
  });

  it('TC-LR-08: matches above threshold=0 → passed:false', () => {
    const fakeMatches = [
      { range: () => ({ start: { line: 5 } }), text: () => 'console.log("x")' },
    ];
    mockAstParse.mockReturnValue({ root: () => ({ findAll: () => fakeMatches }) } as any);
    const result = runAstGrepPattern('src/**/*.ts', 'console.log($$$)', 0);
    expect(result.passed).toBe(false);
    expect(result.count).toBe(1);
  });

  it('TC-LR-09: napi not installed → graceful degradation passed:true', () => {
    mockAstParse.mockImplementation(() => { throw new Error('Cannot find module'); });
    const result = runAstGrepPattern('src/**/*.ts', 'console.log($$$)', 0);
    expect(result.passed).toBe(true);
  });
});
