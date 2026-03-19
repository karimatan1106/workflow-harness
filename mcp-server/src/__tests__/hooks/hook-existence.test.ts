import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Harness root (workflow-harness/)
const HARNESS_ROOT = resolve(__dirname, '../../../..');
const HOOKS_DIR = resolve(HARNESS_ROOT, 'hooks');
const SETTINGS_PATH = resolve(HARNESS_ROOT, '.claude/settings.json');

/** Core hook files shipped with workflow-harness */
const HOOK_FILES = [
  'pre-tool-guard.sh',
  'tool-gate.js',
  'context-watchdog.js',
  'session-boundary.js',
  'hook-utils.js',
  'loop-detector.js',
  'block-dangerous-commands.js',
];

describe('G-01~04: Hook existence and settings', () => {
  it.each(HOOK_FILES)('hook file exists: %s', (filename) => {
    const filepath = resolve(HOOKS_DIR, filename);
    expect(existsSync(filepath)).toBe(true);
  });

  it.each(HOOK_FILES.filter(f => f.endsWith('.sh')))('shell hook file has bash shebang: %s', (filename) => {
    const filepath = resolve(HOOKS_DIR, filename);
    const content = readFileSync(filepath, 'utf8');
    expect(content.startsWith('#!/bin/bash') || content.startsWith('#!/usr/bin/env bash')).toBe(true);
  });

  it('settings.json exists and is valid JSON', () => {
    expect(existsSync(SETTINGS_PATH)).toBe(true);
    const content = readFileSync(SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(content);
    expect(settings).toBeDefined();
    expect(settings.hooks).toBeDefined();
  });

  it('settings.json has PreToolUse hooks', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const preToolUse = settings.hooks.PreToolUse;
    expect(preToolUse).toBeDefined();
    expect(preToolUse.length).toBeGreaterThanOrEqual(1);
  });

  it('settings.json has pre-tool-guard.sh registered', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const preToolUse = settings.hooks.PreToolUse;
    const guardHook = preToolUse.find((h: any) =>
      h.hooks?.some((hh: any) =>
        (typeof hh === 'string' && hh.includes('pre-tool-guard')) ||
        (typeof hh === 'object' && hh.command?.includes('pre-tool-guard'))
      )
    );
    expect(guardHook).toBeDefined();
  });

  it('settings.json has UserPromptSubmit hooks', () => {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    const ups = settings.hooks.UserPromptSubmit;
    expect(ups).toBeDefined();
    expect(ups.length).toBeGreaterThanOrEqual(1);
  });
});
