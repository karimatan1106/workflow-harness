/**
 * TDD Red: stale-task-cleanup-and-hmac-recovery
 * AC-1: Response size <= 10KB | AC-2: Completed exclusion
 * AC-3: HMAC fail → integrityWarning | AC-4: Legacy migration
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureHmacKeys, signState } from '../utils/hmac.js';
import { loadTaskFromDisk, listTasksFromDisk, buildTaskIndex } from '../state/manager-read.js';
import { serializeState } from '../state/state-toon-io.js';
import type { TaskState } from '../state/types.js';

let tempDir: string;
const origSD = process.env.STATE_DIR;

function createSignedState(sd: string, o: { taskId: string; taskName: string; phase?: string }) {
  const key = ensureHmacKeys(sd);
  const now = new Date().toISOString();
  const phase = o.phase ?? 'research';
  const s: Record<string, unknown> = {
    version: 4, phase, completedPhases: [], skippedPhases: [],
    size: 'large',
    riskScore: { total: 5, factors: { fileCount: 5, hasTests: false, hasConfig: false, hasInfra: false, hasSecurity: false, hasDatabase: false, codeLineEstimate: 0 } },
    userIntent: 'test', openQuestions: [], notInScope: [],
    scopeFiles: [], scopeDirs: [], plannedFiles: [], acceptanceCriteria: [], rtmEntries: [],
    proofLog: [], invariants: [],
    checkpoint: { taskId: o.taskId, phase, completedPhases: [], timestamp: now, sha256: '', userIntent: 'test', scopeFiles: [], acceptanceCriteria: [], rtmEntries: [] },
    docsDir: 'docs/workflows/' + o.taskName, sessionToken: 'tok', stateIntegrity: '',
    workflowDir: join(sd, 'workflows', `${o.taskId}_${o.taskName}`),
    createdAt: now, updatedAt: now,
    taskId: o.taskId, taskName: o.taskName,
  };
  s.stateIntegrity = signState(s, key);
  return s;
}

function writeToDisk(sd: string, s: Record<string, unknown>) {
  const d = join(sd, 'workflows', `${s.taskId}_${s.taskName}`);
  mkdirSync(d, { recursive: true });
  const toon = serializeState(s as unknown as TaskState);
  writeFileSync(join(d, 'workflow-state.toon'), toon);
}

function overwriteKey(sd: string, keyHex: string) {
  writeFileSync(join(sd, 'hmac-keys.toon'), `version: 1\ncurrent: ${keyHex}\nrotatedAt: ${new Date().toISOString()}\n`);
}

// writeLegacy removed — JSON migration code was deleted.

beforeEach(() => { tempDir = mkdtempSync(join(tmpdir(), 'stale-hmac-')); process.env.STATE_DIR = tempDir; });
afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); origSD ? (process.env.STATE_DIR = origSD) : delete process.env.STATE_DIR; });

describe('AC-1: Response size <= 10KB', () => {
  it('TC-1-01: 5 active + 10 completed response <= 10KB', () => {
    for (let i = 0; i < 5; i++) writeToDisk(tempDir, createSignedState(tempDir, { taskId: `a-${i}-aaaaaaaa`, taskName: `active-${i}` }));
    for (let i = 0; i < 10; i++) writeToDisk(tempDir, createSignedState(tempDir, { taskId: `c-${i}-bbbbbbbb`, taskName: `done-${i}`, phase: 'completed' }));
    const bytes = Buffer.byteLength(JSON.stringify({ tasks: listTasksFromDisk() }), 'utf8');
    expect(bytes).toBeLessThanOrEqual(10240);
  });

  it('TC-1-02: 50 active tasks response <= 10KB', () => {
    for (let i = 0; i < 50; i++) {
      const pad = 'x'.repeat(20 + (i % 20));
      writeToDisk(tempDir, createSignedState(tempDir, { taskId: `b-${i}-cccccccc`, taskName: `t-${pad}-${i}` }));
    }
    const bytes = Buffer.byteLength(JSON.stringify({ tasks: listTasksFromDisk() }), 'utf8');
    expect(bytes).toBeLessThanOrEqual(10240);
  });
});

describe('AC-2: Completed task exclusion', () => {
  it('TC-2-01: completed excluded from listTasksFromDisk', () => {
    ['research', 'planning', 'implementation'].forEach((p, i) =>
      writeToDisk(tempDir, createSignedState(tempDir, { taskId: `a-${i}-dddddddddd`, taskName: `act-${i}`, phase: p })));
    for (let i = 0; i < 2; i++) writeToDisk(tempDir, createSignedState(tempDir, { taskId: `c-${i}-eeeeeeeeee`, taskName: `dn-${i}`, phase: 'completed' }));
    const r = listTasksFromDisk();
    expect(r.length).toBe(3);
    expect(r.every(t => t.phase !== 'completed')).toBe(true);
  });

  it('TC-2-02: all completed returns empty', () => {
    for (let i = 0; i < 5; i++) writeToDisk(tempDir, createSignedState(tempDir, { taskId: `ac-${i}-ffffffff`, taskName: `ad-${i}`, phase: 'completed' }));
    expect(listTasksFromDisk().length).toBe(0);
  });

  it('TC-2-03: buildTaskIndex includes completed with status="completed"', () => {
    for (let i = 0; i < 2; i++) writeToDisk(tempDir, createSignedState(tempDir, { taskId: `ia-${i}-gggggggg`, taskName: `ia-${i}` }));
    for (let i = 0; i < 3; i++) writeToDisk(tempDir, createSignedState(tempDir, { taskId: `ic-${i}-hhhhhhhh`, taskName: `id-${i}`, phase: 'completed' }));
    const r = buildTaskIndex(tempDir);
    expect(r.length).toBe(5);
    expect(r.filter(t => t.status === 'completed').length).toBe(3);
  });
});

describe('AC-3: HMAC failure returns integrityWarning', () => {
  it('TC-3-01: loadTaskFromDisk returns integrityWarning=true on mismatch', () => {
    ensureHmacKeys(tempDir);
    const id = 'hmac-fail-01-abcdefgh';
    writeToDisk(tempDir, createSignedState(tempDir, { taskId: id, taskName: 'hm-t' }));
    overwriteKey(tempDir, 'b'.repeat(64));
    const r = loadTaskFromDisk(id);
    expect(r).not.toBeNull();
    expect((r as any).integrityWarning).toBe(true);
    expect((r as any).taskId).toBe(id);
  });

  it('TC-3-02: valid HMAC has no integrityWarning', () => {
    const id = 'hmac-ok-01-abcdefgh';
    writeToDisk(tempDir, createSignedState(tempDir, { taskId: id, taskName: 'hm-ok' }));
    const r = loadTaskFromDisk(id);
    expect(r).not.toBeNull();
    expect((r as any).integrityWarning).toBeUndefined();
  });

  it('TC-3-03: write ops blocked on integrityWarning tasks', async () => {
    const id = 'hmac-blk-01-abcdefgh';
    writeToDisk(tempDir, createSignedState(tempDir, { taskId: id, taskName: 'hm-blk' }));
    overwriteKey(tempDir, 'c'.repeat(64));
    const { StateManager } = await import('../state/manager.js');
    const sm = new StateManager();
    expect(sm.advancePhase(id).success).toBe(false);
    expect(sm.advancePhase(id).error).toMatch(/integrity/i);
    expect(sm.approveGate(id, 'user').success).toBe(false);
    expect(sm.recordFeedback(id, 'fb')).toBe(false);
  });

  it('TC-3-04: handleHarnessStatus returns integrityWarning not "Task not found"', async () => {
    const id = 'hmac-st-01-abcdefgh';
    writeToDisk(tempDir, createSignedState(tempDir, { taskId: id, taskName: 'hm-st', phase: 'planning' }));
    overwriteKey(tempDir, 'd'.repeat(64));
    const { handleHarnessStatus } = await import('../tools/handlers/lifecycle.js');
    const { StateManager } = await import('../state/manager.js');
    const c = JSON.stringify(await handleHarnessStatus({ taskId: id }, new StateManager()));
    expect(c).not.toContain('Task not found');
    expect(c).toContain('integrityWarning');
  });
});

// AC-4: Legacy hmac-keys.json migration tests removed — migration code was deleted.
