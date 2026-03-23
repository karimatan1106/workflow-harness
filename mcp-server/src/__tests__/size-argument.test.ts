/**
 * TDD Red tests for size argument feature.
 * Tests createTaskState with explicit size parameter and
 * harness_start schema validation.
 *
 * These tests are expected to FAIL until implementation is done.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { TaskSize } from '../state/types.js';

let TEMP_DIR: string;
let STATE_DIR: string;
let DOCS_DIR: string;
let hmacKey: string;
let createTaskStateFn: typeof import('../state/manager-write.js').createTaskState;

const INTENT = 'Intent with sufficient length for validator check ok.';

beforeAll(async () => {
  TEMP_DIR = mkdtempSync(join(tmpdir(), 'size-arg-test-'));
  STATE_DIR = join(TEMP_DIR, 'state');
  DOCS_DIR = join(TEMP_DIR, 'docs');
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });
  vi.stubEnv('STATE_DIR', STATE_DIR);
  vi.stubEnv('DOCS_DIR', DOCS_DIR);
  vi.resetModules();
  hmacKey = randomBytes(32).toString('hex');
  const mod = await import('../state/manager-write.js');
  createTaskStateFn = mod.createTaskState;
});

afterAll(() => {
  vi.unstubAllEnvs();
  if (TEMP_DIR) rmSync(TEMP_DIR, { recursive: true, force: true });
});

describe('TC-AC1: size argument propagation', () => {
  it('TC-AC1-01: createTaskState with size=large sets state.size to large', () => {
    const state = createTaskStateFn(
      'size-large-task', INTENT, hmacKey, [], [], 'large',
    );
    expect(state.size).toBe('large');
  });
});

describe('TC-AC2: default size and riskScore mapping', () => {
  it('TC-AC2-01: createTaskState without size defaults to large', () => {
    const state = createTaskStateFn(
      'size-default-task', INTENT, hmacKey, [], [],
    );
    expect(state.size).toBe('large');
  });

  it('TC-AC2-02: riskScore fixed mapping large=8', () => {
    const state = createTaskStateFn(
      'risk-large-task', INTENT, hmacKey, [], [], 'large',
    );
    expect(state.riskScore.total).toBe(8);
    expect(state.riskScore.factors).toEqual({
      fileCount: 0, hasTests: false, hasConfig: false,
      hasInfra: false, hasSecurity: false, hasDatabase: false,
      codeLineEstimate: 0,
    });
  });
});

describe('TC-AC4: harness_start schema', () => {
  it('TC-AC4-01: inputSchema has size property with enum constraint', async () => {
    vi.resetModules();
    const defs = await import('../tools/defs-a.js');
    const harnessStart = defs.TOOL_DEFS_A.find(
      (d: { name: string }) => d.name === 'harness_start',
    );
    expect(harnessStart).toBeDefined();

    const sizeProperty = harnessStart!.inputSchema.properties.size;
    expect(sizeProperty).toBeDefined();
    expect(sizeProperty.type).toBe('string');
    expect(sizeProperty.enum).toEqual(['large']);
  });
});
