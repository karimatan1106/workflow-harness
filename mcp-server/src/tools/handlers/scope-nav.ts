/**
 * Scope and navigation handlers: harness_set_scope, harness_complete_sub, harness_back, harness_reset.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { StateManager } from '../../state/manager.js';
import type { PhaseName, ProofEntry, ControlLevel } from '../../state/types.js';
import { runDoDChecks } from '../../gates/dod.js';
import { PHASE_REGISTRY, PHASE_ORDER } from '../../phases/registry.js';
import { getPhaseDefinition } from '../../phases/definitions.js';
import { buildRetryPrompt, type RetryContext } from '../retry.js';
import { stashFailure, promoteStashedFailure } from '../reflector.js';
import { respond, respondError, validateSession, PARALLEL_GROUPS, PHASE_APPROVAL_GATES, type HandlerResult } from '../handler-shared.js';

/**
 * Returns phases that come AFTER targetPhase in PHASE_ORDER.
 * targetPhase itself is NOT included (rollback target's own approval is preserved).
 * Used by handleHarnessBack cascade to scope approval deletion to downstream phases only.
 */
function phasesAfter(targetPhase: string): string[] {
  const idx = PHASE_ORDER.indexOf(targetPhase as (typeof PHASE_ORDER)[number]);
  if (idx === -1) return [];
  return PHASE_ORDER.slice(idx + 1) as string[];
}

export async function handleHarnessSetScope(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const files = Array.isArray(args.files) ? (args.files as string[]) : [];
  const dirs = Array.isArray(args.dirs) ? (args.dirs as string[]) : [];
  const glob = args.glob ? String(args.glob) : undefined;
  if (files.length === 0 && dirs.length === 0 && !glob) return respondError('At least one file, directory, or glob pattern must be specified');
  const addMode = Boolean(args.addMode ?? false);
  const traits = (args.projectTraits && typeof args.projectTraits === 'object') ? args.projectTraits as Record<string, boolean> : undefined;
  const docPaths = Array.isArray(args.docPaths) ? args.docPaths as string[] : undefined;
  const ok = sm.updateScope(taskId, files, dirs, glob, addMode, traits, docPaths);
  if (!ok) return respondError('Failed to update scope for task: ' + taskId);
  const updatedTask = sm.loadTask(taskId);
  return respond({ taskId, scope: { files, dirs, glob }, phase: updatedTask?.phase });
}

