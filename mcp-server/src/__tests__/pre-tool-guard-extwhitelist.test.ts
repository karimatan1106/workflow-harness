/**
 * @spec F-006 / AC-6
 *
 * G-06: pre-tool-guard agent extension whitelist
 *
 * canonical hook (`hooks/pre-tool-guard.sh`) が agent metadata の
 * allowedWriteExt を参照して拡張子ベースの Write 許可判定を行うことを検証する。
 *
 * TDD Red 段階: canonical hook はまだ agent metadata を参照しないため、
 * TC-AC6-01〜TC-AC6-03 は意図通り fail する。
 *
 * Test layout:
 *   - TC-AC6-01: agent_id=coordinator + ext=.toon  → allow (exitCode=0)
 *   - TC-AC6-02: agent_id=coordinator + ext=.mmd   → allow (exitCode=0)
 *   - TC-AC6-03: agent_id=coordinator + ext=.ts    → deny  (exitCode=2, BLOCKED)
 *   - TC-AC6-04: agent_id=worker      + ext=.ts    → allow (従来通り)
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

// __dirname → mcp-server/src/__tests__/
// ../../.. → project root (workflow-harness/)
const PROJECT_ROOT = resolve(__dirname, '../../..');
const SCRIPT_PATH = resolve(PROJECT_ROOT, 'hooks/pre-tool-guard.sh');

function execHook(
  scriptPath: string,
  stdinJson: string,
  env?: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  try {
    const result = execSync(`bash "${scriptPath}"`, {
      input: stdinJson,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 30000,
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout: result, stderr: '' };
  } catch (e: any) {
    const exitCode = typeof e.status === 'number' ? e.status : 1;
    return {
      exitCode,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

describe('G-06: pre-tool-guard agent extension whitelist', () => {
  it('TC-AC6-01: agent_id=coordinator + ext=.toon allow exitCode=0', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      agent_id: 'coordinator',
      tool_input: { file_path: '/tmp/test.toon' },
      cwd: PROJECT_ROOT,
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(0);
  });

  it('TC-AC6-02: agent_id=coordinator + ext=.mmd allow exitCode=0', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      agent_id: 'coordinator',
      tool_input: { file_path: '/tmp/test.mmd' },
      cwd: PROJECT_ROOT,
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(0);
  });

  it('TC-AC6-03: agent_id=coordinator + ext=.ts deny exitCode=2', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      agent_id: 'coordinator',
      tool_input: { file_path: '/tmp/test.ts' },
      cwd: PROJECT_ROOT,
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(2);
    // deny 時は stdout または stderr に BLOCKED マーカーが含まれる
    const combined = `${result.stdout}${result.stderr}`;
    expect(combined).toContain('BLOCKED');
  });

  it('TC-AC6-04: agent_id=worker + ext=.ts allow (従来通り)', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      agent_id: 'worker',
      tool_input: { file_path: '/tmp/test.ts' },
      cwd: PROJECT_ROOT,
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(0);
  });
});
