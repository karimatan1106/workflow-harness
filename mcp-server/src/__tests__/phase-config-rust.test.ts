import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';

// Harness root (workflow-harness/) — 3 levels up from mcp-server/src/__tests__/
const HARNESS_ROOT = resolve(__dirname, '../../..');
const PHASE_CONFIG_PATH = resolve(HARNESS_ROOT, 'hooks/phase-config.js');

const require = createRequire(import.meta.url);
const { BASH_COMMANDS, PHASE_EXT } = require(PHASE_CONFIG_PATH);

describe('phase-config Rust support (AC2/AC3)', () => {
  it('TC-AC2-01: BASH_COMMANDS.implementation includes cargo build/check/clippy/fmt', () => {
    expect(BASH_COMMANDS).toBeDefined();
    expect(BASH_COMMANDS.implementation).toBeDefined();
    expect(Array.isArray(BASH_COMMANDS.implementation)).toBe(true);

    const required = ['cargo build', 'cargo check', 'cargo clippy', 'cargo fmt'];
    for (const cmd of required) {
      expect(BASH_COMMANDS.implementation).toContain(cmd);
    }
  });

  it('TC-AC3-01: PHASE_EXT.testing/regression_test/test_impl/e2e_test all include .rs', () => {
    const phases = ['testing', 'regression_test', 'test_impl', 'e2e_test'] as const;

    for (const phase of phases) {
      const exts = PHASE_EXT[phase];
      expect(exts, `PHASE_EXT.${phase} must be defined`).toBeDefined();
      expect(Array.isArray(exts), `PHASE_EXT.${phase} must be an array`).toBe(true);
      expect(exts, `PHASE_EXT.${phase} must include .rs`).toContain('.rs');
    }
  });
});
