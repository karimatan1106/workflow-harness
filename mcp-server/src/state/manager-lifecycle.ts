/**
 * StateManager extension: phase lifecycle operations (advance, back, reset, approve, complete).
 * @spec docs/spec/features/workflow-harness.md
 */

import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { TaskState, PhaseName } from './types.js';
import { PHASE_REGISTRY, getNextPhase } from '../phases/registry.js';
import { loadTaskFromDisk } from './manager-read.js';
import { signAndPersist, writeTaskIndex, updateCheckpoint } from './manager-write.js';
import { writeProgressJSON } from './progress-json.js';
import { getProjectRoot } from '../utils/project-root.js';

const DEFAULT_ALLOWED_TOOLS = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'];
const DEFAULT_ALLOWED_EXTENSIONS = ['.toon', '.md'];

/**
 * Write allowed tools and extensions for the given phase to .agent/.worker-allowed-*.
 * Non-blocking — errors are silently ignored.
 */
export function writeAllowedToolsFile(phase: PhaseName): void {
  const config = PHASE_REGISTRY[phase];
  const tools = config?.allowedTools ?? DEFAULT_ALLOWED_TOOLS;
  const extensions = config?.allowedExtensions ?? DEFAULT_ALLOWED_EXTENSIONS;
  const dir = join(getProjectRoot(), '.agent');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.worker-allowed-tools'), tools.join(','), 'utf8');
  writeFileSync(join(dir, '.worker-allowed-extensions'), extensions.join(','), 'utf8');
}

type PhaseResult = { success: boolean; nextPhase?: PhaseName; error?: string };
type GateResult = { success: boolean; error?: string };

function loadOrFail(taskId: string): TaskState | GateResult {
  const state = loadTaskFromDisk(taskId);
  if (!state) return { success: false, error: 'Task not found or HMAC verification failed' };
  return state;
}

function isError(result: TaskState | GateResult): result is GateResult {
  return 'success' in result;
}

export function advancePhase(taskId: string, hmacKey: string): PhaseResult {
  const result = loadOrFail(taskId);
  if (isError(result)) return result;
  const state = result;

  if (state.integrityWarning) {
    return { success: false, error: 'Task has integrity warning — write operations blocked. Re-sign or reset HMAC keys.' };
  }
  const nextPhase = getNextPhase(state.phase, state.size, state.mode);
  if (!nextPhase) return { success: false, error: 'No next phase available' };

  const prevPhase = state.phase;
  state.completedPhases.push(state.phase);
  state.phase = nextPhase;
  state.updatedAt = new Date().toISOString();
  updateCheckpoint(state, nextPhase);
  signAndPersist(state, hmacKey);
  writeTaskIndex();
  try { writeProgressJSON(state, prevPhase, nextPhase); } catch { /* non-blocking */ }
  try { writeAllowedToolsFile(nextPhase); } catch { /* non-blocking */ }
  return { success: true, nextPhase };
}

export function approveGate(taskId: string, hmacKey: string, approvalType: string): GateResult {
  const result = loadOrFail(taskId);
  if (isError(result)) return result;
  const state = result;

  if (state.integrityWarning) {
    return { success: false, error: 'Task has integrity warning — write operations blocked.' };
  }
  if (!state.approvals) state.approvals = {};
  state.approvals[approvalType] = { approvedAt: new Date().toISOString() };
  state.updatedAt = new Date().toISOString();
  signAndPersist(state, hmacKey);
  writeTaskIndex();
  return { success: true };
}

export function completeSubPhase(taskId: string, hmacKey: string, subPhase: string): GateResult {
  const result = loadOrFail(taskId);
  if (isError(result)) return result;
  const state = result;

  if (!state.subPhaseStatus) state.subPhaseStatus = {};
  if (state.subPhaseStatus[subPhase]?.status === 'completed') {
    return { success: false, error: `Sub-phase "${subPhase}" is already completed (PCM-1)` };
  }
  const phaseConfig = PHASE_REGISTRY[subPhase as PhaseName];
  if (phaseConfig?.dependencies?.length) {
    for (const dep of phaseConfig.dependencies) {
      const ds = state.subPhaseStatus[dep];
      if (!ds || ds.status !== 'completed') {
        return { success: false, error: `Dependency "${dep}" must be completed before "${subPhase}"` };
      }
    }
  }
  state.subPhaseStatus[subPhase] = {
    name: subPhase, status: 'completed', completedAt: new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();
  signAndPersist(state, hmacKey);
  writeTaskIndex();
  return { success: true };
}

export function goBack(taskId: string, hmacKey: string, targetPhase: PhaseName): GateResult {
  const result = loadOrFail(taskId);
  if (isError(result)) return result;
  const state = result;

  if (state.integrityWarning) {
    return { success: false, error: 'Task has integrity warning — goBack blocked. Use harness_reset to clear state, or re-sign HMAC keys.' };
  }

  const idx = state.completedPhases.indexOf(targetPhase);
  if (idx === -1 && state.phase !== targetPhase) {
    return { success: false, error: 'Target phase was not in completed phases' };
  }
  if (idx !== -1) state.completedPhases = state.completedPhases.slice(0, idx);
  state.phase = targetPhase;
  state.retryCount = {};
  state.artifactHashes = {};
  state.updatedAt = new Date().toISOString();
  updateCheckpoint(state, targetPhase);
  signAndPersist(state, hmacKey);
  writeTaskIndex();
  try { writeAllowedToolsFile(targetPhase); } catch { /* non-blocking */ }
  return { success: true };
}

export function resetTask(
  taskId: string, hmacKey: string, targetPhase: PhaseName, reason: string,
): GateResult {
  const result = loadOrFail(taskId);
  if (isError(result)) return result;
  const state = result;

  state.completedPhases = [];
  state.subPhaseStatus = {};
  state.retryCount = {};
  state.integrityWarning = false;
  state.phase = targetPhase;
  state.updatedAt = new Date().toISOString();
  updateCheckpoint(state, targetPhase);
  if (!state.resetHistory) state.resetHistory = [];
  state.resetHistory.push({ reason, resetAt: state.updatedAt, targetPhase });
  signAndPersist(state, hmacKey);
  writeTaskIndex();
  try { unlinkSync(join(getProjectRoot(), '.agent', '.worker-allowed-tools')); } catch { /* file may not exist */ }
  try { unlinkSync(join(getProjectRoot(), '.agent', '.worker-allowed-extensions')); } catch { /* file may not exist */ }
  return { success: true };
}
