/**
 * StateManager extension: invariant operations + moved utility methods.
 * @spec docs/workflows/inv-n-proof-tier/spec.md
 */

import type { Invariant, InvariantStatus } from './types-invariant.js';
import type { TaskState } from './types.js';

/** Add an invariant to TaskState. Returns false if duplicate id. */
export function applyAddInvariant(state: TaskState, invariant: Invariant): boolean {
  if (!state.invariants) state.invariants = [];
  if (state.invariants.some(inv => inv.id === invariant.id)) return false;
  state.invariants.push(invariant);
  return true;
}

/** Update invariant status. Returns false if not found. */
export function applyUpdateInvariantStatus(
  state: TaskState, invId: string, status: InvariantStatus, evidence?: string,
): boolean {
  if (!state.invariants) return false;
  const inv = state.invariants.find(i => i.id === invId);
  if (!inv) return false;
  inv.status = status;
  if (evidence) inv.evidence = evidence;
  if (status === 'held' || status === 'violated') inv.verifiedAt = new Date().toISOString();
  return true;
}

/** Get known bugs for a task. */
export function applyGetKnownBugs(state: TaskState): Array<{ testName: string; description: string; severity: string; targetPhase?: string; issueUrl?: string; recordedAt: string }> {
  return state.knownBugs ?? [];
}

/** Increment retry count for a phase. Returns new count or -1 on error. */
export function applyIncrementRetryCount(state: TaskState, phase: string): number {
  if (!state.retryCount) state.retryCount = {};
  state.retryCount[phase] = (state.retryCount[phase] ?? 0) + 1;
  return state.retryCount[phase];
}

/** Get retry count for a phase. */
export function applyGetRetryCount(state: TaskState, phase: string): number {
  return state.retryCount?.[phase] ?? 0;
}

/** Reset retry count for a phase. Returns true if count existed. */
export function applyResetRetryCount(state: TaskState, phase: string): boolean {
  if (!state.retryCount?.[phase]) return false;
  delete state.retryCount[phase];
  return true;
}

export function applyBumpCheckStreak(state: TaskState, phase: string, checkName: string): TaskState {
  const streak = state.checkFailureStreak ?? {};
  const cur = streak[phase];
  const newEntry = cur && cur.checkName === checkName
    ? { checkName, count: cur.count + 1 }
    : { checkName, count: 1 };
  return { ...state, checkFailureStreak: { ...streak, [phase]: newEntry } };
}

export function applyClearCheckStreak(state: TaskState, phase: string): TaskState {
  if (!state.checkFailureStreak || !(phase in state.checkFailureStreak)) return state;
  const next = { ...state.checkFailureStreak };
  delete next[phase];
  return { ...state, checkFailureStreak: next };
}

/** Record artifact hash. */
export function applyRecordArtifactHash(state: TaskState, fp: string, hash: string): void {
  if (!state.artifactHashes) state.artifactHashes = {};
  state.artifactHashes[fp] = hash;
}
