/**
 * Scope and navigation handlers: harness_set_scope, harness_complete_sub, harness_back, harness_reset.
 * @spec docs/spec/features/workflow-harness.md
 */
import { runDoDChecks } from '../../gates/dod.js';
import { PHASE_REGISTRY } from '../../phases/registry.js';
import { getPhaseDefinition } from '../../phases/definitions.js';
import { buildRetryPrompt } from '../retry.js';
import { stashFailure, promoteStashedFailure } from '../reflector.js';
import { respond, respondError, validateSession, PARALLEL_GROUPS } from '../handler-shared.js';
export async function handleHarnessSetScope(args, sm) {
    const taskId = String(args.taskId ?? '');
    if (!taskId)
        return respondError('taskId is required');
    const task = sm.loadTask(taskId);
    if (!task)
        return respondError('Task not found: ' + taskId);
    const sessionErr = validateSession(task, args.sessionToken);
    if (sessionErr)
        return respondError(sessionErr);
    const files = Array.isArray(args.files) ? args.files : [];
    const dirs = Array.isArray(args.dirs) ? args.dirs : [];
    const glob = args.glob ? String(args.glob) : undefined;
    if (files.length === 0 && dirs.length === 0 && !glob)
        return respondError('At least one file, directory, or glob pattern must be specified');
    const addMode = Boolean(args.addMode ?? false);
    const ok = sm.updateScope(taskId, files, dirs, glob, addMode);
    if (!ok)
        return respondError('Failed to update scope for task: ' + taskId);
    const updatedTask = sm.loadTask(taskId);
    return respond({ taskId, scope: { files, dirs, glob }, phase: updatedTask?.phase });
}
export async function handleHarnessCompleteSub(args, sm) {
    const taskId = String(args.taskId ?? '');
    const subPhase = String(args.subPhase ?? '');
    const retryCount = Number(args.retryCount ?? 1);
    if (!taskId)
        return respondError('taskId is required');
    if (!subPhase)
        return respondError('subPhase is required');
    const task = sm.loadTask(taskId);
    if (!task)
        return respondError('Task not found: ' + taskId);
    const sessionErr = validateSession(task, args.sessionToken);
    if (sessionErr)
        return respondError(sessionErr);
    const docsDir = task.docsDir ?? ('docs/workflows/' + task.taskName);
    const subPhaseConfig = PHASE_REGISTRY[subPhase];
    if (subPhaseConfig?.outputFile) {
        const subPhaseState = { ...task, phase: subPhase };
        const dodResult = await runDoDChecks(subPhaseState, docsDir);
        if (!dodResult.passed) {
            const phaseDef = getPhaseDefinition(subPhase);
            const retryCtx = { phase: subPhase, taskName: task.taskName, docsDir, retryCount, errorMessage: dodResult.errors.join('\n'), model: (phaseDef?.model ?? 'sonnet') };
            const retryResult = buildRetryPrompt(retryCtx);
            try {
                stashFailure(taskId, subPhase, dodResult.errors.join('\n'), retryCount);
            }
            catch { /* non-blocking */ }
            // PHA-1 (S2-30): After 3+ retries, mark completed sub-phases as rollback candidates
            let pha1Warning;
            if (retryCount >= 3 && task.subPhaseStatus) {
                const completedSubs = Object.entries(task.subPhaseStatus).filter(([, v]) => v.status === 'completed').map(([k]) => k);
                if (completedSubs.length > 0) {
                    pha1Warning = `PHA-1: Sub-phase "${subPhase}" failed ${retryCount} times. Rollback candidates: ${completedSubs.join(', ')}. Use harness_back to undo completed sub-phases if needed.`;
                    try {
                        sm.addProof(taskId, { phase: task.phase, level: 'L4', check: 'parallel_rollback_candidate', result: false, evidence: pha1Warning, timestamp: new Date().toISOString() });
                    }
                    catch { /* non-blocking */ }
                }
            }
            return respond({ error: 'DoD checks failed for sub-phase: ' + subPhase, dodChecks: dodResult.checks, errors: dodResult.errors, retry: { retryPrompt: retryResult.prompt, suggestModelEscalation: retryResult.suggestModelEscalation, suggestedModel: retryResult.suggestedModel }, ...(pha1Warning ? { pha1Warning } : {}) });
        }
    }
    if (retryCount > 1) {
        try {
            promoteStashedFailure(taskId, subPhase, retryCount);
        }
        catch { /* non-blocking */ }
    }
    const subResult = sm.completeSubPhase(taskId, subPhase);
    if (!subResult.success)
        return respondError(subResult.error ?? 'Failed to complete sub-phase: ' + subPhase);
    const proofEntry = { phase: task.phase, level: 'L1', check: 'sub-phase completed: ' + subPhase, result: true, evidence: 'Sub-phase ' + JSON.stringify(subPhase) + ' marked complete at ' + new Date().toISOString(), timestamp: new Date().toISOString() };
    sm.addProof(taskId, proofEntry);
    const groupKey = Object.keys(PARALLEL_GROUPS).find(g => PARALLEL_GROUPS[g].includes(subPhase) || g === task.phase);
    const groupSubPhases = groupKey ? PARALLEL_GROUPS[groupKey] : [];
    const freshTask = sm.loadTask(taskId);
    const completedSubs = freshTask?.subPhaseStatus
        ? Object.entries(freshTask.subPhaseStatus).filter(([, v]) => v.status === 'completed').map(([k]) => k)
        : [];
    const remaining = groupSubPhases.filter(sp => !completedSubs.includes(sp));
    return respond({ subPhase, completed: true, remainingSubPhases: remaining, allSubPhasesComplete: remaining.length === 0, group: groupKey ?? task.phase });
}
export async function handleHarnessBack(args, sm) {
    const taskId = String(args.taskId ?? '');
    const targetPhase = String(args.targetPhase ?? '');
    const reason = args.reason ? String(args.reason) : 'No reason provided';
    if (!taskId)
        return respondError('taskId is required');
    if (!targetPhase)
        return respondError('targetPhase is required');
    const task = sm.loadTask(taskId);
    if (!task)
        return respondError('Task not found: ' + taskId);
    const sessionErr = validateSession(task, args.sessionToken);
    if (sessionErr)
        return respondError(sessionErr);
    const backResult = sm.goBack(taskId, targetPhase);
    if (!backResult.success)
        return respondError(backResult.error ?? 'Failed to go back to phase: ' + targetPhase);
    sm.addProof(taskId, { phase: targetPhase, level: 'L4', check: 'rollback to ' + targetPhase, result: true, evidence: 'Rollback reason: ' + reason + '. Rolled back from ' + task.phase, timestamp: new Date().toISOString() });
    return respond({ taskId, previousPhase: task.phase, targetPhase, rolledBack: true, reason });
}
export async function handleHarnessReset(args, sm) {
    const taskId = String(args.taskId ?? '');
    const reason = args.reason ? String(args.reason) : 'No reason provided';
    if (!taskId)
        return respondError('taskId is required');
    const task = sm.loadTask(taskId);
    if (!task)
        return respondError('Task not found: ' + taskId);
    const sessionErr = validateSession(task, args.sessionToken);
    if (sessionErr)
        return respondError(sessionErr);
    const resetResult = sm.resetTask(taskId, 'scope_definition', reason);
    if (!resetResult.success)
        return respondError(resetResult.error ?? 'Failed to reset task');
    sm.addProof(taskId, { phase: 'scope_definition', level: 'L4', check: 'reset to scope_definition', result: true, evidence: 'Reset reason: ' + reason + '. Reset from ' + task.phase, timestamp: new Date().toISOString() });
    return respond({ taskId, previousPhase: task.phase, targetPhase: 'scope_definition', reset: true, reason });
}
//# sourceMappingURL=scope-nav.js.map