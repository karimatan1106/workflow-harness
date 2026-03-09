import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const PROJECT_ROOT = resolve(__dirname, '../../../../..');
const SCRIPT_PATH = resolve(PROJECT_ROOT, '.claude/hooks/pre-tool-config-guard.sh');

function execHook(
  scriptPath: string,
  stdinJson: string,
  env?: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  const escaped = stdinJson.replace(/'/g, "'\\''");
  try {
    const result = execSync(`echo '${escaped}' | bash "${scriptPath}"`, {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    return { exitCode: 0, stdout: result, stderr: '' };
  } catch (e: any) {
    return {
      exitCode: e.status ?? 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
    };
  }
}

describe('G-02: pre-tool-config-guard', () => {
  const blockedFiles = [
    { name: 'package.json', path: '/project/package.json' },
    { name: '.gitignore', path: '/project/.gitignore' },
    { name: '.mcp.json', path: '/project/.mcp.json' },
    { name: 'tsconfig.json', path: '/project/tsconfig.json' },
    { name: 'tsconfig.build.json', path: '/project/tsconfig.build.json' },
    { name: '.eslintrc.js', path: '/project/.eslintrc.js' },
    { name: '.eslintrc.json', path: '/project/.eslintrc.json' },
    { name: 'settings.json', path: '/project/.claude/settings.json' },
  ];

  it.each(blockedFiles)('blocks write to $name', ({ path }) => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: path },
      file_path: path,
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('[CONFIG-GUARD]');
  });

  const allowedFiles = [
    { name: 'index.ts', path: '/project/src/index.ts' },
    { name: 'README.md', path: '/project/README.md' },
    { name: 'handler.ts', path: '/project/src/handler.ts' },
    { name: 'test.json', path: '/project/data/test.json' },
  ];

  it.each(allowedFiles)('allows write to $name', ({ path }) => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: path },
      file_path: path,
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('[CONFIG-GUARD]');
  });

  it('bypasses when CONFIG_GUARD_DISABLE=true', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: '/project/package.json' },
      file_path: '/project/package.json',
    });
    const result = execHook(SCRIPT_PATH, input, {
      CONFIG_GUARD_DISABLE: 'true',
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain('[CONFIG-GUARD]');
  });

  it('does not bypass when CONFIG_GUARD_DISABLE=false', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: '/project/package.json' },
      file_path: '/project/package.json',
    });
    const result = execHook(SCRIPT_PATH, input, {
      CONFIG_GUARD_DISABLE: 'false',
    });
    expect(result.exitCode).toBe(2);
  });

  it('handles Windows backslash paths', () => {
    // JSON.stringify will produce \\, which in the JSON string represents \
    // The shell script's sed replaces \\ with / so we need actual backslashes in the JSON
    const input = '{"tool_name":"Write","tool_input":{"file_path":"C:\\\\project\\\\.claude\\\\settings.json"},"file_path":"C:\\\\project\\\\.claude\\\\settings.json"}';
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('[CONFIG-GUARD]');
  });

  it('allows empty file_path gracefully', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: {},
    });
    const result = execHook(SCRIPT_PATH, input);
    expect(result.exitCode).toBe(0);
  });
});
