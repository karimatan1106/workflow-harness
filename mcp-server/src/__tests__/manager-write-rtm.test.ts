/**
 * AC-3: RTM upsert — applyAddRTM should upsert (push new, overwrite existing).
 * TDD Red: TC-AC3-02 expected to fail (current code only pushes).
 */

import { describe, it, expect } from 'vitest';
import type { TaskState, RTMEntry } from '../state/types.js';
import { applyAddRTM, applyUpdateRTMStatus } from '../state/manager-write.js';

function createMinimalState(): TaskState {
  return {
    taskId: 'test-rtm-upsert', taskName: 'rtm-test', version: 4,
    phase: 'scope_definition', completedPhases: [], skippedPhases: [],
    size: 'large', riskScore: { total: 8, factors: { fileCount: 0, hasTests: false, hasConfig: false, hasInfra: false, hasSecurity: false, hasDatabase: false, codeLineEstimate: 0 } },
    userIntent: 'Test RTM upsert behavior with sufficient length text for validation.',
    openQuestions: [], notInScope: [], scopeFiles: [], scopeDirs: [], plannedFiles: [],
    acceptanceCriteria: [], rtmEntries: [], proofLog: [], invariants: [],
    checkpoint: { taskId: 'test-rtm-upsert', phase: 'scope_definition', completedPhases: [], timestamp: '', sha256: '', userIntent: '', scopeFiles: [], scopeDirs: [], acceptanceCriteria: [], rtmEntries: [] },
    docsDir: 'docs/test', workflowDir: '.claude/state/workflows/test',
    sessionToken: 'tok', stateIntegrity: '', createdAt: '', updatedAt: '',
  } as TaskState;
}

function makeEntry(id: string, req: string): RTMEntry {
  return { id, requirement: req, status: 'pending' };
}

describe('AC-3: applyAddRTM upsert', () => {
  it('TC-AC3-01: new ID is pushed to rtmEntries', () => {
    const state = createMinimalState();
    applyAddRTM(state, makeEntry('F-010', 'New requirement'));
    expect(state.rtmEntries).toHaveLength(1);
    expect(state.rtmEntries[0].id).toBe('F-010');
    expect(state.rtmEntries[0].requirement).toBe('New requirement');
  });

  it('TC-AC3-02: existing ID is overwritten, array length unchanged', () => {
    const state = createMinimalState();
    applyAddRTM(state, makeEntry('F-001', 'Original'));
    applyAddRTM(state, makeEntry('F-002', 'Other'));
    expect(state.rtmEntries).toHaveLength(2);

    applyAddRTM(state, makeEntry('F-001', 'Updated value'));
    expect(state.rtmEntries).toHaveLength(2);
    const entry = state.rtmEntries.find(e => e.id === 'F-001');
    expect(entry!.requirement).toBe('Updated value');
  });

  it('TC-AC3-03: upserted entry works with applyUpdateRTMStatus', () => {
    const state = createMinimalState();
    applyAddRTM(state, makeEntry('F-001', 'Original'));
    applyAddRTM(state, makeEntry('F-001', 'After upsert'));

    const ok = applyUpdateRTMStatus(state, 'F-001', 'implemented', 'src/x.ts');
    expect(ok).toBe(true);
    const entry = state.rtmEntries.find(e => e.id === 'F-001');
    expect(entry!.status).toBe('implemented');
    expect(entry!.codeRef).toBe('src/x.ts');
  });
});
