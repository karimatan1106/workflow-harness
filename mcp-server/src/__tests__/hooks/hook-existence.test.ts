import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

// Project root (parent repo)
const PROJECT_ROOT = resolve(__dirname, '../../../../..');
const HOOKS_DIR = resolve(PROJECT_ROOT, '.claude/hooks');
const SETTINGS_PATH = resolve(PROJECT_ROOT, '.claude/settings.json');

const HOOK_FILES = [
  'post-tool-lint.sh',
  'pre-tool-config-guard.sh',
  'stop-test-enforcer.sh',
  'pre-compact-context-save.sh',
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

  it('settings.json has PostToolUse hook for Write|Edit', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const postToolUse = settings.hooks.PostToolUse;
    expect(postToolUse).toBeDefined();
    expect(postToolUse).toHaveLength(1);
    expect(postToolUse[0].matcher).toBe('Write|Edit');
    expect(postToolUse[0].command.join(' ')).toContain('post-tool-lint.sh');
  });

  it('settings.json has PreToolUse hook for Write|Edit', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const preToolUse = settings.hooks.PreToolUse;
    expect(preToolUse).toBeDefined();
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse[0].matcher).toBe('Write|Edit');
    expect(preToolUse[0].command.join(' ')).toContain('pre-tool-config-guard.sh');
  });

  it('settings.json has Stop hook', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const stop = settings.hooks.Stop;
    expect(stop).toBeDefined();
    expect(stop).toHaveLength(1);
    expect(stop[0].command.join(' ')).toContain('stop-test-enforcer.sh');
  });

  it('settings.json has Notification hook for compact', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const notification = settings.hooks.Notification;
    expect(notification).toBeDefined();
    expect(notification).toHaveLength(1);
    expect(notification[0].matcher).toBe('compact');
    expect(notification[0].command.join(' ')).toContain('pre-compact-context-save.sh');
  });

  it('settings.json preserves existing UserPromptSubmit hooks', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const ups = settings.hooks.UserPromptSubmit;
    expect(ups).toBeDefined();
    expect(ups).toHaveLength(2);
  });

  it('settings.json preserves existing PreToolCall hook', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const ptc = settings.hooks.PreToolCall;
    expect(ptc).toBeDefined();
    expect(ptc).toHaveLength(1);
  });
});
