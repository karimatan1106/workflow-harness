/**
 * StateManager — thin orchestrator delegating to specialized modules:
 *   manager-read, manager-write, manager-lifecycle, manager-records, manager-invariant
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, PhaseName, TaskSize, AcceptanceCriterion, RTMEntry, ProofEntry } from './types.js';
import type { Invariant, InvariantStatus } from './types-invariant.js';
import { ensureHmacKeys } from '../utils/hmac.js';
import { loadTaskFromDisk, listTasksFromDisk, gcAbandonedTasks } from './manager-read.js';
import {
  persistState, ensureStateDirs, writeTaskIndex, createTaskState, signAndPersist,
  applyAddAC, applyAddRTM, applyUpdateACStatus, applyUpdateRTMStatus,
} from './manager-write.js';
import {
  advancePhase as doAdvance, approveGate as doApprove, completeSubPhase as doComplete,
  goBack as doGoBack, resetTask as doReset,
} from './manager-lifecycle.js';
import {
  applyAddInvariant, applyUpdateInvariantStatus, applyGetKnownBugs,
  applyIncrementRetryCount, applyGetRetryCount, applyResetRetryCount, applyRecordArtifactHash,
  applyBumpCheckStreak, applyClearCheckStreak,
} from './manager-invariant.js';
import {
  applyRecordFeedback, applyRecordBaseline, applyRecordTestResult,
  applyAddProof, applyRecordTestFile, applyRecordKnownBug, applySetRefinedIntent,
} from './manager-records.js';

function getStateDir(): string {
  return process.env.STATE_DIR || '.claude/state';
}

/** Shared load→mutate→sign→persist pattern. Returns false if task not found or fn returns false. */
function withTask(
  taskId: string, hmacKey: string, fn: (s: TaskState) => boolean | void, index = false,
): boolean {
  const state = loadTaskFromDisk(taskId);
  if (!state) return false;
  if (fn(state) === false) return false;
  state.updatedAt = new Date().toISOString();
  signAndPersist(state, hmacKey);
  if (index) writeTaskIndex();
  return true;
}

export class StateManager {
  private hmacKey: string;
  constructor() { this.hmacKey = ensureHmacKeys(getStateDir()); }

  createTask(taskName: string, userIntent: string, files: string[] = [], dirs: string[] = [], size?: TaskSize): TaskState {
    const state = createTaskState(taskName, userIntent, this.hmacKey, files, dirs, size);
    persistState(state);
    ensureStateDirs(state);
    writeTaskIndex();
    return state;
  }

  loadTask(taskId: string): TaskState | null {
    return loadTaskFromDisk(taskId);
  }

  /** Sign and persist an already-loaded TaskState (for in-place mutations). */
  saveTask(state: TaskState): void {
    state.updatedAt = new Date().toISOString();
    signAndPersist(state, this.hmacKey);
  }

  // Lifecycle delegates (→ manager-lifecycle.ts)
  advancePhase(taskId: string) { return doAdvance(taskId, this.hmacKey); }
  approveGate(taskId: string, approvalType: string) { return doApprove(taskId, this.hmacKey, approvalType); }
  completeSubPhase(taskId: string, subPhase: string) { return doComplete(taskId, this.hmacKey, subPhase); }
  goBack(taskId: string, targetPhase: PhaseName) { return doGoBack(taskId, this.hmacKey, targetPhase); }
  resetTask(taskId: string, targetPhase: PhaseName, reason: string) { return doReset(taskId, this.hmacKey, targetPhase, reason); }

  listTasks(): Array<{ taskId: string; taskName: string; phase: PhaseName; size: TaskSize }> {
    return listTasksFromDisk();
  }

  gcAbandonedTasks(): number { return gcAbandonedTasks(); }

  updateScope(
    taskId: string, files: string[], dirs: string[], glob?: string,
    addMode = false, projectTraits?: Record<string, boolean>, docPaths?: string[],
  ): boolean {
    return withTask(taskId, this.hmacKey, state => {
      if (addMode) {
        state.scopeFiles = [...new Set([...state.scopeFiles, ...files])];
        state.scopeDirs = [...new Set([...state.scopeDirs, ...dirs])];
      } else {
        state.scopeFiles = files;
        state.scopeDirs = dirs;
      }
      if (glob) state.scopeGlob = glob;
      if (projectTraits) (state as any).projectTraits = projectTraits;
      if (docPaths) (state as any).docPaths = docPaths;
    });
  }

