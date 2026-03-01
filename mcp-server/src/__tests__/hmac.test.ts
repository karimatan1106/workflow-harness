/**
 * Tests for HMAC utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ensureHmacKeys,
  computeHmac,
  signState,
  verifyState,
  generateSessionToken,
  generateTaskId,
} from '../utils/hmac.js';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'hmac-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('ensureHmacKeys', () => {
  it('creates hmac-keys.json and returns a hex key when file does not exist', () => {
    const key = ensureHmacKeys(tempDir);
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64); // 32 bytes => 64 hex chars
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    expect(existsSync(join(tempDir, 'hmac-keys.json'))).toBe(true);
  });

  it('returns the same key on subsequent calls (reuses existing file)', () => {
    const key1 = ensureHmacKeys(tempDir);
    const key2 = ensureHmacKeys(tempDir);
    expect(key1).toBe(key2);
  });

  it('persists key in hmac-keys.json with correct structure', () => {
    const key = ensureHmacKeys(tempDir);
    const content = JSON.parse(readFileSync(join(tempDir, 'hmac-keys.json'), 'utf8'));
    expect(content.current).toBe(key);
    expect(typeof content.rotatedAt).toBe('string');
  });

  it('creates nested directories if stateDir does not exist', () => {
    const nestedDir = join(tempDir, 'a', 'b', 'c');
    const key = ensureHmacKeys(nestedDir);
    expect(typeof key).toBe('string');
    expect(existsSync(join(nestedDir, 'hmac-keys.json'))).toBe(true);
  });
});

describe('computeHmac', () => {
  it('returns a 64-character hex string', () => {
    const result = computeHmac('hello world', 'secret-key-value');
    expect(typeof result).toBe('string');
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('produces deterministic output for the same inputs', () => {
    const data = 'deterministic data';
    const key = 'fixed-key-for-test';
    const result1 = computeHmac(data, key);
    const result2 = computeHmac(data, key);
    expect(result1).toBe(result2);
  });

  it('produces different output for different data', () => {
    const key = 'same-key';
    const result1 = computeHmac('data-a', key);
    const result2 = computeHmac('data-b', key);
    expect(result1).not.toBe(result2);
  });

  it('produces different output for different keys', () => {
    const data = 'same-data';
    const result1 = computeHmac(data, 'key-1');
    const result2 = computeHmac(data, 'key-2');
    expect(result1).not.toBe(result2);
  });
});

describe('signState and verifyState', () => {
  const key = 'test-hmac-key-for-signing-state';

  it('sign produces a hex string', () => {
    const state = { taskId: 'abc', phase: 'research', taskName: 'test', version: 4 };
    const sig = signState(state as Record<string, unknown>, key);
    expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
  });

  it('verifyState returns true for a properly signed state', () => {
    const state: Record<string, unknown> = {
      taskId: 'task-123',
      phase: 'research',
      taskName: 'my-task',
      version: 4,
      stateIntegrity: '',
    };
    const sig = signState(state, key);
    state.stateIntegrity = sig;
    expect(verifyState(state, key)).toBe(true);
  });

  it('verifyState returns false when stateIntegrity is missing', () => {
    const state: Record<string, unknown> = {
      taskId: 'task-123',
      phase: 'research',
    };
    expect(verifyState(state, key)).toBe(false);
  });

  it('verifyState returns false when state has been tampered with', () => {
    const state: Record<string, unknown> = {
      taskId: 'task-123',
      phase: 'research',
      taskName: 'original-name',
      version: 4,
      stateIntegrity: '',
    };
    const sig = signState(state, key);
    state.stateIntegrity = sig;

    // Tamper: modify a field after signing
    state.taskName = 'tampered-name';
    expect(verifyState(state, key)).toBe(false);
  });

  it('verifyState returns false when wrong key is used', () => {
    const state: Record<string, unknown> = {
      taskId: 'task-xyz',
      phase: 'planning',
      version: 4,
      stateIntegrity: '',
    };
    const sig = signState(state, key);
    state.stateIntegrity = sig;
    expect(verifyState(state, 'wrong-key')).toBe(false);
  });

  it('signState ignores the stateIntegrity field when computing signature', () => {
    const stateWithIntegrity: Record<string, unknown> = {
      taskId: 'task-abc',
      phase: 'research',
      stateIntegrity: 'old-signature-value',
    };
    const stateWithoutIntegrity: Record<string, unknown> = {
      taskId: 'task-abc',
      phase: 'research',
    };
    // Both should produce the same signature (stateIntegrity is excluded from signing)
    const sig1 = signState(stateWithIntegrity, key);
    const sig2 = signState(stateWithoutIntegrity, key);
    expect(sig1).toBe(sig2);
  });
});

describe('generateSessionToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateSessionToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it('returns a unique value on each call', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    expect(token1).not.toBe(token2);
  });
});

describe('generateTaskId', () => {
  it('returns a valid UUID v4 string', () => {
    const id = generateTaskId();
    expect(typeof id).toBe('string');
    // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(id)).toBe(true);
  });

  it('returns a unique value on each call', () => {
    const id1 = generateTaskId();
    const id2 = generateTaskId();
    expect(id1).not.toBe(id2);
  });
});