export async function handleHarnessCompleteSub(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const subPhase = String(args.subPhase ?? '');
  const retryCount = Number(args.retryCount ?? 1);
  if (!taskId) return respondError('taskId is required');
  if (!subPhase) return respondError('subPhase is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const docsDir: string = (task as any).docsDir ?? ('docs/workflows/' + task.taskName);
  const subPhaseConfig = PHASE_REGISTRY[subPhase as keyof typeof PHASE_REGISTRY];
  if (subPhaseConfig?.outputFile) {
    const subPhaseState = { ...task, phase: subPhase as PhaseName };
    const dodResult = await runDoDChecks(subPhaseState, docsDir);
    if (!dodResult.passed) {
      const phaseDef = getPhaseDefinition(subPhase);
      const retryCtx: RetryContext = { phase: subPhase, taskName: task.taskName, docsDir, retryCount, errorMessage: dodResult.errors.join('\n'), model: (phaseDef?.model ?? 'sonnet') as 'opus' | 'sonnet' | 'haiku' };
      const retryResult = buildRetryPrompt(retryCtx, dodResult.checks);
      try { stashFailure(taskId, subPhase, dodResult.errors.join('\n'), retryCount); } catch { /* non-blocking */ }
      // PHA-1 (S2-30): After 3+ retries, mark completed sub-phases as rollback candidates
      let pha1Warning: string | undefined;
      if (retryCount >= 3 && task.subPhaseStatus) {
        const completedSubs = Object.entries(task.subPhaseStatus).filter(([, v]) => v.status === 'completed').map(([k]) => k);
        if (completedSubs.length > 0) {
          pha1Warning = `PHA-1: Sub-phase "${subPhase}" failed ${retryCount} times. Rollback candidates: ${completedSubs.join(', ')}. Use harness_back to undo completed sub-phases if needed.`;
          try { sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L4' as ControlLevel, check: 'parallel_rollback_candidate', result: false, evidence: pha1Warning, timestamp: new Date().toISOString() }); } catch { /* non-blocking */ }
        }
      }
      return respond({ error: 'DoD checks failed for sub-phase: ' + subPhase, dodChecks: dodResult.checks, errors: dodResult.errors, retry: { retryPrompt: retryResult.prompt, suggestModelEscalation: retryResult.suggestModelEscalation, suggestedModel: retryResult.suggestedModel }, ...(pha1Warning ? { pha1Warning } : {}) });
    }
  }
  if (retryCount > 1) { try { promoteStashedFailure(taskId, subPhase, retryCount); } catch { /* non-blocking */ } }
  const subResult = sm.completeSubPhase(taskId, subPhase);
  if (!subResult.success) return respondError(subResult.error ?? 'Failed to complete sub-phase: ' + subPhase);
  const proofEntry: ProofEntry = { phase: task.phase as PhaseName, level: 'L1' as ControlLevel, check: 'sub-phase completed: ' + subPhase, result: true, evidence: 'Sub-phase ' + JSON.stringify(subPhase) + ' marked complete at ' + new Date().toISOString(), timestamp: new Date().toISOString() };
  sm.addProof(taskId, proofEntry);
  const groupKey = Object.keys(PARALLEL_GROUPS).find(g => PARALLEL_GROUPS[g].includes(subPhase) || g === task.phase);
  const groupSubPhases = groupKey ? PARALLEL_GROUPS[groupKey] : [];
  const freshTask = sm.loadTask(taskId);
  const completedSubs: string[] = (freshTask as any)?.subPhaseStatus
    ? Object.entries((freshTask as any).subPhaseStatus).filter(([, v]) => (v as any).status === 'completed').map(([k]) => k)
    : [];
  const remaining = groupSubPhases.filter(sp => !completedSubs.includes(sp));
  return respond({ subPhase, completed: true, remainingSubPhases: remaining, allSubPhasesComplete: remaining.length === 0, group: groupKey ?? task.phase });
}

export async function handleHarnessBack(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const targetPhase = String(args.targetPhase ?? '');
  const reason = args.reason ? String(args.reason) : 'No reason provided';
  const cascade = Boolean(args.cascade ?? false);
  if (!taskId) return respondError('taskId is required');
  if (!targetPhase) return respondError('targetPhase is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const previousPhase = task.phase;
  const backResult = sm.goBack(taskId, targetPhase as PhaseName);
  if (!backResult.success) return respondError(backResult.error ?? 'Failed to go back to phase: ' + targetPhase);
  sm.addProof(taskId, { phase: targetPhase as PhaseName, level: 'L4' as ControlLevel, check: 'rollback to ' + targetPhase, result: true, evidence: 'Rollback reason: ' + reason + '. Rolled back from ' + previousPhase, timestamp: new Date().toISOString() });
  if (!cascade) {
    return respond({ taskId, previousPhase, targetPhase, rolledBack: true, reason });
  }
  const cascadeReapproved: string[] = [];
  const cascadeFailed: { phase: string; reason: string }[] = [];
  // deleteApprovals only for gate phases AFTER targetPhase (F-002 / AC-2).
  // targetPhase 自体および以前の approval は保持し、再承認ループを防ぐ。
  const refreshed = sm.loadTask(taskId);
  if (refreshed?.approvals) {
    const gateKeys = new Set(Object.keys(PHASE_APPROVAL_GATES));
    const downstreamGatePhases = phasesAfter(targetPhase).filter((p) => gateKeys.has(p));
    for (const gp of downstreamGatePhases) {
      if (refreshed.approvals[PHASE_APPROVAL_GATES[gp]]) {
        delete refreshed.approvals[PHASE_APPROVAL_GATES[gp]];
        cascadeReapproved.push(gp);
      }
    }
  }
  if (cascadeFailed.length > 0) {
    return respond({ taskId, previousPhase, targetPhase, rolledBack: true, reason, cascadeFailed, cascadeReapproved });
  }
  return respond({ taskId, previousPhase, targetPhase, rolledBack: true, reason, cascadeReapproved });
}

export async function handleHarnessReset(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const reason = args.reason ? String(args.reason) : 'No reason provided';
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const resetResult = sm.resetTask(taskId, 'scope_definition' as PhaseName, reason);
  if (!resetResult.success) return respondError(resetResult.error ?? 'Failed to reset task');
  sm.addProof(taskId, { phase: 'scope_definition' as PhaseName, level: 'L4' as ControlLevel, check: 'reset to scope_definition', result: true, evidence: 'Reset reason: ' + reason + '. Reset from ' + task.phase, timestamp: new Date().toISOString() });
  return respond({ taskId, previousPhase: task.phase, targetPhase: 'scope_definition', reset: true, reason });
}
