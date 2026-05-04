/**
 * @spec F-002a / AC-1, F-003a / AC-2
 *
 * G-AC1/AC2: BASH_COMMANDS Rust toolchain support
 *
 * `hooks/phase-config.js` の BASH_COMMANDS が Rust ツールチェーン
 * (cargo test / cargo nextest run / cargo add) を許可コマンド集合に
 * 含むことを検証する。
 *
 * TDD Red 段階: 実装(F-002a/F-003a)前のため、
 *   - testing 配列に "cargo test" / "cargo nextest run" は未追加
 *   - implementation キー自体が未定義
 * いずれの TC も意図通り fail する。
 *
 * Test layout:
 *   - TC-AC1-01: BASH_COMMANDS.testing が "cargo test" を含む
 *   - TC-AC1-02: BASH_COMMANDS.testing が "cargo nextest run" を含む(境界値)
 *   - TC-AC2-02: BASH_COMMANDS.implementation 配列に "cargo add" が含まれる
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';

// __dirname → mcp-server/src/__tests__/
// ../../.. → project root (workflow-harness/)
const PROJECT_ROOT = resolve(__dirname, '../../..');
const PHASE_CONFIG_PATH = resolve(PROJECT_ROOT, 'hooks/phase-config.js');

// phase-config.js は CommonJS のため createRequire で読み込む
const require = createRequire(import.meta.url);
const { BASH_COMMANDS } = require(PHASE_CONFIG_PATH) as {
  BASH_COMMANDS: Record<string, string[] | undefined>;
};

describe('G-AC1/AC2: BASH_COMMANDS Rust toolchain support', () => {
  it('TC-AC1-01: BASH_COMMANDS.testing contains "cargo test"', () => {
    const testing = BASH_COMMANDS.testing ?? [];
    expect(testing.includes('cargo test')).toBe(true);
  });

  it('TC-AC1-02: BASH_COMMANDS.testing contains "cargo nextest run" (boundary)', () => {
    const testing = BASH_COMMANDS.testing ?? [];
    expect(testing.includes('cargo nextest run')).toBe(true);
  });

  it('TC-AC2-02: BASH_COMMANDS.implementation contains "cargo add"', () => {
    const implementation = BASH_COMMANDS.implementation ?? [];
    expect(Array.isArray(BASH_COMMANDS.implementation)).toBe(true);
    expect(implementation.includes('cargo add')).toBe(true);
  });
});
