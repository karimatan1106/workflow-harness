/**
 * Query handlers: get_test_info, record_known_bug, get_known_bugs,
 * get_subphase_template, pre_validate, update_ac_status, update_rtm_status.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { StateManager } from '../../state/manager.js';
import type { PhaseName, ControlLevel } from '../../state/types.js';
import { runDoDChecks } from '../../gates/dod.js';
import { PHASE_REGISTRY } from '../../phases/registry.js';
import { buildSubagentPrompt, getPhaseDefinition } from '../../phases/definitions.js';
import { buildRetryPrompt, type RetryContext } from '../retry.js';
import { respond, respondError, validateSession, type HandlerResult } from '../handler-shared.js';

export async function handleHarnessGetTestInfo(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const info = sm.getTestInfo(taskId);
  if (!info) return respondError('Task not found: ' + taskId);
  return respond({ taskId, ...info });
}

export async function handleHarnessRecordKnownBug(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const bug = { testName: String(args.testName ?? ''), description: String(args.description ?? ''), severity: String(args.severity ?? 'medium'), targetPhase: args.targetPhase ? String(args.targetPhase) : undefined, issueUrl: args.issueUrl ? String(args.issueUrl) : undefined };
  if (!bug.testName) return respondError('testName is required');
  if (!bug.description) return respondError('description is required');
  const ok = sm.recordKnownBug(taskId, bug);
  if (!ok) return respondError('Failed to record known bug');
  return respond({ taskId, bug, recorded: true });
}

export async function handleHarnessGetKnownBugs(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const bugs = sm.getKnownBugs(taskId);
  return respond({ taskId, knownBugs: bugs });
}

export async function handleHarnessGetSubphaseTemplate(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const phase = String(args.phase ?? '');
  if (!phase) return respondError('phase is required');
  const taskId = args.taskId ? String(args.taskId) : undefined;
  let taskName = '', docsDir = '', workflowDir = '', userIntent = '';
  if (taskId) {
    const task = sm.loadTask(taskId);
    if (task) { taskName = task.taskName; docsDir = task.docsDir ?? ''; workflowDir = task.workflowDir ?? ''; userIntent = task.userIntent ?? ''; }
  }
  const phaseDef = getPhaseDefinition(phase);
  const registryDef = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!phaseDef && !registryDef) return respondError('No definition found for phase: ' + phase);
  const prompt = phaseDef
    ? buildSubagentPrompt(phase, taskName || '{taskName}', docsDir || '{docsDir}', workflowDir || '{workflowDir}', userIntent || '{userIntent}', taskId)
    : '# ' + phase + ' phase\n\nNo subagent template defined. Use phase registry for configuration.';
  return respond({
    phase,
    model: phaseDef?.model ?? registryDef?.model ?? 'sonnet',
    subagentTemplate: prompt,
  });
}

export async function handleHarnessPreValidate(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  if (!taskId) return respondError('taskId is required');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const docsDir: string = task.docsDir ?? ('docs/workflows/' + task.taskName);
  const dodResult = await runDoDChecks(task, docsDir);
  let retryInfo: { retryPrompt: string; suggestModelEscalation: boolean; suggestedModel: string } | undefined;
  if (!dodResult.passed) {
    const retryCount = Number(args.retryCount ?? 1);
    const phaseDef = getPhaseDefinition(task.phase);
    const retryCtx: RetryContext = { phase: task.phase, taskName: task.taskName, docsDir, retryCount, errorMessage: dodResult.errors.join('\n'), model: (phaseDef?.model ?? 'sonnet') as 'opus' | 'sonnet' | 'haiku' };
    const retryResult = buildRetryPrompt(retryCtx);
    retryInfo = { retryPrompt: retryResult.prompt, suggestModelEscalation: retryResult.suggestModelEscalation, suggestedModel: retryResult.suggestedModel };
  }
  return respond({ phase: task.phase, passed: dodResult.passed, ...(dodResult.passed ? {} : { checks: dodResult.checks, errors: dodResult.errors }), ...(retryInfo ? { retry: retryInfo } : {}) });
}

export async function handleHarnessUpdateAcStatus(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const id = String(args.id ?? '');
  const status = String(args.status ?? '') as 'open' | 'met' | 'not_met';
  if (!taskId) return respondError('taskId is required');
  if (!id) return respondError('id is required');
  if (!['open', 'met', 'not_met'].includes(status)) return respondError('status must be one of: open, met, not_met');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const testCaseId = args.testCaseId ? String(args.testCaseId) : undefined;
  const ok = sm.updateAcceptanceCriterionStatus(taskId, id, status, testCaseId);
  if (!ok) return respondError('Failed to update AC status. AC id "' + id + '" may not exist on task: ' + taskId);
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L3' as ControlLevel, check: 'AC status updated: ' + id + ' -> ' + status, result: true, evidence: 'AC ' + id + ' status set to ' + status + (testCaseId ? ' (testCaseId: ' + testCaseId + ')' : ''), timestamp: new Date().toISOString() });
  return respond({ taskId, id, status, testCaseId, updated: true });
}

export async function handleHarnessUpdateRtmStatus(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult> {
  const taskId = String(args.taskId ?? '');
  const id = String(args.id ?? '');
  const status = String(args.status ?? '') as 'pending' | 'implemented' | 'tested' | 'verified';
  if (!taskId) return respondError('taskId is required');
  if (!id) return respondError('id is required');
  if (!['pending', 'implemented', 'tested', 'verified'].includes(status)) return respondError('status must be one of: pending, implemented, tested, verified');
  const task = sm.loadTask(taskId);
  if (!task) return respondError('Task not found: ' + taskId);
  const sessionErr = validateSession(task, args.sessionToken);
  if (sessionErr) return respondError(sessionErr);
  const codeRef = args.codeRef ? String(args.codeRef) : undefined;
  const testRef = args.testRef ? String(args.testRef) : undefined;
  const ok = sm.updateRTMEntryStatus(taskId, id, status, codeRef, testRef);
  if (!ok) return respondError('Failed to update RTM status. RTM id "' + id + '" may not exist on task: ' + taskId);
  sm.addProof(taskId, { phase: task.phase as PhaseName, level: 'L3' as ControlLevel, check: 'RTM status updated: ' + id + ' -> ' + status, result: true, evidence: 'RTM ' + id + ' status set to ' + status + (codeRef ? ' (codeRef: ' + codeRef + ')' : '') + (testRef ? ' (testRef: ' + testRef + ')' : ''), timestamp: new Date().toISOString() });
  return respond({ taskId, id, status, codeRef, testRef, updated: true });
}
