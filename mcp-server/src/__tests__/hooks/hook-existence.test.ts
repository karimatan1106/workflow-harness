import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Project root (parent repo)
const PROJECT_ROOT = resolve(__dirname, '../../../../..');
const HOOKS_DIR = resolve(PROJECT_ROOT, '.claude/hooks');
const SETTINGS_PATH = resolve(PROJECT_ROOT, '.claude/settings.json');

const HOOK_FILES = [
  'post-tool-lint.sh',
  'pre-tool-config-guard.sh',
  'pre-compact-context-save.sh',
  'context-watchdog.sh',
  'pre-tool-3layer-guard.sh',
  'pre-tool-no-verify-block.sh',
  'handoff-reader.sh',
  'coordinator-recorder.sh',
  'coordinator-cleanup.sh',
];

describe('G-01~04: Hook existence and settings', () => {
  it.each(HOOK_FILES)('hook file exists: %s', (filename) => {
    const filepath = resolve(HOOKS_DIR, filename);
    expect(existsSync(filepath)).toBe(true);
  });

  it.each(HOOK_FILES)('hook file has bash shebang: %s', (filename) => {
    const filepath = resolve(HOOKS_DIR, filename);
    const content = readFileSync(filepath, 'utf8');
    expect(content.startsWith('#!/bin/bash')).toBe(true);
  });

  it('settings.json exists and is valid JSON', () => {
    expect(existsSync(SETTINGS_PATH)).toBe(true);
    const content = readFileSync(SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(content);
    expect(settings).toBeDefined();
    expect(settings.hooks).toBeDefined();
  });

  it('settings.json has PostToolUse hooks for Write|Edit and Agent', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const postToolUse = settings.hooks.PostToolUse;
    expect(postToolUse).toBeDefined();
    expect(postToolUse).toHaveLength(2);
    const lintHook = postToolUse.find((h: any) => h.matcher === 'Write|Edit');
    expect(lintHook).toBeDefined();
    expect(lintHook.hooks[0].command).toContain('post-tool-lint.sh');
    const cleanupHook = postToolUse.find((h: any) => h.matcher === 'Agent');
    expect(cleanupHook).toBeDefined();
    expect(cleanupHook.hooks[0].command).toContain('coordinator-cleanup.sh');
  });

  it('settings.json has PreToolUse hooks (config-guard + no-verify-block)', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const preToolUse = settings.hooks.PreToolUse;
    expect(preToolUse).toBeDefined();
    expect(preToolUse.length).toBeGreaterThanOrEqual(2);
    const configGuard = preToolUse.find((h: any) => h.hooks[0].command.includes('pre-tool-config-guard.sh'));
    expect(configGuard).toBeDefined();
    expect(configGuard.matcher).toBe('Write|Edit');
    const noVerify = preToolUse.find((h: any) => h.hooks[0].command.includes('pre-tool-no-verify-block.sh'));
    expect(noVerify).toBeDefined();
    expect(noVerify.matcher).toBe('Bash');
  });

  it('user-level hooks exist (watchdog + coordinator-recorder)', () => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const userHooksDir = resolve(home, '.claude/hooks');
    for (const f of ['context-watchdog.sh', 'coordinator-recorder.sh']) {
      expect(existsSync(resolve(userHooksDir, f))).toBe(true);
    }
  });

  it('settings.json has Notification hook for compact', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const notification = settings.hooks.Notification;
    expect(notification).toBeDefined();
    expect(notification).toHaveLength(1);
    expect(notification[0].matcher).toBe('compact');
    expect(notification[0].hooks[0].command).toContain('pre-compact-context-save.sh');
  });

  it('settings.json has UserPromptSubmit hook', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const ups = settings.hooks.UserPromptSubmit;
    expect(ups).toBeDefined();
    expect(ups).toHaveLength(1);
    expect(ups[0].hooks[0].command).toContain('handoff-reader.sh');
  });
});
