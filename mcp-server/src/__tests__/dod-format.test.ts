/**
 * DoD gate tests: formatDoDResult.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { runDoDChecks, formatDoDResult } from '../gates/dod.js';
import { createTempDir, removeTempDir, makeMinimalState } from './dod-test-helpers.js';

let tempDir: string;
let docsDir: string;

beforeEach(() => {
  ({ tempDir, docsDir } = createTempDir());
});

afterEach(() => {
  removeTempDir(tempDir);
});

// ─── formatDoDResult ─────────────────────────────

describe('formatDoDResult', () => {
  it('includes PASSED in the output when DoD passed', async () => {
    const state = makeMinimalState('refactoring', tempDir, docsDir);
    const dodResult = await runDoDChecks(state, docsDir);
    const formatted = formatDoDResult(dodResult);
    expect(formatted).toContain('PASSED');
  });

  it('includes FAILED in the output when DoD failed', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    // Do not create the output file → L1 fails
    const dodResult = await runDoDChecks(state, docsDir);
    const formatted = formatDoDResult(dodResult);
    expect(formatted).toContain('FAILED');
  });

  it('lists each check level in the formatted output', async () => {
    const state = makeMinimalState('refactoring', tempDir, docsDir);
    const dodResult = await runDoDChecks(state, docsDir);
    const formatted = formatDoDResult(dodResult);
    expect(formatted).toContain('[L1]');
    expect(formatted).toContain('[L2]');
    expect(formatted).toContain('[L3]');
    expect(formatted).toContain('[L4]');
  });

  it('lists errors section when there are failures', async () => {
    const state = makeMinimalState('research', tempDir, docsDir);
    const dodResult = await runDoDChecks(state, docsDir);
    const formatted = formatDoDResult(dodResult);
    expect(formatted).toContain('Errors:');
  });
});
