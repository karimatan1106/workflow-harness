/**
 * StateManager invariant operations and completeness check tests
 * @spec AC-3 AC-4 AC-5 Invariant add/update/completeness
 * @covers state/manager.ts
 * @covers gates/dod-l3.ts
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let StateManagerClass: typeof import('../state/manager.js').StateManager;
let tempDir: string;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'inv-mgr-test-'));
  vi.stubEnv('STATE_DIR', tempDir);
  vi.resetModules();
  const mod = await import('../state/manager.js');
  StateManagerClass = mod.StateManager;
});

afterAll(() => {
  vi.unstubAllEnvs();
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe('StateManager invariant operations (AC-3, AC-4)', () => {
  let manager: InstanceType<typeof StateManagerClass>;
  let taskId: string;

  beforeEach(() => {
    manager = new StateManagerClass();
    const state = manager.createTask('test-inv', 'Test invariant operations for INV-N proof tier framework');
    taskId = state.taskId;
  });

  it('TC-AC3-01: addInvariant should add INV-N to TaskState.invariants', () => {
    const result = manager.addInvariant(taskId, {
      id: 'INV-1',
      description: 'test_impl precedes implementation in PHASE_ORDER',
      status: 'open',
    });
    expect(result).toBe(true);
    const state = manager.loadTask(taskId);
    expect(state?.invariants).toHaveLength(1);
    expect(state?.invariants[0].id).toBe('INV-1');
  });

  it('TC-AC3-02: addInvariant should reject duplicate INV-N id', () => {
    manager.addInvariant(taskId, { id: 'INV-1', description: 'first', status: 'open' });
    const result = manager.addInvariant(taskId, { id: 'INV-1', description: 'duplicate', status: 'open' });
    expect(result).toBe(false);
  });

  it('TC-AC4-01: updateInvariantStatus should transition open to held', () => {
    manager.addInvariant(taskId, { id: 'INV-1', description: 'test', status: 'open' });
    const result = manager.updateInvariantStatus(taskId, 'INV-1', 'held', 'Verified by test');
    expect(result).toBe(true);
    const state = manager.loadTask(taskId);
    expect(state?.invariants[0].status).toBe('held');
  });

  it('TC-AC4-02: updateInvariantStatus should transition open to violated', () => {
    manager.addInvariant(taskId, { id: 'INV-1', description: 'test', status: 'open' });
    const result = manager.updateInvariantStatus(taskId, 'INV-1', 'violated', 'Broken');
    expect(result).toBe(true);
    const state = manager.loadTask(taskId);
    expect(state?.invariants[0].status).toBe('violated');
  });

  it('TC-AC4-03: updateInvariantStatus should fail for non-existent INV-N', () => {
    const result = manager.updateInvariantStatus(taskId, 'INV-999', 'held');
    expect(result).toBe(false);
  });
});

describe('checkInvariantCompleteness (AC-5)', () => {
  it('TC-AC5-01: should pass when all invariants are held', async () => {
    const { checkInvariantCompleteness } = await import('../gates/dod-l3.js');
    const state = {
      invariants: [
        { id: 'INV-1', description: 'test', status: 'held' as const },
        { id: 'INV-2', description: 'test', status: 'held' as const },
      ],
    } as any;
    const result = checkInvariantCompleteness(state, 'acceptance_verification');
    expect(result.passed).toBe(true);
  });

  it('TC-AC5-02: should fail when invariant is open', async () => {
    const { checkInvariantCompleteness } = await import('../gates/dod-l3.js');
    const state = {
      invariants: [
        { id: 'INV-1', description: 'test', status: 'held' as const },
        { id: 'INV-2', description: 'test', status: 'open' as const },
      ],
    } as any;
    const result = checkInvariantCompleteness(state, 'acceptance_verification');
    expect(result.passed).toBe(false);
  });

  it('TC-AC5-03: should fail when invariant is violated', async () => {
    const { checkInvariantCompleteness } = await import('../gates/dod-l3.js');
    const state = {
      invariants: [
        { id: 'INV-1', description: 'test', status: 'violated' as const },
      ],
    } as any;
    const result = checkInvariantCompleteness(state, 'acceptance_verification');
    expect(result.passed).toBe(false);
  });

  it('TC-AC5-04: should pass when no invariants defined', async () => {
    const { checkInvariantCompleteness } = await import('../gates/dod-l3.js');
    const state = { invariants: [] } as any;
    const result = checkInvariantCompleteness(state, 'acceptance_verification');
    expect(result.passed).toBe(true);
  });
});
