/**
 * StateManager — thin orchestrator delegating to manager-read / manager-write
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, PhaseName, TaskSize, AcceptanceCriterion, RTMEntry, ProofEntry } from './types.js';
import type { Invariant, InvariantStatus } from './types-invariant.js';
import { ensureHmacKeys } from '../utils/hmac.js';
import { PHASE_REGISTRY, getNextPhase } from '../phases/registry.js';
import { loadTaskFromDisk, listTasksFromDisk } from './manager-read.js';
import {
  persistState, ensureStateDirs, writeTaskIndex, createTaskState, signAndPersist,
  updateCheckpoint, applyAddAC, applyAddRTM, applyUpdateACStatus, applyUpdateRTMStatus,
  appendProgressLog,
} from './manager-write.js';
import { writeProgressJSON } from './progress-json.js';
import {
  applyAddInvariant, applyUpdateInvariantStatus, applyGetKnownBugs,
  applyIncrementRetryCount, applyGetRetryCount, applyResetRetryCount, applyRecordArtifactHash,
} from './manager-invariant.js';

function getStateDir(): string { return process.env.STATE_DIR || '.claude/state'; }

export class StateManager {
  private hmacKey: string;
  constructor() { this.hmacKey = ensureHmacKeys(getStateDir()); }

  createTask(taskName: string, userIntent: string, files: string[] = [], dirs: string[] = []): TaskState {
    const state = createTaskState(taskName, userIntent, this.hmacKey, files, dirs);
    persistState(state); ensureStateDirs(state); writeTaskIndex(); return state;
  }

  loadTask(taskId: string): TaskState | null { return loadTaskFromDisk(taskId); }

  advancePhase(taskId: string): { success: boolean; nextPhase?: PhaseName; error?: string } {
    const state = this.loadTask(taskId);
    if (!state) return { success: false, error: 'Task not found or HMAC verification failed' };
    if (state.integrityWarning) return { success: false, error: 'Task has integrity warning — write operations blocked. Re-sign or reset HMAC keys.' };
    const nextPhase = getNextPhase(state.phase, state.size);
    if (!nextPhase) return { success: false, error: 'No next phase available' };
    const prevPhase = state.phase;
    state.completedPhases.push(state.phase); state.phase = nextPhase;
    state.updatedAt = new Date().toISOString(); updateCheckpoint(state, nextPhase);
    signAndPersist(state, this.hmacKey); writeTaskIndex();
    appendProgressLog(state, prevPhase, nextPhase);
    try { writeProgressJSON(state, prevPhase, nextPhase); } catch { /* non-blocking */ }
    return { success: true, nextPhase };
  }

  approveGate(taskId: string, approvalType: string): { success: boolean; error?: string } {
    const state = this.loadTask(taskId);
    if (!state) return { success: false, error: 'Task not found' };
    if (state.integrityWarning) return { success: false, error: 'Task has integrity warning — write operations blocked.' };
    if (!state.approvals) state.approvals = {};
    state.approvals[approvalType] = { approvedAt: new Date().toISOString() };
    state.updatedAt = new Date().toISOString();
    signAndPersist(state, this.hmacKey); writeTaskIndex(); return { success: true };
  }

  completeSubPhase(taskId: string, subPhase: string): { success: boolean; error?: string } {
    const state = this.loadTask(taskId);
    if (!state) return { success: false, error: 'Task not found' };
    if (!state.subPhaseStatus) state.subPhaseStatus = {};
    if (state.subPhaseStatus[subPhase]?.status === 'completed') return { success: false, error: `Sub-phase "${subPhase}" is already completed (PCM-1)` };
    const phaseConfig = PHASE_REGISTRY[subPhase as PhaseName];
    if (phaseConfig?.dependencies?.length) {
      for (const dep of phaseConfig.dependencies) {
        const ds = state.subPhaseStatus[dep];
        if (!ds || ds.status !== 'completed')
          return { success: false, error: `Dependency "${dep}" must be completed before "${subPhase}"` };
      }
    }
    state.subPhaseStatus[subPhase] = { name: subPhase, status: 'completed', completedAt: new Date().toISOString() };
    state.updatedAt = new Date().toISOString();
    signAndPersist(state, this.hmacKey); writeTaskIndex(); return { success: true };
  }

  goBack(taskId: string, targetPhase: PhaseName): { success: boolean; error?: string } {
    const state = this.loadTask(taskId);
    if (!state) return { success: false, error: 'Task not found' };
    const idx = state.completedPhases.indexOf(targetPhase);
    if (idx === -1 && state.phase !== targetPhase) return { success: false, error: 'Target phase was not in completed phases' };
    if (idx !== -1) state.completedPhases = state.completedPhases.slice(0, idx);
    state.phase = targetPhase; state.retryCount = {}; state.updatedAt = new Date().toISOString();
    updateCheckpoint(state, targetPhase);
    signAndPersist(state, this.hmacKey); writeTaskIndex(); return { success: true };
  }

  resetTask(taskId: string, targetPhase: PhaseName, reason: string): { success: boolean; error?: string } {
    const state = this.loadTask(taskId);
    if (!state) return { success: false, error: 'Task not found' };
    state.completedPhases = []; state.subPhaseStatus = {}; state.retryCount = {}; state.phase = targetPhase;
    state.updatedAt = new Date().toISOString(); updateCheckpoint(state, targetPhase);
    if (!state.resetHistory) state.resetHistory = [];
    state.resetHistory.push({ reason, resetAt: state.updatedAt, targetPhase });
    signAndPersist(state, this.hmacKey); writeTaskIndex(); return { success: true };
  }

  addAcceptanceCriterion(taskId: string, criterion: AcceptanceCriterion): boolean {
    const s = this.loadTask(taskId); if (!s) return false; applyAddAC(s, criterion); signAndPersist(s, this.hmacKey); return true;
  }
  addRTMEntry(taskId: string, entry: RTMEntry): boolean {
    const s = this.loadTask(taskId); if (!s) return false; applyAddRTM(s, entry); signAndPersist(s, this.hmacKey); return true;
  }

  recordFeedback(taskId: string, feedback: string): boolean {
    const s = this.loadTask(taskId); if (!s) return false;
    if (s.integrityWarning) return false;
    if (!s.feedbackLog) s.feedbackLog = [];
    s.feedbackLog.push({ feedback, recordedAt: new Date().toISOString() });
    s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return true;
  }
  recordBaseline(taskId: string, totalTests: number, passedTests: number, failedTests: string[]): boolean {
    const s = this.loadTask(taskId); if (!s) return false;
    s.baseline = { capturedAt: new Date().toISOString(), totalTests, passedTests, failedTests };
    s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return true;
  }

  recordTestResult(taskId: string, exitCode: number, output: string, summary?: string): boolean {
    const state = this.loadTask(taskId);
    if (!state) return false;
    if (!state.testResults) state.testResults = [];
    state.testResults.push({ recordedAt: new Date().toISOString(), phase: state.phase, exitCode, output: output.slice(0, 5000), summary });
    state.updatedAt = new Date().toISOString(); signAndPersist(state, this.hmacKey); return true;
  }

  addProof(taskId: string, entry: ProofEntry): boolean {
    const state = this.loadTask(taskId);
    if (!state) return false;
    state.proofLog.push(entry); state.updatedAt = new Date().toISOString();
    signAndPersist(state, this.hmacKey); return true;
  }

  updateScope(taskId: string, files: string[], dirs: string[], glob?: string, addMode: boolean = false, projectTraits?: Record<string, boolean>): boolean {
    const state = this.loadTask(taskId);
    if (!state) return false;
    if (addMode) {
      state.scopeFiles = [...new Set([...state.scopeFiles, ...files])];
      state.scopeDirs = [...new Set([...state.scopeDirs, ...dirs])];
    } else { state.scopeFiles = files; state.scopeDirs = dirs; }
    if (glob) state.scopeGlob = glob;
    if (projectTraits) (state as any).projectTraits = projectTraits;
    state.updatedAt = new Date().toISOString(); signAndPersist(state, this.hmacKey); return true;
  }

  listTasks(): Array<{ taskId: string; taskName: string; phase: PhaseName; size: TaskSize }> { return listTasksFromDisk(); }

  recordTestFile(taskId: string, testFile: string): boolean {
    const state = this.loadTask(taskId);
    if (!state) return false;
    if (!state.testFiles) state.testFiles = [];
    if (!state.testFiles.includes(testFile)) state.testFiles.push(testFile);
    state.updatedAt = new Date().toISOString(); signAndPersist(state, this.hmacKey); return true;
  }

  getTestInfo(taskId: string): { testFiles: string[]; baseline: TaskState['baseline'] | null } | null {
    const state = this.loadTask(taskId);
    if (!state) return null;
    return { testFiles: state.testFiles ?? [], baseline: state.baseline ?? null };
  }

  updateAcceptanceCriterionStatus(taskId: string, acId: string, status: 'open' | 'met' | 'not_met', testCaseId?: string): boolean {
    const state = this.loadTask(taskId);
    if (!state) return false;
    if (!applyUpdateACStatus(state, acId, status, testCaseId)) return false;
    signAndPersist(state, this.hmacKey); writeTaskIndex(); return true;
  }

  updateRTMEntryStatus(taskId: string, rtmId: string, status: 'pending' | 'implemented' | 'tested' | 'verified', codeRef?: string, testRef?: string): boolean {
    const state = this.loadTask(taskId);
    if (!state) return false;
    if (!applyUpdateRTMStatus(state, rtmId, status, codeRef, testRef)) return false;
    signAndPersist(state, this.hmacKey); writeTaskIndex(); return true;
  }

  recordKnownBug(taskId: string, bug: { testName: string; description: string; severity: string; targetPhase?: string; issueUrl?: string }): boolean {
    const s = this.loadTask(taskId); if (!s) return false; if (!s.knownBugs) s.knownBugs = [];
    s.knownBugs.push({ ...bug, severity: bug.severity as 'low' | 'medium' | 'high' | 'critical', recordedAt: new Date().toISOString() });
    s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return true;
  }
  getKnownBugs(taskId: string) { const s = this.loadTask(taskId); return s ? applyGetKnownBugs(s) : []; }
  incrementRetryCount(taskId: string, phase: string): number {
    const s = this.loadTask(taskId); if (!s) return -1;
    const c = applyIncrementRetryCount(s, phase); s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return c;
  }
  getRetryCount(taskId: string, phase: string): number { const s = this.loadTask(taskId); return s ? applyGetRetryCount(s, phase) : 0; }
  resetRetryCount(taskId: string, phase: string): void {
    const s = this.loadTask(taskId); if (!s) return;
    if (applyResetRetryCount(s, phase)) { s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); }
  }
  recordArtifactHash(taskId: string, fp: string, hash: string): boolean {
    const s = this.loadTask(taskId); if (!s) return false; applyRecordArtifactHash(s, fp, hash); s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return true;
  }
  setRefinedIntent(taskId: string, refinedIntent: string): boolean {
    const s = this.loadTask(taskId); if (!s) return false;
    s.refinedIntent = refinedIntent;
    s.updatedAt = new Date().toISOString(); signAndPersist(s, this.hmacKey); return true;
  }
  addInvariant(taskId: string, invariant: Invariant): boolean {
    const s = this.loadTask(taskId); if (!s) return false;
    if (!applyAddInvariant(s, invariant)) return false; signAndPersist(s, this.hmacKey); return true;
  }
  updateInvariantStatus(taskId: string, invId: string, status: InvariantStatus, evidence?: string): boolean {
    const s = this.loadTask(taskId); if (!s) return false;
    if (!applyUpdateInvariantStatus(s, invId, status, evidence)) return false; signAndPersist(s, this.hmacKey); return true;
  }
}