  // AC / RTM delegates (→ manager-write.ts)
  addAcceptanceCriterion(taskId: string, criterion: AcceptanceCriterion): boolean {
    return withTask(taskId, this.hmacKey, s => { applyAddAC(s, criterion); });
  }
  addRTMEntry(taskId: string, entry: RTMEntry): boolean {
    return withTask(taskId, this.hmacKey, s => { applyAddRTM(s, entry); });
  }
  updateAcceptanceCriterionStatus(
    taskId: string, acId: string, status: 'open' | 'met' | 'not_met', testCaseId?: string,
  ): boolean {
    return withTask(taskId, this.hmacKey, s => applyUpdateACStatus(s, acId, status, testCaseId), true);
  }
  updateRTMEntryStatus(
    taskId: string, rtmId: string, status: 'pending' | 'implemented' | 'tested' | 'verified',
    codeRef?: string, testRef?: string,
  ): boolean {
    return withTask(taskId, this.hmacKey, s => applyUpdateRTMStatus(s, rtmId, status, codeRef, testRef), true);
  }

  // Recording delegates (→ manager-records.ts)
  recordFeedback(taskId: string, feedback: string): boolean {
    return withTask(taskId, this.hmacKey, s => applyRecordFeedback(s, feedback));
  }
  recordBaseline(taskId: string, totalTests: number, passedTests: number, failedTests: string[]): boolean {
    return withTask(taskId, this.hmacKey, s => { applyRecordBaseline(s, totalTests, passedTests, failedTests); });
  }
  recordTestResult(taskId: string, exitCode: number, output: string, summary?: string, failedTests?: string[]): boolean {
    return withTask(taskId, this.hmacKey, s => { applyRecordTestResult(s, exitCode, output, summary, failedTests); });
  }
  addProof(taskId: string, entry: ProofEntry): boolean {
    return withTask(taskId, this.hmacKey, s => { applyAddProof(s, entry); });
  }
  recordTestFile(taskId: string, testFile: string): boolean {
    return withTask(taskId, this.hmacKey, s => { applyRecordTestFile(s, testFile); });
  }
  recordKnownBug(
    taskId: string,
    bug: { testName: string; description: string; severity: string; targetPhase?: string; issueUrl?: string },
  ): boolean {
    return withTask(taskId, this.hmacKey, s => { applyRecordKnownBug(s, bug); });
  }
  recordArtifactHash(taskId: string, fp: string, hash: string): boolean {
    return withTask(taskId, this.hmacKey, s => { applyRecordArtifactHash(s, fp, hash); });
  }
  setRefinedIntent(taskId: string, refinedIntent: string): boolean {
    return withTask(taskId, this.hmacKey, s => { applySetRefinedIntent(s, refinedIntent); });
  }

  // Invariant delegates (→ manager-invariant.ts)
  addInvariant(taskId: string, invariant: Invariant): boolean {
    return withTask(taskId, this.hmacKey, s => applyAddInvariant(s, invariant));
  }
  updateInvariantStatus(taskId: string, invId: string, status: InvariantStatus, evidence?: string): boolean {
    return withTask(taskId, this.hmacKey, s => applyUpdateInvariantStatus(s, invId, status, evidence));
  }

  // Query / retry (read-only or special return types)
  getTestInfo(taskId: string): { testFiles: string[]; baseline: TaskState['baseline'] | null } | null {
    const s = this.loadTask(taskId);
    return s ? { testFiles: s.testFiles ?? [], baseline: s.baseline ?? null } : null;
  }
  getKnownBugs(taskId: string) {
    const s = this.loadTask(taskId);
    return s ? applyGetKnownBugs(s) : [];
  }
  getRetryCount(taskId: string, phase: string): number {
    const s = this.loadTask(taskId);
    return s ? applyGetRetryCount(s, phase) : 0;
  }

  incrementRetryCount(taskId: string, phase: string): number {
    const s = this.loadTask(taskId);
    if (!s) return -1;
    const count = applyIncrementRetryCount(s, phase);
    s.updatedAt = new Date().toISOString();
    signAndPersist(s, this.hmacKey);
    return count;
  }

  resetRetryCount(taskId: string, phase: string): void {
    const s = this.loadTask(taskId);
    if (!s) return;
    if (applyResetRetryCount(s, phase)) {
      s.updatedAt = new Date().toISOString();
      signAndPersist(s, this.hmacKey);
    }
  }

  bumpCheckStreak(taskId: string, phase: string, checkName: string): void {
    const s = this.loadTask(taskId);
    if (!s) return;
    const next = applyBumpCheckStreak(s, phase, checkName);
    next.updatedAt = new Date().toISOString();
    signAndPersist(next, this.hmacKey);
  }

  clearCheckStreak(taskId: string, phase: string): void {
    const s = this.loadTask(taskId);
    if (!s) return;
    const next = applyClearCheckStreak(s, phase);
    next.updatedAt = new Date().toISOString();
    signAndPersist(next, this.hmacKey);
  }

  getCheckStreak(taskId: string, phase: string): { checkName: string; count: number } | undefined {
    const s = this.loadTask(taskId);
    return s?.checkFailureStreak?.[phase];
  }
}
