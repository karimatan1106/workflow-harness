/**
 * adr.test.ts — Tests for G-12 ADR (Architecture Decision Records) module.
 * Manages decisions with status lifecycle: proposed → accepted → superseded/deprecated.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { join } from 'path';

const TEST_STATE_DIR = '.claude/state';
const fsStore: Map<string, string> = new Map();

vi.mock('fs', () => ({
  default: {},
  existsSync: (p: string) => fsStore.has(p),
  readFileSync: (p: string, _enc: string) => {
    const v = fsStore.get(p);
    if (v === undefined) throw Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
    return v;
  },
  writeFileSync: (p: string, data: string, _enc?: string) => { fsStore.set(p, data); },
  mkdirSync: (_p: string, _opts?: any) => {},
}));

import {
  loadADRStore, addADR, updateADRStatus, getActiveADRs,
  getADR, supersedeADR, type ADREntry,
} from '../tools/adr.js';

const ADR_PATH = join(TEST_STATE_DIR, 'adr-store.json');

function clearStore() { fsStore.clear(); }
function getStore(): any {
  return JSON.parse(fsStore.get(ADR_PATH)!);
}

describe('ADR store lifecycle', () => {
  beforeEach(clearStore);
  afterEach(() => vi.clearAllMocks());

  it('loadADRStore returns empty store when no file exists', () => {
    const store = loadADRStore();
    expect(store.version).toBe(1);
    expect(store.entries).toEqual([]);
  });

  it('addADR creates a new ADR with proposed status', () => {
    const adr = addADR({
      id: 'ADR-001',
      statement: 'Use TOON format for all artifacts',
      rationale: 'Machine-parseable, no ambiguity',
      context: 'Artifact format decision',
      taskId: 't1',
    });
    expect(adr.id).toBe('ADR-001');
    expect(adr.status).toBe('proposed');
    expect(adr.statement).toBe('Use TOON format for all artifacts');
  });

  it('updateADRStatus transitions proposed → accepted', () => {
    addADR({ id: 'ADR-001', statement: 'stmt', rationale: 'why', context: 'ctx', taskId: 't1' });
    const updated = updateADRStatus('ADR-001', 'accepted');
    expect(updated).toBe(true);
    const adr = getADR('ADR-001');
    expect(adr!.status).toBe('accepted');
  });

  it('updateADRStatus transitions accepted → deprecated', () => {
    addADR({ id: 'ADR-001', statement: 'stmt', rationale: 'why', context: 'ctx', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');
    const updated = updateADRStatus('ADR-001', 'deprecated', 'No longer relevant');
    expect(updated).toBe(true);
    const adr = getADR('ADR-001');
    expect(adr!.status).toBe('deprecated');
    expect(adr!.deprecatedReason).toBe('No longer relevant');
  });

  it('supersedeADR links old ADR to new one', () => {
    addADR({ id: 'ADR-001', statement: 'old approach', rationale: 'v1', context: 'ctx', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');
    addADR({ id: 'ADR-002', statement: 'new approach', rationale: 'v2', context: 'ctx', taskId: 't2' });
    updateADRStatus('ADR-002', 'accepted');
    const ok = supersedeADR('ADR-001', 'ADR-002');
    expect(ok).toBe(true);
    const old = getADR('ADR-001');
    expect(old!.status).toBe('superseded');
    expect(old!.supersededBy).toBe('ADR-002');
  });

  it('getActiveADRs returns only accepted ADRs', () => {
    addADR({ id: 'ADR-001', statement: 'a', rationale: 'r', context: 'c', taskId: 't1' });
    addADR({ id: 'ADR-002', statement: 'b', rationale: 'r', context: 'c', taskId: 't1' });
    addADR({ id: 'ADR-003', statement: 'c', rationale: 'r', context: 'c', taskId: 't1' });
    updateADRStatus('ADR-001', 'accepted');
    updateADRStatus('ADR-002', 'accepted');
    // ADR-003 stays proposed
    const active = getActiveADRs();
    expect(active.length).toBe(2);
    expect(active.map(a => a.id)).toEqual(['ADR-001', 'ADR-002']);
  });

  it('getADR returns undefined for non-existent ADR', () => {
    expect(getADR('ADR-999')).toBeUndefined();
  });

  it('updateADRStatus returns false for non-existent ADR', () => {
    expect(updateADRStatus('ADR-999', 'accepted')).toBe(false);
  });
});
